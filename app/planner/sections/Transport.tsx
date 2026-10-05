"use client";

import { PAYER_LABELS } from "@/lib/planner/catalog";
import { scheduleKind, updateLeg } from "@/lib/planner/model";
import type { Leg, Payer } from "@/lib/planner/types";
import { euro, formatLongDate, formatShortDate, safeExternalLink } from "@/lib/planner/utils";
import { usePlanner } from "../context";
import { MoneyInput, TextInput } from "../fields";

export function TransportSection() {
  const { plan, view, goTo, eur } = usePlanner();
  const transfers = plan.scheduleItems.filter((item) => scheduleKind(item) === "transport").sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const included = view.legs.filter((leg) => leg.included);
  const bookedCount = included.filter((leg) => leg.bookingStatus === "prenotato").length;
  const legsCost = included.reduce((sum, leg) => sum + eur(leg.cost, leg.currency), 0);
  return <section className="panel-section">
    <div className="section-title transport-title">
      <div><p className="eyebrow">Tra le città e dentro ogni giornata</p><h2>Trasporti</h2></div>
      <div><strong>{euro.format(legsCost)}</strong><button className="primary" onClick={() => goTo("calendar", { anchor: "new-plan", newBlockKind: "transport" })}>+ Spostamento in giornata</button></div>
    </div>

    <div className="section-title compact"><div><p className="eyebrow">Tratte principali · {bookedCount}/{included.length} prenotate</p><h2>Collegamenti tra le tappe</h2></div><span className="subtle">Orari e numero treno/volo compaiono nell’agenda del giorno; se prenotata, la tratta entra nel consuntivo</span></div>
    <div className="transport-list">
      {view.legs.map((leg) => <LegCard key={leg.id} leg={leg} />)}
    </div>

    <article className="card daily-transports">
      <div className="card-head"><div><p className="eyebrow">Dall’agenda</p><h2>Spostamenti in giornata</h2></div><span>{transfers.length} inseriti</span></div>
      <div className="daily-transport-list">
        {transfers.length === 0 && <p className="empty padded">Taxi, metro o transfer dentro una giornata: aggiungili dall’agenda come «Trasporto».</p>}
        {transfers.map((item) => <button key={item.id} onClick={() => goTo("calendar", { date: item.date, anchor: `plan-${item.id}` })}>
          <span><b>{formatShortDate(item.date)}</b><small>{item.startTime}–{item.endTime}</small></span>
          <span><strong>{item.transportMode || item.name || "Trasporto"}</strong>{item.fromLocation || "Partenza da definire"} → {item.location || "Destinazione da definire"}</span>
          <i>Modifica in agenda →</i>
        </button>)}
      </div>
    </article>
  </section>;
}

function LegCard({ leg }: { leg: Leg }) {
  const { view, update, log, goTo } = usePlanner();
  const fromStop = view.stopById.get(leg.fromId);
  const toStop = view.stopById.get(leg.toId);
  const date = view.legDateOf(leg);
  const isFlight = /✈|volo|aereo|flight/i.test(leg.mode);
  const booked = leg.bookingStatus === "prenotato";
  const label = view.legLabel(leg);
  const ticket = safeExternalLink(leg.ticketUrl);
  const patch = (changes: Partial<Leg>) => update((current) => updateLeg(current, leg.id, changes));
  const commit = (field: string, changes: Partial<Leg>, shown: string) => {
    patch(changes);
    log("Tratta modificata", `${label}: ${field} ${shown}`);
  };
  return <article id={`leg-${leg.id}`} className={`transport-card ${leg.included ? "" : "disabled"} ${booked ? "booked" : ""}`}>
    <div className="transport-route"><span>{fromStop?.name}</span><i>→</i><span>{toStop?.name}</span></div>
    <div className="transport-date">
      <b>{date ? formatLongDate(date) : "Data da definire"}</b>
      <span className={booked ? "ok" : ""}>{booked ? "✓ Prenotata" : "Da prenotare"}{leg.departureTime ? ` · ${leg.departureTime}${leg.arrivalTime ? ` → ${leg.arrivalTime}` : ""}` : " · orari da definire"}</span>
    </div>
    <div className="transport-fields">
      <label>Mezzo<TextInput value={leg.mode} onCommit={(mode) => commit("mezzo", { mode }, mode)} /></label>
      <label>Durata<TextInput value={leg.duration} onCommit={(duration) => commit("durata", { duration }, duration)} /></label>
      <label>Costo per 2<MoneyInput label={`Costo ${label}`} amount={leg.cost} currency={leg.currency} onAmount={(cost) => commit("costo", { cost }, euro.format(cost))} onCurrency={(currency) => patch({ currency })} /></label>
    </div>
    <div className="transport-fields booking">
      <label>Partenza<input type="time" step="300" value={leg.departureTime || ""} onChange={(event) => patch({ departureTime: event.target.value })} onBlur={(event) => event.target.value && log("Orario tratta", `${label}: partenza ${event.target.value}`)} /></label>
      <label>Arrivo<input type="time" step="300" value={leg.arrivalTime || ""} onChange={(event) => patch({ arrivalTime: event.target.value })} onBlur={(event) => event.target.value && log("Orario tratta", `${label}: arrivo ${event.target.value}`)} /></label>
      <label>{isFlight ? "Volo n." : "Treno n."}<TextInput value={leg.serviceNumber || ""} placeholder={isFlight ? "Es. MU5401" : "Es. G89"} onCommit={(serviceNumber) => commit("numero", { serviceNumber }, serviceNumber)} /></label>
      <label>{isFlight ? "Aeroporto di partenza" : "Stazione di partenza"}<TextInput value={leg.fromStation || ""} placeholder={isFlight ? "Es. Chengdu Tianfu (TFU)" : "Es. Beijing West 北京西"} onCommit={(fromStation) => commit("partenza da", { fromStation }, fromStation)} /></label>
      <label>{isFlight ? "Aeroporto di arrivo" : "Stazione di arrivo"}<TextInput value={leg.toStation || ""} placeholder={isFlight ? "Es. Kunming Changshui (KMG)" : "Es. Xi'an North 西安北"} onCommit={(toStation) => commit("arrivo a", { toStation }, toStation)} /></label>
      <label>Stato<select value={leg.bookingStatus || "da-prenotare"} onChange={(event) => {
        const status = event.target.value as Leg["bookingStatus"];
        patch({ bookingStatus: status });
        log("Stato tratta", `${label}: ${status === "prenotato" ? "prenotata" : "da prenotare"}`);
      }}><option value="da-prenotare">Da prenotare</option><option value="prenotato">Prenotata</option></select></label>
      {booked && <label>N. prenotazione<TextInput value={leg.bookingRef || ""} placeholder="PNR / codice" onCommit={(bookingRef) => commit("prenotazione", { bookingRef }, bookingRef)} /></label>}
      {booked && leg.cost > 0 && <label>Chi ha pagato<select value={leg.paidBy || ""} onChange={(event) => {
        const payer = (event.target.value || undefined) as Payer | undefined;
        patch({ paidBy: payer });
        if (payer) log("Pagamento registrato", `${label}: ha pagato ${PAYER_LABELS[payer]}`);
      }}><option value="">Da assegnare</option><option value="alberto">Alberto</option><option value="sofia">Sofia</option></select></label>}
      <label className="wide">Link biglietto / PDF<TextInput value={leg.ticketUrl || ""} placeholder="Link Trip.com, PDF su Drive o mail di conferma" onCommit={(ticketUrl) => commit("biglietto", { ticketUrl }, ticketUrl ? "link salvato" : "link rimosso")} /></label>
      <label className="wide">Note<TextInput value={leg.note} placeholder="Stazioni, cambi, consigli…" onCommit={(note) => commit("note", { note }, note)} /></label>
    </div>
    <div className="transport-actions">
      <button onClick={() => {
        patch({ included: !leg.included });
        log(leg.included ? "Tratta esclusa" : "Tratta inclusa", label);
      }}>{leg.included ? "Togli dal viaggio" : "Rimetti nel viaggio"}</button>
      {date && <button onClick={() => goTo("calendar", { date })}>Vedi giornata →</button>}
      {ticket && <a className="ticket-link" href={ticket} target="_blank" rel="noreferrer">🎟 Biglietto ↗</a>}
      <a href={isFlight ? "https://www.trip.com/flights/" : "https://www.trip.com/trains/"} target="_blank" rel="noreferrer">{isFlight ? "Voli su Trip.com ↗" : "Treni su Trip.com ↗"}</a>
    </div>
  </article>;
}
