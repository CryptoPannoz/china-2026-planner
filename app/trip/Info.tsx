"use client";

import { useState, type FormEvent } from "react";
import { EXPENSE_CATEGORIES, PAYER_LABELS } from "@/lib/planner/catalog";
import { CITY_TIPS, GUIDE_FACTS } from "@/lib/planner/guide";
import type { Currency, ExpenseCategory, Payer } from "@/lib/planner/types";
import { euro, formatCost, formatShortDate, uid } from "@/lib/planner/utils";
import { APPS, EMERGENCY, PHRASES } from "@/lib/trip/data";
import { todayKey, useTrip } from "./shared";

function Balance() {
  const { plan, view, update, log, who } = useTrip();
  const [form, setForm] = useState({ label: "", amount: "", currency: "CNY" as Currency, paidBy: (who || "alberto") as Payer, category: "cibo" as ExpenseCategory });
  const balance = view.budget.splitBalance;
  const recent = [...plan.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  function add(event: FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    if (!form.label.trim() || !(amount > 0)) return;
    update((current) => ({ ...current, expenses: [...current.expenses, { id: uid("spesa"), date: todayKey(), label: form.label.trim(), amount, currency: form.currency, paidBy: form.paidBy, category: form.category }] }));
    log("Spesa", `${form.label.trim()} · ${formatCost(amount, form.currency)} · ${PAYER_LABELS[form.paidBy]}`);
    setForm({ ...form, label: "", amount: "" });
  }

  return <article className="card" id="conti">
    <p className="eyebrow">Conti tra voi</p>
    <h3>{Math.abs(balance) < 0.01 ? "Siete pari" : balance > 0 ? `Sofia deve ad Alberto ${euro.format(balance)}` : `Alberto deve a Sofia ${euro.format(-balance)}`}</h3>
    <p className="hint">Prenotazioni già pagate, debiti tra voi e spese registrate qui; voli a metà. Cambio usato: ¥{plan.cnyPerEuro} = 1 €.</p>
    <form className="expense" onSubmit={add}>
      <input placeholder="Cosa (es. cena hot pot)" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
      <input inputMode="decimal" placeholder="Importo" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
      <select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as Currency })}><option value="CNY">¥</option><option value="EUR">€</option></select>
      <select value={form.paidBy} onChange={(event) => setForm({ ...form, paidBy: event.target.value as Payer })}><option value="alberto">Ha pagato Alberto</option><option value="sofia">Ha pagato Sofia</option></select>
      <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ExpenseCategory })}>{EXPENSE_CATEGORIES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
      <button className="btn" type="submit">Aggiungi</button>
    </form>
    {recent.length > 0 && <ul className="expenses">{recent.map((expense) => <li key={expense.id}>
      <span><b>{expense.label}</b><small>{formatShortDate(expense.date)} · {PAYER_LABELS[expense.paidBy]}</small></span>
      <span>{formatCost(expense.amount, expense.currency)}</span>
      <button aria-label="Elimina" onClick={() => {
        if (!window.confirm(`Eliminare «${expense.label}»?`)) return;
        update((current) => ({ ...current, expenses: current.expenses.filter((entry) => entry.id !== expense.id) }));
        log("Spesa eliminata", expense.label);
      }}>×</button>
    </li>)}</ul>}
  </article>;
}

function SharedNotes() {
  const { plan, update, log } = useTrip();
  const [draft, setDraft] = useState<string | null>(null);
  return <article className="card">
    <p className="eyebrow">Note condivise · private, solo per voi due</p>
    <textarea rows={8} value={draft ?? plan.notes} onChange={(event) => setDraft(event.target.value)} onBlur={() => {
      if (draft === null || draft === plan.notes) return setDraft(null);
      update((current) => ({ ...current, notes: draft }));
      log("Note", "Ha modificato le note condivise");
      setDraft(null);
    }} />
  </article>;
}

export function InfoTab({ footer }: { footer: React.ReactNode }) {
  const { plan, showChinese } = useTrip();
  return <section className="tab">
    <Balance />
    <article className="card">
      <p className="eyebrow">Emergenze</p>
      <ul className="contacts">{EMERGENCY.map((entry) => <li key={entry.label}>
        <span><b>{entry.label}</b>{entry.note && <small>{entry.note}</small>}</span>
        <a className="chip primary" href={`tel:${entry.number.replace(/\s/g, "")}`}>📞 {entry.number}</a>
      </li>)}</ul>
    </article>
    <article className="card">
      <p className="eyebrow">Frasi · tocca per mostrarla grande</p>
      <ul className="phrases">{PHRASES.map((phrase) => <li key={phrase.zh}><button onClick={() => showChinese({ kind: "place", kicker: phrase.zh, kickerIt: phrase.it, title: phrase.pinyin, titleZh: phrase.zh, subtitle: "" })}>
        <b className="zh">{phrase.zh}</b><span>{phrase.pinyin}</span><small>{phrase.it}</small>
      </button></li>)}</ul>
    </article>
    <article className="card">
      <p className="eyebrow">Le app che servono davvero</p>
      <ul className="apps">{APPS.map((app) => <li key={app.name}><b>{app.name}</b><span>{app.what}</span></li>)}</ul>
    </article>
    <article className="card">
      <p className="eyebrow">Città per città</p>
      {plan.stops.filter((stop) => CITY_TIPS[stop.id]).map((stop) => <details key={stop.id}><summary>{stop.name}</summary><ul className="tips">{CITY_TIPS[stop.id].map((tip) => <li key={tip}>{tip}</li>)}</ul></details>)}
      <details><summary>Da sapere</summary><ul className="tips">{GUIDE_FACTS.map((fact) => <li key={fact}>{fact}</li>)}</ul></details>
    </article>
    <SharedNotes />
    {footer}
  </section>;
}
