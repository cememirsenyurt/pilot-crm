"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useCopilotReadable, useCopilotAction } from "@copilotkit/react-core";
import {
  Bell,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardView } from "@/components/DashboardView";
import { AccountsView } from "@/components/AccountsView";
import { CallsView } from "@/components/CallsView";
import { CalendarView } from "@/components/CalendarView";
import { CallModal } from "@/components/CallModal";
import type {
  Account,
  CallRecord,
  Activity,
  PipelineStats,
  Stage,
} from "@/lib/data";

/* ── Types ─────────────────────────────────────────────────── */

type Page = "dashboard" | "accounts" | "calls" | "calendar";

const pageTitles: Record<Page, string> = {
  dashboard: "Dashboard",
  accounts: "Accounts",
  calls: "Call History",
  calendar: "Calendar",
};

const stageLabels: Record<string, string> = {
  lead: "Lead",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

/* ═══════════════════════════════════════════════════════════════
   Main App
   ═══════════════════════════════════════════════════════════════ */

export default function App() {
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callModalAccountId, setCallModalAccountId] = useState<string | null>(
    null,
  );
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  /* ── Fetch data from server ────────────────────────────────── */

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch("/api/crm");
      const data = await res.json();
      setAccounts(data.accounts ?? []);
      setCalls(data.calls ?? []);
      setActivities(data.activities ?? []);
      setStats(data.stats ?? null);
    } catch (err) {
      console.error("Failed to fetch CRM data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  /* ── Server mutation helper ────────────────────────────────── */

  const mutate = useCallback(
    async (action: string, params: Record<string, unknown> = {}) => {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
      });
      const result = await res.json();
      await refreshData();
      return result;
    },
    [refreshData],
  );

  /* ── Notifications ───────────────────────────────────────── */

  const notifications = useMemo(() => {
    const items: { type: string; icon: string; msg: string; color: string }[] =
      [];
    const now = Date.now();
    const dayMs = 86_400_000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    accounts.forEach((a) => {
      if (a.stage === "closed_won" || a.stage === "closed_lost") return;

      if (a.nextFollowUp && new Date(a.nextFollowUp) < today) {
        items.push({
          type: "overdue",
          icon: "🔴",
          msg: `${a.company}: follow-up overdue`,
          color: "text-red-700 bg-red-50",
        });
      }
      if (now - new Date(a.lastContactDate).getTime() > 14 * dayMs) {
        items.push({
          type: "stale",
          icon: "⏰",
          msg: `${a.company}: no contact in 14+ days`,
          color: "text-amber-700 bg-amber-50",
        });
      }
      if (a.likelihood < 40) {
        items.push({
          type: "risk",
          icon: "⚠️",
          msg: `${a.company}: low likelihood (${a.likelihood}%)`,
          color: "text-red-700 bg-red-50",
        });
      }
    });

    return items;
  }, [accounts]);

  /* Close notification dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ═══════════════════════════════════════════════════════════
     CopilotKit — Readables (share data with the AI)
     ═══════════════════════════════════════════════════════════ */

  useCopilotReadable({
    description:
      "All CRM accounts. Fields: id, company, contactName, contactRole, contactEmail, plan (free/team/enterprise), stage (lead/discovery/proposal/negotiation/closed_won/closed_lost), dealValue ($), likelihood (0-100%), industry, notes[], tags[], lastContactDate, nextFollowUp.",
    value: JSON.stringify(accounts),
  });

  useCopilotReadable({
    description:
      "Pipeline statistics: totalPipelineValue, weightedPipelineValue, averageDealSize, averageLikelihood, totalAccounts, activeDeals, countByStage, valueByStage.",
    value: JSON.stringify(stats),
  });

  useCopilotReadable({
    description:
      "Recent CRM activities (calls, emails, notes, stage_changes, meetings) across all accounts with timestamps.",
    value: JSON.stringify(activities),
  });

  useCopilotReadable({
    description:
      "All call records with transcripts, duration, sentiment scores (1-10), satisfaction scores, outcome summaries, and sentiment tags.",
    value: JSON.stringify(calls),
  });

  /* ═══════════════════════════════════════════════════════════
     CopilotKit — Actions (what the AI can DO)
     ═══════════════════════════════════════════════════════════ */

  /* ── 1. Move Account to Stage ────────────────────────────── */

  useCopilotAction({
    name: "moveAccountToStage",
    description:
      "Move a deal to a new pipeline stage. For closed_won, shows an approval card. Valid stages: lead, discovery, proposal, negotiation, closed_won, closed_lost.",
    parameters: [
      {
        name: "companyName",
        type: "string",
        description: "Company name (partial match OK)",
      },
      {
        name: "newStage",
        type: "string",
        description:
          "Target stage (lead/discovery/proposal/negotiation/closed_won/closed_lost)",
      },
    ],
    renderAndWait: ({ args, handler }) => {
      const name = String(args.companyName ?? "").toLowerCase();
      const acct = accounts.find(
        (a) =>
          a.company.toLowerCase() === name ||
          a.company.toLowerCase().includes(name),
      );
      if (!acct) {
        return (
          <RenderCard variant="error">
            Account &quot;{String(args.companyName)}&quot; not found.
            <button
              onClick={() => handler?.("Account not found.")}
              className="mt-2 w-full rounded-lg bg-gray-100 py-1.5 text-xs font-medium"
            >
              Dismiss
            </button>
          </RenderCard>
        );
      }

      const stage = String(args.newStage);

      if (stage === "closed_won") {
        return (
          <RenderCard variant="warning">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-600">
              Approval Required
            </p>
            <p className="text-sm font-medium text-gray-900">
              Close <strong>{acct.company}</strong> as Won?
            </p>
            <p className="mt-1 text-xs text-gray-500">
              ${acct.dealValue.toLocaleString()} • {acct.contactName} •{" "}
              {acct.likelihood}% likelihood
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={async () => {
                  await mutate("moveStage", {
                    accountId: acct.id,
                    stage: "closed_won",
                  });
                  handler?.(
                    `✅ Approved! ${acct.company} marked as Closed Won.`,
                  );
                }}
                className="flex-1 rounded-lg bg-green-600 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Approve & Close
              </button>
              <button
                onClick={() =>
                  handler?.(
                    `❌ Declined. ${acct.company} stays in ${acct.stage}.`,
                  )
                }
                className="flex-1 rounded-lg bg-gray-100 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Decline
              </button>
            </div>
          </RenderCard>
        );
      }

      /* Non-closed_won — auto-execute */
      return (
        <AutoMoveCard
          account={acct}
          stage={stage}
          handler={handler!}
          onExecute={async () => {
            await mutate("moveStage", {
              accountId: acct.id,
              stage: stage as Stage,
            });
          }}
        />
      );
    },
  });

  /* ── 2. Add Note ─────────────────────────────────────────── */

  useCopilotAction({
    name: "addNote",
    description: "Add a note or observation to an account.",
    parameters: [
      {
        name: "companyName",
        type: "string",
        description: "Company name",
      },
      { name: "note", type: "string", description: "The note text" },
    ],
    handler: async ({
      companyName,
      note,
    }: {
      companyName: string;
      note: string;
    }) => {
      const result = await mutate("addNote", { companyName, note });
      return result.message || `📝 Note added.`;
    },
    render: ({ status, args, result }) => {
      if (status === "inProgress")
        return <RenderCard>Adding note...</RenderCard>;
      return (
        <RenderCard>
          <p className="text-xs font-semibold text-green-600">📝 Note Added</p>
          <p className="mt-1 text-sm text-gray-700">
            {String(args.companyName)}
          </p>
          <p className="mt-1 rounded bg-gray-50 p-2 text-xs text-gray-600 italic">
            &quot;{String(args.note)}&quot;
          </p>
          <p className="mt-1 text-[10px] text-gray-400">
            {new Date().toLocaleString()}
          </p>
        </RenderCard>
      );
    },
  });

  /* ── 3. Get Account Brief ────────────────────────────────── */

  useCopilotAction({
    name: "getAccountBrief",
    description:
      "Generate a full meeting-prep briefing for an account. Shows overview, sentiment history, recent activity, notes, and suggested talking points.",
    parameters: [
      {
        name: "companyName",
        type: "string",
        description: "Company name",
      },
    ],
    handler: async ({ companyName }: { companyName: string }) => {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getAccountBrief", companyName }),
      });
      return await res.json();
    },
    render: ({ status, result }) => {
      if (status === "inProgress")
        return <RenderCard>Preparing briefing...</RenderCard>;
      if (!result || result.error)
        return <RenderCard variant="error">{result?.msg}</RenderCard>;

      const a: Account = result.account;
      const aCalls: CallRecord[] = result.calls ?? [];

      return (
        <RenderCard>
          <p className="text-xs font-bold uppercase tracking-wider text-[#E85D04]">
            📋 Account Brief
          </p>
          <p className="mt-1 text-sm font-bold text-gray-900">{a.company}</p>

          <BriefSection title="Overview">
            <p>
              {a.industry} • {a.plan} plan •{" "}
              <strong>${a.dealValue.toLocaleString()}</strong> •{" "}
              {stageLabels[a.stage]} • {a.likelihood}% likelihood
            </p>
            <p className="mt-0.5">
              Contact: {a.contactName} ({a.contactRole}) — {a.contactEmail}
            </p>
          </BriefSection>

          {aCalls.length > 0 && (
            <BriefSection title="Sentiment History">
              {aCalls.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="truncate">{c.outcome}</span>
                  {c.sentiment && (
                    <span
                      className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${c.sentiment.score >= 7 ? "bg-green-100 text-green-700" : c.sentiment.score >= 4 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                    >
                      {c.sentiment.score}/10
                    </span>
                  )}
                </div>
              ))}
            </BriefSection>
          )}

          {a.notes.length > 0 && (
            <BriefSection title="Notes">
              {a.notes.map((n, i) => (
                <p key={i}>• {n}</p>
              ))}
            </BriefSection>
          )}

          <BriefSection title="Suggested Talking Points">
            <p>
              • Review current {stageLabels[a.stage].toLowerCase()} status and
              timeline
            </p>
            {a.likelihood < 50 && (
              <p>• Address potential blockers or concerns</p>
            )}
            {a.tags.includes("at-risk") && (
              <p>• Discuss engagement level and re-establish value prop</p>
            )}
            <p>• Confirm next steps and follow-up cadence</p>
          </BriefSection>
        </RenderCard>
      );
    },
  });

  /* ── 4. Update Likelihood ────────────────────────────────── */

  useCopilotAction({
    name: "updateLikelihood",
    description: "Update the close probability for a deal (0-100).",
    parameters: [
      {
        name: "companyName",
        type: "string",
        description: "Company name",
      },
      {
        name: "newLikelihood",
        type: "number",
        description: "New likelihood 0-100",
      },
    ],
    handler: async ({
      companyName,
      newLikelihood,
    }: {
      companyName: string;
      newLikelihood: number;
    }) => {
      return await mutate("updateLikelihood", {
        companyName,
        likelihood: newLikelihood,
      });
    },
    render: ({ status, result }) => {
      if (status === "inProgress")
        return <RenderCard>Updating...</RenderCard>;
      if (!result || result.error)
        return <RenderCard variant="error">Account not found.</RenderCard>;
      const up = result.now > result.old;
      return (
        <RenderCard>
          <div className="flex items-center gap-2">
            {up ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm font-semibold">{result.company}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-lg font-bold">
            <span className="text-gray-400">{result.old}%</span>
            <ArrowRight
              className={`h-4 w-4 ${up ? "text-green-500" : "text-red-500"}`}
            />
            <span className={up ? "text-green-600" : "text-red-600"}>
              {result.now}%
            </span>
          </div>
        </RenderCard>
      );
    },
  });

  /* ── 5. Flag Risk ────────────────────────────────────────── */

  useCopilotAction({
    name: "flagRisk",
    description:
      'Flag an account as at-risk. Adds "at-risk" tag and shows a warning card.',
    parameters: [
      {
        name: "companyName",
        type: "string",
        description: "Company name",
      },
      {
        name: "reason",
        type: "string",
        description: "Why this account is at risk",
      },
    ],
    handler: async ({
      companyName,
      reason,
    }: {
      companyName: string;
      reason: string;
    }) => {
      return await mutate("flagRisk", { companyName, reason });
    },
    render: ({ status, result }) => {
      if (status === "inProgress")
        return <RenderCard>Flagging...</RenderCard>;
      if (!result || result.error)
        return <RenderCard variant="error">Account not found.</RenderCard>;
      return (
        <RenderCard variant="error">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-bold text-red-700">
              ⚠️ Risk Alert: {result.company}
            </span>
          </div>
          <p className="mt-1 text-xs text-red-600">{result.reason}</p>
        </RenderCard>
      );
    },
  });

  /* ── 6. Create Visualization (flexible — LLM decides data) ── */

  useCopilotAction({
    name: "createVisualization",
    description:
      "Create ANY visual chart, graph, funnel, overview, scorecard, or comparison from the CRM data. Use this EVERY TIME the user asks to see, show, visualize, chart, graph, plot, or display anything. YOU compute the data items from the CRM data you can see. Supported types: funnel (tapered bars for pipeline/conversion), bar_chart (horizontal bars for comparing values), comparison (side-by-side cards for 2-4 items), scorecard (big KPI numbers), progress (percentage bars).",
    parameters: [
      {
        name: "type",
        type: "string",
        description:
          "Chart type: funnel | bar_chart | comparison | scorecard | progress",
      },
      {
        name: "title",
        type: "string",
        description: "Title for the visualization",
      },
      {
        name: "dataJson",
        type: "string",
        description:
          'JSON array of data items. Each item: {"label":"Name","value":123,"color":"#hex","subtitle":"optional text"}. YOU must compute these values from the CRM data. For colors use hex codes like #6B7280 (gray), #3B82F6 (blue), #F59E0B (amber), #8B5CF6 (purple), #22C55E (green), #EF4444 (red), #E85D04 (orange).',
      },
    ],
    handler: async (args: {
      type: string;
      title: string;
      dataJson: string;
    }) => args,
    render: ({ status, args }) => {
      if (status === "inProgress")
        return <RenderCard>Creating visualization...</RenderCard>;

      let items: VizItem[] = [];
      try {
        items = JSON.parse(String(args.dataJson || "[]"));
      } catch {
        return (
          <RenderCard variant="error">
            Failed to parse visualization data.
          </RenderCard>
        );
      }

      const title = String(args.title || "");
      const type = String(args.type || "bar_chart");

      return (
        <RenderCard>
          {type === "funnel" && <FunnelViz title={title} items={items} />}
          {type === "bar_chart" && <BarChartViz title={title} items={items} />}
          {type === "comparison" && (
            <ComparisonViz title={title} items={items} />
          )}
          {type === "scorecard" && (
            <ScorecardViz title={title} items={items} />
          )}
          {type === "progress" && (
            <ProgressViz title={title} items={items} />
          )}
          {!["funnel", "bar_chart", "comparison", "scorecard", "progress"].includes(type) && (
            <BarChartViz title={title} items={items} />
          )}
        </RenderCard>
      );
    },
  });

  /* ═══════════════════════════════════════════════════════════
     Call modal handlers
     ═══════════════════════════════════════════════════════════ */

  const openCallModal = (accountId?: string) => {
    setCallModalAccountId(accountId ?? null);
    setShowCallModal(true);
  };

  const handleCallComplete = async (
    accountId: string,
    record: Omit<CallRecord, "id"> & { _analysis?: Record<string, unknown> },
  ) => {
    await mutate("addCall", {
      accountId,
      date: record.date,
      duration: record.duration,
      transcript: record.transcript,
      sentiment: record.sentiment,
      outcome: record.outcome,
      analysis: record._analysis ?? null,
    });
  };

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F5F7]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#E85D04]" />
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading PilotCRM...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F5F5F7]">
      <AppSidebar
        activePage={activePage}
        onNavigate={(p) => setActivePage(p as Page)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ── Header ──────────────────────────────────────────── */}
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white/80 px-8 py-3.5 backdrop-blur-sm">
          <h1 className="text-lg font-semibold text-gray-900">
            {pageTitles[activePage]}
          </h1>
          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">
                      Alerts
                    </p>
                  </div>
                  <div className="max-h-64 divide-y divide-gray-50 overflow-y-auto scroll-thin">
                    {notifications.length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-gray-400">
                        No alerts
                      </p>
                    )}
                    {notifications.map((n, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2.5 px-4 py-2.5 ${n.color}`}
                      >
                        <span className="mt-0.5 text-sm">{n.icon}</span>
                        <p className="text-xs">{n.msg}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => openCallModal()}
              className="flex items-center gap-2 rounded-lg bg-[#E85D04] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#D04D00] transition-colors"
            >
              📞 New Call
            </button>
          </div>
        </header>

        {/* ── Content ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto scroll-thin p-6 lg:p-8">
          {activePage === "dashboard" && stats && (
            <DashboardView
              accounts={accounts}
              stats={stats}
              activities={activities}
              calls={calls}
              onCall={openCallModal}
            />
          )}
          {activePage === "accounts" && (
            <AccountsView accounts={accounts} onCall={openCallModal} />
          )}
          {activePage === "calls" && (
            <CallsView calls={calls} accounts={accounts} />
          )}
          {activePage === "calendar" && (
            <CalendarView
              accounts={accounts}
              calls={calls}
              onCall={openCallModal}
            />
          )}
        </main>

        {/* ── Floating call FAB ───────────────────────────────── */}
        <button
          onClick={() => openCallModal()}
          className="call-pulse absolute bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#E85D04] text-2xl text-white shadow-lg hover:bg-[#D04D00] transition-all hover:scale-105 active:scale-95"
        >
          📞
        </button>
      </div>

      {/* ── Call modal ────────────────────────────────────────── */}
      {showCallModal && (
        <CallModal
          accounts={accounts}
          calls={calls}
          selectedAccountId={callModalAccountId}
          onClose={() => setShowCallModal(false)}
          onCallComplete={handleCallComplete}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Render card components used by CopilotKit actions
   ═══════════════════════════════════════════════════════════════ */

function RenderCard({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "error" | "warning";
}) {
  const border =
    variant === "error"
      ? "border-red-200 bg-red-50/50"
      : variant === "warning"
        ? "border-amber-200 bg-amber-50/50"
        : "border-gray-200 bg-white";
  return (
    <div
      className={`rounded-lg border p-3 text-left shadow-sm ${border}`}
    >
      {children}
    </div>
  );
}

function BriefSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2">
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {title}
      </p>
      <div className="text-xs leading-relaxed text-gray-600">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Visualization components — rendered by createVisualization
   ═══════════════════════════════════════════════════════════════ */

interface VizItem {
  label: string;
  value: number;
  color?: string;
  subtitle?: string;
}

interface VizProps {
  title: string;
  items: VizItem[];
}

function FunnelViz({ title, items }: VizProps) {
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#E85D04]">
        {title}
      </p>
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const pct = Math.max((item.value / maxVal) * 100, 20);
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className="flex items-center justify-center rounded-md px-3 py-2 text-xs font-bold text-white shadow-sm"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color || "#6B7280",
                  minWidth: 90,
                }}
              >
                {item.label}
              </div>
              {item.subtitle && (
                <span className="mt-0.5 text-[10px] text-gray-500">
                  {item.subtitle}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarChartViz({ title, items }: VizProps) {
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#E85D04]">
        {title}
      </p>
      <div className="space-y-2.5">
        {items.map((item, i) => {
          const pct = Math.max((item.value / maxVal) * 100, 4);
          return (
            <div key={i}>
              <div className="mb-0.5 flex justify-between text-[11px]">
                <span className="font-medium text-gray-700">{item.label}</span>
                <span className="font-semibold text-gray-800">
                  {item.subtitle || item.value.toLocaleString()}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: item.color || "#6B7280",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonViz({ title, items }: VizProps) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#E85D04]">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-2.5 text-center"
            style={{
              borderTopColor: item.color || "#6B7280",
              borderTopWidth: 3,
            }}
          >
            <p className="text-xs font-bold text-gray-900">{item.label}</p>
            <p
              className="mt-1 text-lg font-bold"
              style={{ color: item.color || "#374151" }}
            >
              {item.subtitle || item.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScorecardViz({ title, items }: VizProps) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#E85D04]">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-lg p-3 text-center"
            style={{
              backgroundColor: `${item.color || "#6B7280"}18`,
            }}
          >
            <p
              className="text-xl font-bold"
              style={{ color: item.color || "#374151" }}
            >
              {item.subtitle || item.value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressViz({ title, items }: VizProps) {
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#E85D04]">
        {title}
      </p>
      <div className="space-y-3">
        {items.map((item, i) => {
          const pct = Math.min(Math.max(item.value, 0), 100);
          return (
            <div key={i}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-medium text-gray-700">{item.label}</span>
                <span
                  className="font-bold"
                  style={{ color: item.color || "#374151" }}
                >
                  {item.subtitle || `${pct}%`}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: item.color || "#6B7280",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Auto-move helper ──────────────────────────────────────── */

function AutoMoveCard({
  account,
  stage,
  handler,
  onExecute,
}: {
  account: Account;
  stage: string;
  handler: (msg: string) => void;
  onExecute: () => Promise<void>;
}) {
  const executed = useRef(false);
  useEffect(() => {
    if (!executed.current) {
      executed.current = true;
      onExecute().then(() => {
        handler(
          `✅ Moved ${account.company} to ${stageLabels[stage] ?? stage}.`,
        );
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RenderCard>
      <div className="flex items-center gap-2">
        <span className="text-green-600">✅</span>
        <span className="text-sm font-medium text-gray-900">
          {account.company} → {stageLabels[stage] ?? stage}
        </span>
      </div>
    </RenderCard>
  );
}
