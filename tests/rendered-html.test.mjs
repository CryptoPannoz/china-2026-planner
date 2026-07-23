import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("protegge il planner con una sessione Firebase verificata sul server", async () => {
  const [page, login, admin] = await Promise.all([
    source("app/page.tsx"),
    source("app/login/LoginCard.tsx"),
    source("lib/firebase-admin.ts"),
  ]);

  assert.match(page, /verifyAllowedSessionCookie/);
  assert.match(page, /redirect\("\/login"\)/);
  assert.match(login, /signInWithPopup/);
  assert.match(login, /Continua con Google/);
  assert.match(admin, /bebroggi@gmail\.com/);
  assert.match(admin, /sofiakovaleva1998@gmail\.com/);
  assert.match(admin, /email_verified/);
  assert.match(admin, /verifySessionCookie\(sessionCookie,\s*true\)/);
});

test("protegge Gemini prima di leggere la chiave lato server", async () => {
  const [client, route, envExample] = await Promise.all([
    source("app/ChinaPlanner.tsx"),
    source("app/api/gemini/route.ts"),
    source(".env.example"),
  ]);

  assert.match(client, /fetch\("\/api\/gemini"/);
  assert.doesNotMatch(client, /x-goog-api-key|GEMINI_API_KEY/);
  assert.match(route, /verifyAllowedSessionCookie/);
  assert.ok(
    route.indexOf("verifyAllowedSessionCookie") <
      route.indexOf("process.env.GEMINI_API_KEY"),
  );
  assert.match(route, /googleMaps/);
  assert.match(route, /googleSearch/);
  assert.match(route, /action === "day-plan"/);
  assert.match(envExample, /^GEMINI_API_KEY=$/m);
  assert.doesNotMatch(envExample, /AIza/);
});

test("non contiene più collegamenti o login ChatGPT Sites", async () => {
  const [pkg, readme, layout] = await Promise.all([
    source("package.json"),
    source("README.md"),
    source("app/layout.tsx"),
  ]);

  assert.doesNotMatch(pkg, /vinext|wrangler|cloudflare/i);
  assert.doesNotMatch(readme, /chatgpt\.site|Sign in with ChatGPT/i);
  assert.match(layout, /index:\s*false/);
});
