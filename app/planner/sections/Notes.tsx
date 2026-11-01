"use client";

import { useState, type FormEvent } from "react";
import { CHECKLIST_GROUPS, PREP_CHECKLIST, defaultChecklist } from "@/lib/planner/catalog";
import { trainSaleWindows } from "@/lib/planner/model";
import type { ChecklistGroup, ChecklistItem, PrepItem, TripLink } from "@/lib/planner/types";
import { addDaysKey, formatShortDate, normalizeLinkUrl, safeExternalLink, uid } from "@/lib/planner/utils";
import { usePlanner } from "../context";
import { TextArea, TextInput } from "../fields";
import { BACKUP_KEY, type ChangeLogEntry } from "../usePlanSync";

const prepById = new Map(PREP_CHECKLIST.map((item) => [item.id, item]));

type CheckRow = {
  key: string;
  label: string;
  done: boolean;
  skipped: boolean;
  group: ChecklistGroup;
  due?: string;
  hint?: string;
  links?: PrepItem["links"];
  guide?: string;
  toggle: () => void;
  /** Solo per i punti in `extraChecklist`: quelli di catalogo si segnano «non serve», gli altri si tolgono. */
  item?: ChecklistItem;
};

function groupOf(item: ChecklistItem): ChecklistGroup {
  if (CHECKLIST_GROUPS.some((group) => group.id === item.group)) return item.group!;
  return prepById.get(item.id)?.group || "altro";
}

export function NotesSection() {
  const { plan, view, update, log, goTo } = usePlanner();
  const [newItem, setNewItem] = useState("");
  const [newGroup, setNewGroup] = useState<ChecklistGroup>("altro");
  const [openHints, setOpenHints] = useState<Set<string>>(() => new Set());
  const [newLink, setNewLink] = useState({ stopId: "", label: "", url: "" });
  const stopName = (stopId: string) => plan.stops.find((stop) => stop.id === stopId)?.name || "Tutto il viaggio";
  const today = new Date().toISOString().slice(0, 10);
  const trains = trainSaleWindows(view.legs, view.legDateOf);

  function toggleDefault(index: number, label: string) {
    const checked = !plan.checklist[index];
    update((current) => ({ ...current, checklist: defaultChecklist.map((_, itemIndex) => (itemIndex === index ? !current.checklist[itemIndex] : Boolean(current.checklist[itemIndex]))) }));
    log(checked ? "Checklist completata" : "Checklist riaperta", label);
  }

  function patchItem(id: string, patch: (entry: ChecklistItem) => ChecklistItem) {
    update((current) => ({ ...current, extraChecklist: current.extraChecklist.map((entry) => (entry.id === id ? patch(entry) : entry)) }));
  }

  const rows: CheckRow[] = [
    ...defaultChecklist.map((entry, index) => ({
      key: `default-${index}`,
      label: entry.label,
      done: Boolean(plan.checklist[index]),
      skipped: false,
      group: entry.group,
      due: entry.due,
      hint: entry.hint,
      links: entry.links,
      guide: entry.guide,
      toggle: () => toggleDefault(index, entry.label),
    })),
    ...plan.extraChecklist.map((item) => ({
      key: item.id,
      label: item.label,
      done: item.done,
      skipped: Boolean(item.skipped),
      group: groupOf(item),
      // I treni scadono quando apre la vendita del primo ancora da prenotare.
      due: item.id === "prep-trains" ? trains[0]?.opensOn : prepById.get(item.id)?.due,
      hint: prepById.get(item.id)?.hint,
      links: prepById.get(item.id)?.links,
      guide: prepById.get(item.id)?.guide,
      toggle: () => {
        patchItem(item.id, (entry) => (entry.skipped ? { ...entry, done: false, skipped: false } : { ...entry, done: !entry.done }));
        log(item.done ? "Checklist riaperta" : "Checklist completata", item.label);
      },
      item,
    })),
  ];
  const done = rows.filter((row) => row.done).length;

  function toggleHint(key: string) {
    setOpenHints((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addItem(event: FormEvent) {
    event.preventDefault();
    const label = newItem.trim();
    if (!label) return;
    update((current) => ({ ...current, extraChecklist: [...current.extraChecklist, { id: uid("check"), label, done: false, group: newGroup }] }));
    setNewItem("");
    log("Checklist ampliata", label);
  }

  function dueLabel(due: string) {
    if (due < today) return { className: "late", text: `in ritardo · ${formatShortDate(due)}` };
    return { className: due <= addDaysKey(today, 2) ? "soon" : "", text: `entro ${formatShortDate(due)}` };
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
        <div className="card-head"><div><p className="eyebrow">Preparazione</p><h2>Checklist</h2></div><span>{done} / {rows.length}</span></div>
        <p className="checklist-source">In ordine di scadenza, con i consigli di chi in Cina c’è già stato. Tocca «Come» per i dettagli; app, internet e consigli città per città sono nella <button type="button" onClick={() => goTo("guide")}>Guida</button>.</p>
        <div className="checklist">
          {CHECKLIST_GROUPS.map((group) => {
            // sort è stabile: a parità di scadenza resta l'ordine del catalogo.
            const groupRows = rows.filter((row) => row.group === group.id).sort((a, b) => (a.due || "").localeCompare(b.due || ""));
            if (!groupRows.length) return null;
            return <section className="check-group" key={group.id}>
              <div className="check-group-head"><div><h3>{group.title}</h3><p>{group.subtitle}</p></div><span>{groupRows.filter((row) => row.done).length} / {groupRows.length}</span></div>
              {groupRows.map((row) => {
                const open = openHints.has(row.key);
                const hasTrains = row.key === "prep-trains";
                const due = row.due && !row.done ? dueLabel(row.due) : null;
                return <div className={`check-row${row.skipped ? " skipped" : ""}`} id={`check-${row.key}`} key={row.key}>
                  <label><input type="checkbox" checked={row.done} onChange={row.toggle} /><span>{row.label}{row.skipped && <em> · non serve</em>}</span></label>
                  <div className="check-meta">
                    {due && <small className={`check-due ${due.className}`}>{due.text}</small>}
                    {(row.hint || row.links || row.guide || hasTrains) && <button type="button" className="check-hint-toggle" aria-expanded={open} onClick={() => toggleHint(row.key)}>{open ? "Chiudi" : "Come"}</button>}
                    {row.item && (prepById.has(row.item.id)
                      ? <button type="button" className="check-skip" onClick={() => {
                        patchItem(row.item!.id, (entry) => ({ ...entry, done: !entry.skipped, skipped: !entry.skipped }));
                        log(row.skipped ? "Checklist riaperta" : "Checklist: non serve", row.label);
                      }}>{row.skipped ? "Serve" : "Non serve"}</button>
                      : <button type="button" className="danger-text" onClick={() => {
                        update((current) => ({ ...current, extraChecklist: current.extraChecklist.filter((entry) => entry.id !== row.item!.id) }));
                        log("Checklist ridotta", row.label);
                      }}>Togli</button>)}
                  </div>
                  {open && <div className="check-hint">
                    {row.hint && <p>{row.hint}</p>}
                    {(row.links || row.guide) && <p className="check-links">
                      {row.links?.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}
                      {row.guide && <button type="button" onClick={() => goTo("guide", { anchor: row.guide })}>{row.guide.startsWith("app-") ? "Scheda nella guida →" : "Nella guida →"}</button>}
                    </p>}
                    {hasTrains && (trains.length
                      ? <ul>{trains.map(({ leg, date, opensOn }) => <li key={leg.id}><b>{view.legLabel(leg)}</b> del {formatShortDate(date)}: {opensOn <= today ? "già in vendita" : `in vendita dal ${formatShortDate(opensOn)}`}</li>)}</ul>
                      : <p>Tutti i treni dell’itinerario risultano prenotati.</p>)}
                  </div>}
                </div>;
              })}
            </section>;
          })}
        </div>
        <form className="add-checklist" onSubmit={addItem}>
          <select aria-label="Gruppo del nuovo punto" value={newGroup} onChange={(event) => setNewGroup(event.target.value as ChecklistGroup)}>
            {CHECKLIST_GROUPS.map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}
          </select>
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
