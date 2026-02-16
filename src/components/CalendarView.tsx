"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Phone } from "lucide-react";
import type { Account, CallRecord } from "@/lib/data";

interface CalendarViewProps {
  accounts: Account[];
  calls: CallRecord[];
  onCall?: (accountId: string) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({ accounts, calls, onCall }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  /* ── Calendar grid ─────────────────────────────────────────── */

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const grid: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) grid.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) grid.push(d);
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [year, month]);

  /* ── Events mapped by day ──────────────────────────────────── */

  const followUpsByDay = useMemo(() => {
    const map: Record<number, Account[]> = {};
    accounts.forEach((a) => {
      if (!a.nextFollowUp) return;
      const d = new Date(a.nextFollowUp);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(a);
      }
    });
    return map;
  }, [accounts, month, year]);

  const callsByDay = useMemo(() => {
    const map: Record<number, CallRecord[]> = {};
    calls.forEach((c) => {
      const d = new Date(c.date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(c);
      }
    });
    return map;
  }, [calls, month, year]);

  const today = new Date();
  const isCurrentMonth =
    today.getMonth() === month && today.getFullYear() === year;
  const todayDate = today.getDate();

  /* ── Upcoming follow-ups (all months) ──────────────────────── */

  const upcomingFollowUps = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return accounts
      .filter(
        (a) =>
          a.nextFollowUp &&
          a.stage !== "closed_won" &&
          a.stage !== "closed_lost",
      )
      .sort(
        (a, b) =>
          new Date(a.nextFollowUp!).getTime() -
          new Date(b.nextFollowUp!).getTime(),
      )
      .slice(0, 8);
  }, [accounts]);

  /* ── Recent calls ──────────────────────────────────────────── */

  const recentCalls = useMemo(() => {
    return [...calls]
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )
      .slice(0, 5);
  }, [calls]);

  const prevMonth = () =>
    setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {/* ── Month Calendar ────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{monthName}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={prevMonth}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextMonth}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-medium uppercase tracking-wider text-gray-400"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (day === null) return <div key={i} />;

            const hasFollowUp = !!followUpsByDay[day];
            const hasCall = !!callsByDay[day];
            const isToday = isCurrentMonth && day === todayDate;
            const isSelected = day === selectedDay;
            const isPast = new Date(year, month, day) < today && !isToday;

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={`relative flex h-12 flex-col items-center justify-center rounded-lg text-sm transition-all ${
                  isSelected
                    ? "bg-[#E85D04] text-white shadow-md"
                    : isToday
                      ? "bg-orange-50 font-bold text-[#E85D04] ring-1 ring-[#E85D04]"
                      : isPast
                        ? "text-gray-300 hover:bg-gray-50"
                        : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {day}
                {(hasFollowUp || hasCall) && (
                  <div className="absolute bottom-1 flex gap-0.5">
                    {hasFollowUp && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                    {hasCall && (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Follow-up
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" /> Call
          </span>
        </div>

        {/* Selected day details */}
        {selectedDay && (
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
              {new Date(year, month, selectedDay).toLocaleDateString("default", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>

            {followUpsByDay[selectedDay]?.map((a) => (
              <div
                key={a.id}
                className="mb-2 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    📅 Follow-up: {a.company}
                  </p>
                  <p className="text-xs text-blue-600">
                    {a.contactName} · {a.stage.replace("_", " ")}
                  </p>
                </div>
                {onCall && (
                  <button
                    onClick={() => onCall(a.id)}
                    className="rounded-lg bg-blue-100 p-1.5 text-blue-600 hover:bg-blue-200 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}

            {callsByDay[selectedDay]?.map((c) => {
              const acct = accounts.find((a) => a.id === c.accountId);
              return (
                <div
                  key={c.id}
                  className="mb-2 rounded-lg bg-green-50 px-3 py-2"
                >
                  <p className="text-sm font-medium text-green-900">
                    📞 Call: {acct?.company ?? "Unknown"}
                  </p>
                  <p className="text-xs text-green-600">
                    {Math.round(c.duration / 60)} min · {c.outcome}
                    {c.sentiment && ` · Sentiment: ${c.sentiment.score}/10`}
                  </p>
                </div>
              );
            })}

            {!followUpsByDay[selectedDay] && !callsByDay[selectedDay] && (
              <p className="text-sm text-gray-400">No events this day</p>
            )}
          </div>
        )}
      </div>

      {/* ── Sidebar: Upcoming + Recent ────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming follow-ups */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            📅 Upcoming Follow-ups
          </h3>
          <div className="space-y-2">
            {upcomingFollowUps.length === 0 && (
              <p className="text-sm text-gray-400">No upcoming follow-ups</p>
            )}
            {upcomingFollowUps.map((a) => {
              const fuDate = new Date(a.nextFollowUp!);
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              const diff = Math.round(
                (fuDate.getTime() - now.getTime()) / 86_400_000,
              );
              const urgency =
                diff < 0
                  ? "text-red-600 bg-red-50"
                  : diff === 0
                    ? "text-amber-600 bg-amber-50"
                    : "text-gray-600 bg-gray-50";
              const label =
                diff < 0
                  ? `${Math.abs(diff)}d overdue`
                  : diff === 0
                    ? "Today"
                    : `in ${diff}d`;

              return (
                <div
                  key={a.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${urgency}`}
                >
                  <div>
                    <p className="text-sm font-medium">{a.company}</p>
                    <p className="text-xs opacity-70">{a.contactName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{label}</span>
                    {onCall && (
                      <button
                        onClick={() => onCall(a.id)}
                        className="rounded p-1 hover:bg-white/50 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent calls */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            📞 Recent Calls
          </h3>
          <div className="space-y-2">
            {recentCalls.length === 0 && (
              <p className="text-sm text-gray-400">No calls yet</p>
            )}
            {recentCalls.map((c) => {
              const acct = accounts.find((a) => a.id === c.accountId);
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {acct?.company ?? "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(c.date).toLocaleDateString()} ·{" "}
                      {Math.round(c.duration / 60)} min
                    </p>
                  </div>
                  {c.sentiment && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        c.sentiment.score >= 7
                          ? "bg-green-100 text-green-700"
                          : c.sentiment.score >= 4
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {c.sentiment.score}/10
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
