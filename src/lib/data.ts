/* ═══════════════════════════════════════════════════════════════
   PilotCRM — In-memory mock CRM database
   Shared across dashboard UI, CopilotKit actions, and Vapi calls.
   All arrays are mutable so actions can write back.
   ═══════════════════════════════════════════════════════════════ */

// ── Types ────────────────────────────────────────────────────

export type Plan = "free" | "team" | "enterprise";

export type Stage =
  | "lead"
  | "discovery"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface Sentiment {
  score: number;        // 1-10
  satisfaction: number; // 1-10
  summary: string;
  tags: string[];
}

export interface Account {
  id: string;
  company: string;
  contactName: string;
  contactEmail: string;
  contactRole: string;
  plan: Plan;
  stage: Stage;
  dealValue: number;
  likelihood: number; // 0-100
  industry: string;
  notes: string[];
  lastContactDate: string;   // ISO
  nextFollowUp: string | null; // ISO or null
  tags: string[];
}

export interface CallRecord {
  id: string;
  accountId: string;
  date: string; // ISO
  duration: number; // seconds
  transcript: string;
  sentiment: Sentiment | null;
  outcome: string;
}

export type ActivityType =
  | "call"
  | "email"
  | "note"
  | "stage_change"
  | "meeting";

export interface Activity {
  id: string;
  accountId: string;
  type: ActivityType;
  message: string;
  timestamp: string; // ISO
}

// ── Helpers for relative dates ──────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

let _nextId = 1000;
function uid(): string {
  return String(++_nextId);
}

// ── Accounts ────────────────────────────────────────────────

export const accounts: Account[] = [
  {
    id: "acc-1",
    company: "Meridian Health",
    contactName: "Dr. Sarah Chen",
    contactEmail: "s.chen@meridianhealth.com",
    contactRole: "VP of Engineering",
    plan: "enterprise",
    stage: "negotiation",
    dealValue: 240_000,
    likelihood: 62,
    industry: "Healthcare",
    notes: [
      "200-person dev team, heavily regulated environment.",
      "Main blocker: HIPAA compliance review — legal wants SOC 2 Type II report.",
      "Sarah is an internal champion but needs sign-off from CISO.",
    ],
    lastContactDate: daysAgo(1),
    nextFollowUp: daysFromNow(2),
    tags: ["enterprise"],
  },
  {
    id: "acc-2",
    company: "NovaPay Technologies",
    contactName: "Marcus Rivera",
    contactEmail: "marcus@novapay.io",
    contactRole: "CTO",
    plan: "team",
    stage: "proposal",
    dealValue: 96_000,
    likelihood: 78,
    industry: "Fintech",
    notes: [
      "Series C, 80 devs. Moving fast — wants to close this quarter.",
      "Loved the demo; specifically asked about real-time collaboration features.",
      "Needs a custom SSO integration — scoped at ~2 weeks eng time.",
    ],
    lastContactDate: daysAgo(3),
    nextFollowUp: daysFromNow(5),
    tags: ["high-priority"],
  },
  {
    id: "acc-3",
    company: "BrightLoop Education",
    contactName: "Priya Sharma",
    contactEmail: "priya@brightloop.edu",
    contactRole: "Head of Product",
    plan: "team",
    stage: "discovery",
    dealValue: 24_000,
    likelihood: 85,
    industry: "EdTech",
    notes: [
      "Small team (20 devs) but incredibly enthusiastic.",
      "Already prototyped an integration over a weekend hackathon.",
      "Budget is tight — may need a discount or phased rollout.",
    ],
    lastContactDate: daysAgo(2),
    nextFollowUp: daysFromNow(7),
    tags: [],
  },
  {
    id: "acc-4",
    company: "Atlas Logistics",
    contactName: "Tom Barrett",
    contactEmail: "tbarrett@atlaslogistics.com",
    contactRole: "Director of IT",
    plan: "enterprise",
    stage: "lead",
    dealValue: 144_000,
    likelihood: 35,
    industry: "Supply Chain",
    notes: [
      "60-person dev org. Cold outreach — responded to a LinkedIn message.",
      "Barely engaged. Took two weeks to schedule an intro call.",
      "Legacy stack (Java monolith) — integration could be painful.",
    ],
    lastContactDate: daysAgo(14),
    nextFollowUp: daysFromNow(3),
    tags: ["at-risk"],
  },
  {
    id: "acc-5",
    company: "Vertex AI Labs",
    contactName: "Lena Kowalski",
    contactEmail: "lena@vertexailabs.com",
    contactRole: "CEO",
    plan: "team",
    stage: "closed_won",
    dealValue: 54_000,
    likelihood: 100,
    industry: "AI / ML Tools",
    notes: [
      "45 devs. Signed 6 months ago — our happiest customer.",
      "Using the platform daily for their internal AI workflows.",
      "Expansion conversation started — looking at enterprise tier.",
    ],
    lastContactDate: daysAgo(5),
    nextFollowUp: null,
    tags: [],
  },
  {
    id: "acc-6",
    company: "Cascade Financial",
    contactName: "James Whitfield",
    contactEmail: "j.whitfield@cascadefinancial.com",
    contactRole: "SVP of Digital Transformation",
    plan: "enterprise",
    stage: "proposal",
    dealValue: 360_000,
    likelihood: 50,
    industry: "Banking / Finance",
    notes: [
      "Fortune 500 bank, 300-person engineering org.",
      "Long sales cycle — currently in legal and procurement review.",
      "Need to satisfy their vendor security questionnaire (150+ questions).",
      "James is enthusiastic but has limited influence over legal timeline.",
    ],
    lastContactDate: daysAgo(4),
    nextFollowUp: daysFromNow(10),
    tags: ["enterprise", "high-priority"],
  },
];

// ── Call Records ─────────────────────────────────────────────

export const callRecords: CallRecord[] = [
  // ── Meridian Health ──
  {
    id: "call-1",
    accountId: "acc-1",
    date: daysAgo(1),
    duration: 1260,
    transcript: [
      "Sarah: We're really interested, but our CISO needs the SOC 2 Type II report before he'll sign off.",
      "Rep: Absolutely — I'll have our security team send that over today.",
      "Sarah: Great. Also, can we get a data residency guarantee? Patient data can't leave US-East.",
      "Rep: Yes, we support region-locked deployments. I'll include that in the proposal addendum.",
      "Sarah: Perfect. Let's aim to get this wrapped up by end of month if possible.",
    ].join("\n"),
    sentiment: {
      score: 7,
      satisfaction: 8,
      summary: "Positive intent but blocked by compliance. Needs security docs ASAP.",
      tags: ["compliance", "urgent-blocker", "engaged"],
    },
    outcome: "Sending SOC 2 report and data residency addendum",
  },
  {
    id: "call-2",
    accountId: "acc-1",
    date: daysAgo(8),
    duration: 900,
    transcript: [
      "Sarah: We ran a proof-of-concept last week and the team loved it.",
      "Rep: That's great to hear. Any issues come up during the POC?",
      "Sarah: Minor thing — the audit logging wasn't granular enough for our compliance team.",
      "Rep: Got it. We can configure custom audit events — I'll set up a technical session.",
    ].join("\n"),
    sentiment: {
      score: 8,
      satisfaction: 7,
      summary: "POC went well. Minor audit logging concern being addressed.",
      tags: ["poc-success", "compliance", "technical-follow-up"],
    },
    outcome: "Scheduled technical deep-dive on audit logging",
  },

  // ── NovaPay Technologies ──
  {
    id: "call-3",
    accountId: "acc-2",
    date: daysAgo(3),
    duration: 1080,
    transcript: [
      "Marcus: The pricing looks good. Can you do annual billing with a 10% discount?",
      "Rep: We can offer 15% on a 2-year commitment, or 10% on annual. Let me draft both options.",
      "Marcus: 2-year is aggressive for us, but I'll float it to the board. The 10% annual is probably our sweet spot.",
      "Rep: I'll send the proposal with both scenarios by EOD.",
    ].join("\n"),
    sentiment: {
      score: 9,
      satisfaction: 9,
      summary: "Very engaged, negotiating pricing. Close to signing.",
      tags: ["pricing", "high-intent", "board-approval"],
    },
    outcome: "Sending dual pricing proposal (annual vs 2-year)",
  },
  {
    id: "call-4",
    accountId: "acc-2",
    date: daysAgo(10),
    duration: 720,
    transcript: [
      "Marcus: Your real-time collab feature — does it work with our existing WebSocket infra?",
      "Rep: Yes, we support custom transport layers. I can share our integration guide.",
      "Marcus: That'd be great. Our team is already excited about this.",
    ].join("\n"),
    sentiment: {
      score: 8,
      satisfaction: 9,
      summary: "Technical validation going well. Team already bought in.",
      tags: ["technical", "positive"],
    },
    outcome: "Shared WebSocket integration guide",
  },
  {
    id: "call-5",
    accountId: "acc-2",
    date: daysAgo(18),
    duration: 540,
    transcript: [
      "Marcus: We're evaluating three vendors. What makes you different from Competitor X?",
      "Rep: Two things — our developer experience is significantly better, and we're the only one with native AI copilot support.",
      "Marcus: The AI angle is interesting. Can you show me a demo focused on that?",
    ].join("\n"),
    sentiment: {
      score: 7,
      satisfaction: 7,
      summary: "Competitive eval phase. AI copilot feature is the differentiator.",
      tags: ["competitive", "demo-request"],
    },
    outcome: "Scheduled AI copilot-focused demo",
  },

  // ── BrightLoop Education ──
  {
    id: "call-6",
    accountId: "acc-3",
    date: daysAgo(2),
    duration: 660,
    transcript: [
      "Priya: We built a prototype over the weekend and it already works better than our current tool.",
      "Rep: That's amazing. What did you build?",
      "Priya: A collaborative lesson planner with AI suggestions. Teachers are loving it.",
      "Rep: I'd love to feature that as a case study if you're open to it.",
    ].join("\n"),
    sentiment: {
      score: 9,
      satisfaction: 10,
      summary: "Extremely enthusiastic. Already built a working prototype.",
      tags: ["champion", "case-study-potential", "fast-mover"],
    },
    outcome: "Discussing case study opportunity",
  },
  {
    id: "call-7",
    accountId: "acc-3",
    date: daysAgo(12),
    duration: 480,
    transcript: [
      "Priya: Our budget is limited — is there a startup discount?",
      "Rep: We have a startup program that offers 30% off the first year.",
      "Priya: That would work! Can you send me the application details?",
    ].join("\n"),
    sentiment: {
      score: 7,
      satisfaction: 8,
      summary: "Budget constrained but very willing. Startup program could close the deal.",
      tags: ["budget", "startup-program"],
    },
    outcome: "Sending startup program application",
  },

  // ── Atlas Logistics ──
  {
    id: "call-8",
    accountId: "acc-4",
    date: daysAgo(14),
    duration: 420,
    transcript: [
      "Tom: Look, I'll be honest — we're not actively looking to switch tools right now.",
      "Rep: Totally understand. What prompted you to take the call?",
      "Tom: Our CTO mentioned you at a conference. I'm just doing due diligence.",
      "Rep: Makes sense. Let me send some materials and we can reconnect when timing is better.",
    ].join("\n"),
    sentiment: {
      score: 4,
      satisfaction: 5,
      summary: "Low urgency. Taking the call out of obligation, not intent.",
      tags: ["low-intent", "due-diligence", "cto-referral"],
    },
    outcome: "Sent overview materials; will follow up in 2 weeks",
  },
  {
    id: "call-9",
    accountId: "acc-4",
    date: daysAgo(21),
    duration: 300,
    transcript: [
      "Rep: Hi Tom, thanks for connecting on LinkedIn. Would love to show you how we help logistics companies.",
      "Tom: Sure, keep it brief. We've got a lot on our plate.",
      "Rep: Understood. I'll send a 5-minute overview video instead of a full demo.",
    ].join("\n"),
    sentiment: {
      score: 3,
      satisfaction: 4,
      summary: "Cold outreach. Barely engaged. Prefers async communication.",
      tags: ["cold", "low-engagement"],
    },
    outcome: "Sent 5-minute product overview video",
  },

  // ── Vertex AI Labs ──
  {
    id: "call-10",
    accountId: "acc-5",
    date: daysAgo(5),
    duration: 1320,
    transcript: [
      "Lena: We've been using the platform for 6 months now and the team can't imagine going back.",
      "Rep: That's so great to hear. Any feature requests on your wishlist?",
      "Lena: Multi-tenant workspace support. We're scaling and need better isolation between projects.",
      "Rep: That's on our Q2 roadmap actually. Would you be open to being a design partner?",
      "Lena: Absolutely. Also, we're looking at the enterprise tier for some of our larger clients.",
    ].join("\n"),
    sentiment: {
      score: 10,
      satisfaction: 10,
      summary: "Thrilled customer. Expansion opportunity to enterprise tier.",
      tags: ["happy-customer", "expansion", "design-partner"],
    },
    outcome: "Setting up enterprise tier evaluation + design partnership",
  },
  {
    id: "call-11",
    accountId: "acc-5",
    date: daysAgo(30),
    duration: 780,
    transcript: [
      "Lena: Usage is up 40% month-over-month since we onboarded.",
      "Rep: Incredible growth. Are you hitting any scale issues?",
      "Lena: Nothing major. The API rate limits could be higher for our batch jobs though.",
    ].join("\n"),
    sentiment: {
      score: 9,
      satisfaction: 9,
      summary: "Strong adoption metrics. Minor request for higher rate limits.",
      tags: ["growth", "rate-limits"],
    },
    outcome: "Submitted rate limit increase request",
  },

  // ── Cascade Financial ──
  {
    id: "call-12",
    accountId: "acc-6",
    date: daysAgo(4),
    duration: 1500,
    transcript: [
      "James: Legal is going through the vendor security questionnaire. It's 150 questions.",
      "Rep: We've pre-filled most of it from our last Fortune 500 deal. I'll send you the completed version.",
      "James: That'll save us weeks. The procurement team also needs a W-9 and insurance certificate.",
      "Rep: Both are ready — I'll include them in the same package.",
      "James: Great. I'm pushing for a Q1 close but legal moves at their own pace here.",
    ].join("\n"),
    sentiment: {
      score: 6,
      satisfaction: 7,
      summary: "Willing champion but constrained by slow legal/procurement process.",
      tags: ["legal-review", "procurement", "long-cycle"],
    },
    outcome: "Sending pre-filled security questionnaire + W-9 + insurance cert",
  },
  {
    id: "call-13",
    accountId: "acc-6",
    date: daysAgo(15),
    duration: 1080,
    transcript: [
      "James: We had 12 people on the demo and everyone was impressed.",
      "Rep: Great turnout. Were there any concerns from the group?",
      "James: A few questions about disaster recovery and SLA guarantees. Can you formalize those?",
      "Rep: Absolutely. I'll prepare a custom SLA document for your team.",
    ].join("\n"),
    sentiment: {
      score: 7,
      satisfaction: 8,
      summary: "Strong group demo reception. SLA documentation needed to move forward.",
      tags: ["group-demo", "sla", "positive"],
    },
    outcome: "Preparing custom SLA document",
  },
  {
    id: "call-14",
    accountId: "acc-6",
    date: daysAgo(25),
    duration: 600,
    transcript: [
      "James: I've been looking at your competitors. Your pricing is higher but the feature set is stronger.",
      "Rep: We find that enterprise clients recoup the difference in the first quarter through productivity gains.",
      "James: I believe that. I need hard numbers for the CFO though.",
    ].join("\n"),
    sentiment: {
      score: 6,
      satisfaction: 6,
      summary: "Sees value but needs ROI data for CFO sign-off.",
      tags: ["competitive", "roi", "cfo-sign-off"],
    },
    outcome: "Preparing ROI analysis and case study package",
  },
];

// ── Activities ──────────────────────────────────────────────

export const activities: Activity[] = [
  // ── Meridian Health ──
  { id: "act-1", accountId: "acc-1", type: "stage_change", message: "Stage changed from Proposal → Negotiation", timestamp: daysAgo(7) },
  { id: "act-2", accountId: "acc-1", type: "email", message: "Sent SOC 2 Type II report to Sarah Chen", timestamp: daysAgo(1) },
  { id: "act-3", accountId: "acc-1", type: "call", message: "Call with Sarah Chen — discussed compliance blockers (21 min)", timestamp: daysAgo(1) },
  { id: "act-4", accountId: "acc-1", type: "note", message: "CISO review expected by end of week. Sarah confident it will pass.", timestamp: daysAgo(1) },
  { id: "act-5", accountId: "acc-1", type: "call", message: "Call with Sarah Chen — POC feedback, audit logging concerns (15 min)", timestamp: daysAgo(8) },
  { id: "act-6", accountId: "acc-1", type: "meeting", message: "Technical deep-dive on audit logging with Meridian security team", timestamp: daysAgo(5) },

  // ── NovaPay Technologies ──
  { id: "act-7", accountId: "acc-2", type: "call", message: "Call with Marcus Rivera — pricing negotiation (18 min)", timestamp: daysAgo(3) },
  { id: "act-8", accountId: "acc-2", type: "email", message: "Sent dual pricing proposal (annual vs 2-year commitment)", timestamp: daysAgo(3) },
  { id: "act-9", accountId: "acc-2", type: "call", message: "Call with Marcus Rivera — WebSocket integration questions (12 min)", timestamp: daysAgo(10) },
  { id: "act-10", accountId: "acc-2", type: "stage_change", message: "Stage changed from Discovery → Proposal", timestamp: daysAgo(8) },
  { id: "act-11", accountId: "acc-2", type: "call", message: "Call with Marcus Rivera — competitive eval, AI demo request (9 min)", timestamp: daysAgo(18) },
  { id: "act-12", accountId: "acc-2", type: "meeting", message: "AI Copilot-focused demo for NovaPay engineering team", timestamp: daysAgo(14) },

  // ── BrightLoop Education ──
  { id: "act-13", accountId: "acc-3", type: "call", message: "Call with Priya Sharma — prototype review, case study discussion (11 min)", timestamp: daysAgo(2) },
  { id: "act-14", accountId: "acc-3", type: "email", message: "Sent startup program application to Priya", timestamp: daysAgo(10) },
  { id: "act-15", accountId: "acc-3", type: "call", message: "Call with Priya Sharma — budget discussion, startup discount (8 min)", timestamp: daysAgo(12) },
  { id: "act-16", accountId: "acc-3", type: "note", message: "Priya's team built a lesson planner prototype in one weekend. Strong champion.", timestamp: daysAgo(2) },
  { id: "act-17", accountId: "acc-3", type: "stage_change", message: "Stage changed from Lead → Discovery", timestamp: daysAgo(15) },

  // ── Atlas Logistics ──
  { id: "act-18", accountId: "acc-4", type: "call", message: "Call with Tom Barrett — intro call, low urgency (7 min)", timestamp: daysAgo(14) },
  { id: "act-19", accountId: "acc-4", type: "email", message: "Sent product overview materials to Tom", timestamp: daysAgo(14) },
  { id: "act-20", accountId: "acc-4", type: "call", message: "Cold outreach call via LinkedIn connection (5 min)", timestamp: daysAgo(21) },
  { id: "act-21", accountId: "acc-4", type: "email", message: "Sent 5-minute product overview video", timestamp: daysAgo(21) },
  { id: "act-22", accountId: "acc-4", type: "note", message: "Very low engagement. CTO referral is only leverage point. Consider deprioritizing.", timestamp: daysAgo(13) },

  // ── Vertex AI Labs ──
  { id: "act-23", accountId: "acc-5", type: "call", message: "Call with Lena Kowalski — expansion discussion, enterprise tier (22 min)", timestamp: daysAgo(5) },
  { id: "act-24", accountId: "acc-5", type: "note", message: "Lena agreed to be a design partner for multi-tenant workspaces.", timestamp: daysAgo(5) },
  { id: "act-25", accountId: "acc-5", type: "call", message: "Call with Lena Kowalski — usage review, rate limit request (13 min)", timestamp: daysAgo(30) },
  { id: "act-26", accountId: "acc-5", type: "email", message: "Submitted internal request to increase API rate limits for Vertex", timestamp: daysAgo(28) },
  { id: "act-27", accountId: "acc-5", type: "stage_change", message: "Deal closed — Vertex AI Labs signed annual contract", timestamp: daysAgo(180) },

  // ── Cascade Financial ──
  { id: "act-28", accountId: "acc-6", type: "call", message: "Call with James Whitfield — security questionnaire logistics (25 min)", timestamp: daysAgo(4) },
  { id: "act-29", accountId: "acc-6", type: "email", message: "Sent pre-filled security questionnaire + W-9 + insurance certificate", timestamp: daysAgo(4) },
  { id: "act-30", accountId: "acc-6", type: "call", message: "Call with James Whitfield — group demo follow-up (18 min)", timestamp: daysAgo(15) },
  { id: "act-31", accountId: "acc-6", type: "meeting", message: "Group demo for Cascade Financial — 12 attendees", timestamp: daysAgo(16) },
  { id: "act-32", accountId: "acc-6", type: "call", message: "Call with James Whitfield — competitive positioning, ROI ask (10 min)", timestamp: daysAgo(25) },
  { id: "act-33", accountId: "acc-6", type: "stage_change", message: "Stage changed from Discovery → Proposal", timestamp: daysAgo(20) },
];

// ═══════════════════════════════════════════════════════════════
// Query helpers
// ═══════════════════════════════════════════════════════════════

export function getAccounts(): Account[] {
  return accounts;
}

export function getAccount(id: string): Account | undefined {
  return accounts.find((a) => a.id === id);
}

export function getAccountByCompany(name: string): Account | undefined {
  const lower = name.toLowerCase();
  return accounts.find((a) => a.company.toLowerCase().includes(lower));
}

export function getCallsByAccount(accountId: string): CallRecord[] {
  return callRecords.filter((c) => c.accountId === accountId);
}

export function getAllCalls(): CallRecord[] {
  return callRecords;
}

export function getActivitiesByAccount(accountId: string): Activity[] {
  return activities
    .filter((a) => a.accountId === accountId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function getRecentActivities(limit: number = 10): Activity[] {
  return [...activities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// ── Pipeline stats ──────────────────────────────────────────

export interface PipelineStats {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  averageDealSize: number;
  averageLikelihood: number;
  totalAccounts: number;
  activeDeals: number;
  countByStage: Record<Stage, number>;
  valueByStage: Record<Stage, number>;
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
    stages.map((s) => [s, accounts.filter((a) => a.stage === s).length])
  ) as Record<Stage, number>;

  const valueByStage = Object.fromEntries(
    stages.map((s) => [
      s,
      accounts.filter((a) => a.stage === s).reduce((sum, a) => sum + a.dealValue, 0),
    ])
  ) as Record<Stage, number>;

  const active = accounts.filter(
    (a) => a.stage !== "closed_won" && a.stage !== "closed_lost"
  );

  const totalPipelineValue = active.reduce((s, a) => s + a.dealValue, 0);
  const weightedPipelineValue = active.reduce(
    (s, a) => s + a.dealValue * (a.likelihood / 100),
    0
  );

  return {
    totalPipelineValue,
    weightedPipelineValue,
    averageDealSize:
      accounts.length > 0
        ? accounts.reduce((s, a) => s + a.dealValue, 0) / accounts.length
        : 0,
    averageLikelihood:
      active.length > 0
        ? active.reduce((s, a) => s + a.likelihood, 0) / active.length
        : 0,
    totalAccounts: accounts.length,
    activeDeals: active.length,
    countByStage,
    valueByStage,
  };
}

// ═══════════════════════════════════════════════════════════════
// Mutation helpers
// ═══════════════════════════════════════════════════════════════

export function updateAccountStage(id: string, stage: Stage): Account | undefined {
  const account = accounts.find((a) => a.id === id);
  if (!account) return undefined;

  const oldStage = account.stage;
  account.stage = stage;

  activities.push({
    id: uid(),
    accountId: id,
    type: "stage_change",
    message: `Stage changed from ${formatStage(oldStage)} → ${formatStage(stage)}`,
    timestamp: new Date().toISOString(),
  });

  return account;
}

export function updateAccountLikelihood(
  id: string,
  likelihood: number
): Account | undefined {
  const account = accounts.find((a) => a.id === id);
  if (!account) return undefined;
  account.likelihood = Math.max(0, Math.min(100, likelihood));
  return account;
}

export function addNoteToAccount(id: string, note: string): Account | undefined {
  const account = accounts.find((a) => a.id === id);
  if (!account) return undefined;

  account.notes.push(note);

  activities.push({
    id: uid(),
    accountId: id,
    type: "note",
    message: note,
    timestamp: new Date().toISOString(),
  });

  return account;
}

export function addCallRecord(
  accountId: string,
  record: Omit<CallRecord, "id">
): CallRecord {
  const newRecord: CallRecord = { ...record, id: uid() };
  callRecords.push(newRecord);

  const account = accounts.find((a) => a.id === accountId);
  if (account) {
    account.lastContactDate = record.date;
  }

  activities.push({
    id: uid(),
    accountId,
    type: "call",
    message: `Call recorded — ${record.outcome} (${Math.round(record.duration / 60)} min)`,
    timestamp: record.date,
  });

  return newRecord;
}

export function addActivity(activity: Omit<Activity, "id">): Activity {
  const newActivity: Activity = { ...activity, id: uid() };
  activities.push(newActivity);
  return newActivity;
}

/** Create a brand-new account from an inbound lead (phone call) */
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
  accounts.push(newAccount);

  activities.push({
    id: uid(),
    accountId: newAccount.id,
    type: "note",
    message: `New inbound lead: ${data.company} — ${data.contactName} (${data.contactRole})`,
    timestamp: new Date().toISOString(),
  });

  return newAccount;
}

// ── Formatting ──────────────────────────────────────────────

function formatStage(stage: Stage): string {
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

// ── Seed data exports (for server-side store.ts) ────────────

export { accounts as SEED_ACCOUNTS };
export { callRecords as SEED_CALL_RECORDS };
export { activities as SEED_ACTIVITIES };
