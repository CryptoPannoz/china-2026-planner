// Controlli sul sito compilato (`npm run build` prima): export statico, accesso e regole Firestore.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function appSources() {
  const files = ["app/ChinaPlanner.tsx", "lib/firebase.ts"];
  for (const dir of ["app/planner", "app/planner/sections", "lib/planner"]) {
    const entries = await readdir(new URL(`../${dir}`, import.meta.url));
    files.push(...entries.filter((name) => /\.tsx?$/.test(name)).map((name) => `${dir}/${name}`));
  }
  return (await Promise.all(files.map(source))).join("\n");
}

test("esporta il planner come sito statico per GitHub Pages", async () => {
  const [html, config, page] = await Promise.all([source("out/index.html"), source("next.config.ts"), source("app/page.tsx")]);
  assert.match(html, /Cina 2026 — Alberto &amp; Sofia/);
  assert.match(html, /Caricamento del planner/);
  assert.match(config, /output:\s*"export"/);
  assert.match(config, /china-2026-planner/);
  assert.doesNotMatch(page, /redirect|cookies|login/i);
});

test("la modalità prova senza login esiste solo in sviluppo", async () => {
  const planner = await source("app/ChinaPlanner.tsx");
  assert.match(planner, /process\.env\.NODE_ENV !== "production"/);
});

test("non contiene Gemini o API server", async () => {
  assert.doesNotMatch(await appSources(), /gemini|GEMINI_API_KEY|\/api\/gemini/i);
});

test("accesso e dati limitati alle due email, anche nelle regole Firestore", async () => {
  const [code, rules] = await Promise.all([appSources(), source("firestore.rules")]);
  assert.match(code, /signInWithPopup/);
  assert.match(code, /persistentMultipleTabManager/);
  assert.match(code, /bebroggi@gmail\.com/);
  assert.match(code, /sofiakovaleva1998@gmail\.com/);
  assert.match(rules, /bebroggi@gmail\.com/);
  assert.match(rules, /sofiakovaleva1998@gmail\.com/);
  assert.match(rules, /allow read, write: if isPlannerMember/);
  assert.match(rules, /allow read, write: if false/);
  assert.match(rules, /allow update, delete: if false/);
});

test("usa Google Maps e OpenStreetMap, non Amap", async () => {
  const code = await appSources();
  assert.match(code, /google\.com\/maps\/search/);
  assert.doesNotMatch(code, /amap/i);
});

test("include la copertina fotografica", async () => {
  const image = await readFile(new URL("../public/china-hero-couple.jpg", import.meta.url));
  assert.ok(image.byteLength > 100_000);
});
