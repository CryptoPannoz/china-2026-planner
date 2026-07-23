import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("esporta il planner come sito pubblico statico", async () => {
  const [html, config, page] = await Promise.all([
    source("out/index.html"),
    source("next.config.ts"),
    source("app/page.tsx"),
  ]);

  assert.match(html, /Cina 2026 — Alberto &amp; Sofia/);
  assert.match(html, /Ogni giorno/);
  assert.match(html, /Agenda giorno per giorno/);
  assert.match(config, /output:\s*"export"/);
  assert.match(config, /china-2026-planner/);
  assert.doesNotMatch(page, /redirect|cookies|login/i);
});

test("non contiene Gemini, Firebase, login o chiavi API", async () => {
  const files = await Promise.all([
    source("app/ChinaPlanner.tsx"),
    source("package.json"),
    source("README.md"),
    source("next.config.ts"),
  ]);
  const combined = files.join("\n");

  assert.doesNotMatch(combined, /gemini|firebase|GEMINI_API_KEY|\/api\/gemini|signInWith/i);
});

test("gestisce costi aggiungibili e rimovibili in euro e yuan", async () => {
  const planner = await source("app/ChinaPlanner.tsx");

  assert.match(planner, /type Currency = "EUR" \| "CNY"/);
  assert.match(planner, /Aggiungi e togli costi/);
  assert.match(planner, /removeCostEntry/);
  assert.match(planner, /cnyPerEuro/);
  assert.match(planner, /CNY ¥/);
});
