import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Test an OpenAI key with a cheap, token-free call (GET /v1/models). Not persisted. */
export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();
    if (!key || typeof key !== "string") {
      return NextResponse.json({ ok: false, error: "Kein Key angegeben" }, { status: 400 });
    }
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key.trim()}` },
    });
    if (res.ok) return NextResponse.json({ ok: true });
    if (res.status === 401) return NextResponse.json({ ok: false, error: "Key ungültig (401)" });
    return NextResponse.json({ ok: false, error: `OpenAI antwortete mit ${res.status}` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "Validierung fehlgeschlagen" }, { status: 500 });
  }
}
