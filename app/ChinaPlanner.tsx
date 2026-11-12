"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { ALLOWED_EMAILS } from "@/lib/planner/catalog";
import { TripApp } from "./trip/TripApp";

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
    // Ritorno dal login a pagina intera (usato quando la finestra di Google non si apre, es. web app installata).
    getRedirectResult(auth).catch(() => setAuthError("Accesso non riuscito. Riprova con Google."));
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
      if (/popup-blocked|operation-not-supported|web-storage-unsupported/.test(message)) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      if (!message.includes("popup-closed-by-user")) setAuthError("Accesso non riuscito. Riprova con Google.");
    } finally {
      setSigningIn(false);
    }
  }

  if (demo) return <TripApp user={null} demo />;

  if (!authReady) {
    return <main className="access-page"><div className="access-card"><p className="eyebrow">Cina 2026</p><h1>Caricamento del planner…</h1></div></main>;
  }

  if (!currentUser) {
    return <main className="access-page">
      <div className="access-card">
        <p className="eyebrow">Alberto & Sofia · Cina 2026</p>
        <h1>Il viaggio, sempre con voi.</h1>
        <p>Biglietti, hotel, orari e cose da fare: sul telefono, anche offline. Accedi una volta con l&apos;account di Alberto o di Sofia.</p>
        <button className="google-login" onClick={login} disabled={signingIn}>{signingIn ? "Accesso…" : "Continua con Google"}</button>
        {authError && <p className="access-error">{authError}</p>}
        <small>Account autorizzati: Alberto e Sofia.</small>
      </div>
    </main>;
  }

  return <TripApp user={currentUser} demo={false} />;
}
