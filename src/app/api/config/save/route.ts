import { NextRequest, NextResponse } from "next/server";
import { setLocalKeys, isEnvKey, type KeyName } from "@/lib/config";

export const runtime = "nodejs";

/**
 * Persist keys to the local config file (self-host). Env-managed keys are
 * skipped (they win anyway, e.g. on Vercel). A read-only filesystem (serverless)
 * yields a clear error telling the user to use environment variables instead.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const map: Record<KeyName, unknown> = {
      OPENAI_API_KEY: body.openaiKey,
      YOUTUBE_API_KEY: body.youtubeKey,
      SUPADATA_API_KEY: body.supadataKey,
    };

    const toSave: Partial<Record<KeyName, string>> = {};
    const skipped: KeyName[] = [];
    for (const [k, v] of Object.entries(map) as [KeyName, unknown][]) {
      if (typeof v !== "string" || !v.trim()) continue;
      if (isEnvKey(k)) { skipped.push(k); continue; } // env-managed, can't override
      toSave[k] = v.trim();
    }

    if (Object.keys(toSave).length > 0) setLocalKeys(toSave);
    return NextResponse.json({ ok: true, saved: Object.keys(toSave), skipped });
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          "Keys konnten nicht gespeichert werden (schreibgeschütztes Dateisystem?). " +
          "Auf gehosteten Umgebungen (z. B. Vercel) bitte Environment-Variablen nutzen.",
        detail: e.message,
      },
      { status: 500 }
    );
  }
}
