import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("esporta il planner come sito pubblico statico", async () => {
  const [html, config, page, planner] = await Promise.all([
    source("out/index.html"),
    source("next.config.ts"),
    source("app/page.tsx"),
    source("app/ChinaPlanner.tsx"),
  ]);

  assert.match(html, /Cina 2026 — Alberto &amp; Sofia/);
  assert.match(html, /Caricamento del planner/);
  assert.match(planner, /Agenda giorno per giorno/);
  assert.match(config, /output:\s*"export"/);
  assert.match(config, /china-2026-planner/);
  assert.doesNotMatch(page, /redirect|cookies|login/i);
});

test("non contiene Gemini o API server", async () => {
  const files = await Promise.all([
    source("app/ChinaPlanner.tsx"),
    source("next.config.ts"),
  ]);
  const combined = files.join("\n");

  assert.doesNotMatch(combined, /gemini|GEMINI_API_KEY|\/api\/gemini/i);
});

test("sincronizza il piano con accesso limitato alle due email", async () => {
  const [planner, rules, firebaseClient] = await Promise.all([
    source("app/ChinaPlanner.tsx"),
    source("firestore.rules"),
    source("lib/firebase.ts"),
  ]);

  assert.match(planner, /signInWithPopup/);
  assert.match(planner, /onSnapshot/);
  assert.match(planner, /setDoc/);
  assert.match(planner, /Tutto sincronizzato/);
  assert.match(firebaseClient, /persistentMultipleTabManager/);
  assert.match(rules, /bebroggi@gmail\.com/);
  assert.match(rules, /sofiakovaleva1998@gmail\.com/);
  assert.match(rules, /allow read, write: if isPlannerMember/);
  assert.match(rules, /allow read, write: if false/);
});

test("gestisce costi aggiungibili e rimovibili in euro e yuan", async () => {
  const planner = await source("app/ChinaPlanner.tsx");

  assert.match(planner, /type Currency = "EUR" \| "CNY"/);
  assert.match(planner, /Voci di budget pianificate/);
  assert.match(planner, /removeCostEntry/);
  assert.match(planner, /cnyPerEuro/);
  assert.match(planner, /CNY ¥/);
});

test("registra spese giornaliere con bilancio Alberto/Sofia", async () => {
  const planner = await source("app/ChinaPlanner.tsx");

  assert.match(planner, /type Payer = "alberto" \| "sofia"/);
  assert.match(planner, /type Expense = \{/);
  assert.match(planner, /addExpense/);
  assert.match(planner, /removeExpense/);
  assert.match(planner, /Spese effettive del giorno/);
  assert.match(planner, /splitBalance/);
  assert.match(planner, /Bilancio Alberto & Sofia/);
  assert.match(planner, /Scostamento per categoria/);
  assert.match(planner, /budgetComparison/);
});

test("mostra agenda per città e attività clou nell'itinerario", async () => {
  const planner = await source("app/ChinaPlanner.tsx");

  assert.match(planner, /Attività clou/);
  assert.match(planner, /addClouActivity/);
  assert.match(planner, /removeClouActivity/);
  assert.match(planner, /webSearchUrl/);
  assert.match(planner, /selectedStopDays/);
  assert.match(planner, /trip-strip/);
  assert.match(planner, /openDayInAgenda/);
});

test("propone varianti di tappe aggiungibili o scartabili", async () => {
  const planner = await source("app/ChinaPlanner.tsx");

  assert.match(planner, /SUGGESTED_STOPS/);
  assert.match(planner, /addSuggestedStop/);
  assert.match(planner, /dismissSuggestion/);
  assert.match(planner, /restoreSuggestions/);
  assert.match(planner, /dismissedSuggestions/);
  assert.match(planner, /Città da valutare/);
  assert.match(planner, /id: "chongqing"/);
  assert.match(planner, /id: "guilin"/);
  assert.match(planner, /id: "lijiang"/);
  assert.match(planner, /id: "dali"/);
  assert.match(planner, /id: "emeishan"/);
  assert.match(planner, /id: "xiamen"/);
  assert.match(planner, /id: "hangzhou"/);
  assert.match(planner, /id: "huangshan"/);
});

test("struttura agenda, mappe e registro condiviso", async () => {
  const [planner, rules] = await Promise.all([
    source("app/ChinaPlanner.tsx"),
    source("firestore.rules"),
  ]);

  assert.match(planner, /type ScheduleKind = "activity" \| "transport" \| "hotel"/);
  assert.match(planner, /Crea categoria/);
  assert.match(planner, /Aggiungi trasferimento/);
  assert.match(planner, /Apri in Amap/);
  assert.match(planner, /Ultimo autosalvataggio/);
  assert.match(planner, /Chi ha modificato cosa/);
  assert.match(planner, /compressCoverPhoto/);
  assert.match(planner, /type HotelStay/);
  assert.match(planner, /Hotel e soggiorni/);
  assert.match(planner, /Data check-in/);
  assert.match(planner, /Data check-out/);
  assert.match(planner, /selectedDayHotels/);
  assert.doesNotMatch(planner, /Link condiviso WeChat/);
  assert.doesNotMatch(planner, /Link condiviso Alipay/);
  assert.match(planner, /amapStopUrl/);
  assert.match(planner, /Panoramica itinerario · OpenStreetMap/);
  assert.match(planner, /La rotta completa, tappa per tappa/);
  assert.match(planner, /fitBounds/);
  assert.doesNotMatch(planner, /Mappa principale · Amap/);
  assert.doesNotMatch(planner, /<option value="hotel">Hotel \/ notte<\/option>/);
  assert.match(rules, /change-log/);
  assert.match(rules, /allow read, create: if isPlannerMember/);
  assert.match(rules, /allow update, delete: if false/);
});

test("include la nuova copertina fotografica", async () => {
  const [planner, image] = await Promise.all([
    source("app/ChinaPlanner.tsx"),
    readFile(new URL("../public/china-hero-couple.jpg", import.meta.url)),
  ]);

  assert.match(planner, /china-hero-couple\.jpg/);
  assert.ok(image.byteLength > 100_000);
});

test("ripristina una sola volta l’itinerario completo nei piani già salvati", async () => {
  const planner = await source("app/ChinaPlanner.tsx");

  assert.match(planner, /ITINERARY_SCHEMA_VERSION = 2/);
  assert.match(planner, /mergeStopsWithDefaults/);
  assert.match(planner, /mergeById\(initialSchedule\.map\(normalizeScheduleItem\), normalizedSchedule\)/);
  assert.match(planner, /action: "Itinerario ripristinato"/);
  assert.match(planner, /id: "d01-arrival"/);
  assert.match(planner, /id: "d17-tower"/);
  assert.match(planner, /id: "beijing"/);
  assert.match(planner, /id: "shanghai"/);
});
