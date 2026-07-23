# China 2026 Planner

Planner privato del viaggio di Alberto e Sofia: itinerario, agenda per giorno e
per ora, trasporti, budget, checklist, foto e ricerca assistita da Gemini.

## Accesso

Il sito usa Google Sign-In tramite Firebase Authentication. La whitelist viene
verificata sul server e consente soltanto:

- `bebroggi@gmail.com`
- `sofiakovaleva1998@gmail.com`

Anche l'API Gemini richiede una sessione Firebase autorizzata.

## Sviluppo locale

Richiede Node.js `>=22.13.0`.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Per provare il login in locale, inserire in `.env.local` la configurazione della
web app Firebase. `GEMINI_API_KEY` resta sempre una variabile server-side.

## Pubblicazione

Il progetto è un'app Next.js standard destinata a Firebase App Hosting e
collegata al branch `main` del repository GitHub. `apphosting.yaml` limita le
istanze e legge `GEMINI_API_KEY` da Cloud Secret Manager.

In Firebase:

1. associare una web app al backend di App Hosting;
2. abilitare il provider Google in Authentication;
3. aggiungere il dominio del backend tra i domini autorizzati;
4. salvare `GEMINI_API_KEY` come secret di produzione.

Ogni push su `main` può avviare automaticamente una nuova pubblicazione.
