"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { buildView } from "@/lib/planner/model";
import type { TaxiInfo } from "@/lib/planner/types";
import { InfoTab } from "./Info";
import { ScheduleTab } from "./Schedule";
import { TaxiCard } from "./TaxiCard";
import { TodoTab } from "./Todo";
import { WalletTab } from "./Wallet";
import { TripContext, type Tab, type Trip } from "./shared";
import { usePlanSync, type SyncStatus } from "./usePlanSync";

const TABS: Array<[Tab, string, string]> = [
  ["viaggio", "🗓️", "Viaggio"],
  ["wallet", "🎫", "Wallet"],
  ["todo", "☑️", "Da fare"],
  ["info", "ℹ️", "Info"],
];

const SYNC: Record<SyncStatus, string> = {
  loading: "Collegamento…",
  saving: "Salvataggio…",
  synced: "Sincronizzato",
  offline: "Offline · copia sul telefono",
  error: "Non sincronizzato · copia sul telefono",
  demo: "Prova locale",
};

export function TripApp({ user, demo }: { user: User | null; demo: boolean }) {
  const { plan, update, ready, status, lastSavedAt, log } = usePlanSync(user, demo);
  const view = useMemo(() => buildView(plan), [plan]);
  const [tab, setTab] = useState<Tab>("viaggio");
  const [taxi, setTaxi] = useState<TaxiInfo | null>(null);
  const email = user?.email?.toLowerCase() || "";
  const who = email.startsWith("sofia") ? "sofia" : email.startsWith("bebroggi") ? "alberto" : null;

  // Telefono in tasca: chiude il campo in modifica così il testo scritto viene salvato.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, []);

  // Web app installabile e usabile offline (solo sul sito pubblicato).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js").catch(() => undefined);
  }, []);

  const open = useCallback<Trip["open"]>((next, anchor) => {
    setTab(next);
    window.setTimeout(() => {
      const target = anchor ? document.getElementById(anchor) : null;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        target.classList.add("flash");
        window.setTimeout(() => target.classList.remove("flash"), 1600);
      } else window.scrollTo({ top: 0 });
    }, 60);
  }, []);

  const trip: Trip = { plan, view, update, log, showChinese: setTaxi, open, who };

  return <TripContext.Provider value={trip}>
    <main className="app">
      <header className="topbar">
        <div><b>Cina 2026</b><span>Alberto & Sofia · 16 nov → 4 dic</span></div>
        <span className={`sync ${status}`} title={lastSavedAt ? `Ultimo salvataggio ${lastSavedAt.toLocaleString("it-IT")}` : ""}><i />{SYNC[status]}</span>
      </header>
      {!ready ? <div className="card loading"><b>Scarico il viaggio…</b><span>Serve internet solo la prima volta: poi resta sul telefono.</span></div> : <>
        {tab === "viaggio" && <ScheduleTab />}
        {tab === "wallet" && <WalletTab />}
        {tab === "todo" && <TodoTab />}
        {tab === "info" && <InfoTab footer={<article className="card account">
          <span>{email || "prova locale"}</span>
          {!demo && <button className="chip" onClick={() => signOut(auth)}>Esci</button>}
        </article>} />}
      </>}
      <nav className="tabbar" aria-label="Sezioni">
        {TABS.map(([id, icon, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => open(id)}><span>{icon}</span>{label}</button>)}
      </nav>
      {taxi && <TaxiCard info={taxi} onClose={() => setTaxi(null)} />}
    </main>
  </TripContext.Provider>;
}
