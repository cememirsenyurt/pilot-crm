"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Phone } from "lucide-react";
import type { Account, Stage } from "@/lib/data";

/* ── Props ─────────────────────────────────────────────────── */

interface AccountsViewProps {
  accounts: Account[];
  onCall: (accountId?: string) => void;
}

/* ── Sort config ───────────────────────────────────────────── */

type SortKey =
  | "company"
  | "stage"
  | "dealValue"
  | "likelihood"
  | "industry"
  | "lastContactDate";

type SortDir = "asc" | "desc";

const stageOrder: Record<Stage, number> = {
  lead: 0,
  discovery: 1,
  proposal: 2,
  negotiation: 3,
  closed_won: 4,
  closed_lost: 5,
};

/* ── Component ─────────────────────────────────────────────── */

export function AccountsView({ accounts, onCall }: AccountsViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("dealValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = [...accounts].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "company":
        cmp = a.company.localeCompare(b.company);
        break;
      case "stage":
        cmp = stageOrder[a.stage] - stageOrder[b.stage];
        break;
      case "dealValue":
        cmp = a.dealValue - b.dealValue;
        break;
      case "likelihood":
        cmp = a.likelihood - b.likelihood;
        break;
      case "industry":
        cmp = a.industry.localeCompare(b.industry);
        break;
      case "lastContactDate":
        cmp =
          new Date(a.lastContactDate).getTime() -
          new Date(b.lastContactDate).getTime();
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggle = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60">
            <tr>
              <SortTh label="Company" k="company" active={sortKey} dir={sortDir} toggle={toggle} />
              <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Contact
              </th>
              <SortTh label="Stage" k="stage" active={sortKey} dir={sortDir} toggle={toggle} />
              <SortTh label="Deal Value" k="dealValue" active={sortKey} dir={sortDir} toggle={toggle} align="right" />
              <SortTh label="Likelihood" k="likelihood" active={sortKey} dir={sortDir} toggle={toggle} align="center" />
              <SortTh label="Industry" k="industry" active={sortKey} dir={sortDir} toggle={toggle} />
              <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Tags
              </th>
              <SortTh label="Last Contact" k="lastContactDate" active={sortKey} dir={sortDir} toggle={toggle} />
              <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((a) => (
              <tr
                key={a.id}
                className="hover:bg-gray-50/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{a.company}</p>
                  <p className="text-[11px] text-gray-400">{a.plan} plan</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{a.contactName}</p>
                  <p className="text-[11px] text-gray-400">{a.contactRole}</p>
                  <p className="text-[11px] text-gray-400">
                    {a.contactEmail}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StageBadge stage={a.stage} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">
                  ${a.dealValue.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center">
                  <LikelihoodBadge value={a.likelihood} />
                </td>
                <td className="px-4 py-3 text-gray-600">{a.industry}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {a.tags.map((t) => (
                      <span
                        key={t}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tagColor[t] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[11px] text-gray-500">
                  {relDate(a.lastContactDate)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onCall(a.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Call
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Sortable table header ─────────────────────────────────── */

function SortTh({
  label,
  k,
  active,
  dir,
  toggle,
  align,
}: {
  label: string;
  k: SortKey;
  active: SortKey;
  dir: SortDir;
  toggle: (k: SortKey) => void;
  align?: "left" | "center" | "right";
}) {
  const isActive = active === k;
  return (
    <th
      className={`cursor-pointer select-none px-4 py-3 text-[11px] font-medium uppercase tracking-wider transition-colors hover:text-gray-900 ${
        isActive ? "text-gray-900" : "text-gray-500"
      } ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
      onClick={() => toggle(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive &&
          (dir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          ))}
      </span>
    </th>
  );
}

/* ── Badge components ──────────────────────────────────────── */

const stageStyle: Record<string, string> = {
  lead: "bg-gray-100 text-gray-700",
  discovery: "bg-blue-100 text-blue-700",
  proposal: "bg-amber-100 text-amber-700",
  negotiation: "bg-purple-100 text-purple-700",
  closed_won: "bg-green-100 text-green-700",
  closed_lost: "bg-red-100 text-red-700",
};

const stageLabel: Record<string, string> = {
  lead: "Lead",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

function StageBadge({ stage }: { stage: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${stageStyle[stage] ?? "bg-gray-100 text-gray-700"}`}
    >
      {stageLabel[stage] ?? stage}
    </span>
  );
}

function LikelihoodBadge({ value }: { value: number }) {
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
