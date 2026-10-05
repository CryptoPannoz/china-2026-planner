// Logica pura del planner: niente React né Firebase, così si può testare con `node --test`.
import {
  ACTIVITY_ZH,
  ARRIVAL_KEY,
  DEFAULT_CNY_PER_EURO,
  DEFAULT_COST_ENTRIES,
  DEFAULT_TRANSFER_ITEMS,
  FLIGHTS_COST,
  KNOWN_LEG_PRESETS,
  LOCKED_STOP_IDS,
  PLAN_VERSION,
  STOP_ZH,
  TRIP_NIGHTS,
  defaultChecklist,
  initialLegs,
  initialSchedule,
  initialStops,
} from "./catalog.ts";
import type { Activity, ExpenseCategory, HotelStay, Leg, Payer, PlanData, ScheduleItem, ScheduleKind, Stop, SuggestedStop } from "./types.ts";
import { addDaysKey, diffDaysKey, formatShortDate, isDateKey, minutesToTime, plural, sameValue, timeToMinutes, toEuro, uid } from "./utils.ts";

// ---------------------------------------------------------------------------
// Itinerario: tappe → date
// ---------------------------------------------------------------------------

export type TimelineEntry = { stop: Stop; index: number; arrival: string; departure: string };

export function buildTimeline(stops: Stop[]): TimelineEntry[] {
  let cursor = ARRIVAL_KEY;
  return stops.map((stop, index) => {
    const arrival = cursor;
    cursor = addDaysKey(cursor, stop.nights);
    return { stop, index, arrival, departure: cursor };
  });
}

export function totalNights(stops: Stop[]) {
  return stops.reduce((sum, stop) => sum + stop.nights, 0);
}

export function isLockedStop(stopId: string) {
  return LOCKED_STOP_IDS.includes(stopId);
}

/** Una tratta per ogni coppia di tappe consecutive: salvata, oppure ricavata dai trasferimenti noti. */
export function normalizeLegs(stops: Stop[], legs: Leg[]): Leg[] {
  return stops.slice(0, -1).map((stop, index) => {
    const next = stops[index + 1];
    const saved = legs.find((leg) => leg.fromId === stop.id && leg.toId === next.id);
    if (saved) return saved;
    const preset = KNOWN_LEG_PRESETS[`${stop.id}-${next.id}`];
    return {
      id: `${stop.id}-${next.id}`,
      fromId: stop.id,
      toId: next.id,
      mode: preset?.mode ?? "Trasporto da definire",
      duration: preset?.duration ?? "Da verificare",
      cost: preset?.cost ?? 0,
      included: true,
      note: preset?.note ?? "Inserisci qui la soluzione scelta",
    };
  });
}

export type CalendarDay = {
  dateKey: string;
  /** 0..16 dentro la finestra dei voli. */
  index: number;
  stopId: string;
  city: string;
  /** Giorno dentro la tappa (0 = arrivo). */
  dayInStop: number;
  /** travel = si arriva oggi; free = notte non assegnata; over = oltre il volo di ritorno. */
  type: "travel" | "stay" | "free" | "over";
  leg?: Leg;
};

export function buildCalendar(timeline: TimelineEntry[], legs: Leg[]): CalendarDay[] {
  const days: CalendarDay[] = [];
  timeline.forEach((entry) => {
    for (let night = 0; night < entry.stop.nights; night++) {
      const index = days.length;
      const leg = night === 0 ? legs.find((item) => item.toId === entry.stop.id) : undefined;
      days.push({
        dateKey: addDaysKey(entry.arrival, night),
        index,
        stopId: entry.stop.id,
        city: entry.stop.name,
        dayInStop: night,
        type: index >= TRIP_NIGHTS ? "over" : night === 0 && entry.index > 0 ? "travel" : "stay",
        leg,
      });
    }
  });
  // Le date del viaggio sono fisse: le notti non assegnate restano visibili come "da pianificare".
  for (let index = days.length; index < TRIP_NIGHTS; index++) {
    days.push({ dateKey: addDaysKey(ARRIVAL_KEY, index), index, stopId: "", city: "Da pianificare", dayInStop: 0, type: "free" });
  }
  return days;
}

/** Ogni tratta parte il giorno in cui si lascia la città di partenza (= arrivo nella successiva). */
export function legDate(timeline: TimelineEntry[], leg: Leg) {
  return timeline.find((entry) => entry.stop.id === leg.fromId)?.departure || "";
}

// ---------------------------------------------------------------------------
// Agenda e hotel
// ---------------------------------------------------------------------------

export function inferScheduleKind(category: string): ScheduleKind {
  if (category === "trasporto" || category === "trasferimento") return "transport";
  if (category === "hotel" || category === "pernottamento") return "hotel";
  return "activity";
}

export function scheduleKind(item: Pick<ScheduleItem, "kind" | "category">): ScheduleKind {
  return item.kind || inferScheduleKind(item.category);
}

function normalizeScheduleItem(item: ScheduleItem): ScheduleItem {
  const kind = scheduleKind(item);
  const location = typeof item.location === "string" ? item.location : "";
  const routeParts = kind === "transport" ? location.split("→").map((part) => part.trim()).filter(Boolean) : [];
  return {
    ...item,
    kind,
    name: typeof item.name === "string" ? item.name : "",
    notes: typeof item.notes === "string" ? item.notes : "",
    price: typeof item.price === "number" && Number.isFinite(item.price) ? item.price : 0,
    startTime: item.startTime || "09:00",
    endTime: item.endTime || item.startTime || "10:00",
    bookingStatus: item.bookingStatus || "da-prenotare",
    category: item.category === "trasporto" ? "trasferimento" : item.category === "hotel" ? "pernottamento" : item.category || "visita",
    fromLocation: item.fromLocation || (routeParts.length > 1 ? routeParts[0] : ""),
    location: routeParts.length > 1 ? routeParts.at(-1) || location : location,
  };
}

function validDay(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function hotelNights(stay: Pick<HotelStay, "checkInDate" | "checkOutDate">) {
  if (!isDateKey(stay.checkInDate) || !isDateKey(stay.checkOutDate)) return 0;
  return Math.max(0, diffDaysKey(stay.checkInDate, stay.checkOutDate));
}

/** Prenotato: il totale pagato. Da prenotare: notti × prezzo a notte stimato. */
export function hotelTotal(stay: HotelStay) {
  if (stay.bookingStatus === "prenotato" && typeof stay.totalPrice === "number" && stay.totalPrice > 0) return stay.totalPrice;
  return hotelNights(stay) * (stay.nightlyPrice || 0);
}

/** Un hotel da prenotare che segue la tappa cambia date da solo quando cambiano le notti. */
export function hotelFollowsStop(stay: HotelStay) {
  return stay.bookingStatus !== "prenotato" && stay.followStop === true;
}

export function makeHotelPlaceholder(stop: Stop, entry: Pick<TimelineEntry, "arrival" | "departure">, takenIds: Set<string>): HotelStay {
  const id = takenIds.has(`hotel-${stop.id}`) ? uid("hotel") : `hotel-${stop.id}`;
  return {
    id,
    stopId: stop.id,
    name: `Hotel da scegliere · ${stop.name}`,
    address: stop.name,
    checkInDate: entry.arrival,
    checkOutDate: entry.departure,
    nightlyPrice: stop.hotelNightly,
    currency: "EUR",
    bookingStatus: "da-prenotare",
    followStop: true,
    notes: "",
  };
}

export function isPlaceholderHotel(stay: HotelStay) {
  return stay.bookingStatus !== "prenotato" && stay.name.startsWith("Hotel da scegliere") && !stay.confirmationNumber && !stay.bookingUrl;
}

/**
 * Ricalcola i campi derivati: data effettiva dei blocchi d'agenda (da tappa + giorno) e date degli
 * hotel che seguono la tappa. Va applicata dopo ogni modifica, così i dati restano coerenti.
 */
export function refreshDerived(plan: PlanData): PlanData {
  const timeline = buildTimeline(plan.stops);
  const byStop = new Map(timeline.map((entry) => [entry.stop.id, entry]));
  let itemsChanged = false;
  const scheduleItems = plan.scheduleItems.map((item) => {
    const entry = byStop.get(item.stopId);
    if (!entry) return item;
    const day = validDay(item.day) ? item.day : isDateKey(item.date) ? Math.max(0, diffDaysKey(entry.arrival, item.date)) : 0;
    const date = addDaysKey(entry.arrival, Math.min(day, entry.stop.nights - 1));
    if (item.day === day && item.date === date) return item;
    itemsChanged = true;
    return { ...item, day, date };
  });
  let hotelsChanged = false;
  const hotelStays = plan.hotelStays.map((stay) => {
    const entry = byStop.get(stay.stopId);
    if (!entry || !hotelFollowsStop(stay)) return stay;
    if (stay.checkInDate === entry.arrival && stay.checkOutDate === entry.departure) return stay;
    hotelsChanged = true;
    return { ...stay, checkInDate: entry.arrival, checkOutDate: entry.departure };
  });
  if (!itemsChanged && !hotelsChanged) return plan;
  return { ...plan, scheduleItems: itemsChanged ? scheduleItems : plan.scheduleItems, hotelStays: hotelsChanged ? hotelStays : plan.hotelStays };
}

/** Il blocco cade oltre l'ultima notte della tappa (la tappa ha perso notti): va ricollocato. */
export function isOverflowItem(item: ScheduleItem, stop: Stop | undefined) {
  return Boolean(stop && validDay(item.day) && item.day > stop.nights - 1);
}

export function sortByTime<T extends Pick<ScheduleItem, "startTime">>(items: T[]) {
  return [...items].sort((left, right) => left.startTime.localeCompare(right.startTime));
}

/** Id dei blocchi che si sovrappongono (confronta ogni blocco con la fine più tarda vista finora). */
export function conflictingIds(items: Array<{ id: string; startTime: string; endTime: string }>) {
  const sorted = sortByTime(items);
  const ids = new Set<string>();
  let latestEnd = -1;
  let latestId = "";
  sorted.forEach((item) => {
    const start = timeToMinutes(item.startTime);
    const end = Math.max(timeToMinutes(item.endTime), start);
    if (latestId && start < latestEnd) {
      ids.add(item.id);
      ids.add(latestId);
    }
    if (end > latestEnd) {
      latestEnd = end;
      latestId = item.id;
    }
  });
  return ids;
}

/** Primo orario libero della giornata: prima gli orari "classici", poi ogni mezz'ora, accorciando se serve. */
export function findFreeSlot(busy: Array<{ startTime: string; endTime: string }>, duration = 180): [string, string] {
  const ranges = busy.map((item) => [timeToMinutes(item.startTime), Math.max(timeToMinutes(item.endTime), timeToMinutes(item.startTime) + 30)]);
  const preferred = ["09:00", "14:00", "18:00", "10:30", "15:30"].map(timeToMinutes);
  const sweep = Array.from({ length: 29 }, (_, index) => 7 * 60 + index * 30);
  for (const length of [duration, 120, 90, 60]) {
    for (const start of [...preferred, ...sweep]) {
      const end = start + length;
      if (end > 23 * 60) continue;
      if (!ranges.some(([busyStart, busyEnd]) => start < busyEnd && end > busyStart)) return [minutesToTime(start), minutesToTime(end)];
    }
  }
  const latest = Math.max(...ranges.map(([, end]) => end), 20 * 60);
  return [minutesToTime(latest), minutesToTime(latest + 60)];
}

// ---------------------------------------------------------------------------
// Caricamento e migrazioni dei dati salvati
// ---------------------------------------------------------------------------

const ID_ARRAY_KEYS = ["stops", "legs", "scheduleItems", "hotelStays", "extraChecklist", "sharedLinks", "costEntries", "expenses"] as const;
export const PLAN_KEYS: Array<keyof PlanData> = [
  "itineraryVersion", "stops", "legs", "scheduleItems", "hotelStays", "checklist", "extraChecklist", "sharedLinks",
  "notes", "cnyPerEuro", "costEntries", "expenses", "customCategories", "dismissedSuggestions", "coverPhoto",
];

function hasId(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string");
}

function idArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter(hasId) as T[]) : [];
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Porta un documento salvato (anche vecchio o sporco) alla forma PlanData, senza cambiarne il contenuto. */
export function shapePlan(value: unknown): PlanData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.stops) || !Array.isArray(data.legs) || !Array.isArray(data.scheduleItems)) return null;
  return {
    itineraryVersion: typeof data.itineraryVersion === "number" ? data.itineraryVersion : 0,
    stops: idArray<Stop>(data.stops).map((stop) => (Array.isArray(stop.activities) ? stop : { ...stop, activities: [] })),
    legs: idArray<Leg>(data.legs),
    scheduleItems: idArray<ScheduleItem>(data.scheduleItems),
    hotelStays: idArray<HotelStay>(data.hotelStays),
    checklist: Array.isArray(data.checklist) ? data.checklist.map(Boolean) : [],
    extraChecklist: idArray<PlanData["extraChecklist"][number]>(data.extraChecklist).filter((item) => typeof item.label === "string"),
    sharedLinks: idArray<PlanData["sharedLinks"][number]>(data.sharedLinks).filter((item) => typeof item.url === "string"),
    notes: typeof data.notes === "string" ? data.notes : "",
    cnyPerEuro: typeof data.cnyPerEuro === "number" && data.cnyPerEuro > 0 ? data.cnyPerEuro : DEFAULT_CNY_PER_EURO,
    costEntries: idArray<PlanData["costEntries"][number]>(data.costEntries),
    expenses: idArray<PlanData["expenses"][number]>(data.expenses),
    customCategories: stringArray(data.customCategories),
    dismissedSuggestions: stringArray(data.dismissedSuggestions),
    coverPhoto: typeof data.coverPhoto === "string" ? data.coverPhoto : "",
  };
}

function mergeById<T extends { id: string }>(defaults: T[], saved: T[]) {
  const savedById = new Map(saved.map((item) => [item.id, item]));
  const defaultIds = new Set(defaults.map((item) => item.id));
  return [...defaults.map((item) => savedById.get(item.id) || item), ...saved.filter((item) => !defaultIds.has(item.id))];
}

function mergeStopsWithDefaults(savedStops: Stop[]) {
  const savedById = new Map(savedStops.map((stop) => [stop.id, stop]));
  const defaultIds = new Set(initialStops.map((stop) => stop.id));
  const restored = initialStops.map((defaultStop) => {
    const saved = savedById.get(defaultStop.id);
    return saved ? { ...defaultStop, ...saved, activities: mergeById(defaultStop.activities, saved.activities || []) } : defaultStop;
  });
  return [...restored, ...savedStops.filter((stop) => !defaultIds.has(stop.id))];
}

/** Reinserisce una tappa di default (se manca) subito dopo un'altra, con tratte e agenda di default. */
function ensureStopAfter(plan: PlanData, stopId: string, afterId: string): PlanData {
  if (plan.stops.some((stop) => stop.id === stopId)) return plan;
  const defaultStop = initialStops.find((stop) => stop.id === stopId);
  if (!defaultStop) return plan;
  const afterIndex = plan.stops.findIndex((stop) => stop.id === afterId);
  const insertAt = afterIndex >= 0 ? afterIndex + 1 : Math.min(2, plan.stops.length);
  const legIds = new Set(plan.legs.map((leg) => leg.id));
  const itemIds = new Set(plan.scheduleItems.map((item) => item.id));
  return {
    ...plan,
    stops: [...plan.stops.slice(0, insertAt), defaultStop, ...plan.stops.slice(insertAt)],
    legs: [...plan.legs, ...initialLegs.filter((leg) => (leg.fromId === stopId || leg.toId === stopId) && !legIds.has(leg.id))],
    scheduleItems: [...plan.scheduleItems, ...initialSchedule.filter((item) => item.stopId === stopId && !itemIds.has(item.id))],
  };
}

/**
 * Assegna a ogni blocco senza "giorno" il suo giorno dentro la tappa. Le vecchie versioni salvavano
 * solo la data, che restava ferma quando cambiavano le notti:
 * - i blocchi del piano originale (data mai modificabile) tornano esattamente al loro giorno;
 * - per gli altri cerchiamo lo spostamento che rimette dentro la tappa il maggior numero di blocchi,
 *   preferendo, a parità, lasciarli sulla data che si vedeva finora.
 */
export function assignDays(items: ScheduleItem[], stops: Stop[]): ScheduleItem[] {
  const originalArrival = new Map(buildTimeline(initialStops).map((entry) => [entry.stop.id, entry.arrival]));
  const originalDate = new Map(initialSchedule.map((item) => [item.id, item.date]));
  const result = [...items];
  buildTimeline(stops).forEach((entry) => {
    const pending = result.map((item, index) => ({ item, index })).filter(({ item }) => item.stopId === entry.stop.id && !validDay(item.day) && isDateKey(item.date));
    const custom: typeof pending = [];
    pending.forEach(({ item, index }) => {
      const arrival = originalArrival.get(item.stopId);
      if (arrival && originalDate.get(item.id) === item.date) result[index] = { ...item, day: Math.max(0, diffDaysKey(arrival, item.date)) };
      else custom.push({ item, index });
    });
    if (custom.length === 0) return;
    const offsets = custom.map(({ item }) => diffDaysKey(entry.arrival, item.date));
    let bestShift = 0;
    let bestScore = -1;
    for (let shift = -TRIP_NIGHTS; shift <= TRIP_NIGHTS; shift++) {
      const score = offsets.filter((offset) => offset - shift >= 0 && offset - shift < entry.stop.nights).length;
      if (score > bestScore || (score === bestScore && Math.abs(shift) < Math.abs(bestShift))) {
        bestScore = score;
        bestShift = shift;
      }
    }
    custom.forEach(({ item, index }, position) => {
      result[index] = { ...item, day: Math.max(0, offsets[position] - bestShift) };
    });
  });
  return result;
}

/** I treni/voli tra città dell'agenda iniziale diventano gli orari della tratta corrispondente. */
function absorbDefaultTransfers(plan: PlanData) {
  const consecutive = new Set(plan.stops.slice(0, -1).map((stop, index) => `${stop.id}>${plan.stops[index + 1].id}`));
  let legs = [...plan.legs];
  const removed = new Set<string>();
  Object.entries(DEFAULT_TRANSFER_ITEMS).forEach(([itemId, [fromId, toId]]) => {
    const item = plan.scheduleItems.find((entry) => entry.id === itemId);
    if (!item || item.bookingStatus === "prenotato" || item.ticketUrl?.trim() || item.price > 0) return;
    removed.add(itemId);
    if (!consecutive.has(`${fromId}>${toId}`)) return;
    const saved = legs.find((leg) => leg.fromId === fromId && leg.toId === toId);
    const leg = saved || normalizeLegs(plan.stops, legs).find((entry) => entry.fromId === fromId && entry.toId === toId);
    if (!leg) return;
    const defaultName = initialSchedule.find((entry) => entry.id === itemId)?.name;
    const extraNotes = [item.name !== defaultName ? item.name : "", item.notes].filter((text) => text && !leg.note.includes(text));
    const patched: Leg = {
      ...leg,
      ...(!leg.departureTime && !leg.arrivalTime ? { departureTime: item.startTime, arrivalTime: item.endTime } : {}),
      note: [leg.note, ...extraNotes].filter(Boolean).join(" · "),
    };
    legs = saved ? legs.map((entry) => (entry.id === saved.id ? patched : entry)) : [...legs, patched];
  });
  return { legs, scheduleItems: plan.scheduleItems.filter((item) => !removed.has(item.id)), absorbed: removed.size };
}

function enrichChinese(plan: PlanData): PlanData {
  const stops = plan.stops.map((stop) => {
    const nameZh = stop.nameZh || STOP_ZH[stop.id];
    const activities = stop.activities.map((activity) => (!activity.nameZh && ACTIVITY_ZH[activity.id] ? { ...activity, nameZh: ACTIVITY_ZH[activity.id] } : activity));
    return nameZh !== stop.nameZh || activities.some((activity, index) => activity !== stop.activities[index]) ? { ...stop, ...(nameZh ? { nameZh } : {}), activities } : stop;
  });
  const stopZh = new Map(stops.map((stop) => [stop.id, stop.nameZh]));
  const scheduleItems = plan.scheduleItems.map((item) => {
    const nameZh = item.nameZh || (item.sourceActivityId ? ACTIVITY_ZH[item.sourceActivityId] : undefined);
    const locationZh = item.locationZh || (scheduleKind(item) === "activity" ? stopZh.get(item.stopId) || STOP_ZH[item.stopId] : undefined);
    if (nameZh === item.nameZh && locationZh === item.locationZh) return item;
    return { ...item, ...(nameZh ? { nameZh } : {}), ...(locationZh ? { locationZh } : {}) };
  });
  return { ...plan, stops, scheduleItems };
}

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Aggiorna un piano salvato all'ultima versione. Idempotente: rieseguirla non cambia nulla, anche se
 * un telefono con la versione vecchia dell'app riscrive il documento.
 */
export function migratePlan(input: PlanData): { plan: PlanData; notes: string[] } {
  const notes: string[] = [];
  const version = input.itineraryVersion || 0;
  let plan: PlanData = { ...input };

  if (version < 2) {
    plan.stops = mergeStopsWithDefaults(plan.stops);
    plan.legs = mergeById(initialLegs, plan.legs);
    plan.scheduleItems = mergeById(initialSchedule, plan.scheduleItems);
    notes.push("Recuperate tutte le tappe, le giornate e le attività del piano originale.");
  }
  plan.scheduleItems = plan.scheduleItems.map(normalizeScheduleItem).filter((item) => scheduleKind(item) !== "hotel");
  plan.stops = plan.stops.map((stop) => ({ ...stop, nights: Math.max(1, Math.round(Number(stop.nights) || 1)) }));
  if (version < 3 && !plan.stops.some((stop) => stop.id === "chengdu")) {
    plan = ensureStopAfter(plan, "chengdu", "xian");
    notes.push("Chengdu reinserita come tappa 3, dopo Xi’an, con treno, hotel e agenda di default.");
  }
  if (version < PLAN_VERSION) {
    plan.scheduleItems = assignDays(plan.scheduleItems, plan.stops);
    const transfers = absorbDefaultTransfers(plan);
    plan.legs = transfers.legs;
    plan.scheduleItems = transfers.scheduleItems;
    const timeline = buildTimeline(plan.stops);
    const takenIds = new Set(plan.hotelStays.map((stay) => stay.id));
    const missing = timeline.filter((entry) => !plan.hotelStays.some((stay) => stay.stopId === entry.stop.id));
    plan.hotelStays = [...plan.hotelStays, ...missing.map((entry) => {
      const stay = makeHotelPlaceholder(entry.stop, entry, takenIds);
      takenIds.add(stay.id);
      return stay;
    })];
    notes.push(`Agenda agganciata alle tappe: ogni blocco ora segue la sua città quando cambiano le notti${transfers.absorbed ? `; ${plural(transfers.absorbed, "treno/volo doppione spostato", "treni/voli doppioni spostati")} nelle tratte` : ""}.`);
  }

  // Pulizia sempre attiva: niente avanzi di tappe eliminate (tranne ciò che è già prenotato/pagato).
  const stopIds = new Set(plan.stops.map((stop) => stop.id));
  plan.scheduleItems = plan.scheduleItems.filter((item) => stopIds.has(item.stopId) || item.bookingStatus === "prenotato");
  plan.hotelStays = plan.hotelStays
    .filter((stay) => stopIds.has(stay.stopId) || stay.bookingStatus === "prenotato")
    .map((stay) => {
      const nightlyPrice = typeof stay.nightlyPrice === "number" && Number.isFinite(stay.nightlyPrice) ? stay.nightlyPrice : 0;
      // Da prenotare si ragiona a notte: un totale inserito a mano diventa prezzo/notte.
      if (stay.bookingStatus !== "prenotato" && typeof stay.totalPrice === "number" && stay.totalPrice > 0 && hotelNights(stay) > 0) {
        const rest = { ...stay };
        delete rest.totalPrice;
        return { ...rest, nightlyPrice: roundCents(stay.totalPrice / hotelNights(stay)) };
      }
      return nightlyPrice === stay.nightlyPrice ? stay : { ...stay, nightlyPrice };
    })
    .map((stay, _, stays) => {
      // Vecchi salvataggi: l'unico hotel non prenotato di una tappa ne segue le date.
      if (stay.followStop !== undefined || stay.bookingStatus === "prenotato") return stay;
      return { ...stay, followStop: stays.filter((other) => other.stopId === stay.stopId).length === 1 };
    });
  if (plan.checklist.length !== defaultChecklist.length) {
    plan.checklist = defaultChecklist.map((_, index) => Boolean(plan.checklist[index]));
  }
  plan = enrichChinese(plan);
  plan.itineraryVersion = PLAN_VERSION;
  return { plan: refreshDerived(plan), notes };
}

export function loadPlan(value: unknown) {
  const shaped = shapePlan(value);
  return shaped ? migratePlan(shaped).plan : null;
}

export function seedPlan(): PlanData {
  return migratePlan({
    itineraryVersion: 3,
    stops: initialStops,
    legs: initialLegs,
    scheduleItems: initialSchedule,
    hotelStays: [],
    checklist: defaultChecklist.map(() => false),
    extraChecklist: [],
    sharedLinks: [],
    notes: "",
    cnyPerEuro: DEFAULT_CNY_PER_EURO,
    costEntries: DEFAULT_COST_ENTRIES.map((entry) => ({ ...entry })),
    expenses: [],
    customCategories: [],
    dismissedSuggestions: [],
    coverPhoto: "",
  }).plan;
}

// ---------------------------------------------------------------------------
// Sincronizzazione: unione a tre vie (ultimo stato cloud, modifiche locali, nuovo stato cloud)
// ---------------------------------------------------------------------------

function mergeByIdThreeWay<T extends { id: string }>(base: T[], local: T[], remote: T[]): T[] {
  const baseById = new Map(base.map((item) => [item.id, item]));
  const localById = new Map(local.map((item) => [item.id, item]));
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const order = (items: T[]) => items.map((item) => item.id).join("|");
  const localReordered = order(local.filter((item) => baseById.has(item.id))) !== order(base.filter((item) => localById.has(item.id)));
  const skeleton = localReordered ? [...local, ...remote] : [...remote, ...local];
  const seen = new Set<string>();
  const merged: T[] = [];
  skeleton.forEach(({ id }) => {
    if (seen.has(id)) return;
    seen.add(id);
    const baseItem = baseById.get(id);
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);
    if (baseItem) {
      if (!localItem) return; // eliminato qui
      if (!remoteItem) {
        if (!sameValue(localItem, baseItem)) merged.push(localItem); // eliminato altrove ma modificato qui
        return;
      }
      merged.push(sameValue(localItem, baseItem) ? remoteItem : localItem);
      return;
    }
    const item = localItem || remoteItem;
    if (item) merged.push(item);
  });
  return merged;
}

/**
 * Unisce le modifiche locali non ancora salvate con un nuovo stato arrivato dal cloud. Per le liste
 * lavora elemento per elemento: Alberto che modifica un hotel e Sofia che aggiunge un'attività non si
 * cancellano a vicenda. In caso di conflitto sullo stesso elemento vince la modifica locale.
 */
export function mergePlan(base: PlanData | null, local: PlanData, remote: PlanData): PlanData {
  if (!base) return remote;
  const merged = { ...remote } as Record<keyof PlanData, unknown>;
  PLAN_KEYS.forEach((key) => {
    const baseValue = base[key];
    const localValue = local[key];
    const remoteValue = remote[key];
    if ((ID_ARRAY_KEYS as readonly string[]).includes(key)) {
      merged[key] = mergeByIdThreeWay(baseValue as Array<{ id: string }>, localValue as Array<{ id: string }>, remoteValue as Array<{ id: string }>);
    } else {
      merged[key] = sameValue(localValue, baseValue) ? remoteValue : localValue;
    }
  });
  return refreshDerived(merged as PlanData);
}

/** Chiavi del piano diverse dall'ultimo stato salvato nel cloud. */
export function changedKeys(base: PlanData | null, plan: PlanData) {
  return PLAN_KEYS.filter((key) => !base || !sameValue(base[key], plan[key]));
}

// ---------------------------------------------------------------------------
// Operazioni sulle tappe (date dei voli fisse: 17 notti in tutto)
// ---------------------------------------------------------------------------

export type PlanChange = { plan: PlanData; notice: string; ok: boolean };

export function setStopNights(plan: PlanData, stopId: string, requested: number): PlanChange {
  const stop = plan.stops.find((item) => item.id === stopId);
  if (!stop) return { plan, notice: "", ok: false };
  const free = TRIP_NIGHTS - totalNights(plan.stops);
  const maxAllowed = stop.nights + Math.max(0, free);
  const nights = Math.min(Math.max(1, Math.round(requested) || 1), maxAllowed);
  const notice = requested > maxAllowed
    ? `Le date dei voli sono fisse (17 nov → 4 dic): ${stop.name} può avere al massimo ${plural(maxAllowed, "notte", "notti")}. Per aumentarle togli prima una notte a un'altra tappa.`
    : "";
  if (nights === stop.nights) return { plan, notice, ok: false };
  return { plan: refreshDerived({ ...plan, stops: plan.stops.map((item) => (item.id === stopId ? { ...item, nights } : item)) }), notice, ok: true };
}

export function moveStop(plan: PlanData, stopId: string, direction: -1 | 1): PlanData {
  const index = plan.stops.findIndex((stop) => stop.id === stopId);
  const target = index + direction;
  if (index <= 0 || index >= plan.stops.length - 1 || target <= 0 || target >= plan.stops.length - 1) return plan;
  const stops = [...plan.stops];
  [stops[index], stops[target]] = [stops[target], stops[index]];
  return refreshDerived({ ...plan, stops });
}

/** Cosa succede eliminando la tappa: serve per chiedere conferma con i numeri giusti. */
export function stopRemovalImpact(plan: PlanData, stopId: string) {
  const index = plan.stops.findIndex((stop) => stop.id === stopId);
  const stop = plan.stops[index];
  const receiver = index > 0 ? plan.stops[index - 1] : plan.stops[index + 1];
  const items = plan.scheduleItems.filter((item) => item.stopId === stopId);
  const stays = plan.hotelStays.filter((stay) => stay.stopId === stopId);
  const overflow = Math.max(0, totalNights(plan.stops) - TRIP_NIGHTS);
  return {
    stop,
    receiver,
    givenNights: stop ? Math.max(0, stop.nights - overflow) : 0,
    removedItems: items.filter((item) => item.bookingStatus !== "prenotato").length,
    keptItems: items.filter((item) => item.bookingStatus === "prenotato").length,
    removedStays: stays.filter((stay) => stay.bookingStatus !== "prenotato").length,
    keptStays: stays.filter((stay) => stay.bookingStatus === "prenotato").length,
  };
}

/** Elimina una tappa: le sue notti passano alla tappa precedente, così la finestra resta piena. */
export function removeStop(plan: PlanData, stopId: string): PlanChange {
  if (isLockedStop(stopId)) return { plan, notice: "", ok: false };
  const impact = stopRemovalImpact(plan, stopId);
  if (!impact.stop) return { plan, notice: "", ok: false };
  const stops = plan.stops
    .filter((stop) => stop.id !== stopId)
    .map((stop) => (impact.receiver && stop.id === impact.receiver.id ? { ...stop, nights: stop.nights + impact.givenNights } : stop));
  const next = refreshDerived({
    ...plan,
    stops,
    scheduleItems: plan.scheduleItems.filter((item) => item.stopId !== stopId || item.bookingStatus === "prenotato"),
    hotelStays: plan.hotelStays.filter((stay) => stay.stopId !== stopId || stay.bookingStatus === "prenotato"),
  });
  const parts = [`${impact.stop.name} eliminata.`];
  if (impact.givenNights && impact.receiver) parts.push(`${plural(impact.givenNights, "notte passa", "notti passano")} a ${impact.receiver.name}: ribilanciale quando vuoi.`);
  if (impact.keptItems || impact.keptStays) parts.push(`Restano ${plural(impact.keptItems + impact.keptStays, "prenotazione già fatta", "prenotazioni già fatte")}: le trovi in «Da sistemare».`);
  return { plan: next, notice: parts.join(" "), ok: true };
}

/** Notti per una nuova tappa: prima quelle libere, poi dalla tappa scelta, poi dalle più lunghe (minimo 1 a testa). */
export function allocateNights(stops: Stop[], needed: number, donorId: string, label: string) {
  const free = TRIP_NIGHTS - totalNights(stops);
  if (free >= needed) return { stops, nights: needed, notice: "" };
  let missing = needed - Math.max(0, free);
  const next = stops.map((stop) => ({ ...stop }));
  const donor = next.find((stop) => stop.id === donorId && stop.nights > 1);
  const others = next.filter((stop) => stop.nights > 1 && stop.id !== donor?.id).sort((a, b) => b.nights - a.nights);
  const taken: string[] = [];
  for (const stop of donor ? [donor, ...others] : others) {
    if (missing <= 0) break;
    const give = Math.min(stop.nights - 1, missing);
    if (give <= 0) continue;
    stop.nights -= give;
    missing -= give;
    taken.push(taken.length === 0 ? `${plural(give, "notte", "notti")} da ${stop.name}` : `${give} da ${stop.name}`);
  }
  const nights = needed - missing;
  const list = taken.length > 1 ? `${taken.slice(0, -1).join(", ")} e ${taken.at(-1)}` : taken[0];
  const notice = taken.length > 0
    ? `Le date dei voli sono fisse (17 nov → 4 dic): per ${label} ho preso ${list}. Puoi ribilanciarle quando vuoi.`
    : "";
  return { stops: next, nights, notice };
}

export function insertStop(plan: PlanData, stop: Stop, options: { afterId: string; nights: number; donorId?: string }): PlanChange {
  if (plan.stops.some((item) => item.id === stop.id)) return { plan, notice: `${stop.name} è già nel piano.`, ok: false };
  const allocation = allocateNights(plan.stops, Math.max(1, options.nights), options.donorId || options.afterId, stop.name);
  if (allocation.nights < 1) {
    return { plan, notice: "Tutte le tappe hanno già una sola notte: per aggiungere una città bisogna prima eliminarne un'altra.", ok: false };
  }
  const newStop = { ...stop, nights: allocation.nights };
  const anchorIndex = allocation.stops.findIndex((item) => item.id === options.afterId);
  const index = Math.min(anchorIndex >= 0 ? anchorIndex + 1 : Math.max(1, allocation.stops.length - 1), allocation.stops.length - 1);
  const stops = [...allocation.stops.slice(0, index), newStop, ...allocation.stops.slice(index)];
  const entry = buildTimeline(stops).find((item) => item.stop.id === newStop.id);
  const hotelStays = entry && !plan.hotelStays.some((stay) => stay.stopId === newStop.id)
    ? [...plan.hotelStays, makeHotelPlaceholder(newStop, entry, new Set(plan.hotelStays.map((stay) => stay.id)))]
    : plan.hotelStays;
  return { plan: refreshDerived({ ...plan, stops, hotelStays }), notice: allocation.notice, ok: true };
}

export function stopFromSuggestion(suggestion: SuggestedStop): Stop {
  return {
    id: suggestion.id,
    name: suggestion.name,
    ...(STOP_ZH[suggestion.id] ? { nameZh: STOP_ZH[suggestion.id] } : {}),
    lat: suggestion.lat,
    lng: suggestion.lng,
    nights: suggestion.nights,
    hotelNightly: suggestion.hotelNightly,
    activities: suggestion.activities.map((activity) => ({ ...activity, ...(ACTIVITY_ZH[activity.id] ? { nameZh: ACTIVITY_ZH[activity.id] } : {}) })),
  };
}

/** Modifica una tratta; se era solo ricavata (mai salvata) la salva con la modifica. */
export function updateLeg(plan: PlanData, legId: string, patch: Partial<Leg>): PlanData {
  if (plan.legs.some((leg) => leg.id === legId)) return { ...plan, legs: plan.legs.map((leg) => (leg.id === legId ? { ...leg, ...patch } : leg)) };
  const derived = normalizeLegs(plan.stops, plan.legs).find((leg) => leg.id === legId);
  return derived ? { ...plan, legs: [...plan.legs, { ...derived, ...patch }] } : plan;
}

// ---------------------------------------------------------------------------
// Agenda: attività clou → blocco in agenda
// ---------------------------------------------------------------------------

export function scheduleActivity(plan: PlanData, stopId: string, activity: Activity, options: { day?: number; id?: string } = {}): { plan: PlanData; item: ScheduleItem } | null {
  const timeline = buildTimeline(plan.stops);
  const entry = timeline.find((item) => item.stop.id === stopId);
  if (!entry) return null;
  const stopItems = plan.scheduleItems.filter((item) => item.stopId === stopId);
  const legs = normalizeLegs(plan.stops, plan.legs);
  const busyFor = (dayIndex: number) => {
    const date = addDaysKey(entry.arrival, dayIndex);
    const leg = legs.find((item) => item.included && item.toId === stopId && dayIndex === 0 && item.departureTime);
    return [
      ...stopItems.filter((item) => item.date === date),
      ...(leg?.departureTime ? [{ startTime: leg.departureTime, endTime: leg.arrivalTime || minutesToTime(timeToMinutes(leg.departureTime) + 120) }] : []),
    ];
  };
  const targetDay = options.day ?? Array.from({ length: entry.stop.nights }, (_, index) => index)
    .sort((left, right) => busyFor(left).length - busyFor(right).length || left - right)[0];
  const [startTime, endTime] = findFreeSlot(busyFor(targetDay));
  const item: ScheduleItem = {
    id: options.id || uid("plan"),
    stopId,
    day: targetDay,
    date: addDaysKey(entry.arrival, targetDay),
    startTime,
    endTime,
    name: activity.name,
    ...(activity.nameZh ? { nameZh: activity.nameZh } : {}),
    kind: "activity",
    category: "visita",
    location: entry.stop.name,
    ...(entry.stop.nameZh ? { locationZh: entry.stop.nameZh } : {}),
    notes: activity.description,
    price: activity.price,
    currency: activity.currency || "EUR",
    bookingStatus: "da-prenotare",
    ...(activity.sourceUrl ? { sourceUrl: activity.sourceUrl } : {}),
    sourceActivityId: activity.id,
  };
  const stops = plan.stops.map((stop) => stop.id !== stopId ? stop : {
    ...stop,
    activities: stop.activities.map((entryActivity) => (entryActivity.id === activity.id ? { ...entryActivity, selected: true } : entryActivity)),
  });
  return { plan: refreshDerived({ ...plan, stops, scheduleItems: [...plan.scheduleItems, item] }), item };
}

// ---------------------------------------------------------------------------
// Budget: previsionale vs consuntivo, bilancio Alberto/Sofia
// ---------------------------------------------------------------------------

export function itemExpenseCategory(item: ScheduleItem): ExpenseCategory {
  if (scheduleKind(item) === "transport") return "trasporti";
  if (item.category === "cibo") return "cibo";
  return "attivita";
}

export type ConfirmedEntry = {
  id: string;
  label: string;
  date: string;
  detail: string;
  amount: number;
  currency: ScheduleItem["currency"];
  paidBy?: Payer;
  category: ExpenseCategory;
};

export function computeBudget(plan: PlanData, legs: Leg[], legLabel: (leg: Leg) => string, legDateOf: (leg: Leg) => string) {
  const eur = (value: number, currency: ScheduleItem["currency"]) => toEuro(value, currency, plan.cnyPerEuro);
  const pricedItems = plan.scheduleItems.filter((item) => item.price > 0);
  const includedLegs = legs.filter((leg) => leg.included);
  const sumItems = (category: ExpenseCategory) => pricedItems.filter((item) => itemExpenseCategory(item) === category).reduce((sum, item) => sum + eur(item.price, item.currency), 0);
  const hotelPlanned = plan.hotelStays.reduce((sum, stay) => sum + eur(hotelTotal(stay), stay.currency), 0);
  const legsPlanned = includedLegs.reduce((sum, leg) => sum + eur(leg.cost, leg.currency), 0);
  const costEntriesPlanned = plan.costEntries.reduce((sum, entry) => sum + eur(entry.amount, entry.currency), 0);
  const planned = {
    voli: FLIGHTS_COST,
    hotel: hotelPlanned,
    trasporti: legsPlanned + sumItems("trasporti"),
    attivita: sumItems("attivita"),
    ciboExtra: sumItems("cibo") + costEntriesPlanned,
  };
  const totalPlanned = planned.voli + planned.hotel + planned.trasporti + planned.attivita + planned.ciboExtra;

  // Consuntivo automatico: ciò che è prenotato entra nello speso senza doverlo registrare a mano.
  const confirmed: ConfirmedEntry[] = [
    ...plan.hotelStays.filter((stay) => stay.bookingStatus === "prenotato").map((stay) => ({
      id: `conf-${stay.id}`,
      label: stay.name,
      date: stay.checkInDate,
      detail: `Hotel prenotato${stay.confirmationNumber ? ` · n. ${stay.confirmationNumber}` : ""}`,
      amount: hotelTotal(stay),
      currency: stay.currency,
      paidBy: stay.paidBy,
      category: "hotel" as ExpenseCategory,
    })),
    ...includedLegs.filter((leg) => leg.bookingStatus === "prenotato" && leg.cost > 0).map((leg) => ({
      id: `conf-${leg.id}`,
      label: legLabel(leg),
      date: legDateOf(leg),
      detail: `Tratta prenotata${leg.serviceNumber ? ` · ${leg.serviceNumber}` : ""}${leg.bookingRef ? ` · n. ${leg.bookingRef}` : ""}`,
      amount: leg.cost,
      currency: leg.currency,
      paidBy: leg.paidBy,
      category: "trasporti" as ExpenseCategory,
    })),
    ...pricedItems.filter((item) => item.bookingStatus === "prenotato").map((item) => ({
      id: `conf-${item.id}`,
      label: item.name,
      date: item.date,
      detail: "Prenotato in agenda",
      amount: item.price,
      currency: item.currency,
      paidBy: item.paidBy,
      category: itemExpenseCategory(item),
    })),
  ];
  const all = [
    ...confirmed.map((entry) => ({ amount: eur(entry.amount, entry.currency), category: entry.category, paidBy: entry.paidBy })),
    ...plan.expenses.map((expense) => ({ amount: eur(expense.amount, expense.currency), category: expense.category, paidBy: expense.paidBy as Payer | undefined })),
  ];
  const spentIn = (categories: ExpenseCategory[]) => all.filter((entry) => categories.includes(entry.category)).reduce((sum, entry) => sum + entry.amount, 0);
  const paidBy = (payer: Payer) => all.filter((entry) => entry.paidBy === payer).reduce((sum, entry) => sum + entry.amount, 0);
  const spent = {
    voli: FLIGHTS_COST + spentIn(["voli"]),
    hotel: spentIn(["hotel"]),
    trasporti: spentIn(["trasporti"]),
    attivita: spentIn(["attivita"]),
    ciboExtra: spentIn(["cibo", "extra"]),
  };
  const totalSpent = spent.voli + spent.hotel + spent.trasporti + spent.attivita + spent.ciboExtra;
  // I voli sono già pagati in pari: metà a testa, quindi non spostano il bilancio.
  const byPayer: Record<Payer, number> = { alberto: FLIGHTS_COST / 2 + paidBy("alberto"), sofia: FLIGHTS_COST / 2 + paidBy("sofia") };
  const unassigned = all.filter((entry) => !entry.paidBy).reduce((sum, entry) => sum + entry.amount, 0);
  return {
    planned,
    spent,
    totalPlanned,
    totalSpent,
    confirmed,
    byPayer,
    unassigned,
    /** >0: Sofia deve ad Alberto; <0: Alberto deve a Sofia. */
    splitBalance: (byPayer.alberto - byPayer.sofia) / 2,
  };
}

// ---------------------------------------------------------------------------
// Controlli di coerenza mostrati in «Da sistemare»
// ---------------------------------------------------------------------------

export type PlanIssue = { id: string; text: string; section: "itinerary" | "calendar" | "hotels" | "transport"; date?: string; stopId?: string };

export function planIssues(plan: PlanData, calendar: CalendarDay[], legs: Leg[]): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const used = totalNights(plan.stops);
  if (used < TRIP_NIGHTS) issues.push({ id: "free-nights", section: "itinerary", text: `${plural(TRIP_NIGHTS - used, "notte ancora da assegnare", "notti ancora da assegnare")} a una tappa (in fondo al viaggio).` });
  if (used > TRIP_NIGHTS) issues.push({ id: "over-nights", section: "itinerary", text: `${plural(used - TRIP_NIGHTS, "notte", "notti")} oltre il volo di ritorno del 4 dicembre: togline a qualche tappa.` });

  const timeline = buildTimeline(plan.stops);
  const stopNights = calendar.filter((day) => day.stopId && day.type !== "over");
  const covering = (dateKey: string) => plan.hotelStays.filter((stay) => stay.checkInDate <= dateKey && stay.checkOutDate > dateKey);
  const uncovered = stopNights.filter((day) => covering(day.dateKey).length === 0);
  if (uncovered.length) issues.push({ id: "no-hotel", section: "hotels", date: uncovered[0].dateKey, text: `Notti senza hotel: ${uncovered.map((day) => `${formatShortDate(day.dateKey)} (${day.city})`).join(", ")}.` });
  const doubled = stopNights.filter((day) => covering(day.dateKey).length > 1);
  if (doubled.length) issues.push({ id: "double-hotel", section: "hotels", date: doubled[0].dateKey, text: `Notti con due hotel: ${doubled.map((day) => formatShortDate(day.dateKey)).join(", ")}. Controlla check-in e check-out.` });

  plan.hotelStays.filter((stay) => stay.bookingStatus === "prenotato").forEach((stay) => {
    const entry = timeline.find((item) => item.stop.id === stay.stopId);
    const siblings = plan.hotelStays.filter((other) => other.stopId === stay.stopId).length;
    if (!entry) {
      issues.push({ id: `orphan-hotel-${stay.id}`, section: "hotels", text: `${stay.name} è prenotato ma la sua tappa non è più nel piano.` });
    } else if (siblings === 1 && (stay.checkInDate !== entry.arrival || stay.checkOutDate !== entry.departure)) {
      issues.push({ id: `hotel-dates-${stay.id}`, section: "hotels", stopId: stay.stopId, text: `${stay.name}: prenotato ${formatShortDate(stay.checkInDate)} → ${formatShortDate(stay.checkOutDate)}, ma ${entry.stop.name} va dal ${formatShortDate(entry.arrival)} al ${formatShortDate(entry.departure)}.` });
    }
  });

  const stopsById = new Map(plan.stops.map((stop) => [stop.id, stop]));
  const overflow = plan.scheduleItems.filter((item) => isOverflowItem(item, stopsById.get(item.stopId)));
  if (overflow.length) issues.push({ id: "overflow-items", section: "calendar", date: overflow[0].date, text: `${plural(overflow.length, "attività è rimasta", "attività sono rimaste")} senza giornata perché la tappa ha meno notti: le trovi sull'ultimo giorno della tappa, spostale.` });
  const orphans = plan.scheduleItems.filter((item) => !stopsById.has(item.stopId));
  if (orphans.length) issues.push({ id: "orphan-items", section: "calendar", date: orphans[0].date, text: `${plural(orphans.length, "prenotazione in agenda appartiene", "prenotazioni in agenda appartengono")} a una tappa eliminata: ${orphans.map((item) => item.name).join(", ")}.` });

  const conflictDays = new Set<string>();
  const byDate = new Map<string, ScheduleItem[]>();
  plan.scheduleItems.forEach((item) => byDate.set(item.date, [...(byDate.get(item.date) || []), item]));
  byDate.forEach((items, date) => {
    if (conflictingIds(items).size > 0) conflictDays.add(date);
  });
  if (conflictDays.size) {
    const dates = [...conflictDays].sort();
    issues.push({ id: "conflicts", section: "calendar", date: dates[0], text: `Orari sovrapposti in ${plural(dates.length, "giorno", "giorni")}: ${dates.map(formatShortDate).join(", ")}.` });
  }

  const excluded = legs.filter((leg) => !leg.included);
  if (excluded.length) issues.push({ id: "excluded-legs", section: "transport", text: `${plural(excluded.length, "tratta esclusa", "tratte escluse")} dal viaggio: manca il collegamento tra due tappe.` });
  return issues;
}

// ---------------------------------------------------------------------------
// Vista derivata usata dall'interfaccia
// ---------------------------------------------------------------------------

export function buildView(plan: PlanData) {
  const timeline = buildTimeline(plan.stops);
  const legs = normalizeLegs(plan.stops, plan.legs);
  const calendar = buildCalendar(timeline, legs);
  const stopById = new Map(plan.stops.map((stop) => [stop.id, stop]));
  const entryById = new Map(timeline.map((entry) => [entry.stop.id, entry]));
  const itemsByDate = new Map<string, ScheduleItem[]>();
  sortByTime(plan.scheduleItems).forEach((item) => itemsByDate.set(item.date, [...(itemsByDate.get(item.date) || []), item]));
  const legLabel = (leg: Leg) => `${stopById.get(leg.fromId)?.name || "?"} → ${stopById.get(leg.toId)?.name || "?"}`;
  const legDateOf = (leg: Leg) => legDate(timeline, leg);
  const usedNights = totalNights(plan.stops);
  return {
    timeline,
    legs,
    calendar,
    stopById,
    entryById,
    itemsByDate,
    legLabel,
    legDateOf,
    usedNights,
    remainingNights: TRIP_NIGHTS - usedNights,
    budget: computeBudget(plan, legs, legLabel, legDateOf),
    issues: planIssues(plan, calendar, legs),
  };
}

export type PlanView = ReturnType<typeof buildView>;
