"use client";

import { FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { useState } from "react";

function localFirebaseConfig(): FirebaseOptions | undefined {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) return undefined;
  return { apiKey, authDomain, projectId, appId };
}

function clientAuth() {
  const config = localFirebaseConfig();
  const app = getApps().length
    ? getApp()
    : config
      ? initializeApp(config)
      : initializeApp();
  return getAuth(app);
}

export function LoginCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn() {
    setBusy(true);
    setError("");

    try {
      const auth = clientAuth();
      await setPersistence(auth, inMemoryPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const payload = (await response.json()) as { error?: string };
      await signOut(auth);

      if (!response.ok) {
        throw new Error(payload.error || "Account non autorizzato.");
      }

      window.location.assign("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Accesso non riuscito.");
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-mark" aria-hidden="true">中</div>
        <p className="eyebrow">Alberto & Sofia · accesso privato</p>
        <h1>China 2026 Planner</h1>
        <p>
          Il viaggio, l’agenda e gli strumenti Gemini sono riservati ai due
          account autorizzati.
        </p>
        <button className="google-login" type="button" onClick={handleSignIn} disabled={busy}>
          <span aria-hidden="true">G</span>
          {busy ? "Accesso in corso…" : "Continua con Google"}
        </button>
        {error && <p className="login-error" role="alert">{error}</p>}
        <small>Usa bebroggi@gmail.com oppure sofiakovaleva1998@gmail.com</small>
      </section>
    </main>
  );
}
