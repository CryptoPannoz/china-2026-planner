"use client";

import { createContext, useContext, useState } from "react";
import type { PlanView } from "@/lib/planner/model";
import type { PlanData, TaxiInfo } from "@/lib/planner/types";
import { driveUrl, type DocLink } from "@/lib/trip/data";

export type Tab = "viaggio" | "wallet" | "todo" | "info";

export type Trip = {
  plan: PlanData;
  view: PlanView;
  update: (updater: (plan: PlanData) => PlanData) => void;
  log: (action: string, detail: string) => void;
  showChinese: (info: TaxiInfo) => void;
  /** Apre una scheda e, se indicato, scorre fino a un elemento (es. la carta del wallet). */
  open: (tab: Tab, anchor?: string) => void;
  who: "alberto" | "sofia" | null;
};

export const TripContext = createContext<Trip | null>(null);

export function useTrip() {
  const trip = useContext(TripContext);
  if (!trip) throw new Error("useTrip fuori dal TripContext");
  return trip;
}

/** Parte in caratteri cinesi di un testo misto («Beijing West 北京西» → «北京西»). */
export function chinesePart(text: string | undefined) {
  return (text || "").match(/[㐀-鿿][㐀-鿿0-9（）()·\-\s号栋弄楼]*/g)?.join(" ").trim() || "";
}

/** Parte latina di un testo misto. */
export function latinPart(text: string | undefined) {
  return (text || "").replace(/[㐀-鿿（）]+/g, "").replace(/\s+/g, " ").trim();
}

/** Numeri di telefono cinesi o italiani dentro un testo libero. */
export function phonesIn(text: string | undefined) {
  return Array.from(new Set((text || "").match(/\+\d{2}[\d\s-]{7,16}\d/g) || [])).map((raw) => ({ raw, tel: raw.replace(/[^\d+]/g, "") }));
}

/** Primo numero lungo di una prenotazione (per cercarla in Gmail). */
export function bookingNumber(text: string | undefined) {
  return (text || "").match(/\d{10,}/)?.[0] || "";
}

export function gmailSearchUrl(query: string) {
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}`;
}

export function mapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function appleMapsUrl(query: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
}

export function DocButtons({ docs }: { docs?: DocLink[] }) {
  if (!docs?.length) return null;
  return <>{docs.map((doc) => <a key={doc.id} className="chip doc" href={driveUrl(doc)} target="_blank" rel="noreferrer">📄 {doc.label}</a>)}</>;
}

export function CopyChip({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return <button className="chip" onClick={async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copia", value);
    }
  }}>{copied ? "✓ Copiato" : `⧉ ${label || value}`}</button>;
}

/** Oggi nel fuso giusto: Italia prima della partenza, Cina durante il viaggio. */
export function todayKey(now = new Date()) {
  const china = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now);
  const italy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  return china >= "2026-11-17" ? china : italy;
}
