import assert from "node:assert/strict";
import test from "node:test";
import { ARRIVAL_KEY, DEFAULT_TRANSFER_ITEMS, PLAN_VERSION, TRIP_NIGHTS, initialLegs, initialSchedule, initialStops } from "../lib/planner/catalog.ts";
import {
  bestInsertionAfter,
  buildCalendar,
  buildTimeline,
  changedKeys,
  computeBudget,
  conflictingIds,
  findFreeSlot,
  insertStop,
  isOverflowItem,
  loadPlan,
  mergePlan,
  migratePlan,
  normalizeLegs,
  planIssues,
  refreshDerived,
  removeStop,
  scheduleActivity,
  seedPlan,
  setStopNights,
  shapePlan,
  totalNights,
} from "../lib/planner/model.ts";
import type { PlanData, ScheduleItem } from "../lib/planner/types.ts";
import { addDaysKey, sameValue, stableStringify } from "../lib/planner/utils.ts";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function stopRange(plan: PlanData, stopId: string) {
  return buildTimeline(plan.stops).find((entry) => entry.stop.id === stopId)!;
}

function itemsIn(plan: PlanData, stopId: string) {
  return plan.scheduleItems.filter((item) => item.stopId === stopId);
}

/** Piano salvato da una vecchia versione: solo date, niente "day". */
function legacyPlan(overrides: Partial<PlanData> = {}): Record<string, unknown> {
  return clone({
    itineraryVersion: 3,
    stops: initialStops,
    legs: initialLegs,
    scheduleItems: initialSchedule,
    hotelStays: [],
    checklist: [true, false],
    extraChecklist: [],
    sharedLinks: [],
    notes: "",
    cnyPerEuro: 8,
    costEntries: [],
    expenses: [],
    customCategories: [],
    dismissedSuggestions: [],
    coverPhoto: "",
    ...overrides,
  });
}

test("il piano iniziale copre esattamente le 17 notti, con un hotel per notte", () => {
  const plan = seedPlan();
  assert.equal(plan.itineraryVersion, PLAN_VERSION);
  assert.equal(totalNights(plan.stops), TRIP_NIGHTS);
  const calendar = buildCalendar(buildTimeline(plan.stops), normalizeLegs(plan.stops, plan.legs));
  assert.equal(calendar.length, TRIP_NIGHTS);
  assert.equal(calendar[0].dateKey, ARRIVAL_KEY);
  assert.equal(calendar.at(-1)!.dateKey, "2026-12-03");
  assert.deepEqual(planIssues(plan, calendar, normalizeLegs(plan.stops, plan.legs)), []);
  assert.equal(plan.hotelStays.length, plan.stops.length);
});

test("ogni blocco d'agenda ha il suo giorno dentro la tappa e una data coerente", () => {
  const plan = seedPlan();
  plan.scheduleItems.forEach((item) => {
    const entry = stopRange(plan, item.stopId);
    assert.equal(typeof item.day, "number", item.id);
    assert.equal(item.date, addDaysKey(entry.arrival, item.day!), item.id);
    assert.ok(item.date >= entry.arrival && item.date < entry.departure, item.id);
  });
});

test("i treni/voli doppioni dell'agenda iniziale diventano orari delle tratte", () => {
  const plan = seedPlan();
  Object.keys(DEFAULT_TRANSFER_ITEMS).forEach((id) => assert.ok(!plan.scheduleItems.some((item) => item.id === id), id));
  const legs = normalizeLegs(plan.stops, plan.legs);
  const beijingXian = legs.find((leg) => leg.id === "beijing-xian")!;
  assert.equal(beijingXian.departureTime, "08:00");
  assert.equal(beijingXian.arrivalTime, "14:30");
  assert.match(beijingXian.note, /60 minuti prima/);
  // L'arrivo in aereo a Pechino non è una tratta tra tappe: resta in agenda.
  assert.ok(plan.scheduleItems.some((item) => item.id === "d01-arrival"));
});

test("cambiando le notti, attività e hotel seguono la propria città", () => {
  const plan = seedPlan();
  const xianBefore = itemsIn(plan, "xian").map((item) => item.day);
  const shorter = setStopNights(plan, "beijing", 2);
  assert.ok(shorter.ok);
  const longer = setStopNights(shorter.plan, "kunming", 4);
  assert.ok(longer.ok);
  const next = longer.plan;
  assert.equal(totalNights(next.stops), TRIP_NIGHTS);

  const xian = stopRange(next, "xian");
  assert.equal(xian.arrival, "2026-11-19");
  assert.deepEqual(itemsIn(next, "xian").map((item) => item.day), xianBefore);
  itemsIn(next, "xian").forEach((item) => assert.ok(item.date >= xian.arrival && item.date < xian.departure));

  // La Muraglia era il giorno 3 di Pechino: ora non c'è più, la vediamo sull'ultimo giorno come da ricollocare.
  const wall = next.scheduleItems.find((item) => item.id === "d03-wall")!;
  assert.equal(wall.day, 2);
  assert.equal(wall.date, "2026-11-18");
  assert.ok(isOverflowItem(wall, next.stops.find((stop) => stop.id === "beijing")));
  const calendar = buildCalendar(buildTimeline(next.stops), normalizeLegs(next.stops, next.legs));
  assert.ok(planIssues(next, calendar, []).some((issue) => issue.id === "overflow-items"));

  // Ridando la notte a Pechino la Muraglia torna al suo giorno: nessun dato perso.
  const restored = setStopNights(setStopNights(next, "kunming", 3).plan, "beijing", 3).plan;
  assert.equal(restored.scheduleItems.find((item) => item.id === "d03-wall")!.date, "2026-11-19");

  const xianHotel = next.hotelStays.find((stay) => stay.stopId === "xian")!;
  assert.equal(xianHotel.checkInDate, xian.arrival);
  assert.equal(xianHotel.checkOutDate, xian.departure);
});

test("le date oltre la finestra dei voli sono bloccate", () => {
  const plan = seedPlan();
  const result = setStopNights(plan, "beijing", 5);
  assert.equal(result.ok, false);
  assert.match(result.notice, /date dei voli sono fisse/);
});

test("un hotel prenotato non cambia date da solo ma viene segnalato", () => {
  const plan = seedPlan();
  plan.hotelStays = plan.hotelStays.map((stay) => (stay.stopId === "xian" ? { ...stay, bookingStatus: "prenotato", totalPrice: 180 } : stay));
  const changed = setStopNights(setStopNights(plan, "beijing", 2).plan, "kunming", 4).plan;
  const stay = changed.hotelStays.find((item) => item.stopId === "xian")!;
  assert.equal(stay.checkInDate, "2026-11-20");
  const calendar = buildCalendar(buildTimeline(changed.stops), []);
  const issues = planIssues(changed, calendar, []);
  assert.ok(issues.some((issue) => issue.id === `hotel-dates-${stay.id}`));
});

test("eliminando una tappa le notti passano alla precedente e restano solo le prenotazioni pagate", () => {
  const plan = seedPlan();
  plan.scheduleItems = plan.scheduleItems.map((item) => (item.id === "d13-river" ? { ...item, bookingStatus: "prenotato" } : item));
  const result = removeStop(plan, "fenghuang");
  assert.ok(result.ok);
  assert.equal(totalNights(result.plan.stops), TRIP_NIGHTS);
  assert.equal(result.plan.stops.find((stop) => stop.id === "zhangjiajie")!.nights, 3);
  assert.ok(!result.plan.hotelStays.some((stay) => stay.stopId === "fenghuang"));
  assert.deepEqual(itemsIn(result.plan, "fenghuang").map((item) => item.id), ["d13-river"]);
  assert.match(result.notice, /passa a Zhangjiajie/);
  assert.equal(removeStop(plan, "beijing").ok, false);
});

test("aggiungere una tappa prende le notti dalla tappa scelta e crea il suo hotel", () => {
  const plan = seedPlan();
  const result = insertStop(plan, { id: "pingyao", name: "Pingyao", lat: 37.2, lng: 112.2, nights: 1, hotelNightly: 45, activities: [] }, { afterId: "beijing", nights: 1, donorId: "kunming" });
  assert.ok(result.ok);
  assert.equal(result.plan.stops[1].id, "pingyao");
  assert.equal(result.plan.stops.find((stop) => stop.id === "kunming")!.nights, 2);
  assert.equal(totalNights(result.plan.stops), TRIP_NIGHTS);
  const hotel = result.plan.hotelStays.find((stay) => stay.stopId === "pingyao")!;
  assert.equal(hotel.checkInDate, "2026-11-20");
  assert.match(result.notice, /ho preso 1 notte da Kunming/);
  // Le attività di Xi'an slittano di un giorno insieme alla città.
  const xian = stopRange(result.plan, "xian");
  itemsIn(result.plan, "xian").forEach((item) => assert.ok(item.date >= xian.arrival && item.date < xian.departure));
});

test("migra un vecchio salvataggio con date sfasate rimettendo le attività nella loro città", () => {
  // Vecchia versione: Pechino ridotta a 2 notti e Kunming a 4, ma le date in agenda erano rimaste ferme.
  const raw = legacyPlan();
  const stops = raw.stops as PlanData["stops"];
  stops.find((stop) => stop.id === "beijing")!.nights = 2;
  stops.find((stop) => stop.id === "kunming")!.nights = 4;
  const plan = loadPlan(raw)!;
  const xian = stopRange(plan, "xian");
  assert.equal(xian.arrival, "2026-11-19");
  const terracotta = plan.scheduleItems.find((item) => item.id === "d05-terracotta")!;
  assert.equal(terracotta.day, 1);
  assert.equal(terracotta.date, "2026-11-20");
  // I blocchi del piano originale tornano esattamente al loro giorno dentro la tappa.
  const kunming = stopRange(plan, "kunming");
  assert.deepEqual(itemsIn(plan, "kunming").map((item) => item.day), [0, 1, 2, 2]);
  itemsIn(plan, "kunming").forEach((item) => assert.ok(item.date >= kunming.arrival && item.date < kunming.departure, item.id));
  // Un blocco aggiunto a mano resta sulla data in cui lo si vedeva, se cade ancora nella sua tappa…
  const custom = loadPlan({ ...legacyPlan(), scheduleItems: [...initialSchedule, { ...initialSchedule[0], id: "plan-custom", stopId: "kunming", date: "2026-11-26" }] })!;
  assert.equal(custom.scheduleItems.find((item) => item.id === "plan-custom")!.date, "2026-11-26");
  // …altrimenti segue la sua città con lo spostamento che rimette dentro più blocchi.
  const shiftedRaw = legacyPlan({ scheduleItems: [...initialSchedule, { ...initialSchedule[0], id: "plan-late", stopId: "xian", date: "2026-11-21" }, { ...initialSchedule[0], id: "plan-late-2", stopId: "xian", date: "2026-11-20" }] });
  (shiftedRaw.stops as PlanData["stops"]).find((stop) => stop.id === "beijing")!.nights = 2;
  (shiftedRaw.stops as PlanData["stops"]).find((stop) => stop.id === "kunming")!.nights = 4;
  const shifted = loadPlan(shiftedRaw)!;
  assert.deepEqual(["plan-late-2", "plan-late"].map((id) => shifted.scheduleItems.find((item) => item.id === id)!.date), ["2026-11-19", "2026-11-20"]);
  // La checklist di lunghezza diversa non perde le spunte.
  assert.equal(plan.checklist[0], true);
});

test("la migrazione non tocca i trasferimenti già prenotati e converte i totali stimati a notte", () => {
  const raw = legacyPlan({
    scheduleItems: initialSchedule.map((item) => (item.id === "d08-flight" ? { ...item, bookingStatus: "prenotato" as const, price: 140 } : item)),
    hotelStays: [{ id: "hotel-beijing", stopId: "beijing", name: "Hotel Pechino", address: "", checkInDate: "2026-11-17", checkOutDate: "2026-11-20", nightlyPrice: 95, totalPrice: 300, currency: "EUR", bookingStatus: "da-prenotare", notes: "" }],
  });
  const plan = loadPlan(raw)!;
  assert.ok(plan.scheduleItems.some((item) => item.id === "d08-flight"));
  const stay = plan.hotelStays.find((item) => item.id === "hotel-beijing")!;
  assert.equal(stay.totalPrice, undefined);
  assert.equal(stay.nightlyPrice, 100);
});

test("la migrazione è idempotente, anche dopo un giro su Firestore (chiavi riordinate)", () => {
  const once = loadPlan(legacyPlan())!;
  const twice = migratePlan(shapePlan(clone(once))!).plan;
  assert.equal(stableStringify(twice), stableStringify(once));
  // Una vecchia app che riscrive la versione 3 non deve rompere nulla.
  const rewritten = loadPlan({ ...clone(once), itineraryVersion: 3 })!;
  assert.equal(stableStringify(rewritten), stableStringify(once));
  // Firestore restituisce i campi in ordine alfabetico: il confronto non deve vedere differenze.
  const sortedKeys = JSON.parse(stableStringify(once));
  assert.deepEqual(changedKeys(once, sortedKeys), []);
});

test("l'unione con il cloud conserva le modifiche di entrambi", () => {
  const base = seedPlan();
  const local = clone(base);
  const remote = clone(base);
  local.scheduleItems = local.scheduleItems.map((item) => (item.id === "d02-forbidden" ? { ...item, name: "Città Proibita (Alberto)" } : item));
  local.notes = "nota locale";
  remote.scheduleItems = remote.scheduleItems.map((item) => (item.id === "d05-terracotta" ? { ...item, startTime: "07:30" } : item));
  remote.scheduleItems.push({ ...remote.scheduleItems[0], id: "plan-sofia", name: "Massaggio" });
  remote.expenses = [{ id: "spesa-1", date: "2026-11-18", label: "Taxi", amount: 50, currency: "CNY", paidBy: "sofia", category: "trasporti" }];
  local.extraChecklist = [{ id: "check-1", label: "Adattatore", done: false }];

  const merged = mergePlan(base, local, remote);
  const byId = new Map(merged.scheduleItems.map((item) => [item.id, item]));
  assert.equal(byId.get("d02-forbidden")!.name, "Città Proibita (Alberto)");
  assert.equal(byId.get("d05-terracotta")!.startTime, "07:30");
  assert.ok(byId.has("plan-sofia"));
  assert.equal(merged.notes, "nota locale");
  assert.equal(merged.expenses.length, 1);
  assert.equal(merged.extraChecklist.length, 1);
});

test("l'unione rispetta le cancellazioni e, nei conflitti, la modifica locale", () => {
  const base = seedPlan();
  const local = clone(base);
  const remote = clone(base);
  local.scheduleItems = local.scheduleItems.filter((item) => item.id !== "d02-jingshan");
  remote.scheduleItems = remote.scheduleItems.filter((item) => item.id !== "d07-tea");
  local.cnyPerEuro = 7.9;
  remote.cnyPerEuro = 8.1;
  local.stops = local.stops.map((stop) => (stop.id === "xian" ? { ...stop, nights: 3 } : stop.id === "kunming" ? { ...stop, nights: 2 } : stop));
  const merged = mergePlan(base, local, remote);
  assert.ok(!merged.scheduleItems.some((item) => item.id === "d02-jingshan"));
  assert.ok(!merged.scheduleItems.some((item) => item.id === "d07-tea"));
  assert.equal(merged.cnyPerEuro, 7.9);
  assert.equal(merged.stops.find((stop) => stop.id === "xian")!.nights, 3);
  // Senza uno stato di partenza noto vince il cloud (mai sovrascrivere il lavoro dell'altro).
  assert.equal(mergePlan(null, local, remote).cnyPerEuro, 8.1);
});

test("subito dopo l'aggiornamento, le modifiche dal vecchio sito non si perdono", () => {
  // Base = documento salvato dalla vecchia versione; la nuova app lo ha aggiornato e modificato un blocco,
  // intanto Sofia (vecchia app) ha modificato un altro blocco e riscritto la versione 3.
  const raw = legacyPlan();
  const base = shapePlan(clone(raw))!;
  const local = migratePlan(clone(base)).plan;
  local.scheduleItems = local.scheduleItems.map((item) => (item.id === "d02-forbidden" ? { ...item, startTime: "08:00" } : item));
  const sofia = clone(raw) as { scheduleItems: ScheduleItem[] };
  sofia.scheduleItems = sofia.scheduleItems.map((item) => (item.id === "d05-terracotta" ? { ...item, notes: "Guida prenotata" } : item));
  const remote = migratePlan(shapePlan(sofia)!).plan;
  const merged = mergePlan(migratePlan(base).plan, local, remote);
  assert.equal(merged.scheduleItems.find((item) => item.id === "d02-forbidden")!.startTime, "08:00");
  assert.equal(merged.scheduleItems.find((item) => item.id === "d05-terracotta")!.notes, "Guida prenotata");
  // E ciò che va scritto nel cloud include la migrazione (il documento era ancora alla versione 3).
  assert.ok(changedKeys(base, merged).includes("scheduleItems"));
});

test("un punto cliccato sulla mappa si inserisce dove allunga meno il percorso", () => {
  const plan = seedPlan();
  assert.equal(bestInsertionAfter(plan.stops, { lat: 37.2, lng: 112.2 }), "beijing"); // Pingyao, tra Pechino e Xi'an
  assert.equal(bestInsertionAfter(plan.stops, { lat: 29.56, lng: 106.55 }), "kunming"); // Chongqing, sulla strada Kunming → Zhangjiajie
  assert.equal(bestInsertionAfter(plan.stops, { lat: 30.27, lng: 120.15 }), "fenghuang"); // Hangzhou, arrivando da ovest prima di Wuzhen
  assert.notEqual(bestInsertionAfter(plan.stops, { lat: 31.3, lng: 121.6 }), "shanghai");
});

test("rileva anche le sovrapposizioni non consecutive", () => {
  const ids = conflictingIds([
    { id: "a", startTime: "09:00", endTime: "17:00" },
    { id: "b", startTime: "10:00", endTime: "11:00" },
    { id: "c", startTime: "12:00", endTime: "13:00" },
    { id: "d", startTime: "18:00", endTime: "19:00" },
  ]);
  assert.deepEqual([...ids].sort(), ["a", "b", "c"]);
});

test("l'orario libero si adatta ai buchi della giornata", () => {
  assert.deepEqual(findFreeSlot([{ startTime: "08:00", endTime: "14:30" }, { startTime: "17:30", endTime: "20:30" }]), ["14:30", "17:30"]);
  assert.deepEqual(findFreeSlot([{ startTime: "07:00", endTime: "12:00" }, { startTime: "13:00", endTime: "23:00" }]), ["12:00", "13:00"]);
});

test("mettere in agenda un'attività clou sceglie un orario libero", () => {
  const plan = seedPlan();
  const beijing = plan.stops.find((stop) => stop.id === "beijing")!;
  const activity = beijing.activities.find((item) => item.id === "temple-heaven")!;
  const result = scheduleActivity(plan, "beijing", activity, { day: 1 })!;
  const dayItems = result.plan.scheduleItems.filter((item) => item.date === result.item.date);
  assert.equal(conflictingIds(dayItems).size, 0);
  assert.equal(result.item.day, 1);
  assert.ok(result.plan.stops.find((stop) => stop.id === "beijing")!.activities.find((item) => item.id === "temple-heaven")!.selected);
});

test("il budget mette ogni voce nella stessa categoria nel previsionale e nel consuntivo", () => {
  const plan = seedPlan();
  const dinner = plan.scheduleItems.find((item) => item.id === "d03-duck")!;
  plan.scheduleItems = plan.scheduleItems.map((item): ScheduleItem => (item.id === dinner.id ? { ...item, bookingStatus: "prenotato", paidBy: "sofia" } : item));
  plan.costEntries = [];
  const legs = normalizeLegs(plan.stops, plan.legs);
  const budget = computeBudget(plan, legs, (leg) => leg.id, () => "");
  const cibo = plan.scheduleItems.filter((item) => item.category === "cibo").reduce((sum, item) => sum + item.price, 0);
  assert.equal(budget.planned.ciboExtra, cibo);
  assert.equal(budget.spent.ciboExtra, dinner.price);
  assert.equal(budget.splitBalance, -dinner.price / 2);
});

test("refreshDerived non crea copie se nulla cambia", () => {
  const plan = seedPlan();
  assert.equal(refreshDerived(plan), plan);
  assert.ok(sameValue(refreshDerived(clone(plan)), plan));
});
