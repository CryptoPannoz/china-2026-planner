"use client";

import { useState, type FormEvent } from "react";
import { defaultChecklist } from "@/lib/planner/catalog";
import type { TripLink } from "@/lib/planner/types";
import { normalizeLinkUrl, safeExternalLink, uid } from "@/lib/planner/utils";
import { usePlanner } from "../context";
import { TextArea, TextInput } from "../fields";
import { BACKUP_KEY, type ChangeLogEntry } from "../usePlanSync";

export function NotesSection() {
  const { plan, update, log } = usePlanner();
  const [newItem, setNewItem] = useState("");
  const [newLink, setNewLink] = useState({ stopId: "", label: "", url: "" });
  const done = plan.checklist.filter(Boolean).length + plan.extraChecklist.filter((item) => item.done).length;
  const stopName = (stopId: string) => plan.stops.find((stop) => stop.id === stopId)?.name || "Tutto il viaggio";

  function addItem(event: FormEvent) {
    event.preventDefault();
    const label = newItem.trim();
    if (!label) return;
    update((current) => ({ ...current, extraChecklist: [...current.extraChecklist, { id: uid("check"), label, done: false }] }));
    setNewItem("");
    log("Checklist ampliata", label);
  }

  function addLink(event: FormEvent) {
    event.preventDefault();
    const url = normalizeLinkUrl(newLink.url);
    if (!url) return;
    const link: TripLink = { id: uid("link"), stopId: newLink.stopId, label: newLink.label.trim(), url };
    update((current) => ({ ...current, sharedLinks: [...current.sharedLinks, link] }));
    setNewLink({ stopId: "", label: "", url: "" });
    log("Link aggiunto", `${stopName(link.stopId)}: ${link.label || link.url}`);
  }

  function patchLink(id: string, changes: Partial<TripLink>) {
    update((current) => ({ ...current, sharedLinks: current.sharedLinks.map((link) => (link.id === id ? { ...link, ...changes } : link)) }));
  }

  const [previousVersion] = useState(() => {
    try {
      return localStorage.getItem(BACKUP_KEY) || "";
    } catch {
      return "";
    }
  });

  function download(content: string, name: string) {
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <section className="planner-grid simple">
    <div className="stack">
      <article className="card">
        <div className="card-head"><div><p className="eyebrow">Preparazione</p><h2>Checklist</h2></div><span>{done} / {plan.checklist.length + plan.extraChecklist.length}</span></div>
        <div className="checklist">
          {defaultChecklist.map((label, index) => <label key={label}><input type="checkbox" checked={Boolean(plan.checklist[index])} onChange={() => {
            const checked = !plan.checklist[index];
            update((current) => ({ ...current, checklist: defaultChecklist.map((_, itemIndex) => (itemIndex === index ? !current.checklist[itemIndex] : Boolean(current.checklist[itemIndex]))) }));
            log(checked ? "Checklist completata" : "Checklist riaperta", label);
          }} /><span>{label}</span></label>)}
          {plan.extraChecklist.map((item) => <label key={item.id}><input type="checkbox" checked={item.done} onChange={() => {
            update((current) => ({ ...current, extraChecklist: current.extraChecklist.map((entry) => (entry.id === item.id ? { ...entry, done: !entry.done } : entry)) }));
            log(item.done ? "Checklist riaperta" : "Checklist completata", item.label);
          }} /><span>{item.label}</span><button type="button" className="danger-text" onClick={(event) => {
            event.preventDefault();
            update((current) => ({ ...current, extraChecklist: current.extraChecklist.filter((entry) => entry.id !== item.id) }));
            log("Checklist ridotta", item.label);
          }}>Togli</button></label>)}
        </div>
        <form className="add-checklist" onSubmit={addItem}>
          <input required aria-label="Nuovo punto della checklist" placeholder="Es. Comprare adattatore per le prese" value={newItem} onChange={(event) => setNewItem(event.target.value)} />
          <button className="primary" type="submit">+ Aggiungi</button>
        </form>
      </article>

      <article className="card links-card">
        <div className="card-head"><div><p className="eyebrow">Prenotazioni, biglietti e pagine da ricordare</p><h2>Link</h2></div><span>{plan.sharedLinks.length} {plan.sharedLinks.length === 1 ? "salvato" : "salvati"}</span></div>
        <div className="link-list">
          {plan.sharedLinks.length === 0 && <p className="empty">Nessun link salvato. Aggiungi qui conferme di prenotazione, biglietti e pagine utili, città per città.</p>}
          {plan.sharedLinks.map((link) => {
            const openUrl = safeExternalLink(link.url);
            return <div className="link-row" key={link.id}>
              <select aria-label="Città del link" value={link.stopId} onChange={(event) => {
                patchLink(link.id, { stopId: event.target.value });
                log("Link spostato", `${link.label || link.url} → ${stopName(event.target.value)}`);
              }}>
                <option value="">Tutto il viaggio</option>
                {plan.stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}
              </select>
              <TextInput aria-label="Descrizione link" value={link.label} placeholder="Es. Conferma hotel, biglietti…" onCommit={(label) => { patchLink(link.id, { label }); log("Link rinominato", label); }} />
              <TextInput aria-label="Indirizzo del link" value={link.url} placeholder="https://…" onCommit={(url) => patchLink(link.id, { url: normalizeLinkUrl(url) })} />
              {openUrl ? <a href={openUrl} target="_blank" rel="noreferrer">Apri ↗</a> : <span className="link-invalid">Link?</span>}
              <button className="danger-text" onClick={() => {
                update((current) => ({ ...current, sharedLinks: current.sharedLinks.filter((item) => item.id !== link.id) }));
                log("Link eliminato", link.label || link.url);
              }}>Togli</button>
            </div>;
          })}
        </div>
        <form className="add-link" onSubmit={addLink}>
          <select aria-label="Città del nuovo link" value={newLink.stopId} onChange={(event) => setNewLink((current) => ({ ...current, stopId: event.target.value }))}>
            <option value="">Tutto il viaggio</option>
            {plan.stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}
          </select>
          <input aria-label="Descrizione nuovo link" value={newLink.label} placeholder="Es. Conferma hotel Pechino" onChange={(event) => setNewLink((current) => ({ ...current, label: event.target.value }))} />
          <input required aria-label="Indirizzo nuovo link" value={newLink.url} placeholder="Incolla qui il link" onChange={(event) => setNewLink((current) => ({ ...current, url: event.target.value }))} />
          <button className="primary" type="submit">+ Aggiungi</button>
        </form>
        <details className="old-notes" open={Boolean(plan.notes.trim())}>
          <summary>Note condivise{plan.notes.trim() ? "" : " · vuote"}</summary>
          <TextArea value={plan.notes} placeholder="Hotel preferiti, ristoranti, idee e cose da ricordare…" onCommit={(notes) => {
            update((current) => ({ ...current, notes }));
            log("Note condivise aggiornate", "Ha modificato le note generali del viaggio");
          }} />
        </details>
      </article>

      <article className="card backup-card">
        <div className="card-head"><div><p className="eyebrow">Sicurezza dei dati</p><h2>Backup del piano</h2></div></div>
        <p>Scarica una copia completa del piano (tappe, agenda, hotel, spese) in un file JSON da tenere da parte prima di grandi modifiche.</p>
        <div className="backup-actions">
          <button className="primary" onClick={() => download(JSON.stringify(plan, null, 2), `cina-2026-backup-${new Date().toISOString().slice(0, 10)}.json`)}>⬇︎ Scarica backup</button>
          {previousVersion && <button className="secondary" onClick={() => download(previousVersion, "cina-2026-prima-del-riordino.json")}>Copia di prima del riordino</button>}
        </div>
      </article>
    </div>
  </section>;
}

export function HistorySection({ entries }: { entries: ChangeLogEntry[] }) {
  return <section className="history-section">
    <div className="section-title"><div><p className="eyebrow">Registro condiviso</p><h2>Chi ha modificato cosa</h2></div><span>Ultime {entries.length} modifiche</span></div>
    <article className="card history-card">
      {entries.length === 0 ? <div className="history-empty"><span>↻</span><b>Ancora nessuna modifica registrata</b><p>Aggiunte, cancellazioni e modifiche importanti appaiono qui con autore e ora.</p></div> : <div className="history-list">
        {entries.map((entry) => <div className="history-row" key={entry.id}>
          <span className={`history-avatar ${entry.authorName === "Sofia" ? "sofia" : ""}`}>{entry.authorName?.charAt(0) || "?"}</span>
          <div><b>{entry.authorName || entry.authorEmail}</b><strong>{entry.action}</strong><p>{entry.detail}</p></div>
          <time>{entry.createdAt?.toDate ? entry.createdAt.toDate().toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "adesso"}</time>
        </div>)}
      </div>}
    </article>
  </section>;
}
