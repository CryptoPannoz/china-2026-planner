"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { STOP_ZH, SUGGESTED_STOPS } from "@/lib/planner/catalog";
import { bestInsertionAfter, distanceKm, isLockedStop, scheduleActivity, scheduleKind, stopFromSuggestion, updateLeg } from "@/lib/planner/model";
import type { Activity, PlanData, Stop, SuggestedStop } from "@/lib/planner/types";
import { euro, formatCost, formatLongDate, formatShortDate, googleMapsSearchUrl, googleMapsStopUrl, plural, slugify, uid, webSearchUrl } from "@/lib/planner/utils";
import { usePlanner } from "../context";
import { MoneyInput } from "../fields";
import { geocodeCity, reverseGeocode } from "../geocode";
import { RouteMap } from "../RouteMap";
import { useStopActions } from "../useStopActions";

/** Città del catalogo con quel nome (es. «Guilin» → Guilin & Yangshuo con le sue attività clou). */
function catalogMatch(plan: PlanData, name: string) {
  const slug = slugify(name);
  const lower = name.toLocaleLowerCase("it");
  return SUGGESTED_STOPS.find((item) => !plan.stops.some((stop) => stop.id === item.id)
    && (item.id === slug || item.name.toLocaleLowerCase("it") === lower || item.name.toLocaleLowerCase("it").startsWith(`${lower} `)));
}

function customStop(plan: PlanData, name: string, place: { lat: number; lng: number; nameZh?: string }): Stop {
  const slug = slugify(name);
  const nameZh = place.nameZh || STOP_ZH[slug];
  return {
    id: plan.stops.some((stop) => stop.id === slug) || SUGGESTED_STOPS.some((item) => item.id === slug) ? uid("stop") : slug,
    name,
    ...(nameZh ? { nameZh } : {}),
    lat: place.lat,
    lng: place.lng,
    nights: 1,
    hotelNightly: 80,
    activities: [],
  };
}

/** Le proposte del catalogo hanno una posizione consigliata; altrimenti vale la geografia. */
function suggestedAfter(plan: PlanData, suggestion: SuggestedStop) {
  const curated = plan.stops.findIndex((stop) => stop.id === suggestion.insertAfterId);
  return curated >= 0 && curated < plan.stops.length - 1 ? suggestion.insertAfterId : bestInsertionAfter(plan.stops, suggestion);
}

export function ItinerarySection() {
  const { plan } = usePlanner();
  const suggestions = useMemo(
    () => SUGGESTED_STOPS.filter((suggestion) => !plan.stops.some((stop) => stop.id === suggestion.id) && !plan.dismissedSuggestions.includes(suggestion.id)),
    [plan.stops, plan.dismissedSuggestions],
  );
  return <>
    <TripStrip />
    <section className="section-grid">
      <div className="stack">
        <IssuesCard />
        <MapCard suggestions={suggestions} />
        <StopsCard />
        <SuggestionsCard suggestions={suggestions} />
      </div>
      <CityPanel />
    </section>
  </>;
}

function TripStrip() {
  const { view, selectedStopId, setSelectedStopId } = usePlanner();
  return <div className="trip-strip" aria-label="I giorni del viaggio">
    {view.calendar.map((day) => (
      <button key={day.dateKey} className={`${day.stopId && day.stopId === selectedStopId ? "current" : ""} ${day.type}`} onClick={() => day.stopId && setSelectedStopId(day.stopId)} title={`Giorno ${day.index + 1} · ${day.city}`}>
        <small>G{day.index + 1}</small>
        <b>{formatShortDate(day.dateKey)}</b>
        <span>{day.city}</span>
      </button>
    ))}
  </div>;
}

function IssuesCard() {
  const { view, goTo } = usePlanner();
  if (view.issues.length === 0) return <div className="plan-ok">✓ Piano coerente: notti, hotel, tratte e agenda tornano.</div>;
  return <article className="card issues-card">
    <div className="card-head"><div><p className="eyebrow">Controlli automatici</p><h2>Da sistemare</h2></div><span className="fit-badge">{view.issues.length}</span></div>
    <ul className="issue-list">
      {view.issues.map((issue) => <li key={issue.id}>
        <span>{issue.text}</span>
        <button onClick={() => goTo(issue.section, { date: issue.date, stopId: issue.stopId || view.calendar.find((day) => day.dateKey === issue.date)?.stopId })}>Apri →</button>
      </li>)}
    </ul>
  </article>;
}

function NightsStepper({ stop }: { stop: Stop }) {
  const { view } = usePlanner();
  const actions = useStopActions();
  return <div className="nights-stepper" onClick={(event) => event.stopPropagation()}>
    <button type="button" aria-label={`Una notte in meno a ${stop.name}`} disabled={stop.nights <= 1} onClick={() => actions.changeNights(stop, stop.nights - 1)}>−</button>
    <b>{plural(stop.nights, "notte", "notti")}</b>
    <button type="button" aria-label={`Una notte in più a ${stop.name}`} className={view.remainingNights <= 0 ? "maxed" : ""} onClick={() => actions.changeNights(stop, stop.nights + 1)}>+</button>
  </div>;
}

function StopsCard() {
  const { plan, view, selectedStopId, setSelectedStopId, update, notify, log } = usePlanner();
  const actions = useStopActions();
  const [form, setForm] = useState({ name: "", nights: 1, afterId: "", donorId: "" });
  const [adding, setAdding] = useState(false);
  const insertable = plan.stops.slice(0, -1);
  const defaultAfter = insertable.some((stop) => stop.id === selectedStopId) ? selectedStopId : insertable.at(-1)?.id || "beijing";
  const afterId = insertable.some((stop) => stop.id === form.afterId) ? form.afterId : defaultAfter;

  function toggleLeg(legId: string, included: boolean, label: string) {
    update((current) => updateLeg(current, legId, { included }));
    log(included ? "Tratta inclusa" : "Tratta esclusa", label);
  }

  async function addStop(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name || adding) return;
    const suggestion = catalogMatch(plan, name);
    let stop: Stop;
    if (suggestion) {
      stop = stopFromSuggestion(suggestion);
    } else {
      setAdding(true);
      const coords = await geocodeCity(name);
      setAdding(false);
      if (!coords) notify(`${name}: coordinate non trovate, il punto sulla mappa è indicativo.`);
      stop = customStop(plan, name, coords || { lat: 30, lng: 111 });
    }
    if (actions.add(stop, { afterId, nights: form.nights, donorId: form.donorId })) setForm({ name: "", nights: 1, afterId: "", donorId: "" });
  }

  return <article className="card">
    <div className="card-head">
      <div><p className="eyebrow">17 nov → 4 dic · date dei voli fisse</p><h2>Tappe e collegamenti</h2></div>
      <span className={`fit-badge ${view.remainingNights === 0 ? "ok" : ""}`}>{view.remainingNights === 0 ? "17/17 notti" : view.remainingNights > 0 ? `${plural(view.remainingNights, "notte libera", "notti libere")}` : `${plural(-view.remainingNights, "notte", "notti")} di troppo`}</span>
    </div>
    <div className="route-editor">
      {view.timeline.map((entry, index) => {
        const { stop } = entry;
        const leg = view.legs[index];
        const locked = isLockedStop(stop.id);
        return <div key={stop.id}>
          <div className={`stop-editor ${selectedStopId === stop.id ? "selected" : ""}`} onClick={() => setSelectedStopId(stop.id)}>
            <span className="stop-number">{index + 1}</span>
            <div className="stop-main"><b>{stop.name}</b><small>{formatShortDate(entry.arrival)} → {formatShortDate(entry.departure)}</small></div>
            <NightsStepper stop={stop} />
            <div className="stop-actions" onClick={(event) => event.stopPropagation()}>
              {locked ? <span className="lock">volo</span> : <>
                <button title="Sposta prima" disabled={index <= 1} onClick={() => actions.move(stop, -1)}>↑</button>
                <button title="Sposta dopo" disabled={index >= view.timeline.length - 2} onClick={() => actions.move(stop, 1)}>↓</button>
                <button className="danger" title="Elimina tappa" onClick={() => actions.remove(stop)}>×</button>
              </>}
            </div>
          </div>
          {leg && <div className={`leg-inline ${leg.included ? "" : "disabled"} ${leg.bookingStatus === "prenotato" ? "booked" : ""}`}>
            <span className="leg-rail" />
            <div>
              <b>{leg.included ? leg.mode : "Trasporto escluso"}{leg.bookingStatus === "prenotato" ? " · ✓ prenotata" : ""}</b>
              <small>{leg.included ? `${leg.departureTime ? `${leg.departureTime}${leg.arrivalTime ? `→${leg.arrivalTime}` : ""} · ` : ""}${leg.duration} · ${formatCost(leg.cost, leg.currency)}` : "Manca il collegamento tra le due tappe"}</small>
            </div>
            <button onClick={() => toggleLeg(leg.id, !leg.included, view.legLabel(leg))}>{leg.included ? "Togli" : "Includi"}</button>
          </div>}
        </div>;
      })}
      <form className="add-stop add-stop-rich" onSubmit={addStop}>
        <input className="add-stop-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Aggiungi una città per nome (o toccala sulla mappa)" list="suggested-stop-names" />
        <datalist id="suggested-stop-names">{SUGGESTED_STOPS.filter((suggestion) => !plan.stops.some((stop) => stop.id === suggestion.id)).map((suggestion) => <option key={suggestion.id} value={suggestion.name} />)}</datalist>
        <label>Dopo<select value={afterId} onChange={(event) => setForm((current) => ({ ...current, afterId: event.target.value }))}>{insertable.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select></label>
        <label>Notti<select value={form.nights} onChange={(event) => setForm((current) => ({ ...current, nights: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map((nights) => <option key={nights} value={nights}>{nights}</option>)}</select></label>
        <DonorSelect value={form.donorId} onChange={(donorId) => setForm((current) => ({ ...current, donorId }))} />
        <button type="submit" disabled={adding || !form.name.trim()}>{adding ? "Cerco la città…" : "+ Aggiungi tappa"}</button>
        <small>Le 17 notti sono fisse: la nuova tappa prende le notti da quella scelta (minimo 1 a tappa) e ti avviso di cosa ho spostato.</small>
      </form>
    </div>
  </article>;
}

function DonorSelect({ value, onChange }: { value: string; onChange: (donorId: string) => void }) {
  const { plan, view } = usePlanner();
  return <label>Notti prese da<select value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">{view.remainingNights > 0 ? `Notti libere (${view.remainingNights})` : "La tappa prima, poi la più lunga"}</option>
    {plan.stops.filter((stop) => stop.nights > 1).map((stop) => <option key={stop.id} value={stop.id}>{stop.name} ({stop.nights} notti)</option>)}
  </select></label>;
}

type NewStopDraft = { kind: "new"; lat: number; lng: number; name: string; nameZh?: string; suggestionId?: string; nights: number; afterId: string; donorId: string; searching: boolean };
type MapOverlay = { kind: "stop"; stopId: string } | NewStopDraft | null;

/** Pixel entro cui un tocco sulla mappa «aggancia» una tappa o una città da valutare già presenti. */
const SNAP_PX = 20;
const metersPerPixel = (zoom: number, lat: number) => 156543.03 * Math.cos(lat * Math.PI / 180) / 2 ** zoom;

function MapCard({ suggestions }: { suggestions: SuggestedStop[] }) {
  const { plan, view, selectedStopId, setSelectedStopId, update, log } = usePlanner();
  const actions = useStopActions();
  const [overlay, setOverlay] = useState<MapOverlay>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const requestRef = useRef(0);
  const visibleSuggestions = useMemo(() => (showSuggestions ? suggestions : []), [showSuggestions, suggestions]);
  const selected = view.stopById.get(selectedStopId) || plan.stops[0];
  const pendingLat = overlay?.kind === "new" ? overlay.lat : null;
  const pendingLng = overlay?.kind === "new" ? overlay.lng : null;
  const pending = useMemo(() => (pendingLat === null || pendingLng === null ? null : { lat: pendingLat, lng: pendingLng }), [pendingLat, pendingLng]);

  function openStop(stopId: string) {
    requestRef.current++;
    setSelectedStopId(stopId);
    setOverlay({ kind: "stop", stopId });
  }

  function openSuggestion(suggestionId: string) {
    const suggestion = SUGGESTED_STOPS.find((item) => item.id === suggestionId);
    if (!suggestion) return;
    requestRef.current++;
    // Sulla mappa si ragiona per geografia: la posizione che allunga meno il percorso attuale.
    setOverlay({ kind: "new", lat: suggestion.lat, lng: suggestion.lng, name: suggestion.name, suggestionId: suggestion.id, nights: suggestion.nights, afterId: bestInsertionAfter(plan.stops, suggestion), donorId: "", searching: false });
  }

  function pickPoint(lat: number, lng: number, zoom: number) {
    const point = { lat, lng };
    const snapKm = SNAP_PX * metersPerPixel(zoom, lat) / 1000;
    const nearStop = plan.stops.find((stop) => distanceKm(stop, point) <= snapKm);
    if (nearStop) return openStop(nearStop.id);
    const nearSuggestion = visibleSuggestions.find((suggestion) => distanceKm(suggestion, point) <= snapKm);
    if (nearSuggestion) return openSuggestion(nearSuggestion.id);
    const request = ++requestRef.current;
    setOverlay({ kind: "new", lat, lng, name: "", nights: 1, afterId: bestInsertionAfter(plan.stops, point), donorId: "", searching: true });
    void reverseGeocode(lat, lng).then((place) => {
      if (requestRef.current !== request) return;
      setOverlay((current) => {
        if (current?.kind !== "new" || current.suggestionId) return current;
        const suggestion = place ? catalogMatch(plan, place.name) : undefined;
        if (suggestion) return { ...current, lat: suggestion.lat, lng: suggestion.lng, name: suggestion.name, suggestionId: suggestion.id, nights: suggestion.nights, searching: false };
        return { ...current, searching: false, name: current.name || place?.name || "", ...(place?.nameZh ? { nameZh: place.nameZh } : {}), lat: place?.lat ?? current.lat, lng: place?.lng ?? current.lng };
      });
    });
  }

  function confirmNewStop(draft: NewStopDraft) {
    const name = draft.name.trim();
    if (!name) return;
    const suggestion = draft.suggestionId ? SUGGESTED_STOPS.find((item) => item.id === draft.suggestionId) : undefined;
    const stop = suggestion ? stopFromSuggestion(suggestion) : customStop(plan, name, draft);
    if (actions.add(stop, { afterId: draft.afterId, nights: draft.nights, donorId: draft.donorId }, "Tappa aggiunta dalla mappa")) setOverlay({ kind: "stop", stopId: stop.id });
  }

  function dismissSuggestion(suggestionId: string) {
    const suggestion = SUGGESTED_STOPS.find((item) => item.id === suggestionId);
    update((current) => ({ ...current, dismissedSuggestions: [...new Set([...current.dismissedSuggestions, suggestionId])] }));
    if (suggestion) log("Proposta scartata", suggestion.name);
    setOverlay(null);
  }

  return <article className="card map-card">
    <div className="card-head"><div><p className="eyebrow">Mappa dell&apos;itinerario</p><h2>La rotta, tappa per tappa</h2></div><span className="subtle">Tocca un punto per aggiungere una tappa · tocca un numero per gestirla</span></div>
    <RouteMap
      stops={plan.stops}
      legs={view.legs}
      suggestions={visibleSuggestions}
      selectedStopId={selectedStopId}
      pending={pending}
      onStopClick={openStop}
      onSuggestionClick={openSuggestion}
      onMapClick={pickPoint}
    >
      {overlay?.kind === "stop" && <StopOverlay stopId={overlay.stopId} onClose={() => setOverlay(null)} />}
      {overlay?.kind === "new" && <NewStopOverlay draft={overlay} onChange={(patch) => setOverlay((current) => (current?.kind === "new" ? { ...current, ...patch } : current))} onConfirm={() => confirmNewStop(overlay)} onDismissSuggestion={dismissSuggestion} onClose={() => {
        requestRef.current++;
        setOverlay(null);
      }} />}
    </RouteMap>
    <div className="map-footer">
      <div className="map-legend"><span><i /> Tappa</span><span><i className="suggested" /> Da valutare</span><span><i className="route" /> Trasporto</span><span><i className="route off" /> Escluso</span></div>
      <label className="map-toggle"><input type="checkbox" checked={showSuggestions} onChange={(event) => setShowSuggestions(event.target.checked)} /> Città da valutare</label>
      <a href={googleMapsStopUrl(selected)} target="_blank" rel="noreferrer">{selected.name} in Google Maps ↗</a>
    </div>
  </article>;
}

function StopOverlay({ stopId, onClose }: { stopId: string; onClose: () => void }) {
  const { view, goTo } = usePlanner();
  const actions = useStopActions();
  const entry = view.entryById.get(stopId);
  if (!entry) return null;
  const { stop, index } = entry;
  const locked = isLockedStop(stop.id);
  const arriving = view.legs.find((leg) => leg.toId === stop.id);
  return <div className="map-overlay" role="dialog" aria-label={`Tappa ${stop.name}`}>
    <header>
      <span className="stop-number">{index + 1}</span>
      <div><b>{stop.name}{stop.nameZh ? <small className="zh"> {stop.nameZh}</small> : null}</b><small>{formatShortDate(entry.arrival)} → {formatShortDate(entry.departure)}{arriving?.included ? ` · arrivo con ${arriving.mode}` : ""}</small></div>
      <button type="button" className="map-overlay-close" aria-label="Chiudi" onClick={onClose}>×</button>
    </header>
    <div className="map-overlay-row">
      <NightsStepper stop={stop} />
      {!locked && <div className="stop-actions">
        <button title="Sposta prima" disabled={index <= 1} onClick={() => actions.move(stop, -1)}>↑</button>
        <button title="Sposta dopo" disabled={index >= view.timeline.length - 2} onClick={() => actions.move(stop, 1)}>↓</button>
      </div>}
    </div>
    <div className="map-overlay-actions">
      <button type="button" onClick={() => goTo("calendar", { date: entry.arrival })}>Giornate →</button>
      <button type="button" onClick={() => goTo("hotels", { stopId: stop.id })}>Hotel →</button>
      {!locked && <button type="button" className="danger-text" onClick={() => {
        if (actions.remove(stop)) onClose();
      }}>Elimina tappa</button>}
    </div>
  </div>;
}

function NewStopOverlay({ draft, onChange, onConfirm, onDismissSuggestion, onClose }: {
  draft: NewStopDraft;
  onChange: (patch: Partial<NewStopDraft>) => void;
  onConfirm: () => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onClose: () => void;
}) {
  const { plan } = usePlanner();
  const suggestion = draft.suggestionId ? SUGGESTED_STOPS.find((item) => item.id === draft.suggestionId) : undefined;
  const insertable = plan.stops.slice(0, -1);
  return <form className="map-overlay" aria-label="Nuova tappa" onSubmit={(event) => {
    event.preventDefault();
    onConfirm();
  }}>
    <header>
      <span className="route-pin pending small">+</span>
      <div><b>{suggestion ? suggestion.name : "Nuova tappa qui"}</b><small>{suggestion ? `Città da valutare · hotel ~${euro.format(suggestion.hotelNightly)}/notte` : draft.searching ? "Cerco il nome del luogo…" : draft.nameZh || "Scrivi il nome della città"}</small></div>
      <button type="button" className="map-overlay-close" aria-label="Chiudi" onClick={onClose}>×</button>
    </header>
    {suggestion ? <div className="map-overlay-recap"><p>{suggestion.recap}</p><small>🚄 {suggestion.transport}</small></div> : <label className="map-overlay-name">Nome<input autoFocus value={draft.name} placeholder={draft.searching ? "Cerco…" : "Es. Pingyao"} onChange={(event) => onChange({ name: event.target.value })} /></label>}
    <div className="map-overlay-grid">
      <label>Dopo<select value={draft.afterId} onChange={(event) => onChange({ afterId: event.target.value })}>{insertable.map((stop, index) => <option key={stop.id} value={stop.id}>{index + 1}. {stop.name}</option>)}</select></label>
      <label>Notti<select value={draft.nights} onChange={(event) => onChange({ nights: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((nights) => <option key={nights} value={nights}>{nights}</option>)}</select></label>
      <DonorSelect value={draft.donorId} onChange={(donorId) => onChange({ donorId })} />
    </div>
    <div className="map-overlay-actions">
      <button type="submit" className="primary" disabled={!draft.name.trim()}>+ Aggiungi tappa</button>
      {suggestion && <button type="button" className="danger-text" onClick={() => onDismissSuggestion(suggestion.id)}>Scarta</button>}
      <button type="button" onClick={onClose}>Annulla</button>
    </div>
  </form>;
}

function SuggestionsCard({ suggestions }: { suggestions: SuggestedStop[] }) {
  const { plan, update, log } = usePlanner();
  const actions = useStopActions();

  function add(suggestion: SuggestedStop) {
    const afterId = suggestedAfter(plan, suggestion);
    actions.add(stopFromSuggestion(suggestion), { afterId, nights: suggestion.nights, donorId: afterId }, "Tappa aggiunta dalle proposte");
  }

  function dismiss(suggestion: SuggestedStop) {
    update((current) => ({ ...current, dismissedSuggestions: [...new Set([...current.dismissedSuggestions, suggestion.id])] }));
    log("Proposta scartata", suggestion.name);
  }

  return <details className="card suggestions-card">
    <summary className="card-head"><div><p className="eyebrow">Varianti possibili</p><h2>Città da valutare ({suggestions.length})</h2></div><span className="subtle">Apri per aggiungere o scartare ▾</span></summary>
    <div className="suggestion-list">
      {suggestions.length === 0 && <p className="empty">Nessuna proposta in sospeso: le hai aggiunte al piano o scartate tutte.</p>}
      {suggestions.map((suggestion) => <div className="suggestion-row" key={suggestion.id}>
        <div className="suggestion-main">
          <div className="suggestion-title"><b>{suggestion.name}</b><span>{plural(suggestion.nights, "notte", "notti")} · hotel ~{euro.format(suggestion.hotelNightly)}/notte</span></div>
          <p>{suggestion.recap}</p>
          <small>🚄 {suggestion.transport}</small>
          <small>❄️ {suggestion.season}</small>
          <span className="activity-links"><a href={webSearchUrl(`${suggestion.name} Cina cosa vedere`)} target="_blank" rel="noreferrer">Cerca sul web ↗</a><a href={googleMapsStopUrl(suggestion)} target="_blank" rel="noreferrer">Google Maps ↗</a></span>
        </div>
        <div className="suggestion-actions">
          <button className="primary" onClick={() => add(suggestion)}>+ Aggiungi al piano</button>
          <button className="danger-text" onClick={() => dismiss(suggestion)}>Scarta</button>
        </div>
      </div>)}
    </div>
    {plan.dismissedSuggestions.length > 0 && <button className="restore-suggestions" onClick={() => {
      update((current) => ({ ...current, dismissedSuggestions: [] }));
      log("Proposte ripristinate", "Tutte le città scartate sono di nuovo visibili");
    }}>↻ Ripristina {plural(plan.dismissedSuggestions.length, "proposta scartata", "proposte scartate")}</button>}
  </details>;
}

function CityPanel() {
  const { plan, view, selectedStopId, update, log, goTo, showChinese, eur } = usePlanner();
  const [newActivity, setNewActivity] = useState({ name: "", price: 0 });
  const stop = view.stopById.get(selectedStopId) || plan.stops[0];
  const entry = view.entryById.get(stop.id);
  const stopItems = plan.scheduleItems.filter((item) => item.stopId === stop.id);
  const stopDays = view.calendar.filter((day) => day.stopId === stop.id);
  const stopHotels = plan.hotelStays.filter((stay) => stay.stopId === stop.id);
  const scheduledItem = (activity: Activity) => plan.scheduleItems.find((item) => item.sourceActivityId === activity.id && item.stopId === stop.id);

  function schedule(activity: Activity) {
    const existing = scheduledItem(activity);
    if (existing) {
      goTo("calendar", { date: existing.date, anchor: `plan-${existing.id}` });
      return;
    }
    const id = uid("plan");
    const preview = scheduleActivity(plan, stop.id, activity, { id });
    if (!preview) return;
    update((current) => scheduleActivity(current, stop.id, activity, { id, day: preview.item.day })?.plan ?? current);
    log("Attività in agenda", `${activity.name} · ${formatShortDate(preview.item.date)} ${preview.item.startTime}`);
    goTo("calendar", { date: preview.item.date, anchor: `plan-${id}` });
  }

  function updateActivity(activityId: string, patch: Partial<Activity>) {
    update((current) => ({ ...current, stops: current.stops.map((item) => item.id !== stop.id ? item : { ...item, activities: item.activities.map((activity) => (activity.id === activityId ? { ...activity, ...patch } : activity)) }) }));
  }

  function addActivity(event: FormEvent) {
    event.preventDefault();
    const name = newActivity.name.trim();
    if (!name) return;
    const activity: Activity = { id: uid("clou"), name, description: "", price: newActivity.price, currency: "EUR", selected: false };
    update((current) => ({ ...current, stops: current.stops.map((item) => (item.id !== stop.id ? item : { ...item, activities: [...item.activities, activity] })) }));
    setNewActivity({ name: "", price: 0 });
    log("Attività clou aggiunta", `${stop.name}: ${name}`);
  }

  function removeActivity(activity: Activity) {
    update((current) => ({ ...current, stops: current.stops.map((item) => (item.id !== stop.id ? item : { ...item, activities: item.activities.filter((entryActivity) => entryActivity.id !== activity.id) })) }));
    log("Attività clou rimossa", `${stop.name}: ${activity.name}`);
  }

  return <aside className="card city-workspace">
    <div className="card-head sticky"><div><p className="eyebrow">Tappa selezionata</p><h2>{stop.name}</h2></div><span className="city-dates">{entry ? `${formatShortDate(entry.arrival)} → ${formatShortDate(entry.departure)}` : ""}</span></div>
    <div className="city-body">
      <div className="mini-budget"><span>Blocchi in agenda</span><b>{stopItems.length}</b><small>{euro.format(stopItems.reduce((sum, item) => sum + eur(item.price, item.currency), 0))} nel budget</small></div>
      <button className="hotel-field hotel-link" onClick={() => goTo("hotels", { stopId: stop.id })}>
        <span>⌂ {stopHotels.length === 0 ? "Nessun hotel" : stopHotels.map((stay) => stay.name).join(" · ")}</span>
        <strong>{stopHotels.some((stay) => stay.bookingStatus === "prenotato") ? "✓" : ""} →</strong>
      </button>

      <h3>Agenda giorno per giorno</h3>
      <div className="city-days">
        {stopDays.map((day) => {
          const dayItems = view.itemsByDate.get(day.dateKey) || [];
          return <button className="city-day" key={day.dateKey} onClick={() => goTo("calendar", { date: day.dateKey })}>
            <div className="city-day-head"><small>G{day.index + 1}</small><b>{formatLongDate(day.dateKey)}</b><i>Apri →</i></div>
            {day.leg?.included && <p className="city-day-leg">{day.leg.mode} da {view.stopById.get(day.leg.fromId)?.name}{day.leg.departureTime ? ` · ${day.leg.departureTime}` : ""}</p>}
            {dayItems.length === 0 ? <p className="empty">Giornata ancora libera</p> : <ul>
              {dayItems.map((item) => <li key={item.id} className={`kind-${scheduleKind(item)}`}><span>{item.startTime}</span>{item.name}{item.price > 0 && <em>{formatCost(item.price, item.currency)}</em>}</li>)}
            </ul>}
          </button>;
        })}
      </div>

      <h3>Attività clou · le imperdibili</h3>
      <div className="activity-list">
        {stop.activities.length === 0 && <p className="empty">Nessuna attività clou salvata: aggiungila qui sotto o cerca idee sul web.</p>}
        {stop.activities.map((activity) => {
          const scheduled = scheduledItem(activity);
          return <div className={`activity-row ${scheduled ? "selected" : ""}`} key={activity.id}>
            <button className="check" title={scheduled ? `In agenda il ${formatShortDate(scheduled.date)}: apri` : "Metti in agenda nel primo orario libero"} onClick={() => schedule(activity)}>{scheduled ? "✓" : "+"}</button>
            <div>
              <b>{activity.name}</b>
              {activity.nameZh && <button className="zh-chip" title="Mostra in cinese a schermo intero" onClick={() => showChinese({ kind: "place", title: activity.name, titleZh: activity.nameZh, subtitle: stop.name, subtitleZh: stop.nameZh })}>中 {activity.nameZh}</button>}
              {scheduled && <small className="scheduled-note">In agenda: {formatShortDate(scheduled.date)} · {scheduled.startTime}</small>}
              {activity.description && <small>{activity.description}</small>}
              <span className="activity-links"><a href={webSearchUrl(`${activity.name} ${stop.name} biglietti sito ufficiale`)} target="_blank" rel="noreferrer">Cerca sul web ↗</a><a href={googleMapsSearchUrl(activity.name, stop.name)} target="_blank" rel="noreferrer">Google Maps ↗</a>{activity.sourceUrl && <a href={activity.sourceUrl} target="_blank" rel="noreferrer">Fonte ↗</a>}</span>
            </div>
            <div className="clou-side">
              <MoneyInput label={`Costo ${activity.name}`} amount={activity.price} currency={activity.currency} onAmount={(price) => updateActivity(activity.id, { price })} onCurrency={(currency) => updateActivity(activity.id, { currency })} />
              <button className="danger-text" onClick={() => removeActivity(activity)}>Togli</button>
            </div>
          </div>;
        })}
      </div>
      <form className="add-clou" onSubmit={addActivity}>
        <input value={newActivity.name} placeholder={`Nuova attività clou a ${stop.name}`} onChange={(event) => setNewActivity((current) => ({ ...current, name: event.target.value }))} />
        <input inputMode="decimal" aria-label="Costo stimato in euro per 2" placeholder="€ per 2" value={newActivity.price || ""} onChange={(event) => setNewActivity((current) => ({ ...current, price: Math.max(0, Number(event.target.value.replace(",", ".")) || 0) }))} />
        <button type="submit">+ Aggiungi</button>
      </form>
      <a className="clou-search" href={webSearchUrl(`cosa vedere a ${stop.name} Cina attrazioni imperdibili`)} target="_blank" rel="noreferrer">🔍 Cerca idee sul web per {stop.name} ↗</a>
    </div>
  </aside>;
}
