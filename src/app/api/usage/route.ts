import { NextResponse } from "next/server";
import { getUsage } from "@/lib/store";
import { costUsd } from "@/lib/config";

export const runtime = "nodejs";

/** Aggregated token usage + a cost estimate (tokens × configured model prices). */
export async function GET() {
  try {
    const { rows } = await getUsage();
    const byModel = rows.map((r) => ({
      ...r,
      costUsd: costUsd(r.model, r.promptTokens, r.completionTokens),
    }));
    const totalCostUsd = byModel.reduce((s, r) => s + r.costUsd, 0);
    const requests = byModel.reduce((s, r) => s + r.requests, 0);
    return NextResponse.json({ totalCostUsd, requests, byModel });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "usage failed" }, { status: 500 });
  }
}
