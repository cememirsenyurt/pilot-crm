import { NextRequest, NextResponse } from "next/server";
import { addCallRecord, getAccounts } from "@/lib/data";

/**
 * Vapi webhook handler — receives events from Vapi for inbound phone calls.
 * Set the Vapi phone number Server URL to:
 *   https://pilot-crm.onrender.com/api/vapi
 */

interface VapiMessage {
  message: {
    type: string;
    [key: string]: unknown;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VapiMessage;
    const { type } = body.message;

    switch (type) {
      case "assistant-request":
        return handleAssistantRequest();

      case "end-of-call-report":
        return handleEndOfCallReport(body.message);

      case "status-update":
      case "speech-update":
      case "transcript":
      case "hang":
      case "tool-calls":
        return NextResponse.json({ ok: true });

      default:
        return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("Vapi webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

/** Return assistant config for inbound calls */
function handleAssistantRequest() {
  return NextResponse.json({
    assistant: {
      firstMessage:
        "Hi, you've reached the PilotCRM sales team. How can I help you today?",
      model: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "system",
            content: `You are Sam, a friendly and professional AI sales assistant for PilotCRM.
You help callers with questions about their accounts, the product, pricing, and next steps.
Keep responses concise and helpful. If you don't know something, offer to have a human rep follow up.`,
          },
        ],
      },
      voice: {
        provider: "11labs",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
      },
    },
  });
}

/** Log completed calls into the CRM */
function handleEndOfCallReport(message: Record<string, unknown>) {
  const transcript = String(message.transcript ?? "");
  const summary = String(message.summary ?? "Inbound call completed");
  const durationSeconds = Number(message.endedReason === "hangup" ? message.duration ?? 0 : message.duration ?? 0);

  // Try to match caller to an account by scanning transcript for company/contact names
  const accounts = getAccounts();
  let matchedAccountId = accounts[0]?.id ?? "acc-1"; // default fallback

  for (const account of accounts) {
    const lower = transcript.toLowerCase();
    if (
      lower.includes(account.company.toLowerCase()) ||
      lower.includes(account.contactName.toLowerCase())
    ) {
      matchedAccountId = account.id;
      break;
    }
  }

  addCallRecord(matchedAccountId, {
    accountId: matchedAccountId,
    date: new Date().toISOString(),
    duration: durationSeconds,
    transcript: transcript || "(No transcript recorded)",
    sentiment: null,
    outcome: summary,
  });

  console.log(`[Vapi] End-of-call logged for account ${matchedAccountId}`);
  return NextResponse.json({ ok: true });
}

/** Allow GET for health-check / verification */
export async function GET() {
  return NextResponse.json({ status: "ok", service: "pilot-crm-vapi-webhook" });
}
