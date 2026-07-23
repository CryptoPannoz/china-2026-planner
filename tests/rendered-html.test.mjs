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
  assert.match(planner, /Aggiungi e togli costi/);
  assert.match(planner, /removeCostEntry/);
  assert.match(planner, /cnyPerEuro/);
  assert.match(planner, /CNY ¥/);
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
  assert.match(rules, /change-log/);
  assert.match(rules, /allow read, create: if isPlannerMember/);
  assert.match(rules, /allow update, delete: if false/);
});
