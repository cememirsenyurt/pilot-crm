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
        const acct = updateAccountStage(accountId, body.stage as Stage);
        return NextResponse.json({
          ok: true,
          message: `✅ Moved ${acct?.company ?? "account"} to ${body.stage}`,
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

        /* If sentiment includes likelihoodToClose, update the account */
        if (body.sentiment?.likelihoodToClose) {
          const acct = getAccount(body.accountId);
          if (acct) {
            updateAccountLikelihood(
              acct.id,
              Math.round(
                (acct.likelihood + body.sentiment.likelihoodToClose) / 2,
              ),
            );
          }
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
