"use client";

import { useState, type FormEvent } from "react";
import { EXPENSE_CATEGORIES, FLIGHTS_COST, PAYER_LABELS } from "@/lib/planner/catalog";
import { hotelNights, settleUpEntry } from "@/lib/planner/model";
import type { Currency, Payer, Settlement } from "@/lib/planner/types";
import { euro, formatCost, formatShortDate, uid } from "@/lib/planner/utils";
import { usePlanner } from "../context";
import { NumberInput, TextInput } from "../fields";

/** Quanto resta del previsto: in rosso se lo speso ha già superato la stima. */
function remaining(spent: number, planned: number) {
  const value = planned - spent;
  if (Math.abs(value) < 0.005) return { text: "In linea", className: "muted" };
  return { text: value < 0 ? `+ ${euro.format(-value)} oltre` : euro.format(value), className: value < 0 ? "over" : "ok" };
}

const otherPayer = (payer: Payer): Payer => (payer === "alberto" ? "sofia" : "alberto");

/** Saldo con segno (>0: Sofia deve ad Alberto) in parole. */
function balanceText(balance: number) {
  if (Math.abs(balance) < 0.005) return "siete pari";
  return balance > 0 ? `Sofia deve ad Alberto ${euro.format(balance)}` : `Alberto deve a Sofia ${euro.format(-balance)}`;
}

function settlementText(settlement: Settlement) {
  const from = PAYER_LABELS[settlement.from];
  const to = PAYER_LABELS[otherPayer(settlement.from)];
  return settlement.kind === "debito" ? `${from} deve a ${to}` : `${from} ha dato a ${to}`;
}

export function BudgetSection() {
  const { plan, view, update, log, eur, goTo } = usePlanner();
  const [newCost, setNewCost] = useState({ label: "", amount: "", currency: "EUR" as Currency });
  const [newSettlement, setNewSettlement] = useState({ kind: "debito" as Settlement["kind"], from: "sofia" as Payer, label: "", amount: "", currency: "EUR" as Currency });
  const { budget } = view;
  const includedLegs = view.legs.filter((leg) => leg.included);
  const pricedItems = plan.scheduleItems.filter((item) => item.price > 0);
  const rows = [
    { key: "voli", label: "Voli internazionali", note: "Già pagati · divisi a metà", planned: budget.planned.voli, spent: budget.spent.voli },
    { key: "hotel", label: "Hotel", note: `${plan.hotelStays.reduce((sum, stay) => sum + hotelNights(stay), 0)} notti · ${plan.hotelStays.filter((stay) => stay.bookingStatus === "prenotato").length}/${plan.hotelStays.length} prenotati`, planned: budget.planned.hotel, spent: budget.spent.hotel },
    { key: "trasporti", label: "Trasporti", note: `${includedLegs.length} tratte (${includedLegs.filter((leg) => leg.bookingStatus === "prenotato").length} prenotate) + spostamenti in agenda`, planned: budget.planned.trasporti, spent: budget.spent.trasporti },
    { key: "attivita", label: "Attività", note: "Blocchi in agenda con un costo", planned: budget.planned.attivita, spent: budget.spent.attivita },
    { key: "cibo-extra", label: "Cibo & extra", note: `Cene in agenda + ${plan.costEntries.length} voci stimate`, planned: budget.planned.ciboExtra, spent: budget.spent.ciboExtra },
  ];
  const total = remaining(budget.totalSpent, budget.totalPlanned);

  function addCost(event: FormEvent) {
    event.preventDefault();
    const amount = Number(newCost.amount.replace(",", "."));
    if (!newCost.label.trim() || !(amount > 0)) return;
    const entry = { id: uid("cost"), label: newCost.label.trim(), amount, currency: newCost.currency };
    update((current) => ({ ...current, costEntries: [...current.costEntries, entry] }));
    setNewCost((current) => ({ ...current, label: "", amount: "" }));
    log("Costo aggiunto", `${entry.label} · ${formatCost(entry.amount, entry.currency)}`);
  }

  function addSettlement(event: FormEvent) {
    event.preventDefault();
    const amount = Number(newSettlement.amount.replace(",", "."));
    if (!newSettlement.label.trim() || !(amount > 0)) return;
    const { kind, from, currency } = newSettlement;
    const entry: Settlement = { id: uid("conto"), date: new Date().toISOString().slice(0, 10), label: newSettlement.label.trim(), amount, currency, kind, from };
    update((current) => ({ ...current, settlements: [...current.settlements, entry] }));
    setNewSettlement((current) => ({ ...current, label: "", amount: "" }));
    log(kind === "debito" ? "Debito da scalare" : "Rimborso registrato", `${entry.label}: ${settlementText(entry)} ${formatCost(amount, currency)}`);
  }

  function settleUp() {
    const entry = settleUpEntry(budget.splitBalance, new Date().toISOString().slice(0, 10));
    if (!entry) return;
    const text = `${PAYER_LABELS[entry.from]} dà ${euro.format(entry.amount)} a ${PAYER_LABELS[otherPayer(entry.from)]}`;
    if (!window.confirm(`${text} e i conti tornano a zero. Registro il saldo?`)) return;
    update((current) => ({ ...current, settlements: [...current.settlements, entry] }));
    log("Conti pareggiati", text);
  }

  function patchCost(id: string, changes: Partial<(typeof plan.costEntries)[number]>) {
    update((current) => ({ ...current, costEntries: current.costEntries.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)) }));
  }

  return <section className="panel-section">
    <div className="budget-hero">
      <div><p className="eyebrow">Budget previsionale · per due</p><strong>{euro.format(budget.totalPlanned)}</strong><span>{euro.format(budget.totalPlanned / 2)} a persona</span></div>
      <div className="budget-hero-side">
        <div><small>Speso e prenotato</small><b>{euro.format(budget.totalSpent)}</b></div>
        <div><small>Residuo</small><b className={budget.totalPlanned - budget.totalSpent >= 0 ? "ok" : "over"}>{euro.format(budget.totalPlanned - budget.totalSpent)}</b></div>
        <div><small>Cambio</small><label className="fx-input">1 € = <NumberInput min={0.01} aria-label="Yuan per euro" value={plan.cnyPerEuro} onCommit={(cnyPerEuro) => {
          update((current) => ({ ...current, cnyPerEuro: Math.max(0.01, cnyPerEuro) }));
          log("Cambio aggiornato", `1 € = ${cnyPerEuro} ¥`);
        }} /> ¥</label></div>
      </div>
    </div>

    <article className="card budget-compare">
      <div className="card-head"><div><p className="eyebrow">Previsionale vs consuntivo</p><h2>Previsto e speso per categoria</h2></div><span className="subtle">Voli, prenotazioni confermate e spese registrate entrano da soli nel consuntivo</span></div>
      <div className="compare-table">
        <div className="compare-row head"><span>Categoria</span><span>Previsto</span><span>Speso o prenotato</span><span>Rimanente</span></div>
        {rows.map((row) => {
          const rowDelta = remaining(row.spent, row.planned);
          return <div className="compare-row" key={row.key}>
            <span className="compare-label"><b>{row.label}</b><small>{row.note}</small></span>
            <span>{euro.format(row.planned)}</span>
            <span>{row.spent > 0 ? euro.format(row.spent) : "—"}</span>
            <span className={`compare-delta ${rowDelta.className}`}>{rowDelta.text}</span>
          </div>;
        })}
        <div className="compare-row total">
          <span className="compare-label"><b>Totale viaggio</b></span>
          <span>{euro.format(budget.totalPlanned)}</span>
          <span>{euro.format(budget.totalSpent)}</span>
          <span className={`compare-delta ${total.className}`}>{total.text}</span>
        </div>
      </div>
    </article>

    <article className="card split-card">
      <div className="card-head"><div><p className="eyebrow">Splitwise interno · tutto diviso a metà</p><h2>Bilancio Alberto & Sofia</h2></div><b>{euro.format(budget.totalSpent)}</b></div>
      <div className="split-totals">
        <div className="split-person alberto"><span className="payer-badge alberto">A</span><div><b>Alberto</b><small>ha anticipato</small></div><strong>{euro.format(budget.byPayer.alberto)}</strong></div>
        <div className={`split-balance ${Math.abs(budget.splitBalance) < 0.005 ? "even" : ""}`}>
          {Math.abs(budget.splitBalance) < 0.005 ? <b>Siete pari</b> : budget.splitBalance > 0 ? <><small>Sofia deve ad Alberto</small><b>{euro.format(budget.splitBalance)}</b></> : <><small>Alberto deve a Sofia</small><b>{euro.format(-budget.splitBalance)}</b></>}
        </div>
        <div className="split-person sofia"><span className="payer-badge sofia">S</span><div><b>Sofia</b><small>ha anticipato</small></div><strong>{euro.format(budget.byPayer.sofia)}</strong></div>
      </div>
      {plan.settlements.length > 0 && <p className="split-breakdown">Solo spese del viaggio: {balanceText(budget.tripBalance)} · debiti e rimborsi tra voi: {balanceText(budget.settlementsBalance)}</p>}
      {budget.unassigned > 0 && <p className="split-warning">⚠️ {euro.format(budget.unassigned)} di prenotazioni senza «chi ha pagato»: non entrano nel bilancio finché non lo indicate.</p>}
      <div className="expense-register">
        <div className="expense-row auto">
          <span className="payer-badge even">½</span>
          <div><b>Voli internazionali</b><small>Già pagati · divisi a metà, non spostano il bilancio</small></div>
          <strong>{euro.format(FLIGHTS_COST)}</strong>
          <em className="auto-tag">auto</em>
        </div>
        {[...budget.confirmed].sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`)).map((entry) => <div className="expense-row auto" key={entry.id}>
          <span className={`payer-badge ${entry.paidBy || "even"}`}>{entry.paidBy ? PAYER_LABELS[entry.paidBy].charAt(0) : "?"}</span>
          <div><b>{entry.label}</b><small>{formatShortDate(entry.date)} · {entry.detail}{entry.paidBy ? ` · ha pagato ${PAYER_LABELS[entry.paidBy]}` : " · chi ha pagato? Da assegnare"}</small></div>
          <strong>{formatCost(entry.amount, entry.currency)}{entry.currency === "CNY" && <small>≈ {euro.format(eur(entry.amount, entry.currency))}</small>}</strong>
          <em className="auto-tag">auto</em>
        </div>)}
        {[...plan.expenses].sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`)).map((expense) => <div className="expense-row" key={expense.id}>
          <span className={`payer-badge ${expense.paidBy}`}>{PAYER_LABELS[expense.paidBy].charAt(0)}</span>
          <div><b>{expense.label}</b><small>{formatShortDate(expense.date)} · {EXPENSE_CATEGORIES.find((category) => category.value === expense.category)?.label || "Extra"}</small></div>
          <strong>{formatCost(expense.amount, expense.currency)}</strong>
          <button className="danger-text" onClick={() => {
            update((current) => ({ ...current, expenses: current.expenses.filter((entry) => entry.id !== expense.id) }));
            log("Spesa eliminata", `${expense.label} · ${formatCost(expense.amount, expense.currency)}`);
          }}>Togli</button>
        </div>)}
      </div>
      <div className="settle-box">
        <div className="settle-head">
          <div><b>Pareggia i conti</b><small>Debiti fuori dal viaggio da scalare (es. l&apos;affitto) e rimborsi già fatti: entrano nel saldo qui sopra.</small></div>
          {Math.abs(budget.splitBalance) >= 0.005 && <button className="primary" onClick={settleUp}>Salda {euro.format(Math.abs(budget.splitBalance))}</button>}
        </div>
        {plan.settlements.length > 0 && <div className="expense-list">
          {[...plan.settlements].sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`)).map((settlement) => <div className="expense-row" key={settlement.id}>
            <span className={`payer-badge ${settlement.from}`}>{PAYER_LABELS[settlement.from].charAt(0)}</span>
            <div><b>{settlement.label}</b><small>{formatShortDate(settlement.date)} · {settlement.kind === "debito" ? "debito da scalare" : "rimborso"} · {settlementText(settlement)}</small></div>
            <strong>{formatCost(settlement.amount, settlement.currency)}</strong>
            <button className="danger-text" onClick={() => {
              update((current) => ({ ...current, settlements: current.settlements.filter((entry) => entry.id !== settlement.id) }));
              log("Movimento tolto", `${settlement.label} · ${formatCost(settlement.amount, settlement.currency)}`);
            }}>Togli</button>
          </div>)}
        </div>}
        <form className="add-cost settle-form" onSubmit={addSettlement}>
          <select aria-label="Tipo di movimento" value={newSettlement.kind} onChange={(event) => setNewSettlement((current) => ({ ...current, kind: event.target.value as Settlement["kind"] }))}><option value="debito">Debito da scalare</option><option value="rimborso">Rimborso già fatto</option></select>
          <select aria-label="Chi verso chi" value={newSettlement.from} onChange={(event) => setNewSettlement((current) => ({ ...current, from: event.target.value as Payer }))}>
            {(["sofia", "alberto"] as Payer[]).map((payer) => <option key={payer} value={payer}>{PAYER_LABELS[payer]} {newSettlement.kind === "debito" ? "deve a" : "ha dato a"} {PAYER_LABELS[otherPayer(payer)]}</option>)}
          </select>
          <input required aria-label="Motivo" placeholder="Es. Affitto ottobre" value={newSettlement.label} onChange={(event) => setNewSettlement((current) => ({ ...current, label: event.target.value }))} />
          <input required aria-label="Importo" inputMode="decimal" placeholder="0" value={newSettlement.amount} onChange={(event) => setNewSettlement((current) => ({ ...current, amount: event.target.value }))} />
          <select aria-label="Valuta" value={newSettlement.currency} onChange={(event) => setNewSettlement((current) => ({ ...current, currency: event.target.value as Currency }))}><option value="EUR">EUR €</option><option value="CNY">CNY ¥</option></select>
          <button className="primary" type="submit">+ Aggiungi</button>
        </form>
      </div>
    </article>

    <div className="budget-panels">
      <article className="card cost-manager">
        <div className="card-head"><div><p className="eyebrow">Stime a forfait · cibo, extra</p><h2>Voci di budget pianificate</h2></div><b>{euro.format(plan.costEntries.reduce((sum, entry) => sum + eur(entry.amount, entry.currency), 0))}</b></div>
        <div className="cost-list">
          {plan.costEntries.map((entry) => <div className="cost-row" key={entry.id}>
            <TextInput aria-label="Descrizione costo" value={entry.label} onCommit={(label) => { patchCost(entry.id, { label }); log("Costo modificato", `Descrizione: ${label}`); }} />
            <NumberInput aria-label={`Importo ${entry.label}`} value={entry.amount} onCommit={(amount) => { patchCost(entry.id, { amount }); log("Costo modificato", `${entry.label}: ${formatCost(amount, entry.currency)}`); }} />
            <select aria-label={`Valuta ${entry.label}`} value={entry.currency} onChange={(event) => patchCost(entry.id, { currency: event.target.value as Currency })}><option value="EUR">EUR €</option><option value="CNY">CNY ¥</option></select>
            <strong>{entry.currency === "CNY" ? `≈ ${euro.format(eur(entry.amount, entry.currency))}` : formatCost(entry.amount, entry.currency)}</strong>
            <button className="danger-text" onClick={() => {
              update((current) => ({ ...current, costEntries: current.costEntries.filter((item) => item.id !== entry.id) }));
              log("Costo eliminato", `${entry.label} · ${formatCost(entry.amount, entry.currency)}`);
            }}>Togli</button>
          </div>)}
        </div>
        <form className="add-cost" onSubmit={addCost}>
          <input required aria-label="Nuovo costo" placeholder="Es. SIM e VPN" value={newCost.label} onChange={(event) => setNewCost((current) => ({ ...current, label: event.target.value }))} />
          <input required aria-label="Importo nuovo costo" inputMode="decimal" placeholder="0" value={newCost.amount} onChange={(event) => setNewCost((current) => ({ ...current, amount: event.target.value }))} />
          <select aria-label="Valuta nuovo costo" value={newCost.currency} onChange={(event) => setNewCost((current) => ({ ...current, currency: event.target.value as Currency }))}><option value="EUR">EUR €</option><option value="CNY">CNY ¥</option></select>
          <button className="primary" type="submit">+ Aggiungi</button>
        </form>
      </article>
      <article className="card budget-detail">
        <div className="card-head"><div><p className="eyebrow">Dall’agenda</p><h2>Blocchi con un costo</h2></div><b>{euro.format(pricedItems.reduce((sum, item) => sum + eur(item.price, item.currency), 0))}</b></div>
        <div>{pricedItems.length === 0 ? <p className="empty padded">Aggiungi un costo a un blocco dell’agenda per includerlo nel budget.</p> : [...pricedItems].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)).map((item) => (
          <button className="budget-row" key={item.id} onClick={() => goTo("calendar", { date: item.date, anchor: `plan-${item.id}` })}>
            <span>{view.stopById.get(item.stopId)?.name || "Tappa"}<small>{formatShortDate(item.date)} · {item.startTime}</small></span>
            <div><b>{item.name}</b><small>{item.bookingStatus === "prenotato" ? `✓ prenotato${item.paidBy ? ` · ha pagato ${PAYER_LABELS[item.paidBy]}` : " · chi ha pagato?"}` : item.bookingStatus === "da-prenotare" ? "da prenotare" : ""}</small></div>
            <strong>{formatCost(item.price, item.currency)}</strong>
          </button>
        ))}</div>
      </article>
    </div>
  </section>;
}
