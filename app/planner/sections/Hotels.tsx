"use client";

import { useState, type FormEvent } from "react";
import { PAYER_LABELS } from "@/lib/planner/catalog";
import { hotelFollowsStop, hotelNights, hotelTotal, isPlaceholderHotel } from "@/lib/planner/model";
import type { Currency, HotelStay, Payer } from "@/lib/planner/types";
import { addDaysKey, euro, formatCost, formatShortDate, googleMapsSearchUrl, plural, safeExternalLink, translateZhUrl, uid } from "@/lib/planner/utils";
import { usePlanner } from "../context";
import { MoneyInput, TextArea, TextInput } from "../fields";

const roundCents = (value: number) => Math.round(value * 100) / 100;

export function HotelsSection() {
  const { plan, view, eur } = usePlanner();
  const orphanStays = plan.hotelStays.filter((stay) => !view.stopById.has(stay.stopId));
  const booked = plan.hotelStays.filter((stay) => stay.bookingStatus === "prenotato").length;
  const hotelIssues = view.issues.filter((issue) => issue.section === "hotels");
  return <section className="panel-section">
    <div className="section-title hotel-title">
      <div><p className="eyebrow">Una notte = un hotel · le date seguono le tappe</p><h2>Hotel e soggiorni</h2></div>
      <div><span><b>{booked}/{plan.hotelStays.length}</b> prenotati</span><strong>{euro.format(plan.hotelStays.reduce((sum, stay) => sum + eur(hotelTotal(stay), stay.currency), 0))}</strong></div>
    </div>
    {hotelIssues.length > 0 && <div className="issue-strip">{hotelIssues.map((issue) => <p key={issue.id}>⚠️ {issue.text}</p>)}</div>}
    <div className="hotel-groups">
      {view.timeline.map((entry, index) => {
        const stays = plan.hotelStays.filter((stay) => stay.stopId === entry.stop.id).sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
        return <section className="hotel-group" id={`hotels-${entry.stop.id}`} key={entry.stop.id}>
          <header>
            <span className="stop-number">{index + 1}</span>
            <div><b>{entry.stop.name}</b><small>{formatShortDate(entry.arrival)} → {formatShortDate(entry.departure)} · {plural(entry.stop.nights, "notte", "notti")}</small></div>
          </header>
          {stays.length === 0 && <p className="empty">Nessun hotel per questa tappa: aggiungilo qui sotto.</p>}
          <div className="hotel-stay-list">
            {stays.map((stay) => <StayCard key={stay.id} stay={stay} />)}
          </div>
        </section>;
      })}
      {orphanStays.length > 0 && <section className="hotel-group">
        <header><span className="stop-number">!</span><div><b>Tappe eliminate</b><small>Prenotazioni già fatte da disdire o ricollocare</small></div></header>
        <div className="hotel-stay-list">{orphanStays.map((stay) => <StayCard key={stay.id} stay={stay} />)}</div>
      </section>}
    </div>
    <AddHotelForm />
  </section>;
}

function StayCard({ stay }: { stay: HotelStay }) {
  const { plan, view, update, log, notify, showChinese } = usePlanner();
  const stop = view.stopById.get(stay.stopId);
  const entry = view.entryById.get(stay.stopId);
  const follows = hotelFollowsStop(stay);
  const nights = hotelNights(stay);
  const isBooked = stay.bookingStatus === "prenotato";
  const mapUrl = safeExternalLink(stay.mapUrl) || googleMapsSearchUrl(stay.address || stay.name, stop?.name || "");
  const bookingUrl = safeExternalLink(stay.bookingUrl);

  function patch(changes: Partial<HotelStay>) {
    update((current) => ({ ...current, hotelStays: current.hotelStays.map((item) => (item.id === stay.id ? { ...item, ...changes } : item)) }));
  }

  function setDates(checkInDate: string, checkOutDate: string) {
    if (!checkInDate || !checkOutDate) return;
    if (checkOutDate <= checkInDate) {
      notify("Il check-out deve essere almeno il giorno dopo il check-in.");
      return;
    }
    patch({ checkInDate, checkOutDate, followStop: false });
    log("Date hotel modificate", `${stay.name}: ${formatShortDate(checkInDate)} → ${formatShortDate(checkOutDate)}`);
  }

  function setStatus(status: HotelStay["bookingStatus"]) {
    update((current) => ({
      ...current,
      hotelStays: current.hotelStays.map((item) => {
        if (item.id !== stay.id) return item;
        if (status === "prenotato") return { ...item, bookingStatus: status, totalPrice: item.totalPrice && item.totalPrice > 0 ? item.totalPrice : roundCents(hotelTotal(item)) };
        const rest = { ...item };
        delete rest.totalPrice;
        const itemNights = hotelNights(item);
        return { ...rest, bookingStatus: status, nightlyPrice: item.totalPrice && itemNights ? roundCents(item.totalPrice / itemNights) : item.nightlyPrice };
      }),
    }));
    log("Stato hotel modificato", `${stay.name}: ${status === "prenotato" ? "prenotato" : "da prenotare"}`);
  }

  function remove() {
    if (!window.confirm(`Eliminare «${stay.name}»?${isBooked ? "\nÈ segnato come prenotato: ricordati di disdirlo." : ""}`)) return;
    update((current) => ({ ...current, hotelStays: current.hotelStays.filter((item) => item.id !== stay.id) }));
    log("Hotel eliminato", `${stay.name} · ${formatShortDate(stay.checkInDate)} → ${formatShortDate(stay.checkOutDate)}`);
  }

  return <article className={`card hotel-stay-card ${isBooked ? "booked" : ""}`} id={`hotel-${stay.id}`}>
    <div className="hotel-date-band">
      <span>Check-in<b>{formatShortDate(stay.checkInDate)}</b></span>
      <i>→</i>
      <span>Check-out<b>{formatShortDate(stay.checkOutDate)}</b></span>
      <small>{plural(nights, "notte", "notti")}{follows ? " · segue la tappa" : ""}</small>
      {isBooked && <em className="booked-badge">✓ Prenotato{stay.paidBy ? ` · ${PAYER_LABELS[stay.paidBy]}` : ""}</em>}
    </div>
    <div className="hotel-stay-content">
      <div className="hotel-stay-head">
        <div><span>⌂ {stop?.name || "Tappa eliminata"}</span><TextInput aria-label="Nome hotel" value={stay.name} onCommit={(name) => { patch({ name }); log("Hotel rinominato", name); }} /></div>
        <button className="danger-text" onClick={remove}>Elimina</button>
      </div>
      <div className="hotel-fields">
        {follows ? <p className="wide hotel-follow-note">Le date seguono {stop?.name}: se cambi le notti della tappa si aggiornano da sole. <button type="button" onClick={() => patch({ followStop: false })}>Imposta date a mano</button></p> : <>
          <label>Data check-in<input type="date" value={stay.checkInDate} onChange={(event) => setDates(event.target.value, stay.checkOutDate > event.target.value ? stay.checkOutDate : addDaysKey(event.target.value, 1))} /></label>
          <label>Data check-out<input type="date" value={stay.checkOutDate} min={addDaysKey(stay.checkInDate, 1)} onChange={(event) => setDates(stay.checkInDate, event.target.value)} /></label>
          {!isBooked && entry && plan.hotelStays.filter((item) => item.stopId === stay.stopId).length === 1 && <p className="wide hotel-follow-note"><button type="button" onClick={() => patch({ followStop: true })}>↺ Allinea alle date di {entry.stop.name}</button></p>}
        </>}
        <label className="wide">Indirizzo<TextInput value={stay.address} placeholder="Nome e indirizzo dell'hotel" onCommit={(address) => { patch({ address }); log("Indirizzo hotel modificato", `${stay.name}: ${address}`); }} /></label>
        <label>Nome in cinese <a className="translate-link" href={translateZhUrl(stay.name)} target="_blank" rel="noreferrer">Traduci ↗</a><TextInput value={stay.nameZh || ""} placeholder="Traduci il nome e incollalo qui" onCommit={(nameZh) => { patch({ nameZh }); log("Nome cinese aggiornato", stay.name); }} /></label>
        <label className="wide">Indirizzo in cinese <a className="translate-link" href={translateZhUrl(stay.address || stay.name)} target="_blank" rel="noreferrer">Traduci ↗</a><TextInput value={stay.addressZh || ""} placeholder="Traduci l'indirizzo e incollalo qui" onCommit={(addressZh) => { patch({ addressZh }); log("Indirizzo cinese aggiornato", stay.name); }} /></label>
        {isBooked
          ? <label>Totale pagato<MoneyInput label={`Totale ${stay.name}`} amount={stay.totalPrice || 0} currency={stay.currency} onAmount={(totalPrice) => { patch({ totalPrice }); log("Prezzo hotel modificato", `${stay.name}: ${formatCost(totalPrice, stay.currency)} totali`); }} onCurrency={(currency: Currency) => patch({ currency })} /></label>
          : <label>Prezzo a notte (stima)<MoneyInput label={`Prezzo a notte ${stay.name}`} amount={stay.nightlyPrice} currency={stay.currency} onAmount={(nightlyPrice) => { patch({ nightlyPrice }); log("Prezzo hotel modificato", `${stay.name}: ${formatCost(nightlyPrice, stay.currency)} a notte`); }} onCurrency={(currency: Currency) => patch({ currency })} /><small className="field-hint">= {formatCost(hotelTotal(stay), stay.currency)} per {plural(nights, "notte", "notti")}</small></label>}
        <label>Stato<select value={stay.bookingStatus} onChange={(event) => setStatus(event.target.value as HotelStay["bookingStatus"])}><option value="da-prenotare">Da prenotare</option><option value="prenotato">Prenotato</option></select></label>
        {isBooked && <>
          <label>Numero prenotazione<TextInput value={stay.confirmationNumber || ""} placeholder="Es. codice Booking / Trip.com" onCommit={(confirmationNumber) => { patch({ confirmationNumber }); if (confirmationNumber.trim()) log("Numero prenotazione salvato", `${stay.name}: ${confirmationNumber.trim()}`); }} /></label>
          <div className="hotel-payer">
            <span>Chi ha pagato?</span>
            <div>{(["alberto", "sofia"] as Payer[]).map((payer) => <button type="button" key={payer} className={stay.paidBy === payer ? `active ${payer}` : ""} onClick={() => {
              if (stay.paidBy === payer) return;
              patch({ paidBy: payer });
              log("Pagamento hotel registrato", `${stay.name}: ha pagato ${PAYER_LABELS[payer]}`);
            }}>{PAYER_LABELS[payer]}</button>)}</div>
          </div>
        </>}
        <label className="wide">Note<TextArea value={stay.notes} placeholder="Colazione, cancellazione, camera, deposito bagagli…" onCommit={(notes) => { patch({ notes }); log("Note hotel aggiornate", stay.name); }} /></label>
      </div>
      <details className="app-links-editor"><summary>Link prenotazione e mappa</summary><div>
        <label>Prenotazione<TextInput value={stay.bookingUrl || ""} placeholder="https://…" onCommit={(value) => patch({ bookingUrl: value })} /></label>
        <label>Link mappa<TextInput value={stay.mapUrl || ""} placeholder="Automatico se vuoto" onCommit={(value) => patch({ mapUrl: value })} /></label>
      </div></details>
      <div className="hotel-actions">
        <button className="taxi-button" onClick={() => showChinese({ kind: "hotel", title: stay.name, titleZh: stay.nameZh, subtitle: stay.address, subtitleZh: stay.addressZh })}>🚕 Mostra in cinese</button>
        <a href={mapUrl} target="_blank" rel="noreferrer">Google Maps ↗</a>
        {bookingUrl && <a href={bookingUrl} target="_blank" rel="noreferrer">Prenotazione ↗</a>}
      </div>
    </div>
  </article>;
}

function AddHotelForm() {
  const { plan, view, selectedStopId, update, log } = usePlanner();
  const firstStopId = view.stopById.has(selectedStopId) ? selectedStopId : plan.stops[0]?.id || "";
  const rangeOf = (stopId: string) => {
    const entry = view.entryById.get(stopId);
    return entry ? { checkInDate: entry.arrival, checkOutDate: entry.departure } : { checkInDate: "", checkOutDate: "" };
  };
  const [form, setForm] = useState(() => ({ stopId: firstStopId, name: "", address: "", total: "", currency: "EUR" as Currency, bookingStatus: "prenotato" as HotelStay["bookingStatus"], confirmationNumber: "", paidBy: undefined as Payer | undefined, notes: "", ...rangeOf(firstStopId) }));
  const valid = form.name.trim() && form.checkInDate && form.checkOutDate > form.checkInDate;
  const stopStays = plan.hotelStays.filter((stay) => stay.stopId === form.stopId);
  const replacesPlaceholder = stopStays.length === 1 && isPlaceholderHotel(stopStays[0]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const total = Math.max(0, Number(form.total.replace(",", ".")) || 0);
    const nights = hotelNights(form);
    const range = rangeOf(form.stopId);
    const isBooked = form.bookingStatus === "prenotato";
    const stay: HotelStay = {
      id: uid("hotel"),
      stopId: form.stopId,
      name: form.name.trim(),
      address: form.address.trim(),
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      nightlyPrice: nights > 0 ? roundCents(total / nights) : 0,
      ...(isBooked ? { totalPrice: total } : {}),
      currency: form.currency,
      bookingStatus: form.bookingStatus,
      followStop: !isBooked && form.checkInDate === range.checkInDate && form.checkOutDate === range.checkOutDate,
      ...(isBooked && form.confirmationNumber.trim() ? { confirmationNumber: form.confirmationNumber.trim() } : {}),
      ...(isBooked && form.paidBy ? { paidBy: form.paidBy } : {}),
      notes: form.notes.trim(),
    };
    update((current) => {
      const siblings = current.hotelStays.filter((item) => item.stopId === stay.stopId);
      // Il segnaposto «Hotel da scegliere» viene sostituito dall'hotel vero, non sommato.
      const placeholderId = siblings.length === 1 && isPlaceholderHotel(siblings[0]) ? siblings[0].id : "";
      const others = current.hotelStays.filter((item) => item.id !== placeholderId).map((item) => (item.stopId === stay.stopId && item.followStop ? { ...item, followStop: false } : item));
      return { ...current, hotelStays: [...others, stay] };
    });
    setForm((current) => ({ ...current, name: "", address: "", total: "", confirmationNumber: "", paidBy: undefined, notes: "" }));
    log("Hotel aggiunto", `${stay.name} · ${formatShortDate(stay.checkInDate)} → ${formatShortDate(stay.checkOutDate)}${isBooked ? ` · prenotato${stay.paidBy ? `, ha pagato ${PAYER_LABELS[stay.paidBy]}` : ""}` : ""}`);
  }

  return <form className="card add-hotel-card" onSubmit={submit}>
    <div className="card-head"><div><p className="eyebrow">Hotel scelto, cambio hotel o soggiorno diviso</p><h2>Aggiungi hotel</h2></div></div>
    <div className="hotel-fields">
      <label>Città<select value={form.stopId} onChange={(event) => setForm((current) => ({ ...current, stopId: event.target.value, ...rangeOf(event.target.value) }))}>{plan.stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select></label>
      <label className="wide">Nome hotel<input required value={form.name} placeholder="Es. Hotel a Pechino" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
      <label>Check-in<input type="date" required value={form.checkInDate} onChange={(event) => setForm((current) => ({ ...current, checkInDate: event.target.value }))} /></label>
      <label>Check-out<input type="date" required value={form.checkOutDate} min={form.checkInDate ? addDaysKey(form.checkInDate, 1) : undefined} onChange={(event) => setForm((current) => ({ ...current, checkOutDate: event.target.value }))} /></label>
      <label className="wide">Indirizzo<input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></label>
      <label>Prezzo totale<span className="money-input"><input inputMode="decimal" value={form.total} placeholder="0" onChange={(event) => setForm((current) => ({ ...current, total: event.target.value }))} /><select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value as Currency }))}><option value="EUR">€</option><option value="CNY">¥</option></select></span></label>
      <label>Stato<select value={form.bookingStatus} onChange={(event) => setForm((current) => ({ ...current, bookingStatus: event.target.value as HotelStay["bookingStatus"] }))}><option value="prenotato">Prenotato</option><option value="da-prenotare">Da prenotare</option></select></label>
      {form.bookingStatus === "prenotato" && <>
        <label>Numero prenotazione<input value={form.confirmationNumber} placeholder="Es. codice Booking / Trip.com" onChange={(event) => setForm((current) => ({ ...current, confirmationNumber: event.target.value }))} /></label>
        <div className="hotel-payer"><span>Chi ha pagato?</span><div>{(["alberto", "sofia"] as Payer[]).map((payer) => <button type="button" key={payer} className={form.paidBy === payer ? `active ${payer}` : ""} onClick={() => setForm((current) => ({ ...current, paidBy: current.paidBy === payer ? undefined : payer }))}>{PAYER_LABELS[payer]}</button>)}</div></div>
      </>}
      <label className="wide">Note<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
      {replacesPlaceholder && <p className="wide hotel-follow-note">Sostituisce «{stopStays[0].name}».</p>}
      {form.checkInDate && form.checkOutDate <= form.checkInDate && <p className="wide error">Il check-out deve essere dopo il check-in.</p>}
    </div>
    <button className="primary" type="submit" disabled={!valid}>+ Aggiungi soggiorno</button>
  </form>;
}
