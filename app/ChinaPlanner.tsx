"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { ALLOWED_EMAILS } from "@/lib/planner/catalog";
import { PlannerApp } from "./planner/PlannerApp";

const noSubscription = () => () => undefined;

/** Solo in sviluppo: `?demo` apre il planner senza login, con i dati salvati solo nel browser. */
function useDemoMode() {
  return useSyncExternalStore(
    noSubscription,
    () => process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("demo"),
    () => false,
  );
}

export function ChinaPlanner() {
  const demo = useDemoMode();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      const email = user?.email?.toLowerCase() || "";
      if (user && !ALLOWED_EMAILS.has(email)) {
        setAuthError("Questo account non è autorizzato per il planner.");
        await signOut(auth);
        setCurrentUser(null);
      } else {
        setCurrentUser(user);
      }
      setAuthReady(true);
    });
  }, []);

  async function login() {
    setSigningIn(true);
    setAuthError("");
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const email = credential.user.email?.toLowerCase() || "";
      if (!ALLOWED_EMAILS.has(email)) {
        await signOut(auth);
        setAuthError("Usa l’account di Alberto o quello di Sofia.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("popup-closed-by-user")) setAuthError("Accesso non riuscito. Riprova con Google.");
    } finally {
      setSigningIn(false);
    }
  }

  if (demo) return <PlannerApp user={null} demo />;

  if (!authReady) {
    return <main className="access-page"><div className="access-card"><p className="eyebrow">Cina 2026</p><h1>Caricamento del planner…</h1></div></main>;
  }

  if (!currentUser) {
    return <main className="access-page">
      <div className="access-card">
        <p className="eyebrow">Alberto & Sofia · Cina 2026</p>
        <h1>Il viaggio, sempre con voi.</h1>
        <p>Accedi con uno dei due account autorizzati. Agenda, costi e note saranno sincronizzati tra computer e telefono.</p>
        <button className="google-login" onClick={login} disabled={signingIn}>{signingIn ? "Accesso…" : "Continua con Google"}</button>
        {authError && <p className="access-error">{authError}</p>}
        <small>Account autorizzati: Alberto e Sofia.</small>
      </div>
    </main>;
  }

  return <PlannerApp user={currentUser} demo={false} />;
}
