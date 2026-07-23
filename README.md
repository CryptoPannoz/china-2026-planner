# China 2026 Planner

Planner pubblico e completamente statico del viaggio di Alberto e Sofia.

Permette di:

- modificare tappe, notti e trasporti;
- organizzare ogni giornata per orario;
- aggiungere o eliminare attività;
- inserire costi in euro oppure yuan;
- modificare il cambio yuan/euro;
- aggiungere e togliere liberamente voci di costo;
- salvare agenda, budget, checklist e note nel browser.

Non usa account, servizi esterni o chiavi API.

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
