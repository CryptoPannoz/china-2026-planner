import { NextRequest, NextResponse } from "next/server";
import {
  createAllowedSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/firebase-admin";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Richiesta non autorizzata." }, { status: 403 });
  }

  let idToken = "";
  try {
    const body = (await request.json()) as { idToken?: unknown };
    idToken = typeof body.idToken === "string" ? body.idToken : "";
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  if (!idToken || idToken.length > 10_000) {
    return NextResponse.json({ error: "Token non valido." }, { status: 400 });
  }

  try {
    const session = await createAllowedSessionCookie(idToken);
    if (!session) {
      return NextResponse.json(
        { error: "Questo account Google non è autorizzato ad accedere al planner." },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ ok: true, email: session.user.email });
    response.cookies.set(SESSION_COOKIE_NAME, session.sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json(
      { error: "Accesso non riuscito. Riprova fra un momento." },
      { status: 401 },
    );
  }
}
