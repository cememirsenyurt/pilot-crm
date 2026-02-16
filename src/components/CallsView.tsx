"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import type { CallRecord, Account } from "@/lib/data";

/* ── Props ─────────────────────────────────────────────────── */

interface CallsViewProps {
  calls: CallRecord[];
  accounts: Account[];
}

/* ── Component ─────────────────────────────────────────────── */

export function CallsView({ calls, accounts }: CallsViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...calls].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const companyOf = (accountId: string) =>
    accounts.find((a) => a.id === accountId)?.company ?? "Unknown";

  return (
    <div className="space-y-3">
      {sorted.map((call) => {
        const open = expandedId === call.id;
        return (
          <div
            key={call.id}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Row */}
            <button
              onClick={() => setExpandedId(open ? null : call.id)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50/50"
            >
              {open ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
              )}

              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-gray-900">
                  {companyOf(call.accountId)}
                </p>
                <p className="text-[11px] text-gray-500">
                  {fmtDate(call.date)}
                </p>
              </div>

              <span className="hidden items-center gap-1 text-xs text-gray-500 sm:flex">
                <Clock className="h-3.5 w-3.5" />
                {fmtDuration(call.duration)}
              </span>

              <span className="hidden max-w-[200px] truncate text-xs text-gray-500 lg:block">
                {call.outcome}
              </span>

              {call.sentiment && (
                <SentimentBadge score={call.sentiment.score} />
              )}
            </button>

            {/* Expanded detail */}
            {open && (
              <div className="border-t border-gray-100 bg-gray-50/30 px-5 py-5">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Transcript */}
                  <div>
                    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Transcript
                    </h4>
                    <div className="rounded-lg bg-white p-4 text-[13px] leading-relaxed text-gray-700 shadow-inner whitespace-pre-wrap">
                      {call.transcript}
                    </div>
                  </div>

                  {/* Sentiment */}
                  {call.sentiment && (
                    <div>
                      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Sentiment Analysis
                      </h4>
                      <div className="space-y-4 rounded-lg bg-white p-4 shadow-inner">
                        {/* Score meters */}
                        <div className="flex gap-6">
                          <ScoreMeter
                            label="Score"
                            value={call.sentiment.score}
                          />
                          <ScoreMeter
                            label="Satisfaction"
                            value={call.sentiment.satisfaction}
                          />
                        </div>

                        {/* Summary */}
                        <p className="text-[13px] text-gray-600">
                          {call.sentiment.summary}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5">
                          {call.sentiment.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Outcome */}
                      <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                          Outcome
                        </p>
                        <p className="mt-1 text-[13px] text-gray-700">
                          {call.outcome}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {sorted.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <p className="text-sm text-gray-400">No call records yet</p>
        </div>
      )}
    </div>
  );
}

/* ── Sentiment badge ───────────────────────────────────────── */

function SentimentBadge({ score }: { score: number }) {
  const c =
    score >= 8
      ? "bg-green-100 text-green-700"
      : score >= 5
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c}`}
    >
      {score}/10
    </span>
  );
}

/* ── Score meter ───────────────────────────────────────────── */

function ScoreMeter({ label, value }: { label: string; value: number }) {
  const pct = (value / 10) * 100;
  const barColor =
    value >= 8 ? "bg-green-500" : value >= 5 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-500">{label}</span>
        <span className="text-[11px] font-bold text-gray-700">
          {value}/10
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Utility ───────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
