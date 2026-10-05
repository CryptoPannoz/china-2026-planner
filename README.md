# China 2026 Planner

Planner condiviso del viaggio di Alberto e Sofia. Il sito è pubblicato
gratuitamente su GitHub Pages, mentre accesso e dati sono gestiti dal piano
gratuito Firebase Spark.

Permette di:

- modificare tappe e notti (le 17 notti tra i voli sono fisse) con la striscia dei giorni sempre visibile;
- vedere in **«Da sistemare»** i controlli automatici: notti senza hotel o con due hotel, hotel prenotati
  con date diverse dalla tappa, attività rimaste senza giornata, orari sovrapposti, tratte escluse;
- organizzare ogni giornata per orario (lista o vista a ore), spostare un blocco su un altro giorno e
  mandare in agenda le **attività clou** di ogni città nel primo orario libero;
- gestire gli hotel tappa per tappa: quelli ancora da prenotare seguono da soli le date della tappa;
- gestire le tratte tra città con orari, numero treno/volo e prenotazione (compaiono nel giorno giusto);
- registrare le **spese effettive con chi ha pagato**, confrontare previsto e speso per categoria e
  vedere il **bilancio stile Splitwise** tra Alberto e Sofia;
- inserire costi in euro o yuan con cambio modificabile;
- vedere il percorso sulla mappa (strade, satellite o rilievo) e **aggiungere tappe toccando la mappa**:
  il nome della città arriva da solo e la tappa va dove allunga meno il percorso;
- aprire luoghi in Google Maps, con nomi in cinese per il tassista;
- vedere chi ha modificato cosa e scaricare un backup JSON del piano;
- lavorare da computer e telefono anche offline: le modifiche si sincronizzano appena torna la rete.

Le attività in agenda sono agganciate alla **tappa e al giorno dentro la tappa**: se cambiano le notti o
l'ordine delle città, seguono la loro città invece di restare su una data vecchia.

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

- `lib/planner/` — logica pura, testata con `node --test`: `catalog.ts` (tappe, proposte, nomi
  cinesi, piano iniziale), `model.ts` (timeline, migrazioni dei salvataggi, unione con il cloud,
  operazioni sulle tappe, budget, controlli), `utils.ts` (date, soldi, link).
- `app/planner/` — interfaccia: `PlannerApp.tsx`, `usePlanSync.ts` (Firestore + copia locale),
  `sections/` (una sezione per scheda), mappa, griglia oraria, campi che salvano all'uscita.
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
