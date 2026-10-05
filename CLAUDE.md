# China 2026 Planner — istruzioni per Claude

Planner condiviso del viaggio in Cina di Alberto e Sofia (17 nov → 4 dic 2026). Next.js 16 con
export statico su GitHub Pages; dati in Firestore (progetto `china-2026-bebroggi`, documento
`travel-plans/china-2026` + sottocollezione `change-log`). Accesso Google limitato alle due email
(anche in `firestore.rules`).

## Deploy
- Push su `origin/main` → GitHub Actions (`.github/workflows/pages.yml`): lint, `npm test`, build, Pages.
- Le regole Firestore non passano dalla CI: vanno pubblicate a mano con la CLI Firebase.

## Lavorare sul codice
- Logica in `lib/planner/` (pura, importi con estensione `.ts` per `node --test`); UI in `app/planner/`.
- Prova locale senza login: `npm run dev` e apri `/?demo` (dati solo nel browser, chiave `china-planner-demo`).
- `npm test` (logica) e `npm run lint` devono passare; `npm run test:build` verifica l'export.

## Dati: regole da rispettare
- Il documento è **condiviso e vivo**: ogni cambio di formato va in `migratePlan` (`lib/planner/model.ts`),
  alzando `PLAN_VERSION`, e deve essere **idempotente** (una vecchia app può riscrivere la versione precedente).
- I blocchi d'agenda si collocano con `stopId` + `day` (giorno dentro la tappa); `date` è derivata da
  `refreshDerived` e salvata solo per compatibilità. Gli hotel con `followStop` seguono le date della tappa.
- Il salvataggio scrive solo le chiavi cambiate (`setDoc` con `merge`) e unisce le modifiche remote con
  `mergePlan` (unione a tre vie elemento per elemento): non sostituire con un `setDoc` dell'intero piano.
- Prima della migrazione v4 il primo dispositivo salva una copia del documento in localStorage
  (`china-planner-backup-before-v4`), scaricabile da «Checklist & note».
