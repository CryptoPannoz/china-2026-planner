"use client";

import { Fragment } from "react";
import { CITY_TIPS, GUIDE_APP_GROUPS, GUIDE_FACTS, GUIDE_INTERNET, GUIDE_INTERNET_SOURCES, GUIDE_SOURCE_URL, GUIDE_WHEN_LABELS } from "@/lib/planner/guide";
import { usePlanner } from "../context";

/** Testo con `comandi` tra apici inversi: le parti tra apici diventano codice. */
function withCode(text: string) {
  return text.split("`").map((part, index) => (index % 2 ? <code key={index}>{part}</code> : <Fragment key={index}>{part}</Fragment>));
}

function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function GuideSection() {
  const { plan, goTo, showChinese } = usePlanner();
  const checks = new Map(plan.extraChecklist.map((item) => [item.id, item]));
  const appCount = GUIDE_APP_GROUPS.reduce((sum, group) => sum + group.apps.length, 0);
  const cities = plan.stops.filter((stop) => CITY_TIPS[stop.id]);

  return <section className="planner-grid simple guide-section">
    <div className="stack">
      <article className="card guide-intro">
        <div className="card-head"><div><p className="eyebrow">Da chi in Cina c’è già stato</p><h2>Guida alla Cina</h2></div></div>
        <p>Le app una per una, come restare connessi, i consigli città per città e le piccole cose sul posto. Le cose da fare sono nella checklist; qui ci sono il perché e il come.</p>
        <nav className="guide-jumps" aria-label="Parti della guida">
          <button type="button" onClick={() => jump("guide-apps")}>📱 App ({appCount})</button>
          <button type="button" onClick={() => jump("guide-internet")}>🛡️ Internet dalla Cina</button>
          {cities.length > 0 && <button type="button" onClick={() => jump("guide-cities")}>📍 Città</button>}
          <button type="button" onClick={() => jump("guide-facts")}>💡 Da sapere</button>
          <button type="button" onClick={() => goTo("planner")}>☑ Checklist →</button>
        </nav>
      </article>

      <article className="card guide-card" id="guide-apps">
        <div className="card-head"><div><p className="eyebrow">Cosa installare e preparare prima di atterrare</p><h2>App per la Cina</h2></div><span>{appCount} schede</span></div>
        <p className="guide-lead">Quelle «Prima di partire» dalla Cina non si sistemano più. Tocca una scheda per i passi.</p>
        {GUIDE_APP_GROUPS.map((group) => <section className="guide-group" key={group.id}>
          <h3>{group.title}</h3>
          {group.apps.map((app) => {
            const item = app.checkId ? checks.get(app.checkId) : undefined;
            const state = item && (item.skipped ? { className: "skipped", label: "non serve" } : item.done ? { className: "done", label: "✓ fatto" } : { className: "", label: "da fare" });
            return <details className="guide-app" id={app.id} key={app.id}>
              <summary>
                <span className="guide-icon" aria-hidden="true">{app.icon}</span>
                <span className="guide-app-title">
                  <b>{app.name}</b>{app.zh && <i lang="zh">{app.zh}</i>}
                  <small>{app.why}</small>
                </span>
                <span className="guide-badges">
                  <em className={`guide-when ${app.when}`}>{GUIDE_WHEN_LABELS[app.when]}</em>
                  {state && <em className={`guide-status ${state.className}`}>{state.label}</em>}
                </span>
              </summary>
              <div className="guide-app-body">
                {app.watch && <p className="guide-watch"><b>Attenzione.</b> {app.watch}</p>}
                <ol>{app.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                {(app.links || app.showZh || item) && <p className="guide-actions">
                  {app.showZh?.map((info) => <button type="button" className="zh-chip" key={info.title} title="Mostra in cinese a schermo intero" onClick={() => showChinese(info)}>中 {info.title}</button>)}
                  {app.links?.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}
                  {item && <button type="button" className="guide-to-check" onClick={() => goTo("planner", { anchor: `check-${item.id}` })}>Nella checklist →</button>}
                </p>}
              </div>
            </details>;
          })}
        </section>)}
      </article>

      <article className="card guide-card" id="guide-internet">
        <div className="card-head"><div><p className="eyebrow">Scritta dopo un mese in Cina lavorando ogni giorno</p><h2>Internet dalla Cina</h2></div></div>
        <p className="guide-lead">Per la vacanza bastano eSIM e una VPN di riserva. Per lavorare o usare Claude serve un tunnel tutto vostro: qui come farlo, e cosa è andato storto a chi l’ha già fatto.</p>
        <div className="guide-topics">
          {GUIDE_INTERNET.map((topic, index) => <details className="guide-topic" id={topic.id} key={topic.id} open={index === 0}>
            <summary>{topic.title}</summary>
            <ul>{topic.points.map((point) => <li key={point}>{withCode(point)}</li>)}</ul>
            {topic.code && <pre><code>{topic.code}</code></pre>}
          </details>)}
        </div>
        <p className="guide-actions guide-sources">Per approfondire: {GUIDE_INTERNET_SOURCES.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</p>
      </article>

      {cities.length > 0 && <article className="card guide-card" id="guide-cities">
        <div className="card-head"><div><p className="eyebrow">Sulle tappe del vostro itinerario</p><h2>Città per città</h2></div></div>
        <div className="guide-cities">
          {cities.map((stop) => <section key={stop.id}>
            <div className="guide-city-head"><h3>{stop.name}</h3><button type="button" className="guide-to-check" onClick={() => goTo("itinerary", { stopId: stop.id })}>Apri la tappa →</button></div>
            <ul>{CITY_TIPS[stop.id].map((tip) => <li key={tip}>{tip}</li>)}</ul>
          </section>)}
        </div>
      </article>}

      <article className="card facts-card" id="guide-facts">
        <div className="card-head"><div><p className="eyebrow">Da sapere</p><h2>Piccole cose sul posto</h2></div></div>
        <ul className="prep-facts">{GUIDE_FACTS.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      </article>

      <p className="guide-credit">Raccolta dalla lista «Prepare», dalla guida alle app e dalla guida alla connettività di <a href={GUIDE_SOURCE_URL} target="_blank" rel="noreferrer">china.adormo.com ↗</a> (serve l’accesso), con quello che hanno scritto i viaggiatori in Cina a ottobre 2026.</p>
    </div>
  </section>;
}
