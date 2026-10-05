import type { Currency } from "./types.ts";

// --- Date come chiavi "YYYY-MM-DD" (calcoli in UTC, così fusi orari e ora legale non spostano i giorni) ---

const DAY_MS = 86_400_000;

function keyToUtc(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, (month || 1) - 1, day || 1);
}

function utcToKey(ms: number) {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDaysKey(key: string, amount: number) {
  return utcToKey(keyToUtc(key) + amount * DAY_MS);
}

/** Giorni da `from` a `to` (positivo se `to` è dopo). */
export function diffDaysKey(from: string, to: string) {
  return Math.round((keyToUtc(to) - keyToUtc(from)) / DAY_MS);
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Date locale a mezzogiorno: solo per formattare in italiano. */
export function keyToDate(key: string) {
  return new Date(`${key}T12:00:00`);
}

const shortDateFormat = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
const longDateFormat = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "long" });

export const formatShortDate = (key: string) => (isDateKey(key) ? shortDateFormat.format(keyToDate(key)) : "—");
export const formatLongDate = (key: string) => (isDateKey(key) ? longDateFormat.format(keyToDate(key)) : "—");

// --- Orari ---

export function timeToMinutes(value: string) {
  const [hours, minutes] = (value || "").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function minutesToTime(value: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 55, value));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

// --- Soldi ---

export const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
export const yuan = new Intl.NumberFormat("it-IT", { style: "currency", currency: "CNY" });

export function toEuro(value: number, currency: Currency | undefined, cnyPerEuro: number) {
  return currency === "CNY" ? value / Math.max(cnyPerEuro, 0.01) : value;
}

export function formatCost(value: number, currency: Currency | undefined) {
  return currency === "CNY" ? yuan.format(value) : euro.format(value);
}

// --- Link ---

export function googleMapsSearchUrl(place: string, city = "") {
  const queryText = [place, city].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`;
}

export function googleMapsStopUrl(stop: { lat: number; lng: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${stop.lat}%2C${stop.lng}`;
}

export function webSearchUrl(queryText: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(queryText)}`;
}

export function translateZhUrl(text: string) {
  return `https://translate.google.com/?sl=auto&tl=zh-CN&text=${encodeURIComponent(text)}&op=translate`;
}

const SAFE_LINK = /^(https?:\/\/|weixin:\/\/|alipays?:\/\/)/i;

/** Solo link http(s)/WeChat/Alipay: niente javascript: o altri schemi nei campi liberi. */
export function safeExternalLink(value: string | undefined) {
  const link = value?.trim() || "";
  return SAFE_LINK.test(link) ? link : "";
}

/** Completa con https:// i link incollati senza schema. */
export function normalizeLinkUrl(value: string) {
  const url = value.trim();
  if (!url) return "";
  return SAFE_LINK.test(url) ? url : `https://${url}`;
}

// --- Varie ---

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function slugify(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tappa";
}

export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** JSON con chiavi ordinate: Firestore non garantisce l'ordine dei campi, così i confronti restano stabili. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}

export function sameValue(left: unknown, right: unknown) {
  return left === right || stableStringify(left) === stableStringify(right);
}
