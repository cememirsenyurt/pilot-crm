"use client";

import { DollarSign, TrendingUp, Users, Phone, Clock } from "lucide-react";
import type {
  Account,
  Activity,
  CallRecord,
  PipelineStats,
  Stage,
} from "@/lib/data";

/* ── Props ─────────────────────────────────────────────────── */

interface DashboardViewProps {
  accounts: Account[];
  stats: PipelineStats;
  activities: Activity[];
  calls: CallRecord[];
  onCall: (accountId?: string) => void;
}

/* ── Main ──────────────────────────────────────────────────── */

export function DashboardView({
  accounts,
  stats,
  activities,
  calls,
  onCall,
}: DashboardViewProps) {
  const callsThisWeek = calls.filter(
    (c) => Date.now() - new Date(c.date).getTime() < 7 * 86_400_000,
  ).length;

  return (
    <div className="space-y-6">
      {/* ── Stat cards ────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          label="Total Pipeline"
          value={fmtCurrency(stats.totalPipelineValue)}
          sub={`Weighted: ${fmtCurrency(stats.weightedPipelineValue)}`}
          accent="bg-green-50"
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-600" />}
          label="Active Deals"
          value={stats.activeDeals}
          sub={`${stats.totalAccounts} total accounts`}
          accent="bg-blue-50"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
          label="Avg Likelihood"
          value={`${Math.round(stats.averageLikelihood)}%`}
          sub="Across active deals"
          accent="bg-purple-50"
        />
        <StatCard
          icon={<Phone className="h-5 w-5 text-orange-600" />}
          label="Calls This Week"
          value={callsThisWeek}
          sub={`${calls.length} total calls`}
          accent="bg-orange-50"
        />
      </div>

      {/* ── Two-column: kanban + activity ─────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <PipelineKanban accounts={accounts} onCall={onCall} />
        </div>
        <div className="space-y-6 xl:col-span-2">
          <ActivityFeed activities={activities} accounts={accounts} />
          <UpcomingFollowUps accounts={accounts} />
        </div>
      </div>
    </div>
  );
}

/* ── Stat card ─────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${accent}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="truncate text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Pipeline kanban ───────────────────────────────────────── */

const kanbanStages: { key: Stage; label: string; dot: string }[] = [
  { key: "lead", label: "Lead", dot: "bg-gray-400" },
  { key: "discovery", label: "Discovery", dot: "bg-blue-500" },
  { key: "proposal", label: "Proposal", dot: "bg-amber-500" },
  { key: "negotiation", label: "Negotiation", dot: "bg-purple-500" },
  { key: "closed_won", label: "Closed Won", dot: "bg-green-500" },
];

function PipelineKanban({
  accounts,
  onCall,
}: {
  accounts: Account[];
  onCall: (id?: string) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-gray-900">Pipeline</h3>
      </div>
      <div className="overflow-x-auto scroll-thin p-4">
        <div className="flex gap-3" style={{ minWidth: 900 }}>
          {kanbanStages.map((stage) => {
            const stageAccounts = accounts.filter(
              (a) => a.stage === stage.key,
            );
            return (
              <div key={stage.key} className="min-w-[170px] flex-1">
                {/* Column header */}
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${stage.dot}`}
                  />
                  <span className="text-xs font-semibold text-gray-600">
                    {stage.label}
                  </span>
                  <span className="ml-auto rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                    {stageAccounts.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2.5">
                  {stageAccounts.map((a) => (
                    <DealCard key={a.id} account={a} onCall={onCall} />
                  ))}
                  {stageAccounts.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-[11px] text-gray-400">
                      No deals
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Deal card ─────────────────────────────────────────────── */

function DealCard({
  account: a,
  onCall,
}: {
  account: Account;
  onCall: (id?: string) => void;
}) {
  const borderColor =
    a.likelihood >= 70
      ? "border-l-green-500"
      : a.likelihood >= 40
        ? "border-l-amber-500"
        : "border-l-red-500";

  return (
    <div
      className={`rounded-lg border border-gray-100 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md border-l-[3px] ${borderColor}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-1">
        <h4 className="text-[13px] font-semibold leading-tight text-gray-900">
          {a.company}
        </h4>
        <button
          onClick={() => onCall(a.id)}
          className="shrink-0 rounded p-1 text-gray-300 hover:bg-orange-50 hover:text-[#E85D04] transition-colors"
        >
          <Phone className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-0.5 text-[11px] text-gray-500">
        {a.contactName} &middot; {a.contactRole}
      </p>

      {/* Value + likelihood */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">
          ${a.dealValue.toLocaleString()}
        </span>
        <LikelihoodPill value={a.likelihood} />
      </div>

      {/* Tags */}
      {a.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {a.tags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </div>
      )}

      {/* Last contact */}
      <p className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
        <Clock className="h-3 w-3" />
        {relDate(a.lastContactDate)}
      </p>
    </div>
  );
}

/* ── Activity feed ─────────────────────────────────────────── */

const activityIcon: Record<string, string> = {
  call: "📞",
  email: "✉️",
  note: "📝",
  stage_change: "🔄",
  meeting: "📅",
};

function ActivityFeed({
  activities,
  accounts,
}: {
  activities: Activity[];
  accounts: Account[];
}) {
  const companyOf = (id: string) =>
    accounts.find((a) => a.id === id)?.company ?? "";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-gray-900">
          Recent Activity
        </h3>
      </div>
      <div className="max-h-[340px] divide-y divide-gray-50 overflow-y-auto scroll-thin">
        {activities.slice(0, 8).map((act) => (
          <div
            key={act.id}
            className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors"
          >
            <span className="mt-0.5 text-base leading-none">
              {activityIcon[act.type] ?? "📌"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-gray-700">
                {act.message}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                  {companyOf(act.accountId)}
                </span>
                <span className="text-[10px] text-gray-400">
                  {relDate(act.timestamp)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Upcoming follow-ups ───────────────────────────────────── */

function UpcomingFollowUps({ accounts }: { accounts: Account[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = accounts
    .filter((a) => a.nextFollowUp)
    .map((a) => {
      const d = new Date(a.nextFollowUp!);
      const dDay = new Date(d);
      dDay.setHours(0, 0, 0, 0);
      const diff = dDay.getTime() - today.getTime();
      const status: "overdue" | "today" | "future" =
        diff < 0 ? "overdue" : diff === 0 ? "today" : "future";
      return { account: a, date: d, status };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const statusStyle = {
    overdue: "bg-red-50 text-red-700 border-red-200",
    today: "bg-amber-50 text-amber-700 border-amber-200",
    future: "bg-gray-50 text-gray-600 border-gray-200",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-gray-900">
          Upcoming Follow-ups
        </h3>
      </div>
      <div className="divide-y divide-gray-50">
        {rows.map(({ account: a, date, status }) => (
          <div
            key={a.id}
            className="flex items-center justify-between px-5 py-3"
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-gray-900">
                {a.company}
              </p>
              <p className="text-[11px] text-gray-500">{a.contactName}</p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusStyle[status]}`}
            >
              {status === "overdue"
                ? "Overdue"
                : status === "today"
                  ? "Today"
                  : fmtShortDate(date)}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-gray-400">
            No upcoming follow-ups
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Shared micro-components ───────────────────────────────── */

function LikelihoodPill({ value }: { value: number }) {
  const c =
    value >= 70
      ? "bg-green-100 text-green-700"
      : value >= 40
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}
    >
      {value}%
    </span>
  );
}

const tagColor: Record<string, string> = {
  enterprise: "bg-purple-100 text-purple-700",
  "high-priority": "bg-orange-100 text-orange-700",
  "at-risk": "bg-red-100 text-red-700",
};

function TagPill({ tag }: { tag: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tagColor[tag] ?? "bg-gray-100 text-gray-600"}`}
    >
      {tag}
    </span>
  );
}

/* ── Utility ───────────────────────────────────────────────── */

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function relDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
