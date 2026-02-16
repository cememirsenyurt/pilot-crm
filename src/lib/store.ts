/**
 * Server-side persistent CRM store.
 * Data is kept in memory and synced to a JSON file on disk.
 * This persists across page refreshes within a deployment.
 * On cold start (new deploy / instance restart), seeds from defaults.
 */

import * as fs from "fs";
import {
  type Account,
  type CallRecord,
  type Activity,
  type Stage,
  type PipelineStats,
  SEED_ACCOUNTS,
  SEED_CALL_RECORDS,
  SEED_ACTIVITIES,
} from "./data";

const DATA_FILE = "/tmp/pilotcrm-data.json";

// ── Valid stages ──────────────────────────────────────────────

const VALID_STAGES: Stage[] = [
  "lead",
  "discovery",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];

// ── ID generator ──────────────────────────────────────────────

let _counter = Date.now();
function uid(): string {
  return `s-${++_counter}`;
}

// ── Store shape ───────────────────────────────────────────────

interface StoreData {
  accounts: Account[];
  callRecords: CallRecord[];
  activities: Activity[];
}

// ── Load / Save ───────────────────────────────────────────────

function loadStore(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw) as StoreData;
      if (parsed.accounts?.length) {
        /* Clean up any accounts with invalid stages from previous bugs */
        for (const acct of parsed.accounts) {
          if (!VALID_STAGES.includes(acct.stage as Stage)) {
            console.warn(
              `[store] Account "${acct.company}" had invalid stage "${acct.stage}", resetting to "lead"`,
            );
            acct.stage = "lead";
          }
        }
        /* Clean up activity messages that say "→ undefined" */
        parsed.activities = parsed.activities.filter(
          (a) => !a.message.includes("→ undefined"),
        );
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[store] Failed to load from file, using seed data:", err);
  }
  return {
    accounts: JSON.parse(JSON.stringify(SEED_ACCOUNTS)),
    callRecords: JSON.parse(JSON.stringify(SEED_CALL_RECORDS)),
    activities: JSON.parse(JSON.stringify(SEED_ACTIVITIES)),
  };
}

function persist(): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store));
  } catch (err) {
    console.warn("[store] Failed to persist:", err);
  }
}

// ── Initialize ────────────────────────────────────────────────

const store: StoreData = loadStore();

// ── Query helpers ─────────────────────────────────────────────

export function getAccounts(): Account[] {
  return store.accounts;
}

export function getAccount(id: string): Account | undefined {
  return store.accounts.find((a) => a.id === id);
}

export function getAccountByCompany(name: string): Account | undefined {
  const lower = name.toLowerCase();
  return (
    store.accounts.find((a) => a.company.toLowerCase() === lower) ??
    store.accounts.find((a) => a.company.toLowerCase().includes(lower))
  );
}

export function getCallsByAccount(accountId: string): CallRecord[] {
  return store.callRecords.filter((c) => c.accountId === accountId);
}

export function getAllCalls(): CallRecord[] {
  return store.callRecords;
}

export function getActivitiesByAccount(accountId: string): Activity[] {
  return store.activities
    .filter((a) => a.accountId === accountId)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}

export function getRecentActivities(limit: number): Activity[] {
  return [...store.activities]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, limit);
}

export function getPipelineStats(): PipelineStats {
  const stages: Stage[] = [
    "lead",
    "discovery",
    "proposal",
    "negotiation",
    "closed_won",
    "closed_lost",
  ];

  const countByStage = Object.fromEntries(
    stages.map((s) => [
      s,
      store.accounts.filter((a) => a.stage === s).length,
    ]),
  ) as Record<Stage, number>;

  const valueByStage = Object.fromEntries(
    stages.map((s) => [
      s,
      store.accounts
        .filter((a) => a.stage === s)
        .reduce((sum, a) => sum + a.dealValue, 0),
    ]),
  ) as Record<Stage, number>;

  const active = store.accounts.filter((a) => a.stage !== "closed_lost");
  const totalValue = active.reduce((sum, a) => sum + a.dealValue, 0);

  return {
    totalPipelineValue: totalValue,
    weightedPipelineValue: active.reduce(
      (sum, a) => sum + (a.dealValue * a.likelihood) / 100,
      0,
    ),
    averageDealSize: active.length ? Math.round(totalValue / active.length) : 0,
    averageLikelihood: active.length
      ? Math.round(
          active.reduce((sum, a) => sum + a.likelihood, 0) / active.length,
        )
      : 0,
    totalAccounts: store.accounts.length,
    activeDeals: active.filter((a) => a.stage !== "closed_won").length,
    countByStage,
    valueByStage,
  };
}

// ── Mutation helpers (all persist to disk) ────────────────────

export function updateAccountStage(
  id: string,
  stage: Stage,
): Account | undefined {
  const account = store.accounts.find((a) => a.id === id);
  if (!account) return undefined;

  /* Validate that stage is actually a known stage */
  if (!VALID_STAGES.includes(stage)) {
    console.warn(`[store] Invalid stage "${stage}" — ignoring`);
    return account;
  }

  /* Don't write a no-op stage change */
  if (account.stage === stage) return account;

  const oldStage = account.stage;
  account.stage = stage;

  store.activities.push({
    id: uid(),
    accountId: id,
    type: "stage_change",
    message: `Stage changed from ${fmtStage(oldStage)} → ${fmtStage(stage)}`,
    timestamp: new Date().toISOString(),
  });

  persist();
  return account;
}

export function updateAccountLikelihood(
  id: string,
  likelihood: number,
): Account | undefined {
  const account = store.accounts.find((a) => a.id === id);
  if (!account) return undefined;
  account.likelihood = Math.max(0, Math.min(100, likelihood));
  persist();
  return account;
}

export function addNoteToAccount(
  id: string,
  note: string,
): Account | undefined {
  const account = store.accounts.find((a) => a.id === id);
  if (!account) return undefined;

  account.notes.push(note);

  store.activities.push({
    id: uid(),
    accountId: id,
    type: "note",
    message: note,
    timestamp: new Date().toISOString(),
  });

  persist();
  return account;
}

export function addCallRecord(
  accountId: string,
  record: Omit<CallRecord, "id">,
): CallRecord {
  const newRecord: CallRecord = { ...record, id: uid() };
  store.callRecords.push(newRecord);

  const account = store.accounts.find((a) => a.id === accountId);
  if (account) {
    account.lastContactDate = record.date;
  }

  store.activities.push({
    id: uid(),
    accountId,
    type: "call",
    message: `Call recorded — ${record.outcome} (${Math.round(record.duration / 60)} min)`,
    timestamp: record.date,
  });

  persist();
  return newRecord;
}

export function addActivity(activity: Omit<Activity, "id">): Activity {
  const newActivity: Activity = { ...activity, id: uid() };
  store.activities.push(newActivity);
  persist();
  return newActivity;
}

export function createAccount(data: {
  company: string;
  contactName: string;
  contactEmail: string;
  contactRole: string;
  industry: string;
  dealValue: number;
  notes: string[];
}): Account {
  const newAccount: Account = {
    id: uid(),
    company: data.company,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactRole: data.contactRole,
    plan: "free",
    stage: "lead",
    dealValue: data.dealValue,
    likelihood: 25,
    industry: data.industry,
    notes: data.notes,
    lastContactDate: new Date().toISOString(),
    nextFollowUp: new Date(Date.now() + 3 * 86_400_000)
      .toISOString()
      .split("T")[0],
    tags: ["inbound"],
  };
  store.accounts.push(newAccount);

  store.activities.push({
    id: uid(),
    accountId: newAccount.id,
    type: "note",
    message: `New inbound lead: ${data.company} — ${data.contactName} (${data.contactRole})`,
    timestamp: new Date().toISOString(),
  });

  persist();
  return newAccount;
}

export function deleteAccount(id: string): boolean {
  const idx = store.accounts.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  store.accounts.splice(idx, 1);
  persist();
  return true;
}

export function flagAccountRisk(
  id: string,
  reason: string,
): Account | undefined {
  const account = store.accounts.find((a) => a.id === id);
  if (!account) return undefined;
  if (!account.tags.includes("at-risk")) account.tags.push("at-risk");
  addNoteToAccount(id, `⚠️ AT-RISK: ${reason}`);
  return account;
}

// ── Formatting ────────────────────────────────────────────────

function fmtStage(stage: Stage): string {
  const labels: Record<Stage, string> = {
    lead: "Lead",
    discovery: "Discovery",
    proposal: "Proposal",
    negotiation: "Negotiation",
    closed_won: "Closed Won",
    closed_lost: "Closed Lost",
  };
  return labels[stage] ?? stage;
}
