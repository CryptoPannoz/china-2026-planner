"use client";

import { useMemo, useState, type FormEvent } from "react";
import { STOP_ZH, SUGGESTED_STOPS } from "@/lib/planner/catalog";
import { insertStop, isLockedStop, moveStop, removeStop, scheduleActivity, scheduleKind, setStopNights, stopFromSuggestion, stopRemovalImpact, updateLeg } from "@/lib/planner/model";
import type { Activity, Stop, SuggestedStop } from "@/lib/planner/types";
import { euro, formatCost, formatLongDate, formatShortDate, googleMapsSearchUrl, googleMapsStopUrl, plural, slugify, uid, webSearchUrl } from "@/lib/planner/utils";
import { usePlanner } from "../context";
import { MoneyInput } from "../fields";
import { RouteMap } from "../RouteMap";

// Geocoding leggero via OpenStreetMap (serve solo in fase di pianificazione, da casa).
async function geocodeCity(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cn&q=${encodeURIComponent(name)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const results = await response.json() as Array<{ lat: string; lon: string }>;
    const lat = Number(results[0]?.lat);
    const lng = Number(results[0]?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
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
        <StopsCard />
        <MapCard suggestions={suggestions} />
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

function StopsCard() {
  const planner = usePlanner();
  const { plan, view, selectedStopId, setSelectedStopId, update, notify, log } = planner;
  const [form, setForm] = useState({ name: "", nights: 1, afterId: "", donorId: "" });
  const [adding, setAdding] = useState(false);
  const insertable = plan.stops.filter((stop) => stop.id !== "shanghai");
  const defaultAfter = insertable.some((stop) => stop.id === selectedStopId) ? selectedStopId : insertable.at(-1)?.id || "beijing";
  const afterId = insertable.some((stop) => stop.id === form.afterId) ? form.afterId : defaultAfter;

  function changeNights(stop: Stop, nights: number) {
    const preview = setStopNights(plan, stop.id, nights);
    if (preview.notice) notify(preview.notice);
    if (!preview.ok) return;
    update((current) => setStopNights(current, stop.id, nights).plan);
    log("Notti modificate", `${stop.name}: ${plural(nights, "notte", "notti")}`);
  }

  function remove(stop: Stop) {
    const impact = stopRemovalImpact(plan, stop.id);
    const lines = [`Eliminare ${stop.name} dal piano?`, ""];
    if (impact.removedItems) lines.push(`• ${plural(impact.removedItems, "blocco in agenda verrà cancellato", "blocchi in agenda verranno cancellati")}`);
    if (impact.removedStays) lines.push(`• l'hotel non prenotato verrà cancellato`);
    if (impact.keptItems + impact.keptStays) lines.push(`• ${plural(impact.keptItems + impact.keptStays, "prenotazione già fatta resta", "prenotazioni già fatte restano")} da ricollocare`);
    if (impact.givenNights && impact.receiver) lines.push(`• ${plural(impact.givenNights, "notte passa", "notti passano")} a ${impact.receiver.name}`);
    if (!window.confirm(lines.join("\n"))) return;
    const result = removeStop(plan, stop.id);
    update((current) => removeStop(current, stop.id).plan);
    notify(result.notice);
    log("Tappa eliminata", result.notice);
    if (selectedStopId === stop.id) setSelectedStopId(impact.receiver?.id || "beijing");
  }

  function move(stop: Stop, direction: -1 | 1) {
    update((current) => moveStop(current, stop.id, direction));
    log("Tappa spostata", `${stop.name} ${direction < 0 ? "prima" : "dopo"}`);
  }

  function toggleLeg(legId: string, included: boolean, label: string) {
    update((current) => updateLeg(current, legId, { included }));
    log(included ? "Tratta inclusa" : "Tratta esclusa", label);
  }

  async function addStop(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name || adding) return;
    const slug = slugify(name);
    const suggestion = SUGGESTED_STOPS.find((item) => item.id === slug || item.name.toLocaleLowerCase("it") === name.toLocaleLowerCase("it"));
    let stop: Stop;
    if (suggestion) {
      stop = stopFromSuggestion(suggestion);
    } else {
      setAdding(true);
      const coords = await geocodeCity(name);
      setAdding(false);
      if (!coords) notify(`${name}: coordinate non trovate, il punto sulla mappa è indicativo.`);
      const id = plan.stops.some((item) => item.id === slug) ? uid("stop") : slug;
      stop = { id, name, ...(STOP_ZH[slug] ? { nameZh: STOP_ZH[slug] } : {}), lat: coords?.lat ?? 30, lng: coords?.lng ?? 111, nights: 1, hotelNightly: 80, activities: [] };
    }
    const options = { afterId, nights: form.nights, donorId: form.donorId };
    const preview = insertStop(plan, stop, options);
    if (!preview.ok) {
      notify(preview.notice);
      return;
    }
    update((current) => insertStop(current, stop, options).plan);
    if (preview.notice) notify(preview.notice);
    setSelectedStopId(stop.id);
    setForm({ name: "", nights: 1, afterId: "", donorId: "" });
    log("Tappa aggiunta", `${stop.name} · ${plural(preview.plan.stops.find((item) => item.id === stop.id)?.nights || 1, "notte", "notti")}`);
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
            <div className="nights-stepper" onClick={(event) => event.stopPropagation()}>
              <button type="button" aria-label={`Una notte in meno a ${stop.name}`} disabled={stop.nights <= 1} onClick={() => changeNights(stop, stop.nights - 1)}>−</button>
              <b>{plural(stop.nights, "notte", "notti")}</b>
              <button type="button" aria-label={`Una notte in più a ${stop.name}`} className={view.remainingNights <= 0 ? "maxed" : ""} onClick={() => changeNights(stop, stop.nights + 1)}>+</button>
            </div>
            <div className="stop-actions" onClick={(event) => event.stopPropagation()}>
              {locked ? <span className="lock">volo</span> : <>
                <button title="Sposta prima" disabled={index <= 1} onClick={() => move(stop, -1)}>↑</button>
                <button title="Sposta dopo" disabled={index >= view.timeline.length - 2} onClick={() => move(stop, 1)}>↓</button>
                <button className="danger" title="Elimina tappa" onClick={() => remove(stop)}>×</button>
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
        <input className="add-stop-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Aggiungi una città (es. Chongqing, Guilin, Lijiang…)" list="suggested-stop-names" />
        <datalist id="suggested-stop-names">{SUGGESTED_STOPS.filter((suggestion) => !plan.stops.some((stop) => stop.id === suggestion.id)).map((suggestion) => <option key={suggestion.id} value={suggestion.name} />)}</datalist>
        <label>Dopo<select value={afterId} onChange={(event) => setForm((current) => ({ ...current, afterId: event.target.value }))}>{insertable.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select></label>
        <label>Notti<select value={form.nights} onChange={(event) => setForm((current) => ({ ...current, nights: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map((nights) => <option key={nights} value={nights}>{nights}</option>)}</select></label>
        <label>Notti prese da<select value={form.donorId} onChange={(event) => setForm((current) => ({ ...current, donorId: event.target.value }))}><option value="">{view.remainingNights > 0 ? `Notti libere (${view.remainingNights})` : "La tappa prima, poi la più lunga"}</option>{plan.stops.filter((stop) => stop.nights > 1).map((stop) => <option key={stop.id} value={stop.id}>{stop.name} ({stop.nights} notti)</option>)}</select></label>
        <button type="submit" disabled={adding || !form.name.trim()}>{adding ? "Cerco la città…" : "+ Aggiungi tappa"}</button>
        <small>Le 17 notti sono fisse: la nuova tappa prende le notti da quella scelta (minimo 1 a tappa) e ti avviso di cosa ho spostato.</small>
      </form>
    </div>
  </article>;
}

function MapCard({ suggestions }: { suggestions: SuggestedStop[] }) {
  const { plan, view, setSelectedStopId, selectedStopId } = usePlanner();
  const selected = view.stopById.get(selectedStopId) || plan.stops[0];
  return <article className="card map-card">
    <div className="card-head"><div><p className="eyebrow">Panoramica itinerario · OpenStreetMap</p><h2>La rotta completa, tappa per tappa</h2></div><span className="subtle">Numeri = tappe · «?» = città da valutare</span></div>
    <RouteMap stops={plan.stops} legs={view.legs} suggestions={suggestions} onSelect={setSelectedStopId} />
    <div className="china-map-note">
      <div><b>Ogni luogo si apre in Google Maps</b><span>Hotel, attività e trasporti hanno il proprio collegamento.</span></div>
      <a href={googleMapsStopUrl(selected)} target="_blank" rel="noreferrer">Apri {selected.name} in Google Maps ↗</a>
    </div>
  </article>;
}

function SuggestionsCard({ suggestions }: { suggestions: SuggestedStop[] }) {
  const { plan, update, notify, log, setSelectedStopId } = usePlanner();

  function add(suggestion: SuggestedStop) {
    const stop = stopFromSuggestion(suggestion);
    const afterId = plan.stops.some((item) => item.id === suggestion.insertAfterId) && suggestion.insertAfterId !== "shanghai" ? suggestion.insertAfterId : plan.stops.at(-2)?.id || "beijing";
    const options = { afterId, nights: suggestion.nights, donorId: afterId };
    const preview = insertStop(plan, stop, options);
    if (!preview.ok) {
      notify(preview.notice);
      return;
    }
    update((current) => insertStop(current, stop, options).plan);
    if (preview.notice) notify(preview.notice);
    setSelectedStopId(stop.id);
    log("Tappa aggiunta dalle proposte", `${stop.name} · ${plural(preview.plan.stops.find((item) => item.id === stop.id)?.nights || 1, "notte", "notti")}`);
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
