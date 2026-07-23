import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renderizza il planner Cina 2026", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Cina 2026 — Alberto &amp; Sofia<\/title>/i);
  assert.match(html, /Ogni giorno/);
  assert.match(html, /Arrivo a Pechino/);
  assert.match(html, /Partenza da Shanghai/);
  assert.match(html, /Giorno per giorno, ora per ora/);
  assert.match(html, /Nuova attività/);
  assert.match(html, /Gemini pianifica la giornata/);
  assert.match(html, /Arrivo a Pechino e transfer/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("mantiene Gemini esclusivamente lato server", async () => {
  const [client, route, envExample] = await Promise.all([
    readFile(new URL("../app/ChinaPlanner.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/gemini/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(client, /fetch\("\/api\/gemini"/);
  assert.match(client, /action:\s*"day-plan"/);
  assert.match(client, /scheduleItems/);
  assert.doesNotMatch(client, /x-goog-api-key|GEMINI_API_KEY/);
  assert.match(route, /process\.env\.GEMINI_API_KEY/);
  assert.match(route, /googleMaps/);
  assert.match(route, /googleSearch/);
  assert.match(route, /action === "day-plan"/);
  assert.equal(envExample.trim().split("\n").at(-1), "GEMINI_API_KEY=");
});

test("spiega chiaramente quando la chiave Gemini non è configurata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/gemini", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "activities", city: "Pechino", query: "Musei" }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 503);
  assert.match(await response.text(), /GEMINI_API_KEY/);
});
