import "server-only";

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export const SESSION_COOKIE_NAME = "china_2026_session";
export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

const ALLOWED_EMAILS = new Set([
  "bebroggi@gmail.com",
  "sofiakovaleva1998@gmail.com",
]);

function adminAuth() {
  const app = getApps()[0] ?? initializeApp();
  return getAuth(app);
}

export function isAllowedEmail(email: string | undefined) {
  return Boolean(email && ALLOWED_EMAILS.has(email.toLowerCase()));
}

export async function verifyAllowedIdToken(idToken: string) {
  const decoded = await adminAuth().verifyIdToken(idToken, true);
  if (!decoded.email_verified || !isAllowedEmail(decoded.email)) return null;
  return decoded;
}

export async function createAllowedSessionCookie(idToken: string) {
  const decoded = await verifyAllowedIdToken(idToken);
  if (!decoded) return null;

  const sessionCookie = await adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  });
  return { sessionCookie, user: decoded };
}

export async function verifyAllowedSessionCookie(sessionCookie?: string) {
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    if (!decoded.email_verified || !isAllowedEmail(decoded.email)) return null;
    return decoded;
  } catch {
    return null;
  }
}
