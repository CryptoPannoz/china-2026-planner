# Studio tecnico: Gemini e mappe per la Cina

Aggiornato il 23 luglio 2026.

## Scelta mappa

Per l’uso reale in Cina continentale la scelta consigliata è **Amap / Gaode**:

- ogni attività, hotel e destinazione del planner apre una ricerca Amap senza richiedere una chiave;
- la mappa generale Leaflet + OpenStreetMap resta utile come panoramica dell’itinerario, ma non va considerata uno strumento di navigazione sul posto;
- per una futura ricerca integrata con selezione del luogo, coordinate e percorso serve la Web Service API di Amap e una relativa chiave;
- i luoghi andrebbero salvati con nome inglese, nome cinese, indirizzo, coordinate e link Amap.

La URI API ufficiale di Amap consente di aprire marker e navigazione sia da desktop sia da mobile, anche richiamando l’app:

- [Amap URI API — panoramica](https://lbs.amap.com/api/uri-api/summary)
- [Amap URI API — navigazione](https://lbs.amap.com/api/uri-api/guide/travel/route)
- [Amap Web Service — ricerca POI](https://lbs.amap.com/api/webservice/guide/api/search/)

### Evoluzione proposta

1. Fase attuale: link Amap automatico per ogni luogo; nessun costo e nessuna chiave.
2. Fase successiva: campo di ricerca Amap nel planner, risultati selezionabili, memorizzazione di coordinate e POI.
3. Ultima fase: indicazioni hotel → attività e confronto auto/mezzi pubblici/a piedi.

Una mappa Amap incorporata dentro GitHub Pages richiede una chiave Web JS e il
relativo codice di sicurezza. Per non pubblicare credenziali in chiaro, la
versione attuale usa OpenStreetMap come panoramica principale dell’intero
itinerario e la URI API ufficiale di Amap per i singoli hotel, attività,
trasporti e città. I luoghi si aprono realmente in Amap e l’app mobile viene
richiamata quando disponibile.

## Collegamenti WeChat e Alipay

Non esiste un collegamento universale sicuro che permetta a un normale sito web
di cercare liberamente qualsiasi attività dentro WeChat o Alipay. I Mini Program
usano identificativi e percorsi specifici del servizio.

Per questo il planner consente di incollare su hotel, attività e trasporti il
link effettivamente condiviso dal relativo Mini Program o esercente. Il pulsante
WeChat o Alipay appare soltanto quando è stato salvato un link valido `https`,
`weixin://`, `alipay://` o `alipays://`.

## Fattibilità Gemini

Gemini è fattibile, ma non va richiamato direttamente con una chiave inserita nel codice di GitHub Pages. La documentazione ufficiale avverte che una chiave nel client web è estraibile.

La soluzione adatta a questo progetto è **Firebase AI Logic + Gemini Developer API + App Check**:

- funziona anche con il piano Firebase Spark gratuito e con il free tier del Gemini Developer API;
- la chiave Gemini non viene inserita nel repository o nel browser: il proxy di Firebase la gestisce;
- App Check protegge l’endpoint dagli abusi;
- non richiede Cloud Functions, che porterebbero il progetto verso il piano Blaze.

Fonti ufficiali:

- [Firebase AI Logic — guida web](https://firebase.google.com/docs/ai-logic/get-started?platform=web)
- [Firebase AI Logic — prezzi](https://firebase.google.com/docs/ai-logic/pricing)
- [Firebase AI Logic — App Check](https://firebase.google.com/docs/ai-logic/app-check)
- [Google AI — sicurezza delle API key](https://ai.google.dev/gemini-api/docs/api-key)

### Funzione utile da implementare in seguito

Gemini dovrebbe proporre luoghi in formato strutturato (nome, motivo, durata, costo stimato, categoria e query Amap), senza scrivere subito nel viaggio. L’utente seleziona un risultato e solo allora il planner crea l’attività nel giorno e nell’orario scelti.

Prima dell’implementazione occorre:

1. attivare Firebase AI Logic scegliendo Gemini Developer API;
2. configurare e applicare App Check al dominio GitHub Pages;
3. scegliere un modello disponibile nel free tier;
4. imporre un limite di richieste per utente;
5. testare che i risultati restituiscano nomi utili anche in cinese.

Gemini non è stato riattivato in questa versione: non sono presenti chiavi Gemini né chiamate al modello.
