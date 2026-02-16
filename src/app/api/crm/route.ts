import { NextRequest, NextResponse } from "next/server";
import {
  getAccounts,
  getAccountByCompany,
  getAccount,
  getAllCalls,
  getCallsByAccount,
  getActivitiesByAccount,
  getRecentActivities,
  getPipelineStats,
  updateAccountStage,
  updateAccountLikelihood,
  addNoteToAccount,
  addCallRecord,
  createAccount,
  flagAccountRisk,
  persistFromRoute,
} from "@/lib/store";
import type { Stage } from "@/lib/data";

/**
 * GET /api/crm — returns full CRM state
 */
export async function GET() {
  return NextResponse.json({
    accounts: getAccounts(),
    calls: getAllCalls(),
    activities: getRecentActivities(20),
    stats: getPipelineStats(),
  });
}

/**
 * POST /api/crm — handles all mutations
 * Body: { action: string, ...params }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "moveStage": {
        const accountId =
          body.accountId ??
          getAccountByCompany(body.companyName ?? "")?.id;
        if (!accountId) {
          return NextResponse.json(
            { error: true, message: "Account not found" },
            { status: 404 },
          );
        }
        const validStages: Stage[] = [
          "lead",
          "discovery",
          "proposal",
          "negotiation",
          "closed_won",
          "closed_lost",
        ];
        const stage = validStages.find(
          (s) => s === String(body.stage ?? "").toLowerCase().replace(/\s+/g, "_"),
        );
        if (!stage) {
          return NextResponse.json(
            { error: true, message: `Invalid stage: ${body.stage}` },
            { status: 400 },
          );
        }
        const acct = updateAccountStage(accountId, stage);
        const stageLabel: Record<string, string> = {
          lead: "Lead",
          discovery: "Discovery",
          proposal: "Proposal",
          negotiation: "Negotiation",
          closed_won: "Closed Won",
          closed_lost: "Closed Lost",
        };
        return NextResponse.json({
          ok: true,
          message: `✅ Moved ${acct?.company ?? "account"} to ${stageLabel[stage] ?? stage}`,
          account: acct,
        });
      }

      case "addNote": {
        const acct = getAccountByCompany(body.companyName ?? "");
        if (!acct) {
          return NextResponse.json(
            { error: true, message: `Account "${body.companyName}" not found` },
            { status: 404 },
          );
        }
        addNoteToAccount(acct.id, body.note);
        return NextResponse.json({
          ok: true,
          message: `📝 Note added to ${acct.company}`,
        });
      }

      case "getAccountBrief": {
        const acct = getAccountByCompany(body.companyName ?? "");
        if (!acct) {
          return NextResponse.json({ error: true, msg: `"${body.companyName}" not found.` });
        }
        return NextResponse.json({
          account: acct,
          calls: getCallsByAccount(acct.id),
          activities: getActivitiesByAccount(acct.id).slice(0, 6),
        });
      }

      case "updateLikelihood": {
        const acct = getAccountByCompany(body.companyName ?? "");
        if (!acct) {
          return NextResponse.json({ error: true }, { status: 404 });
        }
        const oldLikelihood = acct.likelihood;
        updateAccountLikelihood(acct.id, body.likelihood);
        return NextResponse.json({
          ok: true,
          company: acct.company,
          old: oldLikelihood,
          now: body.likelihood,
        });
      }

      case "flagRisk": {
        const acct = getAccountByCompany(body.companyName ?? "");
        if (!acct) {
          return NextResponse.json({ error: true }, { status: 404 });
        }
        flagAccountRisk(acct.id, body.reason);
        return NextResponse.json({
          ok: true,
          company: acct.company,
          reason: body.reason,
        });
      }

      case "addCall": {
        const record = addCallRecord(body.accountId, {
          accountId: body.accountId,
          date: body.date ?? new Date().toISOString(),
          duration: body.duration ?? 0,
          transcript: body.transcript ?? "",
          sentiment: body.sentiment ?? null,
          outcome: body.outcome ?? "Call completed",
        });

        const acct = getAccount(body.accountId);
        const analysis = body.analysis;
        const sentimentScore =
          analysis?.overallSentiment ?? body.sentiment?.score ?? null;
        const likelihoodFromCall = analysis?.likelihoodToClose ?? null;

        if (
          acct &&
          acct.stage !== "closed_won" &&
          acct.stage !== "closed_lost"
        ) {
          /* ── 1. Update likelihood based on call analysis ───── */
          if (typeof likelihoodFromCall === "number") {
            const newLikelihood = Math.round(
              acct.likelihood * 0.3 + likelihoodFromCall * 0.7,
            );
            updateAccountLikelihood(acct.id, newLikelihood);
          }

          /* ── 2. Auto-adjust pipeline stage based on sentiment  */
          const stageOrder: Stage[] = [
            "lead",
            "discovery",
            "proposal",
            "negotiation",
          ];
          const currentIdx = stageOrder.indexOf(acct.stage as Stage);

          if (typeof sentimentScore === "number" && currentIdx >= 0) {
            if (sentimentScore <= 3 && currentIdx > 0) {
              updateAccountStage(acct.id, stageOrder[currentIdx - 1]);
            }
            if (sentimentScore <= 3) {
              flagAccountRisk(
                acct.id,
                `Negative call — sentiment ${sentimentScore}/10: ${body.outcome ?? "poor engagement"}`,
              );
            }
            if (sentimentScore >= 8 && currentIdx < stageOrder.length - 1) {
              updateAccountStage(acct.id, stageOrder[currentIdx + 1]);
            }
          }

          /* ── 3. Add call summary as a note ─────────────────── */
          const summary = analysis?.summary ?? body.outcome;
          if (summary) {
            const noteLines = [`📞 Call summary: ${summary}`];
            const nextSteps = analysis?.nextSteps;
            if (Array.isArray(nextSteps) && nextSteps.length > 0) {
              noteLines.push(
                `Next steps: ${nextSteps.slice(0, 3).join("; ")}`,
              );
            }
            addNoteToAccount(acct.id, noteLines.join(" | "));
          }

          /* ── 4. Update tags based on call analysis ─────────── */
          const tagsToAdd: string[] = [];
          const tagsToRemove: string[] = [];

          if (typeof sentimentScore === "number") {
            if (sentimentScore >= 8) {
              tagsToAdd.push("engaged");
              tagsToRemove.push("at-risk");
            } else if (sentimentScore <= 3) {
              tagsToAdd.push("at-risk");
              tagsToRemove.push("engaged");
            }
          }

          if (typeof likelihoodFromCall === "number") {
            if (likelihoodFromCall >= 75) {
              tagsToAdd.push("high-priority");
            }
          }

          const painPoints = analysis?.painPoints;
          if (Array.isArray(painPoints) && painPoints.length > 0) {
            const painText = painPoints.join(" ").toLowerCase();
            if (painText.includes("budget") || painText.includes("price") || painText.includes("cost")) {
              tagsToAdd.push("budget-concern");
            }
            if (painText.includes("compliance") || painText.includes("security") || painText.includes("legal")) {
              tagsToAdd.push("compliance-blocker");
            }
            if (painText.includes("timeline") || painText.includes("deadline") || painText.includes("urgent")) {
              tagsToAdd.push("urgent-timeline");
            }
          }

          /* Apply tag changes */
          for (const tag of tagsToAdd) {
            if (!acct.tags.includes(tag)) {
              acct.tags.push(tag);
            }
          }
          for (const tag of tagsToRemove) {
            const idx = acct.tags.indexOf(tag);
            if (idx >= 0) acct.tags.splice(idx, 1);
          }

          /* ── 5. Set next follow-up based on call ───────────── */
          const nextSteps = analysis?.nextSteps;
          if (Array.isArray(nextSteps) && nextSteps.length > 0) {
            const followUpDays =
              typeof sentimentScore === "number" && sentimentScore >= 7
                ? 2
                : 5;
            acct.nextFollowUp = new Date(
              Date.now() + followUpDays * 86_400_000,
            )
              .toISOString()
              .split("T")[0];
          }

          /* ── 6. If likelihood dropped below 30, flag at-risk  */
          const refreshedAcct = getAccount(body.accountId);
          if (
            refreshedAcct &&
            refreshedAcct.likelihood < 30 &&
            !refreshedAcct.tags.includes("at-risk")
          ) {
            flagAccountRisk(
              acct.id,
              `Likelihood dropped to ${refreshedAcct.likelihood}% after call`,
            );
          }

          /* Persist all tag/follow-up changes */
          persistFromRoute();
        }

        return NextResponse.json({ ok: true, callId: record.id });
      }

      case "createAccount": {
        const newAcct = createAccount({
          company: body.company ?? "Unknown",
          contactName: body.contactName ?? "Unknown",
          contactEmail: body.contactEmail ?? "",
          contactRole: body.contactRole ?? "",
          industry: body.industry ?? "Technology",
          dealValue: body.dealValue ?? 24000,
          notes: body.notes ?? [],
        });
        return NextResponse.json({ ok: true, account: newAcct });
      }

      default:
        return NextResponse.json(
          { error: true, message: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error("[CRM API] Error:", err);
    return NextResponse.json(
      { error: true, message: "Internal error" },
      { status: 500 },
    );
  }
}
