"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BUILT_IN_CATEGORIES, EXPENSE_CATEGORIES, KIND_LABELS, PAYER_LABELS } from "@/lib/planner/catalog";
import { conflictingIds, isOverflowItem, scheduleActivity, scheduleKind, type CalendarDay } from "@/lib/planner/model";
import type { Currency, ExpenseCategory, Payer, ScheduleItem, ScheduleKind } from "@/lib/planner/types";
import { euro, formatCost, formatLongDate, formatShortDate, googleMapsSearchUrl, minutesToTime, plural, safeExternalLink, timeToMinutes, translateZhUrl, uid, webSearchUrl } from "@/lib/planner/utils";
import { usePlanner } from "../context";
import { MoneyInput, TextArea, TextInput } from "../fields";
import { HourGrid, type HourBlock } from "../HourGrid";

type NewBlock = Pick<ScheduleItem, "kind" | "startTime" | "endTime" | "name" | "category" | "fromLocation" | "location" | "transportMode" | "mapUrl" | "notes" | "price" | "currency" | "bookingStatus" | "paidBy">;

function emptyBlock(kind: ScheduleKind = "activity"): NewBlock {
  return { kind, startTime: "09:00", endTime: "11:00", name: "", category: kind === "transport" ? "trasferimento" : "visita", fromLocation: "", location: "", transportMode: "", mapUrl: "", notes: "", price: 0, currency: "EUR", bookingStatus: "da-prenotare" };
}

function mapLinkFor(item: ScheduleItem, city: string) {
  const customLink = safeExternalLink(item.mapUrl);
  if (customLink) return customLink;
  const place = item.location.split("→").at(-1)?.trim() || item.location.trim();
  return place ? googleMapsSearchUrl(place, city) : "";
}

const dayLabel = (day: CalendarDay) => `G${day.index + 1} · ${formatShortDate(day.dateKey)} · ${day.city}`;

export function AgendaSection() {
  const planner = usePlanner();
  const { plan, view, selectedDate, setSelectedDate, update, log, notify, goTo, eur, agendaNewKind } = planner;
  const [mode, setMode] = useState<"list" | "hours">("list");
  const [draft, setDraft] = useState<NewBlock>(() => emptyBlock(agendaNewKind));
  const [newCategory, setNewCategory] = useState("");
  const [newExpense, setNewExpense] = useState({ label: "", amount: "", currency: "EUR" as Currency, paidBy: "alberto" as Payer, category: "cibo" as ExpenseCategory });

  const day = view.calendar.find((entry) => entry.dateKey === selectedDate) ?? view.calendar[0];
  const stop = view.stopById.get(day.stopId);
  const items = view.itemsByDate.get(day.dateKey) || [];
  const leg = day.leg?.included ? day.leg : undefined;
  const legBlock = leg?.departureTime ? { id: `leg-${leg.id}`, startTime: leg.departureTime, endTime: leg.arrivalTime || minutesToTime(timeToMinutes(leg.departureTime) + 120) } : undefined;
  const conflicts = conflictingIds([...items, ...(legBlock ? [legBlock] : [])]);
  const hotels = plan.hotelStays.filter((stay) => stay.checkInDate <= day.dateKey && stay.checkOutDate > day.dateKey);
  const dayExpenses = plan.expenses.filter((expense) => expense.date === day.dateKey);
  const dayCost = items.reduce((sum, item) => sum + eur(item.price, item.currency), 0);
  const dayExpensesTotal = dayExpenses.reduce((sum, expense) => sum + eur(expense.amount, expense.currency), 0);
  const plannedTotal = plan.scheduleItems.reduce((sum, item) => sum + eur(item.price, item.currency), 0);
  const toBook = plan.scheduleItems.filter((item) => item.bookingStatus === "da-prenotare").length;
  const categoryOptions = useMemo(() => [...BUILT_IN_CATEGORIES, ...plan.customCategories.map((category) => ({ value: category, label: category }))], [plan.customCategories]);
  const assignableDays = view.calendar.filter((entry) => entry.stopId);
  const overflowCount = items.filter((item) => isOverflowItem(item, view.stopById.get(item.stopId))).length;

  useEffect(() => {
    document.querySelector(".day-strip button.active")?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [day.dateKey]);

  function updateItem(id: string, patch: Partial<ScheduleItem>) {
    update((current) => ({ ...current, scheduleItems: current.scheduleItems.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }

  function removeItem(item: ScheduleItem) {
    if (item.bookingStatus === "prenotato" && !window.confirm(`«${item.name}» è già prenotato. Eliminarlo dall'agenda?`)) return;
    update((current) => ({ ...current, scheduleItems: current.scheduleItems.filter((entry) => entry.id !== item.id) }));
    log(`${KIND_LABELS[scheduleKind(item)]} eliminato`, `${item.name} · ${formatShortDate(item.date)}`);
  }

  function moveItem(item: ScheduleItem, dateKey: string) {
    const target = view.calendar.find((entry) => entry.dateKey === dateKey);
    if (!target?.stopId) return;
    updateItem(item.id, { stopId: target.stopId, day: target.dayInStop });
    notify(`«${item.name}» spostato a ${dayLabel(target)}.`);
    log("Attività spostata", `${item.name} → ${dayLabel(target)}`);
  }

  function addBlock(event: FormEvent) {
    event.preventDefault();
    if (!day.stopId || !draft.name.trim()) return;
    const item: ScheduleItem = {
      ...draft,
      id: uid("plan"),
      stopId: day.stopId,
      day: day.dayInStop,
      date: day.dateKey,
      name: draft.name.trim(),
      location: draft.location.trim(),
      notes: draft.notes.trim(),
      endTime: draft.endTime < draft.startTime ? draft.startTime : draft.endTime,
      paidBy: draft.bookingStatus === "prenotato" ? draft.paidBy : undefined,
    };
    update((current) => ({ ...current, scheduleItems: [...current.scheduleItems, item] }));
    setDraft((current) => ({ ...emptyBlock(current.kind), category: current.category, currency: current.currency }));
    log(`${KIND_LABELS[item.kind || "activity"]} aggiunto`, `${item.name} · ${formatShortDate(item.date)} ${item.startTime}–${item.endTime}`);
  }

  function addCategory() {
    const category = newCategory.trim();
    if (!category || categoryOptions.some((item) => item.value.toLocaleLowerCase("it") === category.toLocaleLowerCase("it"))) return;
    update((current) => ({ ...current, customCategories: [...current.customCategories, category] }));
    setDraft((current) => ({ ...current, category }));
    setNewCategory("");
    log("Categoria aggiunta", category);
  }

  function addExpense(event: FormEvent) {
    event.preventDefault();
    const amount = Number(newExpense.amount.replace(",", "."));
    if (!newExpense.label.trim() || !(amount > 0)) return;
    const expense = { id: uid("spesa"), date: day.dateKey, label: newExpense.label.trim(), amount, currency: newExpense.currency, paidBy: newExpense.paidBy, category: newExpense.category };
    update((current) => ({ ...current, expenses: [...current.expenses, expense] }));
    setNewExpense((current) => ({ ...current, label: "", amount: "" }));
    log("Spesa registrata", `${expense.label} · ${formatCost(expense.amount, expense.currency)} · ha pagato ${PAYER_LABELS[expense.paidBy]}`);
  }

  function scheduleClou(activityId: string) {
    const activity = stop?.activities.find((item) => item.id === activityId);
    if (!stop || !activity) return;
    const id = uid("plan");
    update((current) => scheduleActivity(current, stop.id, activity, { id, day: day.dayInStop })?.plan ?? current);
    log("Attività clou in agenda", `${activity.name} · ${formatShortDate(day.dateKey)}`);
  }

  const hourBlocks: HourBlock[] = [
    ...items.map((item) => ({
      id: item.id,
      kind: scheduleKind(item) === "transport" ? "transport" as const : "activity" as const,
      start: item.startTime,
      end: item.endTime,
      title: item.name,
      subtitle: item.price > 0 ? formatCost(item.price, item.currency) : item.location || undefined,
      booked: item.bookingStatus === "prenotato",
      conflict: conflicts.has(item.id),
    })),
    ...(leg && legBlock ? [{ id: legBlock.id, kind: "leg" as const, start: legBlock.startTime, end: legBlock.endTime, title: `${leg.mode} ${view.legLabel(leg)}`, subtitle: leg.serviceNumber || undefined, booked: leg.bookingStatus === "prenotato", conflict: conflicts.has(legBlock.id) }] : []),
  ];

  function scrollTo(id: string) {
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }

  return <section className="panel-section">
    <div className="section-title agenda-title">
      <div><p className="eyebrow">Agenda condivisa · sincronizzata tra i vostri dispositivi</p><h2>Giorno per giorno, ora per ora</h2></div>
      <div className="agenda-summary">
        <span><b>{plan.scheduleItems.length}</b> blocchi</span>
        <span><b>{toBook}</b> da prenotare</span>
        <span><b>{euro.format(plannedTotal)}</b> pianificati</span>
        <div className="agenda-view-toggle" role="group" aria-label="Vista agenda"><button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>☰ Lista</button><button className={mode === "hours" ? "active" : ""} onClick={() => setMode("hours")}>🕒 Ore</button></div>
        <button onClick={() => window.print()}>Stampa</button>
      </div>
    </div>

    <div className="day-strip-wrap">
      <div className="day-strip-current" aria-live="polite"><small>G{day.index + 1}</small><b>{formatLongDate(day.dateKey)}</b><span>{day.city}</span></div>
      <div className="day-strip" aria-label="Giorni del viaggio">
        {view.calendar.map((entry) => {
          const count = (view.itemsByDate.get(entry.dateKey) || []).length;
          return <button key={entry.dateKey} className={`${entry.dateKey === day.dateKey ? "active" : ""} ${entry.type}`} onClick={() => setSelectedDate(entry.dateKey)}>
            <small>G{entry.index + 1}</small>
            <b>{formatShortDate(entry.dateKey)}</b>
            <span>{entry.city}</span>
            <i>{entry.type === "travel" ? "🚄 " : ""}{plural(count, "blocco", "blocchi")}</i>
          </button>;
        })}
      </div>
    </div>

    <div className="agenda-main">
      <article className="card day-overview">
        <div>
          <p className="eyebrow">{day.type === "travel" ? "Giornata di spostamento" : day.type === "free" ? "Notte non assegnata · aggiungi notti a una tappa dall'Itinerario" : day.type === "over" ? "Oltre il volo di ritorno · togli notti dall'Itinerario" : "Giornata in città"}</p>
          <h2>{formatLongDate(day.dateKey)}</h2>
          <strong>{day.city}{stop?.nameZh ? ` · ${stop.nameZh}` : ""}</strong>
        </div>
        <div className="day-kpis">
          <span><b>{items.length}</b> blocchi</span>
          <span><b>{items[0]?.startTime || "—"}</b> inizio</span>
          <span><b>{euro.format(dayCost)}</b> pianificato</span>
          <span><b>{euro.format(dayExpensesTotal)}</b> speso</span>
        </div>
      </article>

      <div className="day-hotels">
        {hotels.length === 0 ? <button className="day-hotel-empty" onClick={() => goTo("hotels", { stopId: day.stopId })}><span>⌂</span><div><b>Nessun hotel per questa notte</b><small>Apri la sezione Hotel per sistemare check-in e check-out.</small></div><i>Gestisci hotel →</i></button> : hotels.map((stay) => {
          const stayStop = view.stopById.get(stay.stopId);
          return <article className="day-hotel-banner" key={stay.id}>
            <span className="day-hotel-icon">⌂</span>
            <div><small>Hotel della notte · {stay.checkInDate === day.dateKey ? "check-in oggi" : `fino al ${formatShortDate(stay.checkOutDate)}`}{stay.bookingStatus === "prenotato" ? " · ✓ prenotato" : " · da prenotare"}</small><b>{stay.name}</b><p>{stay.address || stayStop?.name}</p></div>
            <div className="day-hotel-dates"><span>{formatShortDate(stay.checkInDate)}<small>in</small></span><i>→</i><span>{formatShortDate(stay.checkOutDate)}<small>out</small></span></div>
            <div className="day-hotel-actions"><button className="taxi-button" onClick={() => planner.showChinese({ kind: "hotel", title: stay.name, titleZh: stay.nameZh, subtitle: stay.address, subtitleZh: stay.addressZh })}>🚕 Mostra in cinese</button><a href={safeExternalLink(stay.mapUrl) || googleMapsSearchUrl(stay.address || stay.name, stayStop?.name || "")} target="_blank" rel="noreferrer">Google Maps ↗</a><button onClick={() => goTo("hotels", { stopId: stay.stopId })}>Modifica</button></div>
          </article>;
        })}
      </div>

      {leg && <article className={`day-leg-banner ${leg.bookingStatus === "prenotato" ? "booked" : ""}`}>
        <span className="day-leg-icon">{/✈/.test(leg.mode) ? "✈️" : /🚌|bus/i.test(leg.mode) ? "🚌" : /🚕|didi|taxi/i.test(leg.mode) ? "🚕" : "🚄"}</span>
        <div>
          <small>Tratta del giorno · {leg.bookingStatus === "prenotato" ? "prenotata" : "da prenotare"}</small>
          <b>{view.legLabel(leg)}</b>
          <p>{leg.departureTime ? `${leg.departureTime}${leg.arrivalTime ? ` → ${leg.arrivalTime}` : ""}` : "Orari da definire"}{leg.serviceNumber ? ` · ${leg.serviceNumber}` : ""} · {leg.mode} · {leg.duration}{leg.fromStation ? ` · ${leg.fromStation}${leg.toStation ? ` → ${leg.toStation}` : ""}` : ""}</p>
        </div>
        <div className="day-leg-actions">
          {safeExternalLink(leg.ticketUrl) && <a href={safeExternalLink(leg.ticketUrl)} target="_blank" rel="noreferrer">🎟 Biglietto ↗</a>}
          <button onClick={() => goTo("transport", { anchor: `leg-${leg.id}` })}>{leg.bookingStatus === "prenotato" ? "Dettagli" : "Orari e prenotazione"} →</button>
        </div>
      </article>}

      {conflicts.size > 0 && <div className="agenda-warning"><b>Orari sovrapposti</b><span>I blocchi evidenziati si accavallano{legBlock && conflicts.has(legBlock.id) ? " (anche con la tratta del giorno)" : ""}: sistema inizio o fine.</span></div>}
      {overflowCount > 0 && <div className="agenda-warning"><b>Da ricollocare</b><span>{plural(overflowCount, "blocco era", "blocchi erano")} in un giorno che la tappa non ha più: usa «Giorno» per spostarli.</span></div>}

      {stop && stop.activities.length > 0 && <div className="day-clou">
        <span className="day-clou-label">✦ Attività clou di {stop.name}</span>
        <div className="day-clou-chips">
          {[...stop.activities].sort((a, b) => Number(b.selected) - Number(a.selected)).map((activity) => {
            const scheduled = plan.scheduleItems.find((item) => item.sourceActivityId === activity.id && item.stopId === stop.id);
            return <button key={activity.id} className={scheduled ? "done" : ""} title={scheduled ? `In agenda il ${formatShortDate(scheduled.date)}` : `Aggiungi a questa giornata · ${activity.description}`} onClick={() => (scheduled ? (scheduled.date === day.dateKey ? scrollTo(`plan-${scheduled.id}`) : setSelectedDate(scheduled.date)) : scheduleClou(activity.id))}>
              <i>{scheduled ? "✓" : "+"}</i>{activity.name}{scheduled && scheduled.date !== day.dateKey ? <em>{formatShortDate(scheduled.date)}</em> : activity.price > 0 && <em>{formatCost(activity.price, activity.currency)}</em>}
            </button>;
          })}
        </div>
      </div>}

      {mode === "hours" && <article className="card hour-card">
        <div className="card-head"><div><p className="eyebrow">Vista a ore · {day.city}</p><h3>{formatLongDate(day.dateKey)}</h3></div><span className="subtle">Tocca un’ora libera per creare un blocco · tocca un blocco per modificarlo</span></div>
        <HourGrid blocks={hourBlocks} onPickTime={(time) => {
          setDraft((current) => ({ ...current, startTime: time, endTime: minutesToTime(timeToMinutes(time) + 120) }));
          scrollTo("new-plan");
        }} onOpenBlock={(block) => {
          if (block.kind === "leg" && leg) {
            goTo("transport", { anchor: `leg-${leg.id}` });
            return;
          }
          setMode("list");
          scrollTo(`plan-${block.id}`);
        }} />
        <div className="hour-legend"><span><i className="activity" /> Attività</span><span><i className="transport" /> Spostamento</span><span><i className="leg" /> Tratta tra città</span><span><i className="booked" /> Prenotato</span></div>
      </article>}

      <div className="time-plan" hidden={mode === "hours"}>
        {items.length === 0 && <div className="empty-day"><span>+</span><b>Giornata ancora libera</b><p>{day.stopId ? "Aggiungi un'attività clou qui sopra o un blocco con il modulo qui sotto." : "Prima assegna questa notte a una tappa dall'Itinerario."}</p></div>}
        {items.map((item) => <ScheduleCard key={item.id} item={item} conflict={conflicts.has(item.id)} overflow={isOverflowItem(item, view.stopById.get(item.stopId))} city={day.city} days={assignableDays} categoryOptions={categoryOptions} onUpdate={(patch) => updateItem(item.id, patch)} onRemove={() => removeItem(item)} onMove={(dateKey) => moveItem(item, dateKey)} />)}
      </div>

      {day.stopId ? <form className="card add-plan-card" id="new-plan" onSubmit={addBlock}>
        <div className="card-head"><div><p className="eyebrow">Nuovo blocco · {formatShortDate(day.dateKey)}</p><h3>Nuovo {KIND_LABELS[draft.kind || "activity"].toLocaleLowerCase("it")}</h3></div><span>{day.city}</span></div>
        <div className="kind-picker" role="group" aria-label="Tipo di nuovo blocco">
          {(["activity", "transport"] as ScheduleKind[]).map((kind) => <button type="button" key={kind} className={draft.kind === kind ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, kind, category: kind === "transport" ? "trasferimento" : "visita" }))}><span>{kind === "activity" ? "◎" : "→"}</span>{KIND_LABELS[kind]}</button>)}
        </div>
        <div className="add-plan-grid">
          <label>Inizio<input type="time" step="300" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} /></label>
          <label>Fine<input type="time" step="300" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} /></label>
          <label className="wide">Titolo<input required value={draft.name} placeholder={draft.kind === "transport" ? "Es. Hotel → Muraglia di Mutianyu" : "Es. Tempio del Cielo"} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          {draft.kind === "activity" && <label>Categoria<select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{categoryOptions.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}</select></label>}
          {draft.kind === "transport" && <><label>Mezzo<input value={draft.transportMode} placeholder="Treno, Didi, metro…" onChange={(event) => setDraft((current) => ({ ...current, transportMode: event.target.value }))} /></label><label className="wide">Da<input value={draft.fromLocation} placeholder="Hotel o punto di partenza" onChange={(event) => setDraft((current) => ({ ...current, fromLocation: event.target.value }))} /></label></>}
          <label className="wide">{draft.kind === "transport" ? "A / destinazione" : "Luogo"}<input value={draft.location} placeholder="Nome, indirizzo o stazione (meglio anche in cinese)" onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} /></label>
          <label>Costo per 2<span className="money-input"><input inputMode="decimal" value={draft.price || ""} placeholder="0" onChange={(event) => setDraft((current) => ({ ...current, price: Math.max(0, Number(event.target.value.replace(",", ".")) || 0) }))} /><select aria-label="Valuta nuovo blocco" value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value as Currency }))}><option value="EUR">€</option><option value="CNY">¥</option></select></span></label>
          <label>Stato<select value={draft.bookingStatus} onChange={(event) => setDraft((current) => ({ ...current, bookingStatus: event.target.value as ScheduleItem["bookingStatus"] }))}><option value="da-prenotare">Da prenotare</option><option value="prenotato">Prenotato</option><option value="non-serve">Nessuna prenotazione</option></select></label>
          {draft.bookingStatus === "prenotato" && <label>Chi ha pagato<select value={draft.paidBy || ""} onChange={(event) => setDraft((current) => ({ ...current, paidBy: (event.target.value || undefined) as Payer | undefined }))}><option value="">Da assegnare</option><option value="alberto">Alberto</option><option value="sofia">Sofia</option></select></label>}
          <label className="full">Note<textarea value={draft.notes} placeholder="Tempi di trasferimento, biglietti, promemoria…" onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
        </div>
        {draft.kind === "activity" && <div className="category-creator"><span>Non trovi la categoria?</span><input value={newCategory} placeholder="Es. Fotografia" onChange={(event) => setNewCategory(event.target.value)} /><button type="button" onClick={addCategory}>+ Crea categoria</button></div>}
        <div className="add-plan-footer"><button className="primary" type="submit">+ Aggiungi alla giornata</button><small>Ogni modifica successiva si salva da sola quando esci dal campo.</small></div>
      </form> : <div className="empty-day compact"><b>Questa notte non appartiene a nessuna tappa</b><p>Aggiungi una notte a una tappa nell&apos;Itinerario per poterla pianificare.</p><button className="primary" onClick={() => goTo("itinerary")}>Vai all&apos;Itinerario</button></div>}

      <article className="card day-expenses">
        <div className="card-head"><div><p className="eyebrow">Fine giornata · chi ha pagato cosa</p><h3>Spese effettive del giorno</h3></div><b>{euro.format(dayExpensesTotal)}</b></div>
        <div className="expense-list">
          {dayExpenses.length === 0 && <p className="empty">Nessuna spesa registrata. A fine giornata segnate qui chi ha pagato cosa: budget e bilancio Alberto/Sofia si aggiornano da soli.</p>}
          {dayExpenses.map((expense) => <div className="expense-row" key={expense.id}>
            <span className={`payer-badge ${expense.paidBy}`}>{PAYER_LABELS[expense.paidBy].charAt(0)}</span>
            <div><b>{expense.label}</b><small>{EXPENSE_CATEGORIES.find((category) => category.value === expense.category)?.label || "Extra"} · ha pagato {PAYER_LABELS[expense.paidBy]}</small></div>
            <strong>{formatCost(expense.amount, expense.currency)}{expense.currency === "CNY" && <small>≈ {euro.format(eur(expense.amount, expense.currency))}</small>}</strong>
            <button className="danger-text" onClick={() => {
              update((current) => ({ ...current, expenses: current.expenses.filter((entry) => entry.id !== expense.id) }));
              log("Spesa eliminata", `${expense.label} · ${formatCost(expense.amount, expense.currency)}`);
            }}>Togli</button>
          </div>)}
        </div>
        <form className="add-expense" onSubmit={addExpense}>
          <input required aria-label="Descrizione spesa" placeholder="Es. Cena, biglietti, taxi…" value={newExpense.label} onChange={(event) => setNewExpense((current) => ({ ...current, label: event.target.value }))} />
          <input required aria-label="Importo spesa" inputMode="decimal" placeholder="0" value={newExpense.amount} onChange={(event) => setNewExpense((current) => ({ ...current, amount: event.target.value }))} />
          <select aria-label="Valuta spesa" value={newExpense.currency} onChange={(event) => setNewExpense((current) => ({ ...current, currency: event.target.value as Currency }))}><option value="EUR">€</option><option value="CNY">¥</option></select>
          <select aria-label="Categoria spesa" value={newExpense.category} onChange={(event) => setNewExpense((current) => ({ ...current, category: event.target.value as ExpenseCategory }))}>{EXPENSE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select>
          <select aria-label="Chi ha pagato" value={newExpense.paidBy} onChange={(event) => setNewExpense((current) => ({ ...current, paidBy: event.target.value as Payer }))}><option value="alberto">Alberto</option><option value="sofia">Sofia</option></select>
          <button className="primary" type="submit">+ Registra</button>
        </form>
      </article>
    </div>
  </section>;
}

function ScheduleCard({ item, conflict, overflow, city, days, categoryOptions, onUpdate, onRemove, onMove }: {
  item: ScheduleItem;
  conflict: boolean;
  overflow: boolean;
  city: string;
  days: CalendarDay[];
  categoryOptions: Array<{ value: string; label: string }>;
  onUpdate: (patch: Partial<ScheduleItem>) => void;
  onRemove: () => void;
  onMove: (dateKey: string) => void;
}) {
  const { log, showChinese } = usePlanner();
  const kind = scheduleKind(item);
  const mapLink = mapLinkFor(item, city);
  const ticket = safeExternalLink(item.ticketUrl);
  const commit = (field: string, patch: Partial<ScheduleItem>, shown: string) => {
    onUpdate(patch);
    log("Modifica agenda", `${item.name}: ${field} ${shown}`);
  };
  return <article id={`plan-${item.id}`} className={`schedule-item kind-${kind} ${conflict ? "conflict" : ""} ${item.bookingStatus === "prenotato" ? "booked" : ""}`}>
    <div className="schedule-time">
      <label>Inizio<input type="time" step="300" value={item.startTime} onChange={(event) => event.target.value && onUpdate({ startTime: event.target.value, ...(item.endTime < event.target.value ? { endTime: event.target.value } : {}) })} /></label>
      <span>↓</span>
      <label>Fine<input type="time" step="300" value={item.endTime} onChange={(event) => event.target.value && onUpdate({ endTime: event.target.value })} /></label>
    </div>
    <div className="schedule-content">
      <div className="kind-badge"><span>{kind === "activity" ? "◎" : "→"}</span>{KIND_LABELS[kind]}{overflow && <em className="overflow-tag">da ricollocare</em>}</div>
      <div className="schedule-topline">
        <TextInput className="schedule-name" aria-label="Nome" value={item.name} onCommit={(name) => commit("titolo", { name }, name)} />
        <select aria-label="Tipo di blocco" value={kind} onChange={(event) => {
          const nextKind = event.target.value as ScheduleKind;
          onUpdate({ kind: nextKind, category: nextKind === "transport" ? "trasferimento" : "visita" });
          log("Tipo modificato", `${item.name}: ${KIND_LABELS[nextKind]}`);
        }}><option value="activity">Attività</option><option value="transport">Trasporto</option></select>
      </div>
      <div className="schedule-quick">
        {item.location && <span className="quick-place">📍 {item.location}</span>}
        {item.nameZh && <button className="quick-zh" title="Mostra in cinese a schermo intero" onClick={() => showChinese({ kind: "place", title: item.name, titleZh: item.nameZh, subtitle: item.location || city, subtitleZh: item.locationZh })}>中 {item.nameZh}</button>}
        {mapLink && <a href={mapLink} target="_blank" rel="noreferrer">Mappa ↗</a>}
        {ticket && <a href={ticket} target="_blank" rel="noreferrer">🎟 Biglietto ↗</a>}
      </div>
      <div className="schedule-meta">
        <label>Costo per 2 <MoneyInput label={`Costo ${item.name}`} amount={item.price} currency={item.currency} onAmount={(price) => commit("costo", { price }, formatCost(price, item.currency))} onCurrency={(currency) => commit("valuta", { currency }, currency)} /></label>
        <label>Stato <select value={item.bookingStatus} onChange={(event) => {
          onUpdate({ bookingStatus: event.target.value as ScheduleItem["bookingStatus"] });
          log("Stato modificato", `${item.name}: ${event.target.options[event.target.selectedIndex].text}`);
        }}><option value="da-prenotare">Da prenotare</option><option value="prenotato">Prenotato</option><option value="non-serve">Nessuna prenotazione</option></select></label>
        {item.bookingStatus === "prenotato" && <label>Chi ha pagato <select value={item.paidBy || ""} onChange={(event) => {
          const payer = (event.target.value || undefined) as Payer | undefined;
          onUpdate({ paidBy: payer });
          if (payer) log("Pagamento registrato", `${item.name}: ha pagato ${PAYER_LABELS[payer]}`);
        }}><option value="">Da assegnare</option><option value="alberto">Alberto</option><option value="sofia">Sofia</option></select></label>}
        <label>Giorno <select value={item.date} onChange={(event) => onMove(event.target.value)}>
          {!days.some((day) => day.dateKey === item.date) && <option value={item.date}>{formatShortDate(item.date)} · fuori viaggio</option>}
          {days.map((day) => <option key={day.dateKey} value={day.dateKey}>{dayLabel(day)}</option>)}
        </select></label>
        <button className="danger-text" onClick={onRemove}>Elimina</button>
      </div>
      <details className="schedule-more">
        <summary>Dettagli · luogo, biglietto, cinese, note</summary>
        <div className="schedule-specifics">
          {kind === "activity" && <label>Categoria<select aria-label="Categoria" value={item.category} onChange={(event) => {
            onUpdate({ category: event.target.value });
            log("Categoria modificata", `${item.name}: ${event.target.options[event.target.selectedIndex].text}`);
          }}>{!categoryOptions.some((category) => category.value === item.category) && <option value={item.category}>{item.category}</option>}{categoryOptions.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}</select></label>}
          {kind === "transport" && <>
            <label>Mezzo<TextInput value={item.transportMode || ""} placeholder="Treno, Didi, metro…" onCommit={(transportMode) => commit("mezzo", { transportMode }, transportMode)} /></label>
            <label>Da<TextInput value={item.fromLocation || ""} placeholder="Hotel o punto di partenza" onCommit={(fromLocation) => commit("partenza", { fromLocation }, fromLocation)} /></label>
          </>}
          <label className={kind === "activity" ? "wide" : ""}>{kind === "transport" ? "A / destinazione" : "Luogo"}<TextInput value={item.location} placeholder="Nome, indirizzo o stazione" onCommit={(location) => commit("luogo", { location }, location)} /></label>
          <label>Nome in cinese<TextInput value={item.nameZh || ""} placeholder="Es. 故宫博物院" onCommit={(nameZh) => commit("nome cinese", { nameZh }, nameZh)} /></label>
          <label>Luogo in cinese<TextInput value={item.locationZh || ""} placeholder="Indirizzo o zona in cinese" onCommit={(locationZh) => commit("luogo cinese", { locationZh }, locationZh)} /></label>
          <label className="wide">Link biglietto / PDF<TextInput value={item.ticketUrl || ""} placeholder="Link a biglietto, PDF su Drive o mail di conferma" onCommit={(ticketUrl) => commit("biglietto", { ticketUrl }, ticketUrl ? "link salvato" : "link rimosso")} /></label>
          <label className="wide">Link mappa personalizzato<TextInput value={item.mapUrl || ""} placeholder="Automatico se vuoto" onCommit={(mapUrl) => onUpdate({ mapUrl })} /></label>
        </div>
        <div className="zh-tools">
          <button type="button" onClick={() => showChinese({ kind: "place", title: item.name, titleZh: item.nameZh, subtitle: item.location || city, subtitleZh: item.locationZh })}>🈶 Mostra in cinese</button>
          <a href={translateZhUrl(`${item.name}${item.location ? `, ${item.location}` : ""}`)} target="_blank" rel="noreferrer">Traduci con Google ↗</a>
          <a href={webSearchUrl(`${item.name} ${city} biglietti sito ufficiale`)} target="_blank" rel="noreferrer">Cerca link ufficiale ↗</a>
          {safeExternalLink(item.sourceUrl) && <a href={safeExternalLink(item.sourceUrl)} target="_blank" rel="noreferrer">Fonte ↗</a>}
        </div>
        <TextArea aria-label="Note" value={item.notes} placeholder="Biglietti, cosa portare, note pratiche…" onCommit={(notes) => {
          onUpdate({ notes });
          log("Note aggiornate", item.name);
        }} />
      </details>
    </div>
  </article>;
}
