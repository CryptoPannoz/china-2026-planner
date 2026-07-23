import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginCard } from "./LoginCard";
import {
  SESSION_COOKIE_NAME,
  verifyAllowedSessionCookie,
} from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const user = await verifyAllowedSessionCookie(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
  );
  if (user) redirect("/");

  return <LoginCard />;
}
