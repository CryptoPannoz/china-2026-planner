"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ARRIVAL_KEY, TRIP_NIGHTS } from "@/lib/planner/catalog";
import { buildView } from "@/lib/planner/model";
import type { Currency, ScheduleKind, TaxiInfo } from "@/lib/planner/types";
import { toEuro } from "@/lib/planner/utils";
import { PlannerContext, type Planner, type Section } from "./context";
import { AgendaSection } from "./sections/Agenda";
import { BudgetSection } from "./sections/Budget";
import { HotelsSection } from "./sections/Hotels";
import { ItinerarySection } from "./sections/Itinerary";
import { HistorySection, NotesSection } from "./sections/Notes";
import { TransportSection } from "./sections/Transport";
import { TaxiCard } from "./TaxiCard";
import { useChangeLog, usePlanSync, type SyncStatus } from "./usePlanSync";

const NAV_ITEMS: Array<[Section, string]> = [
  ["itinerary", "Itinerario"],
  ["calendar", "Agenda & spese"],
  ["hotels", "Hotel"],
  ["transport", "Trasporti"],
  ["budget", "Budget"],
  ["planner", "Checklist & note"],
  ["history", "Modifiche"],
];

const SYNC_LABELS: Record<SyncStatus, string> = {
  loading: "Collegamento al database…",
  saving: "Salvataggio…",
  synced: "Tutto sincronizzato",
  offline: "Offline · le modifiche partono appena torna la rete",
  error: "Sincronizzazione non riuscita · le modifiche restano su questo dispositivo",
  demo: "Prova locale · niente viene salvato nel cloud",
};

async function compressCoverPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Scegli un file immagine.");
  if (file.size > 12_000_000) throw new Error("La foto supera 12 MB.");
  const source = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / source.width, 900 / source.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossibile preparare la foto.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  let quality = .8;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 560_000 && quality > .45) {
    quality -= .08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > 650_000) throw new Error("La foto resta troppo grande: scegline una più leggera.");
  return dataUrl;
}

export function PlannerApp({ user, demo }: { user: User | null; demo: boolean }) {
  const { plan, update, ready, status, lastSavedAt, log } = usePlanSync(user, demo);
  const view = useMemo(() => buildView(plan), [plan]);
  const changeLog = useChangeLog(!demo && Boolean(user));
  const [section, setSection] = useState<Section>("itinerary");
  const [selectedDate, setSelectedDate] = useState(ARRIVAL_KEY);
  const [selectedStopId, setSelectedStopId] = useState("beijing");
  const [agendaNewKind, setAgendaNewKind] = useState<ScheduleKind>("activity");
  const [notice, setNotice] = useState("");
  const [taxiInfo, setTaxiInfo] = useState<TaxiInfo | null>(null);
  const [photoError, setPhotoError] = useState("");
  const noticeTimer = useRef<number | null>(null);

  // Telefono in tasca o cambio app: chiude il campo in modifica così il testo scritto viene salvato.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, []);

  const notify = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 9000);
  }, []);

  const goTo = useCallback<Planner["goTo"]>((next, options = {}) => {
    if (options.date) setSelectedDate(options.date);
    if (options.stopId) setSelectedStopId(options.stopId);
    setAgendaNewKind(options.newBlockKind || "activity");
    setSection(next);
    const anchor = options.anchor || (next === "hotels" && options.stopId ? `hotels-${options.stopId}` : "");
    window.setTimeout(() => {
      const target = anchor ? document.getElementById(anchor) : null;
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
      else document.querySelector(".nav")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, []);

  const eur = useCallback((value: number, currency: Currency | undefined) => toEuro(value, currency, plan.cnyPerEuro), [plan.cnyPerEuro]);

  async function changeCoverPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError("");
    try {
      const coverPhoto = await compressCoverPhoto(file);
      update((current) => ({ ...current, coverPhoto }));
      log("Copertina aggiornata", "Ha caricato una nuova foto di viaggio");
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Non riesco a preparare questa foto.");
    }
  }

  const planner: Planner = { plan, view, update, log, notify, section, goTo, agendaNewKind, selectedDate, setSelectedDate, selectedStopId, setSelectedStopId, showChinese: setTaxiInfo, eur };

  return (
    <PlannerContext.Provider value={planner}>
      <main className="shell">
        <header className="hero has-photo" style={{ backgroundImage: `linear-gradient(0deg, rgba(6,27,20,.62), rgba(6,27,20,.06) 55%), url("${plan.coverPhoto || "china-hero-couple.jpg"}")` }}>
          <div className="hero-bar">
            <p className="eyebrow">Alberto & Sofia · Cina 2026 · 17 nov → 4 dic</p>
            <div className="cover-actions">
              <label>📷 {plan.coverPhoto ? "Cambia foto" : "Aggiungi foto"}<input type="file" accept="image/*" onChange={changeCoverPhoto} /></label>
              {plan.coverPhoto && <button onClick={() => {
                update((current) => ({ ...current, coverPhoto: "" }));
                log("Copertina rimossa", "Ha rimosso la foto di viaggio");
              }}>Rimuovi</button>}
            </div>
          </div>
          {photoError && <p className="photo-error">{photoError}</p>}
        </header>

        <div className="flight-anchors">
          <div><span className="anchor-icon">↓</span><p><b>Arrivo a Pechino</b><strong>Martedì 17 novembre · 12:25</strong><small>PEK · transfer verso l’hotel</small></p></div>
          <div className="window-meter"><span style={{ width: `${Math.min(100, (view.usedNights / TRIP_NIGHTS) * 100)}%` }} /><b>{view.usedNights} / {TRIP_NIGHTS} notti assegnate</b></div>
          <div><span className="anchor-icon outbound">↑</span><p><b>Partenza da Shanghai</b><strong>Venerdì 4 dicembre · 09:40</strong><small>PVG · arrivo consigliato 06:40</small></p></div>
        </div>

        <nav className="nav" aria-label="Sezioni del viaggio">
          {NAV_ITEMS.map(([id, label]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>
            {label}{id === "itinerary" && view.issues.length > 0 && <i className="nav-badge" title="Cose da sistemare">{view.issues.length}</i>}
          </button>)}
        </nav>
        <div className={`sync-bar ${status}`}>
          <span><i />{SYNC_LABELS[status]}</span>
          <small>{lastSavedAt ? `Ultimo salvataggio ${lastSavedAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} · ` : ""}{user?.email || "prova locale"}</small>
          {!demo && <button onClick={() => signOut(auth)}>Esci</button>}
        </div>
        {notice && <div className="notice-bar" role="status"><span>✈️ {notice}</span><button aria-label="Chiudi avviso" onClick={() => setNotice("")}>×</button></div>}

        {!ready ? <div className="loading-card card"><b>Carico il piano condiviso…</b><span>Un attimo: sto scaricando l’ultima versione salvata da Alberto e Sofia.</span></div> : <>
          {section === "itinerary" && <ItinerarySection />}
          {section === "calendar" && <AgendaSection />}
          {section === "hotels" && <HotelsSection />}
          {section === "transport" && <TransportSection />}
          {section === "budget" && <BudgetSection />}
          {section === "planner" && <NotesSection />}
          {section === "history" && <HistorySection entries={changeLog} />}
        </>}

        {taxiInfo && <TaxiCard info={taxiInfo} onClose={() => setTaxiInfo(null)} />}
      </main>
    </PlannerContext.Provider>
  );
}
