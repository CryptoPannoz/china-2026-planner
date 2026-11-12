# China 2026 Planner

Planner condiviso del viaggio di Alberto e Sofia. Il sito è pubblicato
gratuitamente su GitHub Pages, mentre accesso e dati sono gestiti dal piano
gratuito Firebase Spark.

Dal 12 novembre 2026 è un **wallet e scheduler di viaggio** installabile sul telefono (web app, funziona
anche offline), con quattro schede:

- **Viaggio** — giorno per giorno dal 16 nov al 4 dic: voli, treni, check-in/out, attività e promemoria,
  con il meteo medio di ogni tappa; prima della partenza il conto alla rovescia.
- **Wallet** — voli, treni (carrozza e posti), hotel con «🚕 Mostra in cinese», attività, assicurazione e
  documenti, con i PDF delle conferme in Drive.
- **Da fare** — cose da fare prima di partire divise per data e per persona (spunte sincronizzate) e la
  valigia con il meteo storico delle tappe (spunte solo sul telefono).
- **Info** — conti tra Alberto e Sofia con le spese in viaggio, emergenze, frasi, app, consigli per città,
  note condivise.

Numeri di prenotazione, indirizzi, telefoni e note restano nel documento Firestore (dopo il login); nel
codice pubblico (`lib/trip/data.ts`) ci sono solo orari, link ai PDF privati in Drive, meteo e liste.

L'accesso con Google è consentito soltanto a:

- `bebroggi@gmail.com`
- `sofiakovaleva1998@gmail.com`

Le regole Firestore applicano la stessa lista anche direttamente sul database.
La chiave web Firebase presente nel client identifica il progetto e non è un
segreto; la protezione dei dati dipende da Authentication e dalle regole
`firestore.rules`.

## Sviluppo locale

Richiede Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Per provare l'interfaccia senza login e senza toccare i dati veri apri
<http://localhost:3000/?demo> (solo in sviluppo: i dati restano nel browser).

```bash
npm test          # logica del planner (date, migrazioni, sincronizzazione, budget)
npm run lint
npm run test:build  # compila il sito statico e lo verifica
```

### Struttura

- `lib/planner/` — formato dei dati, migrazioni e unione con il cloud, testati con `node --test`.
- `lib/trip/data.ts` — voli, posti dei treni, link Drive, promemoria, meteo, cose da fare, valigia.
- `app/trip/` — interfaccia: `TripApp.tsx` e una scheda per file; `usePlanSync.ts` (Firestore + copia locale).
- `public/manifest.webmanifest` e `public/sw.js` — installazione sul telefono e uso offline.
- `app/ChinaPlanner.tsx` — accesso con Google.

## Pubblicazione

Il progetto usa l'export statico di Next.js. Il workflow
`.github/workflows/pages.yml` compila e pubblica automaticamente il branch
`main` su GitHub Pages:

<https://cryptopannoz.github.io/china-2026-planner/>

Il database Firestore resta nel progetto `china-2026-bebroggi`; GitHub Pages
non ospita né espone i dati del viaggio.

Lo studio per l’eventuale ritorno di Gemini e per l’evoluzione della mappa è in
[`docs/GEMINI_AND_MAPS_STUDY.md`](docs/GEMINI_AND_MAPS_STUDY.md).
