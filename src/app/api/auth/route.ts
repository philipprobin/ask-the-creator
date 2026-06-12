import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;

  // If no password is set, allow access
  if (!sitePassword) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { password } = await req.json();

    if (password === sitePassword) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Falsches Passwort" },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage" },
      { status: 400 }
    );
  }
}
