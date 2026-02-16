import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { addCallRecord, createAccount, getAccounts } from "@/lib/store";

/**
 * Vapi webhook handler — receives events from Vapi for inbound phone calls.
 *
 * Set the Vapi phone number Server URL to:
 *   https://pilot-crm.onrender.com/api/vapi
 *
 * Flow:
 *   1. Caller dials the Vapi phone number
 *   2. Vapi sends "assistant-request" → we return Alex's assistant config
 *   3. Alex (AI) gathers: name, company, role, industry, needs, budget
 *   4. Call ends → Vapi sends "end-of-call-report" with full transcript
 *   5. We use Claude to extract lead info from the transcript
 *   6. New account is created in the pipeline as a "Lead"
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
        return await handleEndOfCallReport(body.message);

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
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

/**
 * Return Alex's assistant config for inbound phone calls.
 * Alex's job: greet the caller, learn about them, and qualify them as a lead.
 */
function handleAssistantRequest() {
  return NextResponse.json({
    assistant: {
      firstMessage:
        "Hey there! This is Alex from PilotCRM. Thanks for calling in. Who do I have the pleasure of speaking with?",
      model: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "system",
            content: [
              `You are Alex, a senior account manager at PilotCRM, a B2B SaaS company that sells developer tools and platform solutions.`,
              `Someone is calling your direct line. Your job is to:`,
              ``,
              `1. GREET them warmly and learn their name`,
              `2. ASK what company they're with and their role`,
              `3. DISCOVER their needs — what problems are they trying to solve?`,
              `4. QUALIFY the lead — ask about:`,
              `   - Team size (how many developers/users?)`,
              `   - Current tools they're using`,
              `   - Timeline for making a decision`,
              `   - Approximate budget range they're working with`,
              `   - What industry they're in`,
              `5. PITCH PilotCRM briefly — we offer developer tools, API management, and team collaboration`,
              `6. CLOSE with next steps — offer to send a proposal, schedule a demo, or connect them with a specialist`,
              ``,
              `IMPORTANT RULES:`,
              `- Be natural and conversational — don't sound like a form`,
              `- Ask ONE question at a time, don't overwhelm the caller`,
              `- If they give you info unprompted, acknowledge it and move on`,
              `- If they seem hesitant, don't push — offer to send info via email`,
              `- Always be professional, friendly, and helpful`,
              `- Keep responses to 1-3 sentences`,
              `- If they ask about pricing, our plans start at $24K/year for teams and go up to enterprise custom pricing`,
              `- Always confirm their email before ending the call so we can follow up`,
              ``,
              `Remember: every piece of info you gather becomes a lead in our CRM. Get their name, company, role, email, industry, and what they need.`,
            ].join("\n"),
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

/**
 * When the call ends, use Claude to extract structured lead info
 * from the transcript and create a new account in the pipeline.
 */
async function handleEndOfCallReport(message: Record<string, unknown>) {
  const transcript = String(message.transcript ?? "");
  const summary = String(message.summary ?? "Inbound call completed");
  const durationSeconds = Number(message.duration ?? 0);

  if (!transcript || transcript.length < 20) {
    console.log("[Vapi] Call ended with minimal transcript, skipping.");
    return NextResponse.json({ ok: true });
  }

  /* First, check if the caller matches an existing account */
  const existingAccounts = getAccounts();
  let matchedExisting = false;

  for (const account of existingAccounts) {
    const lower = transcript.toLowerCase();
    if (
      lower.includes(account.company.toLowerCase()) ||
      lower.includes(account.contactName.toLowerCase())
    ) {
      /* Existing account — just log the call */
      addCallRecord(account.id, {
        accountId: account.id,
        date: new Date().toISOString(),
        duration: durationSeconds,
        transcript,
        sentiment: null,
        outcome: summary,
      });
      console.log(
        `[Vapi] Inbound call matched existing account: ${account.company}`,
      );
      matchedExisting = true;
      break;
    }
  }

  if (matchedExisting) {
    return NextResponse.json({ ok: true });
  }

  /* New caller — extract lead info with Claude */
  let leadInfo = {
    company: "Unknown Company",
    contactName: "Unknown Caller",
    contactEmail: "unknown@email.com",
    contactRole: "Unknown",
    industry: "Technology",
    dealValue: 24000,
    notes: [summary],
  };

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `Extract lead information from this inbound sales call transcript. The caller is a potential customer for PilotCRM.

TRANSCRIPT:
${transcript}

Return ONLY valid JSON with this structure:
{
  "contactName": "<full name of the caller, or 'Unknown Caller' if not mentioned>",
  "company": "<company name, or 'Unknown Company' if not mentioned>",
  "contactRole": "<their job title/role, or 'Unknown' if not mentioned>",
  "contactEmail": "<email if mentioned, or generate a plausible one like firstname@company.com>",
  "industry": "<their industry, or best guess based on context>",
  "dealValue": <estimated annual deal value in dollars based on team size and needs — use 24000 as minimum for small teams, 96000 for mid-size, 240000+ for enterprise>,
  "teamSize": "<number of developers/users if mentioned>",
  "needs": "<1-2 sentence summary of what they need>",
  "timeline": "<when they want to decide, if mentioned>",
  "notes": ["<key insight 1>", "<key insight 2>", "<key insight 3>"]
}`,
          },
        ],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        leadInfo = {
          company: parsed.company || "Unknown Company",
          contactName: parsed.contactName || "Unknown Caller",
          contactEmail: parsed.contactEmail || "unknown@email.com",
          contactRole: parsed.contactRole || "Unknown",
          industry: parsed.industry || "Technology",
          dealValue: parsed.dealValue || 24000,
          notes: [
            ...(parsed.notes || []),
            parsed.needs ? `Needs: ${parsed.needs}` : "",
            parsed.timeline ? `Timeline: ${parsed.timeline}` : "",
            parsed.teamSize ? `Team size: ${parsed.teamSize}` : "",
          ].filter(Boolean),
        };
      }
    } catch (err) {
      console.error("[Vapi] Claude lead extraction failed:", err);
    }
  }

  /* Create the new account */
  const newAccount = createAccount(leadInfo);

  /* Log the call against the new account */
  addCallRecord(newAccount.id, {
    accountId: newAccount.id,
    date: new Date().toISOString(),
    duration: durationSeconds,
    transcript,
    sentiment: null,
    outcome: summary,
  });

  console.log(
    `[Vapi] New inbound lead created: ${leadInfo.company} — ${leadInfo.contactName}`,
  );

  return NextResponse.json({
    ok: true,
    newAccountId: newAccount.id,
    company: leadInfo.company,
  });
}

/** Allow GET for health-check / verification */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "pilot-crm-vapi-webhook",
  });
}
