# China 2026 Planner

Planner condiviso del viaggio di Alberto e Sofia. Il sito è pubblicato
gratuitamente su GitHub Pages, mentre accesso e dati sono gestiti dal piano
gratuito Firebase Spark.

Permette di:

- modificare tappe, notti e trasporti;
- organizzare ogni giornata per orario;
- aggiungere o eliminare attività;
- inserire costi in euro oppure yuan;
- modificare il cambio yuan/euro;
- aggiungere e togliere liberamente voci di costo;
- sincronizzare agenda, budget, checklist e note tra computer e telefono;
- continuare a lavorare temporaneamente anche senza connessione.

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

## Pubblicazione

Il progetto usa l'export statico di Next.js. Il workflow
`.github/workflows/pages.yml` compila e pubblica automaticamente il branch
`main` su GitHub Pages:

<https://cryptopannoz.github.io/china-2026-planner/>

Il database Firestore resta nel progetto `china-2026-bebroggi`; GitHub Pages
non ospita né espone i dati del viaggio.
