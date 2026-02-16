"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Phone, X, Mic, MicOff, Clock } from "lucide-react";
import type { Account, CallRecord } from "@/lib/data";

/* ── Types ─────────────────────────────────────────────────── */

type CallState = "pre-call" | "active" | "post-call";

interface TranscriptMsg {
  role: "assistant" | "user";
  text: string;
}

interface SentimentResult {
  overallSentiment: number;
  customerSatisfaction: number;
  likelihoodToClose: number;
  painPoints: string[];
  positiveSignals: string[];
  objectionsRaised: string[];
  nextSteps: string[];
  summary: string;
  reasoning: {
    sentimentReasoning: string;
    satisfactionReasoning: string;
    likelihoodReasoning: string;
  };
}

/* ── Props ─────────────────────────────────────────────────── */

interface CallModalProps {
  accounts: Account[];
  calls: CallRecord[];
  selectedAccountId: string | null;
  onClose: () => void;
  onCallComplete: (accountId: string, record: Omit<CallRecord, "id">) => void;
}

/* ── Component ─────────────────────────────────────────────── */

export function CallModal({
  accounts,
  calls: allCalls,
  selectedAccountId,
  onClose,
  onCallComplete,
}: CallModalProps) {
  const [callState, setCallState] = useState<CallState>("pre-call");
  const [accountId, setAccountId] = useState(
    selectedAccountId ?? accounts[0]?.id ?? "",
  );
  const [transcript, setTranscript] = useState<TranscriptMsg[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [muted, setMuted] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const account = accounts.find((a) => a.id === accountId);
  const lastCalls = account
    ? allCalls.filter((c) => c.accountId === account.id).slice(-1)
    : [];
  const lastSentiment = lastCalls[0]?.sentiment;

  /* ── Start call ──────────────────────────────────────────── */

  const startCall = useCallback(async () => {
    const pubKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    const assistId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

    if (!pubKey || !account) {
      setCallError("Missing Vapi configuration. Check environment variables.");
      return;
    }

    setCallError(null);

    try {
      const VapiModule = await import("@vapi-ai/web");
      const Vapi = VapiModule.default;
      const vapi = new Vapi(pubKey);
      vapiRef.current = vapi;

      vapi.on("message", (msg: Record<string, unknown>) => {
        if (msg.type === "transcript" && msg.transcriptType === "final") {
          setTranscript((prev) => [
            ...prev,
            {
              role: msg.role === "assistant" ? "assistant" : "user",
              text: String(msg.transcript ?? ""),
            },
          ]);
        }
      });

      vapi.on("call-end", () => {
        setCallState("post-call");
        if (timerRef.current) clearInterval(timerRef.current);
      });

      vapi.on("error", (err: unknown) => {
        console.error("Vapi error:", err);
        setCallError("Call error occurred. Please try again.");
      });

      /* Build assistant overrides with account context.
         The Vapi assistant acts as Alex (the sales rep).
         The human user role-plays as the customer. */
      const overrides = {
        firstMessage: `Hi ${account.contactName}, this is Alex from PilotCRM. Thanks for taking my call today. How have you been?`,
        model: {
          provider: "anthropic" as const,
          model: "claude-sonnet-4-20250514" as const,
          messages: [
            {
              role: "system" as const,
              content: [
                `You are Alex, a senior account manager at PilotCRM, a B2B SaaS company that sells developer tools and platform solutions.`,
                `You are on a sales call with ${account.contactName}, who is the ${account.contactRole} at ${account.company}.`,
                ``,
                `ACCOUNT CONTEXT:`,
                `- Company: ${account.company}`,
                `- Industry: ${account.industry}`,
                `- Current Plan: ${account.plan}`,
                `- Deal Value: $${account.dealValue.toLocaleString()}`,
                `- Pipeline Stage: ${account.stage.replace("_", " ")}`,
                `- Close Likelihood: ${account.likelihood}%`,
                `- Tags: ${account.tags.join(", ") || "none"}`,
                `- Recent Notes: ${account.notes.slice(-3).join(" | ") || "No notes yet"}`,
                ``,
                `YOUR OBJECTIVES FOR THIS CALL:`,
                `1. Build rapport — ask how they're doing, reference past conversations if notes exist`,
                `2. Understand current needs — ask open-ended questions about their challenges`,
                `3. Address concerns — if they mention pricing, compliance, timeline, or competition, handle it confidently`,
                `4. Advance the deal — suggest concrete next steps (demo, proposal review, technical deep-dive, contract)`,
                `5. Gather intel — learn about decision makers, budget timeline, competing solutions`,
                ``,
                `BEHAVIOR RULES:`,
                `- Be professional, warm, and conversational — not robotic`,
                `- Keep responses concise (2-3 sentences typically)`,
                `- Listen carefully and respond to what they actually say`,
                `- Ask one question at a time, don't overwhelm`,
                `- If they seem ready to end the call, summarize next steps and thank them`,
                `- Never make up facts about PilotCRM's product — stay general if unsure`,
              ].join("\n"),
            },
          ],
        },
      };

      if (assistId) {
        await vapi.start(assistId, overrides);
      } else {
        await vapi.start(overrides);
      }

      setCallState("active");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      console.error("Vapi start failed:", err);
      setCallError(
        `Failed to start call: ${err instanceof Error ? err.message : "Unknown error"}. Check browser microphone permissions.`,
      );
    }
  }, [account]);

  /* ── End call ────────────────────────────────────────────── */

  const endCall = () => {
    vapiRef.current?.stop?.();
    if (timerRef.current) clearInterval(timerRef.current);
    setCallState("post-call");
  };

  /* ── Toggle mute ─────────────────────────────────────────── */

  const toggleMute = () => {
    if (vapiRef.current) {
      if (muted) {
        vapiRef.current.setMuted?.(false);
      } else {
        vapiRef.current.setMuted?.(true);
      }
    }
    setMuted(!muted);
  };

  /* ── Analyze sentiment on post-call ──────────────────────── */

  useEffect(() => {
    if (callState !== "post-call" || sentiment || analyzing) return;
    if (transcript.length === 0) {
      setSentiment(null);
      setAnalyzing(false);
      return;
    }

    setAnalyzing(true);

    const full = transcript
      .map(
        (m) =>
          `${m.role === "assistant" ? "Alex (Sales Rep)" : account?.contactName ?? "Customer"}: ${m.text}`,
      )
      .join("\n");

    fetch("/api/analyze-sentiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: full,
        accountId,
        contactName: account?.contactName ?? "Unknown",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSentiment(data);
        setAnalyzing(false);
      })
      .catch(() => setAnalyzing(false));
  }, [callState, sentiment, analyzing, transcript, accountId, account]);

  /* ── Save ────────────────────────────────────────────────── */

  const handleSave = () => {
    if (!account) return;

    const full = transcript
      .map(
        (m) =>
          `${m.role === "assistant" ? "Alex (Sales Rep)" : account.contactName}: ${m.text}`,
      )
      .join("\n");

    onCallComplete(accountId, {
      accountId,
      date: new Date().toISOString(),
      duration: elapsed,
      transcript: full || "(No transcript recorded)",
      sentiment: sentiment
        ? {
            score: sentiment.overallSentiment,
            satisfaction: sentiment.customerSatisfaction,
            summary: sentiment.summary,
            tags: [
              ...sentiment.painPoints.slice(0, 2).map(() => "pain-point"),
              ...sentiment.positiveSignals
                .slice(0, 2)
                .map(() => "positive-signal"),
            ],
          }
        : null,
      outcome: sentiment?.summary ?? "Call completed",
      _analysis: sentiment
        ? {
            likelihoodToClose: sentiment.likelihoodToClose,
            overallSentiment: sentiment.overallSentiment,
            painPoints: sentiment.painPoints,
            positiveSignals: sentiment.positiveSignals,
            nextSteps: sentiment.nextSteps,
          }
        : null,
    } as Omit<CallRecord, "id"> & { _analysis?: Record<string, unknown> });

    onClose();
  };

  /* ── Export JSON ──────────────────────────────────────────── */

  const handleExport = () => {
    if (!sentiment) return;
    const blob = new Blob([JSON.stringify(sentiment, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-${account?.company ?? "call"}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Auto-scroll ─────────────────────────────────────────── */

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript]);

  /* ── Cleanup ─────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      vapiRef.current?.stop?.();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${callState === "active" ? "bg-green-100" : "bg-orange-100"}`}
            >
              <Phone
                className={`h-4 w-4 ${callState === "active" ? "text-green-600" : "text-orange-600"}`}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {callState === "pre-call" && "New Call"}
                {callState === "active" &&
                  `On Call with ${account?.contactName ?? "..."}`}
                {callState === "post-call" && "Call Complete"}
              </h3>
              {callState === "active" && (
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <span className="text-xs text-gray-500">
                    {fmtTime(elapsed)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={callState === "active" ? endCall : onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── PRE-CALL ─────────────────────────────────────────── */}
        {callState === "pre-call" && (
          <div className="flex-1 overflow-y-auto p-6">
            {/* Account selector */}
            <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Select Account
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              {accounts
                .filter(
                  (a) =>
                    a.stage !== "closed_won" && a.stage !== "closed_lost",
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.company} — {a.contactName}
                  </option>
                ))}
            </select>

            {/* Context */}
            {account && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Contact</p>
                  <p className="text-sm font-medium text-gray-900">
                    {account.contactName} — {account.contactRole}
                  </p>
                  <p className="text-xs text-gray-500">
                    {account.contactEmail}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">Stage</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {account.stage.replace("_", " ")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">
                      Deal Value
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      ${account.dealValue.toLocaleString()}
                    </p>
                  </div>
                </div>
                {lastSentiment && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                    <p className="text-xs font-medium text-blue-600">
                      Last Call Sentiment
                    </p>
                    <p className="text-sm text-blue-800">
                      Score: {lastSentiment.score}/10 —{" "}
                      {lastSentiment.summary}
                    </p>
                  </div>
                )}
                {account.notes.length > 0 && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">
                      Latest Note
                    </p>
                    <p className="text-sm text-gray-700">
                      {account.notes[account.notes.length - 1]}
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
                  <p className="text-xs font-medium text-orange-600">
                    How This Works
                  </p>
                  <p className="text-sm text-orange-800">
                    The AI will play as <strong>Alex</strong> (you, the sales
                    rep). You speak as{" "}
                    <strong>{account.contactName}</strong> from{" "}
                    {account.company}. Have a natural sales conversation!
                  </p>
                </div>
              </div>
            )}

            {callError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-medium text-red-600">Error</p>
                <p className="text-sm text-red-700">{callError}</p>
              </div>
            )}

            <button
              onClick={startCall}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
            >
              <Phone className="h-4 w-4" />
              Start Call
            </button>
          </div>
        )}

        {/* ── ACTIVE CALL ──────────────────────────────────────── */}
        {callState === "active" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Transcript area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto scroll-thin space-y-3 p-4"
            >
              {transcript.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">
                  Waiting for conversation...
                </p>
              )}
              {transcript.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-orange-50 text-gray-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    <p className="mb-0.5 text-[10px] font-semibold uppercase text-gray-400">
                      {msg.role === "assistant"
                        ? "🤖 Alex (AI Rep)"
                        : `👤 ${account?.contactName ?? "Customer"}`}
                    </p>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Call controls */}
            <div className="flex items-center justify-center gap-4 border-t border-gray-100 px-6 py-4">
              <button
                onClick={toggleMute}
                className={`rounded-full p-3 transition-colors ${muted ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {muted ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={endCall}
                className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
              >
                <Phone className="h-4 w-4 rotate-[135deg]" />
                End Call
              </button>
              <div className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                {fmtTime(elapsed)}
              </div>
            </div>
          </div>
        )}

        {/* ── POST-CALL ────────────────────────────────────────── */}
        {callState === "post-call" && (
          <div className="flex-1 overflow-y-auto scroll-thin p-6">
            {analyzing && (
              <div className="flex flex-col items-center py-12">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-orange-500" />
                <p className="mt-4 text-sm font-medium text-gray-600">
                  🧠 Analyzing with Claude...
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Processing transcript and generating insights
                </p>
              </div>
            )}

            {!analyzing && sentiment && (
              <div className="space-y-4">
                {/* Score card */}
                <div className="grid grid-cols-3 gap-3">
                  <ScoreCard
                    label="Sentiment"
                    value={sentiment.overallSentiment}
                    max={10}
                  />
                  <ScoreCard
                    label="Satisfaction"
                    value={sentiment.customerSatisfaction}
                    max={10}
                  />
                  <ScoreCard
                    label="Close %"
                    value={sentiment.likelihoodToClose}
                    max={100}
                    pct
                  />
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-900">
                    {sentiment.summary}
                  </p>
                </div>

                {sentiment.painPoints.length > 0 && (
                  <Section
                    title="🔴 Pain Points"
                    items={sentiment.painPoints}
                    color="red"
                  />
                )}
                {sentiment.positiveSignals.length > 0 && (
                  <Section
                    title="🟢 Positive Signals"
                    items={sentiment.positiveSignals}
                    color="green"
                  />
                )}
                {sentiment.nextSteps.length > 0 && (
                  <Section
                    title="📋 Next Steps"
                    items={sentiment.nextSteps}
                    color="blue"
                  />
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    className="flex-1 rounded-lg bg-[#E85D04] py-2.5 text-sm font-semibold text-white hover:bg-[#D04D00] transition-colors"
                  >
                    Save & Close
                  </button>
                  <button
                    onClick={handleExport}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Export JSON
                  </button>
                </div>
              </div>
            )}

            {!analyzing && !sentiment && transcript.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500">
                  No transcript recorded.
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 rounded-lg bg-gray-100 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────── */

function ScoreCard({
  label,
  value,
  max,
  pct,
}: {
  label: string;
  value: number;
  max: number;
  pct?: boolean;
}) {
  const ratio = value / max;
  const color =
    ratio >= 0.7
      ? "text-green-600 bg-green-50 border-green-200"
      : ratio >= 0.4
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-red-600 bg-red-50 border-red-200";

  return (
    <div className={`rounded-lg border p-3 text-center ${color}`}>
      <p className="text-2xl font-bold">
        {value}
        {pct ? "%" : `/${max}`}
      </p>
      <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">
        {label}
      </p>
    </div>
  );
}

function Section({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: "red" | "green" | "blue";
}) {
  const bg = { red: "bg-red-50", green: "bg-green-50", blue: "bg-blue-50" }[
    color
  ];
  const text = {
    red: "text-red-700",
    green: "text-green-700",
    blue: "text-blue-700",
  }[color];

  return (
    <div className={`rounded-lg ${bg} p-3`}>
      <p className={`mb-1.5 text-xs font-semibold ${text}`}>{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`text-sm ${text} opacity-80`}>
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
