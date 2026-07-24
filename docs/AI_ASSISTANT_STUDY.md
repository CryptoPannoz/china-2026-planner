# Studio: assistente AI nel planner (Claude vs Gemini)

Aggiornato il 24 luglio 2026. Completa lo studio [GEMINI_AND_MAPS_STUDY.md](GEMINI_AND_MAPS_STUDY.md).

## Cosa deve fare il bot

Un assistente dentro il planner ("chiedi al viaggio") che:

1. **propone, non scrive**: restituisce suggerimenti strutturati (nome, perché, durata, costo stimato per 2, categoria, query Amap, giorno consigliato) e l'app li inserisce in agenda solo quando Alberto o Sofia li approvano;
2. **rispetta i vincoli**: riceve nel prompt il piano corrente (tappe, notti, giorni liberi) e sa che 17 nov → 4 dic sono fissi, quindi propone solo cose che stanno nel calendario;
3. **conosce il contesto**: novembre/dicembre in Cina, budget della coppia, attività già in agenda (per non ripetere).

Il punto 2 ora è facile: con il vincolo delle 17 notti nel codice, il bot può ricevere `remainingNights`, i giorni ancora liberi per città, e proporre solo dentro quei limiti.

## Vincolo di architettura

Il sito è **statico su GitHub Pages** (nessun server) con Firebase **Spark** (niente Cloud Functions). Qualsiasi chiave API messa nel codice del sito è pubblica ed estraibile. Quindi servono soluzioni dove la chiave sta altrove.

## Opzione A — Gemini ("Gianni") via Firebase AI Logic · consigliata per partire

Già studiata in dettaglio nell'altro documento. In sintesi:

- **Zero server e zero costi**: funziona con Spark + free tier del Gemini Developer API; il proxy di Firebase custodisce la chiave, App Check protegge dagli abusi limitando le chiamate al dominio GitHub Pages.
- **Integrazione naturale**: l'app usa già Firebase Auth e Firestore; l'SDK `firebase/ai` si aggiunge al bundle esistente.
- **Limiti**: modelli Gemini del free tier con quote giornaliere; qualità buona per suggerimenti turistici, meno controllo sul formato (comunque supporta output JSON con schema).

Passi: attivare AI Logic sul progetto `china-2026-bebroggi` scegliendo Gemini Developer API → configurare App Check (reCAPTCHA v3 sul dominio `cryptopannoz.github.io`) → aggiungere `getAI()`/`getGenerativeModel()` in `lib/firebase.ts` → UI dei suggerimenti.

## Opzione B — Claude via API con proxy Cloudflare Worker

Claude non può essere chiamato direttamente dal browser (la chiave sarebbe pubblica), ma basta un **Cloudflare Worker sul free tier** (100.000 richieste/giorno) che fa da proxy:

```
Browser (GitHub Pages) ──ID token Firebase──▶ Worker ──ANTHROPIC_API_KEY (secret)──▶ API Claude
```

Il Worker: verifica l'ID token Firebase (accetta solo bebroggi@ e sofiakovaleva1998@), applica un rate limit, inoltra la richiesta e restituisce il JSON. La chiave sta nei secret del Worker, mai nel repo. Nel workspace c'è già esperienza con Workers (repo `china-2026`).

Esempio di chiamata nel Worker (SDK ufficiale, output strutturato — così l'app riceve suggerimenti già in formato utilizzabile):

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const response = await client.messages.parse({
  model: "claude-opus-4-8",
  max_tokens: 16000,
  system: "Sei l'assistente di viaggio del planner Cina 2026 di Alberto e Sofia. Le date sono fisse: arrivo 17 novembre, partenza 4 dicembre. Proponi solo attività compatibili con il piano e la stagione.",
  messages: [{ role: "user", content: promptConPianoCorrente }],
  output_config: { format: { type: "json_schema", schema: SUGGESTIONS_SCHEMA } },
});
```

**Modelli e prezzi** (per milione di token, luglio 2026):

| Modello | Input | Output | Note |
|---|---|---|---|
| `claude-opus-4-8` | $5 | $25 | Il consigliato: qualità massima dei consigli |
| `claude-sonnet-5` | $3 ($2 intro fino al 31/8/26) | $15 ($10 intro) | Ottimo compromesso |
| `claude-haiku-4-5` | $1 | $5 | Il più economico, adatto a suggerimenti brevi |

Ordine di grandezza dei costi reali: una richiesta di suggerimenti (~2.000 token in, ~1.000 out) con Opus 4.8 costa ~3,5 centesimi; con un uso da pianificazione di coppia (qualche decina di richieste al mese) si resta sotto 1–2 €/mese.

## Confronto e raccomandazione

| | Gemini (A) | Claude (B) |
|---|---|---|
| Costo | 0 € (free tier) | pochi €/mese + 5 min di setup billing Anthropic |
| Infrastruttura in più | nessuna | 1 Cloudflare Worker (free) |
| Sicurezza chiave | proxy Firebase + App Check | secret del Worker + verifica token Firebase |
| Qualità consigli di viaggio | buona | molto alta, ottimo output strutturato |
| Aderenza allo stack attuale | perfetta (già Firebase) | richiede un pezzo nuovo |

**Raccomandazione**: partire con **Gemini/AI Logic** (opzione A) perché non introduce infrastruttura né costi, e il flusso "proposta strutturata → approvazione → inserimento in agenda" è identico per entrambi. Se la qualità dei suggerimenti non basta, si aggiunge il Worker e si passa a Claude cambiando solo l'endpoint chiamato dall'app: conviene quindi isolare da subito la chiamata AI in un modulo `lib/assistant.ts` con un'interfaccia unica.

## Prossimi passi concreti

1. Definire lo schema dei suggerimenti (`SUGGESTIONS_SCHEMA`) e il prompt che serializza il piano corrente (tappe, notti, giorni liberi, attività già in agenda, budget residuo).
2. Costruire la UI: pannello "Chiedi all'assistente" nell'itinerario, con card-suggerimento e bottone "+ Metti in agenda" che riusa `scheduleActivity`.
3. Attivare Firebase AI Logic + App Check (opzione A) e collegare il modulo.
4. (Eventuale fase 2) Worker Cloudflare + chiave Anthropic per passare a Claude.
