"use client";

import { useEffect, useState } from "react";
import type { ChecklistItem } from "@/lib/planner/types";
import { PACKING, TODOS, TODO_WHEN, WEATHER, type Todo, type Who } from "@/lib/trip/data";
import { useTrip } from "./shared";

const WHO_LABEL: Record<Who, string> = { entrambi: "Tutti e due", alberto: "Alberto", sofia: "Sofia" };
const PACK_KEY = "china-packing-v1";

function TodoRow({ todo, state, onToggle }: { todo: Todo; state?: ChecklistItem; onToggle: () => void }) {
  const done = Boolean(state?.done || state?.skipped);
  return <li className={`todo ${done ? "done" : ""}`}>
    <button className="check" aria-pressed={done} aria-label={done ? "Segna da fare" : "Segna fatto"} onClick={onToggle}>{done ? "✓" : ""}</button>
    <div>
      <b>{todo.label}</b>
      <span className={`who ${todo.who}`}>{WHO_LABEL[todo.who]}</span>
      {(todo.hint || todo.links) && <details><summary>Come</summary>
        {todo.hint && <p>{todo.hint}</p>}
        {todo.links && <p className="chips">{todo.links.map((link) => <a key={link.url} className="chip" href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</p>}
      </details>}
    </div>
  </li>;
}

function Packing() {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PACK_KEY) || "[]");
      // Lettura una tantum dal browser dopo il montaggio: il server non ha localStorage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setChecked(new Set(saved));
    } catch {
      // Navigazione privata: la lista funziona lo stesso, senza ricordarsi le spunte.
    }
  }, []);
  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(PACK_KEY, JSON.stringify([...next]));
      } catch {
        // idem
      }
      return next;
    });
  }
  const total = PACKING.reduce((sum, group) => sum + group.items.length, 0);
  return <>
    <h2 id="valigia" className="section-title">Valigia · {checked.size}/{total}</h2>
    <article className="card">
      <p className="eyebrow">Meteo medio 2015–2025 sulle vostre date</p>
      <table className="weather">
        <thead><tr><th>Tappa</th><th>Min</th><th>Max</th><th>Pioggia</th></tr></thead>
        <tbody>{WEATHER.map((entry) => <tr key={entry.stopId}>
          <td><b>{entry.city}</b><small>{entry.dates}</small></td>
          <td className="cold">{entry.min}°<small>fino a {entry.low}°</small></td>
          <td>{entry.max}°</td>
          <td>{entry.rain}%<small>dei giorni</small></td>
        </tr>)}</tbody>
      </table>
      <ul className="tips">{WEATHER.map((entry) => <li key={entry.stopId}><b>{entry.city}:</b> {entry.note}</li>)}</ul>
      <p className="hint">Le spunte della valigia restano solo su questo telefono: ognuno fa la sua.</p>
    </article>
    {PACKING.map((group) => <article key={group.id} className="card">
      <h3>{group.title}</h3>
      {group.note && <p className="hint">{group.note}</p>}
      <ul className="todos">
        {group.items.map((item, index) => {
          const id = `${group.id}:${index}`;
          const done = checked.has(id);
          return <li key={id} className={`todo ${done ? "done" : ""}`}>
            <button className="check" aria-pressed={done} aria-label={done ? "Togli" : "In valigia"} onClick={() => toggle(id)}>{done ? "✓" : ""}</button>
            <div><b>{item}</b></div>
          </li>;
        })}
      </ul>
    </article>)}
  </>;
}

export function TodoTab() {
  const { plan, update, log, who } = useTrip();
  const [filter, setFilter] = useState<"tutti" | "alberto" | "sofia">(who || "tutti");
  const states = new Map(plan.extraChecklist.map((item) => [item.id, item]));
  const visible = TODOS.filter((todo) => filter === "tutti" || todo.who === "entrambi" || todo.who === filter);
  const open = visible.filter((todo) => !(states.get(todo.id)?.done || states.get(todo.id)?.skipped));

  function toggle(todo: Todo) {
    const current = states.get(todo.id);
    const done = !(current?.done || current?.skipped);
    update((plan) => ({
      ...plan,
      extraChecklist: current
        ? plan.extraChecklist.map((item) => (item.id === todo.id ? { ...item, done, skipped: false } : item))
        : [...plan.extraChecklist, { id: todo.id, label: todo.label, done, group: "ultima-settimana" }],
    }));
    log(done ? "Fatto" : "Riaperto", todo.label);
  }

  return <section className="tab">
    <article className="card">
      <p className="eyebrow">Prima di partire · {open.length} da fare</p>
      <div className="segmented">
        {(["tutti", "alberto", "sofia"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "tutti" ? "Tutti" : value === "alberto" ? "Alberto" : "Sofia"}</button>)}
      </div>
      <p className="hint">Le spunte si sincronizzano tra i vostri telefoni. <a href="#valigia">Vai alla valigia ↓</a></p>
    </article>
    {TODO_WHEN.map((when) => {
      const todos = visible.filter((todo) => todo.when === when.id);
      if (!todos.length) return null;
      const left = todos.filter((todo) => !(states.get(todo.id)?.done || states.get(todo.id)?.skipped)).length;
      return <article key={when.id} className="card">
        <header className="group-head"><div><h3>{when.title}</h3><small>{when.subtitle}</small></div><span className={left ? "count" : "count ok"}>{left ? left : "✓"}</span></header>
        <ul className="todos">{todos.map((todo) => <TodoRow key={todo.id} todo={todo} state={states.get(todo.id)} onToggle={() => toggle(todo)} />)}</ul>
      </article>;
    })}
    <Packing />
  </section>;
}
