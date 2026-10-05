"use client";

import { useEffect } from "react";
import type { TaxiInfo } from "@/lib/planner/types";

/** Nome e indirizzo in cinese a tutto schermo, da mostrare a un tassista o a un passante. */
export function TaxiCard({ info, onClose }: { info: TaxiInfo; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const titleZh = info.titleZh?.trim();
  const subtitleZh = info.subtitleZh?.trim();
  return <div className="taxi-overlay" role="dialog" aria-modal="true" aria-label="Nome in cinese da mostrare" onClick={onClose}>
    <div className="taxi-card" onClick={(event) => event.stopPropagation()}>
      <p className="taxi-kicker">{info.kind === "hotel" ? "请送我们到这家酒店，谢谢！" : "请问，这个地方怎么走？谢谢！"}</p>
      <small className="taxi-kicker-it">{info.kind === "hotel" ? "«Per favore, ci porti a questo hotel. Grazie!»" : "«Scusi, come si arriva a questo posto? Grazie!»"}</small>
      <h2>{titleZh || info.title}</h2>
      <p className="taxi-address">{subtitleZh || info.subtitle || ""}</p>
      {!titleZh && <small className="taxi-hint">Consiglio: aggiungi il nome in cinese (c&apos;è il link «Traduci»), così chi legge non ha dubbi.</small>}
      {(titleZh || subtitleZh) && <div className="taxi-latin"><b>{info.title}</b><span>{info.subtitle}</span></div>}
      <button className="taxi-close" onClick={onClose}>Chiudi</button>
    </div>
  </div>;
}
