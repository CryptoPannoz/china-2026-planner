"use client";

import { useState } from "react";
import { scheduleKind } from "@/lib/planner/model";
import { euro, formatCost, formatLongDate, formatShortDate, googleMapsStopUrl, plural } from "@/lib/planner/utils";
import { usePlanner } from "../context";
import { RouteMap } from "../RouteMap";

export function ItinerarySection() {
  return <>
    <TripStrip />
    <section className="section-grid">
      <div className="stack">
        <IssuesCard />
        <MapCard />
        <StopsCard />
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

/** Tappe e notti sono definitive: qui si leggono, e da ogni tratta si va a prenotarla. */
function StopsCard() {
  const { view, selectedStopId, setSelectedStopId, goTo } = usePlanner();
  return <article className="card">
    <div className="card-head">
      <div><p className="eyebrow">17 nov → 4 dic · itinerario definitivo</p><h2>Tappe e collegamenti</h2></div>
      <span className="fit-badge ok">{plural(view.usedNights, "notte", "notti")}</span>
    </div>
    <div className="route-editor">
      {view.timeline.map((entry, index) => {
        const { stop } = entry;
        const leg = view.legs[index];
        const booked = leg?.bookingStatus === "prenotato";
        return <div key={stop.id}>
          <div className={`stop-editor ${selectedStopId === stop.id ? "selected" : ""}`} onClick={() => setSelectedStopId(stop.id)}>
            <span className="stop-number">{index + 1}</span>
            <div className="stop-main"><b>{stop.name}</b><small>{formatShortDate(entry.arrival)} → {formatShortDate(entry.departure)}</small></div>
            <span className="stop-nights">{plural(stop.nights, "notte", "notti")}</span>
          </div>
          {leg && <div className={`leg-inline ${leg.included ? "" : "disabled"} ${booked ? "booked" : ""}`}>
            <span className="leg-rail" />
            <div>
              <b>{leg.included ? leg.mode : "Trasporto escluso"}{booked ? " · ✓ prenotata" : ""}</b>
              <small>{leg.included ? `${leg.departureTime ? `${leg.departureTime}${leg.arrivalTime ? `→${leg.arrivalTime}` : ""} · ` : ""}${leg.duration} · ${formatCost(leg.cost, leg.currency)}` : "Manca il collegamento tra le due tappe"}</small>
            </div>
            <button onClick={() => goTo("transport", { anchor: `leg-${leg.id}` })}>{booked ? "Dettagli" : "Prenota"} →</button>
          </div>}
        </div>;
      })}
    </div>
  </article>;
}

function MapCard() {
  const { plan, view, selectedStopId, setSelectedStopId } = usePlanner();
  const [openStopId, setOpenStopId] = useState("");
  const selected = view.stopById.get(selectedStopId) || plan.stops[0];

  function openStop(stopId: string) {
    setSelectedStopId(stopId);
    setOpenStopId(stopId);
  }

  return <article className="card map-card">
    <div className="card-head"><div><p className="eyebrow">Mappa dell&apos;itinerario</p><h2>La rotta, tappa per tappa</h2></div><span className="subtle">Tocca un numero per date, agenda e hotel della tappa</span></div>
    <RouteMap stops={plan.stops} legs={view.legs} selectedStopId={selectedStopId} onStopClick={openStop}>
      {openStopId && <StopOverlay stopId={openStopId} onClose={() => setOpenStopId("")} />}
    </RouteMap>
    <div className="map-footer">
      <div className="map-legend"><span><i /> Tappa</span><span><i className="route" /> Trasporto</span><span><i className="route off" /> Escluso</span></div>
      <a href={googleMapsStopUrl(selected)} target="_blank" rel="noreferrer">{selected.name} in Google Maps ↗</a>
    </div>
  </article>;
}

function StopOverlay({ stopId, onClose }: { stopId: string; onClose: () => void }) {
  const { view, goTo } = usePlanner();
  const entry = view.entryById.get(stopId);
  if (!entry) return null;
  const { stop, index } = entry;
  const arriving = view.legs.find((leg) => leg.toId === stop.id);
  return <div className="map-overlay" role="dialog" aria-label={`Tappa ${stop.name}`}>
    <header>
      <span className="stop-number">{index + 1}</span>
      <div><b>{stop.name}{stop.nameZh ? <small className="zh"> {stop.nameZh}</small> : null}</b><small>{formatShortDate(entry.arrival)} → {formatShortDate(entry.departure)} · {plural(stop.nights, "notte", "notti")}{arriving?.included ? ` · arrivo con ${arriving.mode}` : ""}</small></div>
      <button type="button" className="map-overlay-close" aria-label="Chiudi" onClick={onClose}>×</button>
    </header>
    <div className="map-overlay-actions">
      <button type="button" onClick={() => goTo("calendar", { date: entry.arrival })}>Giornate →</button>
      <button type="button" onClick={() => goTo("hotels", { stopId: stop.id })}>Hotel →</button>
    </div>
  </div>;
}

function CityPanel() {
  const { plan, view, selectedStopId, goTo, eur } = usePlanner();
  const stop = view.stopById.get(selectedStopId) || plan.stops[0];
  const entry = view.entryById.get(stop.id);
  const stopItems = plan.scheduleItems.filter((item) => item.stopId === stop.id);
  const stopDays = view.calendar.filter((day) => day.stopId === stop.id);
  const stopHotels = plan.hotelStays.filter((stay) => stay.stopId === stop.id);

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
    </div>
  </aside>;
}
