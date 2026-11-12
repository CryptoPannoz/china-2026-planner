// ---------------------------------------------------------------------------
// Wallet e scheduler del viaggio: solo dati pubblicabili (il repository è pubblico).
// Numeri di prenotazione, indirizzi, telefoni e note restano nel documento Firestore e
// arrivano dall'app dopo il login. Qui: orari, link ai PDF privati in Drive (aprono solo
// per Alberto e Sofia), meteo, cose da fare e valigia.
// ---------------------------------------------------------------------------

export const TRIP_START = "2026-11-16";
export const TRIP_END = "2026-12-04";
export const DEPARTURE_AT = "2026-11-16T16:55:00+01:00";

export type Who = "entrambi" | "alberto" | "sofia";
export type DocLink = { label: string; id: string; kind?: "file" | "folder" | "doc" };

export function driveUrl(link: DocLink) {
  if (link.kind === "folder") return `https://drive.google.com/drive/folders/${link.id}`;
  if (link.kind === "doc") return `https://docs.google.com/document/d/${link.id}/edit`;
  return `https://drive.google.com/file/d/${link.id}/view`;
}

export const DRIVE_FOLDER: DocLink = { label: "Cartella Drive", id: "1--RqtVedjckDdzXzRmN7JSzrtpSSNjHw", kind: "folder" };
export const DRIVE_SUMMARY: DocLink = { label: "Riepilogo prenotazioni", id: "1kQOXPxHw4LD9AoprI5AugeuLngwiofxrnBqRAhZFCHA", kind: "doc" };

/** PDF delle conferme in Drive, per tratta (id della tratta), hotel (id della tappa) o voce. */
export const DOCS: Record<string, DocLink[]> = {
  "flights": [
    { label: "Itinerario", id: "1uvDqAeQiK8yYZGbY-uGEdCeaOpwYp3U4" },
    { label: "Itinerario EN", id: "1Dezn_pW8LNAINvBhOPuuUPAl25xwgulQ" },
    { label: "Ricevuta", id: "1Wcw-w_Rb3uWbwynN8xSLktEdnIwzWnOT" },
  ],
  "leg:beijing-xian": [{ label: "Ricevuta", id: "1HbduEXyQTv5XhCQYykCdlePKyS_rkcbE" }],
  "leg:zhangjiajie-shanghai": [
    { label: "E-itinerary", id: "128dAdPPg9EFWmcE1ZZighXFp8tOCkrIO" },
    { label: "Ricevuta", id: "1ghMfmDMYXAYZZuAEvzwEsJTing37gHli" },
  ],
  "hotel:beijing": [
    { label: "Voucher check-in", id: "1DdEExHEd3aYkRodyC2VkHFtHofGnQCym" },
    { label: "Voucher EN", id: "1v50jjBZwOw1ye9-Oxjl4EY5UUv9BSio-" },
    { label: "Ricevuta", id: "1s7WTK6KDWelPktyEXggQsCy47EIcUCLX" },
  ],
  "hotel:xian": [
    { label: "Voucher check-in", id: "11sVYggeIug_4BWPECeDMmmUzJvLBwnZB" },
    { label: "Voucher EN", id: "16X-F6oWObj7pOMIp7YBV4ugZmeOo6IYy" },
    { label: "Ricevuta", id: "10yyq7VSUoYnntTos5vhE0YRNhemo_hQK" },
  ],
  "hotel:chengdu": [
    { label: "Voucher check-in", id: "1xbuCWnxvVpLGUH4xCzsUOTnPmSKPqK-1" },
    { label: "Voucher EN", id: "1ad7AQufZUMikRthqkPeYV_bjdBPF7Jbt" },
    { label: "Ricevuta", id: "1YnWcA8LPBUL4H4Q-ng_kQCWfGFYxv9pO" },
  ],
  "hotel:chongqing": [
    { label: "Voucher check-in", id: "1VB5Pcha23BnlR9_jipYKFfziBH-zN9he" },
    { label: "Voucher EN", id: "1JgWkDRuh1X2I_U-LaXmH4UT4t8exb8D2" },
    { label: "Ricevuta", id: "1Ibs17vf7cFoA2d7leM428AJwJtUGqtBY" },
  ],
  "hotel:zhangjiajie": [
    { label: "Voucher check-in", id: "19tySGb_wHlJ7dkk6bh5fYrc70lluDe3G" },
    { label: "Voucher EN", id: "16rxRND9CDy0eGjGZLyRQ9JeFy1Xo5Np7" },
    { label: "Ricevuta", id: "1iUZyja4geyjztHZuRR1ASuyD-pJEfX6H" },
  ],
  "hotel:shanghai": [
    { label: "Voucher check-in", id: "1P5NsbT4zrhRgllOzl86L3_ppgsvIsVko" },
    { label: "Voucher EN", id: "1Nqm5z8yK3Ypb_TwYmG_x407qzdEfgcGU" },
    { label: "Ricevuta", id: "17dmhPtNyhIXjkz1yi_seTNhekxgloybE" },
  ],
  "forbidden-city": [{ label: "Foto del punto d'incontro", id: "1W6_NWmRlwKihhprFv8EXQXwWur6erRAq" }],
  "insurance": [{ label: "Condizioni AXA", id: "1e0xz2asj66c-HwUIbA96il5is6okahU_" }],
  "documents": [
    DRIVE_FOLDER,
    DRIVE_SUMMARY,
    { label: "Passaporto Sofia (PDF)", id: "1OBGsg7TQkfv2000rJYB5fuUxxNousjF5" },
    { label: "Mappa per Organic Maps (.kml)", id: "1Pu7uT1o_dXCD4TBQF3cEUvRVhcyq1gMl" },
  ],
};

/** Carrozza, posti e varco dei treni già emessi (dalle mail di Trip.com). */
export const TRAIN_SEATS: Record<string, { car: string; seats: string; gate?: string; issued: string }> = {
  "beijing-xian": { car: "11", seats: "1C Alberto · 1D Sofia", gate: "检票口 10–11", issued: "emessi il 6 nov" },
  "xian-chengdu": { car: "3", seats: "17A Alberto · 17B Sofia", gate: "23B", issued: "emessi il 9 nov" },
  "chengdu-chongqing": { car: "5", seats: "11B Alberto · 11C Sofia", gate: "A26", issued: "emessi l'11 nov" },
};

/** Voli intercontinentali: numeri e orari (ora locale). Prenotazione e PNR sono nei PDF. */
export type FlightSegment = { code: string; airline: string; from: string; to: string; dep: string; arr: string; date: string; arrDate?: string };
export const FLIGHTS: Array<{ id: string; title: string; date: string; segments: FlightSegment[]; tips: string[] }> = [
  {
    id: "outbound",
    title: "Venezia → Pechino",
    date: "2026-11-16",
    segments: [
      { code: "EN1927", airline: "Air Dolomiti", from: "Venezia VCE", to: "Monaco MUC T2", dep: "16:55", arr: "17:55", date: "2026-11-16" },
      { code: "LH722", airline: "Lufthansa", from: "Monaco MUC T2", to: "Pechino PEK T3", dep: "19:15", arr: "12:25", date: "2026-11-16", arrDate: "2026-11-17" },
    ],
    tips: [
      "A Marco Polo entro le 14:55. A Monaco 1h20 per il cambio, con il controllo passaporti in uscita da Schengen: niente soste.",
      "Bagaglio a testa: 1 da stiva 23 kg, 1 a mano 55×40×23 + 1 oggetto personale, a mano max 8 kg in tutto.",
      "Check-in online dalle 17:55 di domenica 15 (23 ore prima).",
    ],
  },
  {
    id: "return",
    title: "Shanghai → Venezia",
    date: "2026-12-04",
    segments: [
      { code: "LX189", airline: "SWISS", from: "Shanghai PVG T2", to: "Zurigo ZRH", dep: "09:40", arr: "16:10", date: "2026-12-04" },
      { code: "LX1664", airline: "SWISS", from: "Zurigo ZRH", to: "Venezia VCE", dep: "17:20", arr: "18:25", date: "2026-12-04" },
    ],
    tips: [
      "Pudong Terminal 2. In aeroporto alle 06:40: DiDi dal Gefii verso le 5:30 (prenotarlo la sera prima).",
      "Check-in online dalle 10:40 di giovedì 3 dicembre.",
      "Power bank nel bagaglio a mano, mai in stiva.",
    ],
  },
];

/** Promemoria del viaggio senza dati privati: compaiono nel giorno giusto dello scheduler. */
export const REMINDERS: Array<{ date: string; time: string; title: string; detail?: string }> = [
  { date: "2026-11-16", time: "14:55", title: "In aeroporto a Venezia", detail: "Volo alle 16:55. Passaporti, carte fisiche, power bank nel bagaglio a mano." },
  { date: "2026-11-17", time: "13:00", title: "Prima ora in Cina", detail: "eSIM accesa, prova WhatsApp e Google; Alipay aperto (la carta è ancora collegata?); QR «Transport» per la metro di Pechino. Foto della pagina col timbro d'ingresso." },
  { date: "2026-11-18", time: "11:20", title: "Ritrovo Città Proibita", detail: "Casa da tè Lao She, bandiera con il panda. Metro linea 2 fino a Qianmen, uscita C, poi 300 m. Passaporti! Non scendere a Tian'anmen Est/Ovest." },
  { date: "2026-11-20", time: "13:05", title: "In stazione a Beijing West", detail: "Un'ora prima del G367: controlli di sicurezza e passaporto." },
  { date: "2026-11-26", time: "10:00", title: "Biglietto Tianmen Shan tramite la guesthouse", detail: "Sconto di ¥20 se prenotato 2 giorni prima. In cima ~0°: strati, guanti, scarpe che non scivolano." },
  { date: "2026-11-28", time: "18:00", title: "Telefonare all'host di Shanghai", detail: "Serve il codice del self check-in (dalle 15:00 del 29). Numero nella scheda hotel." },
  { date: "2026-11-29", time: "09:30", title: "Partire per l'aeroporto di Zhangjiajie", detail: "Volo FM9342 alle 11:50 dal T2 di Hehua (DYG)." },
  { date: "2026-12-03", time: "20:00", title: "Preparare il rientro", detail: "Check-in online SWISS, DiDi prenotato per le 5:30, valigia sotto i 23 kg." },
  { date: "2026-12-04", time: "05:30", title: "DiDi per Pudong T2", detail: "In aeroporto alle 06:40." },
];

// ---------------------------------------------------------------------------
// Meteo: medie 2015–2025 (Open-Meteo, dati ERA5) sui giorni esatti di ogni tappa
// ---------------------------------------------------------------------------

export const WEATHER: Array<{ stopId: string; city: string; dates: string; max: number; min: number; low: number; rain: number; note: string }> = [
  { stopId: "beijing", city: "Pechino", dates: "17–20 nov", max: 9, min: 0, low: -6, rain: 11, note: "Secco e ventoso, sotto zero di notte. Previsioni attuali: 6–11° di giorno, fino a −2° di notte." },
  { stopId: "xian", city: "Xi'an", dates: "20–23 nov", max: 11, min: 2, low: -5, rain: 27, note: "Freddo al mattino, sole di giorno. Aria spesso inquinata: KN95." },
  { stopId: "chengdu", city: "Chengdu", dates: "23–25 nov", max: 14, min: 7, low: 2, rain: 9, note: "Cielo grigio e umido, poca pioggia vera." },
  { stopId: "chongqing", city: "Chongqing", dates: "25–27 nov", max: 15, min: 9, low: 3, rain: 27, note: "Nebbia e pioviggine; tante scale: scarpe comode." },
  { stopId: "zhangjiajie", city: "Zhangjiajie", dates: "27–29 nov", max: 15, min: 7, low: 2, rain: 36, note: "La tappa più piovosa. In cima al Tianmen (1.500 m) 7° di giorno e 0° di notte, a volte ghiaccio." },
  { stopId: "shanghai", city: "Shanghai", dates: "29 nov–4 dic", max: 14, min: 6, low: -1, rain: 23, note: "Umido e ventoso, si sente più freddo di quanto dica il termometro." },
];

// ---------------------------------------------------------------------------
// Cose da fare: lo stato (fatto / non serve) si salva in `extraChecklist` del piano condiviso.
// Gli id `prep-*` e `check-*` esistono già nel piano; gli id `go-*` si aggiungono alla prima spunta.
// ---------------------------------------------------------------------------

export type TodoWhen = "subito" | "weekend" | "partenza" | "cina";
export const TODO_WHEN: Array<{ id: TodoWhen; title: string; subtitle: string }> = [
  { id: "subito", title: "Subito · entro venerdì 13", subtitle: "Le cose che chiedono tempo o una banca aperta" },
  { id: "weekend", title: "Weekend · sabato 14 e domenica 15", subtitle: "App, offline, valigia" },
  { id: "partenza", title: "Lunedì 16 · si parte", subtitle: "Volo alle 16:55 da Venezia" },
  { id: "cina", title: "In Cina", subtitle: "Da fare sul posto, con la data" },
];

export type Todo = { id: string; when: TodoWhen; who: Who; label: string; hint?: string; links?: Array<{ label: string; url: string }> };

export const TODOS: Todo[] = [
  // Subito
  { id: "check-mvz8hd8n-ic6h2", when: "subito", who: "alberto", label: "Venerdì 13: controllare in Trip.com che il treno Chongqing → Zhangjiajie (G2321) risulti emesso", hint: "Trip.com lo compra alle 11:00 ora cinese (le 4:00 in Italia) e manda l'esito per mail. Gli altri tre treni sono già emessi, con carrozza e posti (vedi Wallet). Se va in lista d'attesa niente panico: per il G2241 è passato a «emesso» in un minuto." },
  { id: "go-zjj-sofia", when: "subito", who: "alberto", label: "Aggiungere Sofia alla prenotazione di Zhangjiajie dall'app Trip.com", hint: "Sulla prenotazione della guesthouse c'è solo Alberto: in Cina l'hotel registra ogni ospite col passaporto." },
  { id: "go-sofia-permesso", when: "subito", who: "sofia", label: "Permesso di soggiorno valido, in borsa insieme al passaporto", hint: "Si esce da Schengen a Monaco e si rientra a Zurigo: con il passaporto serve il titolo di soggiorno. Per la Cina niente visto: esenzione di 30 giorni valida fino al 31/12/2027 (il viaggio ne dura 18)." },
  { id: "prep-esim-buy", when: "subito", who: "entrambi", label: "Comprare l'eSIM per la Cina (consiglio: Nomad, 20 GB / 30 giorni)", hint: "Roaming che esce a Hong Kong: Google, WhatsApp, Instagram e Gmail funzionano senza VPN. Dalla Cina i siti delle eSIM sono bloccati, quindi va comprata ora. Codice Nomad BBIYPGMWJSLW = 5 $ di sconto. Alternativa: Saily. Holafly solo se volete i dati illimitati.", links: [{ label: "Nomad", url: "https://www.nomadesim.com/" }, { label: "Saily", url: "https://saily.com/" }] },
  { id: "prep-esim-install", when: "subito", who: "entrambi", label: "Installare l'eSIM adesso, attivarla solo all'atterraggio", hint: "L'installazione vuole internet: farla in Italia. Lasciarla spenta fino a Pechino; poi impostarla come linea dati con il roaming dati attivo SOLO su quella linea." },
  { id: "prep-alipay", when: "subito", who: "entrambi", label: "Alipay: passaporto verificato e carta collegata", hint: "La verifica può bloccarsi per ore o chiedere conferme alla banca: farla adesso. Poi Face ID e niente logout fino al rientro." },
  { id: "prep-wechat", when: "subito", who: "entrambi", label: "WeChat con WeChat Pay attivo (Io → Servizi → Portafoglio)", hint: "Stessa carta di Alipay. Hotel e guide vi scriveranno lì." },
  { id: "prep-bank", when: "subito", who: "entrambi", label: "Avvisare la banca e attivare pagamenti esteri e online", hint: "Un addebito via QR cinese sembra una frode. Se i codici di conferma arrivano via SMS, la SIM italiana deve restare raggiungibile." },
  { id: "prep-backup-card", when: "subito", who: "entrambi", label: "Una carta di riserva di un'altra banca, tenuta separata", hint: "Se la carta principale si blocca, si bloccano anche Alipay e WeChat." },
  { id: "prep-vpn", when: "subito", who: "entrambi", label: "VPN a pagamento di riserva (LetsVPN o ExpressVPN), provata su telefono e Mac", hint: "Con l'eSIM in roaming di solito non serve; serve in hotel col Wi-Fi cinese. Dalla Cina gli store delle VPN sono bloccati." },

  // Weekend
  { id: "prep-arrival-card", when: "weekend", who: "entrambi", label: "Arrival card online, una a testa: da sabato 14 alle 5:30", hint: "Si apre 72 ore prima dell'atterraggio (17 nov, 12:25 a Pechino). Solo sul sito ufficiale o nell'app NIA 12367, gratis: diffidare dei siti che chiedono soldi. Servono passaporto, volo LH722 e indirizzo del primo hotel (nel Wallet). Non si modifica: in caso di errore se ne fa una nuova.", links: [{ label: "Arrival card (NIA)", url: "https://s.nia.gov.cn/ArrivalCardFillingPC/" }] },
  { id: "go-checkin-out", when: "weekend", who: "alberto", label: "Domenica 15 dalle 17:55: check-in online Air Dolomiti + Lufthansa per tutti e due", hint: "Con il codice PNR della mail Trip.com (o dall'app Trip.com). Carte d'imbarco nel Wallet del telefono e screenshot." },
  { id: "go-install-app", when: "weekend", who: "entrambi", label: "Installare questa web app sul telefono e aprire ogni scheda una volta online", hint: "iPhone: Safari → Condividi → «Aggiungi alla schermata Home». Android: Chrome → ⋮ → «Installa app». Poi login con Google: da quel momento funziona anche offline." },
  { id: "go-drive-offline", when: "weekend", who: "entrambi", label: "Drive: rendere disponibili offline i PDF delle conferme", hint: "App Google Drive → cartella «Cina 2026 · Prenotazioni e documenti» → ⋮ su ogni PDF → «Rendi disponibile offline». Con l'eSIM Drive si apre anche dalla Cina, ma in metro o in stazione il segnale manca." },
  { id: "prep-translate", when: "weekend", who: "entrambi", label: "Traduttore: cinese offline su Google Traduttore (o Traduci di Apple)", hint: "Scaricare la lingua «Cinese (semplificato)» e provarla in modalità aereo. Più Baidu Translate per la fotocamera sui menu e Pleco per i caratteri." },
  { id: "prep-baidu", when: "weekend", who: "entrambi", label: "Baidu Translate (百度翻译) installata e provata con la fotocamera", hint: "Il trucco per le app solo in cinese: screenshot e poi «importa dall'album» in Baidu." },
  { id: "prep-gaode", when: "weekend", who: "entrambi", label: "Mappe: Gaode (高德地图) installata; su iPhone anche Mappe di Apple va bene", hint: "Google Maps in Cina è sfasato di centinaia di metri. In Gaode: Impostazioni → Lingua → English." },
  { id: "prep-didi", when: "weekend", who: "entrambi", label: "Aprire una volta DiDi dentro Alipay (mini-programma in inglese)", hint: "Paga dal portafoglio. Per il tassista: tasto «🚕 Mostra in cinese» su ogni hotel del Wallet." },
  { id: "prep-metro", when: "weekend", who: "entrambi", label: "MetroMan con le città del viaggio scaricate" },
  { id: "prep-offline-map", when: "weekend", who: "entrambi", label: "Organic Maps con le regioni del viaggio scaricate (e il .kml dei posti)", hint: "Il file .kml è nel Wallet → Documenti: aprirlo con Organic Maps." },
  { id: "prep-booking-apps", when: "weekend", who: "entrambi", label: "App Trip.com e GetYourGuide installate e loggate, conferme in screenshot" },
  { id: "check-mvy4f7m2-yp19j", when: "weekend", who: "alberto", label: "Stampare i due certificati dell'assicurazione AXA", hint: "Dalla mail Trip.com «L'assicurazione è stata emessa» del 30 giugno, un link a testa (serve la data di nascita). Nel bagaglio a mano." },
  { id: "prep-offline-kit", when: "weekend", who: "entrambi", label: "Password, codici di recupero e codici delle banche salvati offline" },
  { id: "prep-phone-backup", when: "weekend", who: "entrambi", label: "Backup del telefono" },
  { id: "prep-cash", when: "weekend", who: "entrambi", label: "Contanti: ¥500–1.000 (o euro da cambiare in città)" },
  { id: "prep-cards", when: "weekend", who: "entrambi", label: "Carte fisiche nel portafoglio, non solo sul telefono", hint: "Alipay e WeChat con carta estera: gratis fino a ¥200, oltre 3%. Sopra ¥200 meglio la carta fisica." },
  { id: "prep-home-sim", when: "weekend", who: "entrambi", label: "SIM italiana attiva per gli SMS, con i dati in roaming spenti" },
  { id: "prep-powerbank", when: "weekend", who: "entrambi", label: "Power bank sotto 100 Wh con il marchio 3C", hint: "Senza 3C lo sequestrano ai controlli dei voli interni (Zhangjiajie → Shanghai)." },
  { id: "prep-adapter", when: "weekend", who: "entrambi", label: "Adattatore, caricatore e cavo" },
  { id: "prep-meds", when: "weekend", who: "entrambi", label: "Farmaci in confezione originale (lista in «Valigia»)" },
  { id: "prep-air", when: "weekend", who: "entrambi", label: "Mascherine KN95 per Pechino e Xi'an" },
  { id: "go-pack", when: "weekend", who: "entrambi", label: "Fare la valigia con la lista «Valigia» qui sotto", hint: "23 kg in stiva, a mano max 8 kg in tutto." },
  { id: "prep-airport", when: "weekend", who: "entrambi", label: "Ripassare il tragitto PEK T3 → hotel", hint: "Taxi ufficiale o DiDi (40–60 min, ~¥120) mostrando l'indirizzo in cinese, oppure Airport Express fino a Dongzhimen e poi taxi. Ignorare chi vi avvicina in sala arrivi." },

  // Partenza
  { id: "go-vce", when: "partenza", who: "entrambi", label: "A Venezia Marco Polo entro le 14:55", hint: "Passaporti (Sofia: anche il permesso di soggiorno), carte fisiche, certificati AXA, power bank nel bagaglio a mano." },
  { id: "prep-first-hour", when: "partenza", who: "entrambi", label: "All'atterraggio: impronte ai chioschi, poi eSIM accesa e test di WhatsApp e Google" },

  // In Cina
  { id: "prep-alipay-check", when: "cina", who: "entrambi", label: "17 nov · Alipay: carta ancora collegata e QR «Transport» attivo" },
  { id: "prep-passport-photo", when: "cina", who: "entrambi", label: "17 nov · Foto della pagina col timbro d'ingresso" },
  { id: "go-tianmen", when: "cina", who: "alberto", label: "26 nov · Biglietto Tianmen Shan tramite la guesthouse (sconto ¥20)" },
  { id: "check-mvz8gzil-ta23f", when: "cina", who: "alberto", label: "28 nov · Telefonare all'host di Shanghai per il codice del self check-in" },
  { id: "go-swiss-checkin", when: "cina", who: "alberto", label: "3 dic dalle 10:40 · Check-in online SWISS e DiDi prenotato per le 5:30" },
];

// ---------------------------------------------------------------------------
// Valigia: spunte solo su questo telefono (ognuno fa la sua)
// ---------------------------------------------------------------------------

export const PACKING: Array<{ id: string; title: string; note?: string; items: string[] }> = [
  {
    id: "docs",
    title: "Documenti e soldi · nel bagaglio a mano",
    items: [
      "Passaporto (Sofia: anche il permesso di soggiorno)",
      "Certificato assicurazione AXA stampato",
      "Due carte fisiche di banche diverse, tenute separate",
      "Contanti: ¥500–1.000 e qualche euro",
      "Fotocopia del passaporto, separata dall'originale",
    ],
  },
  {
    id: "clothes",
    title: "Vestiti · a strati, da 0° a 15°",
    note: "Pechino e Xi'an sotto zero di notte, Chengdu–Shanghai 6–15° e umido. Meglio strati che un cappotto pesante.",
    items: [
      "Piumino leggero comprimibile (anche sul Tianmen)",
      "Giacca impermeabile antivento sopra il piumino",
      "Pile o maglione caldo ×2",
      "Maglie termiche (sopra e sotto) ×2",
      "Magliette a manica lunga ×4–5",
      "Pantaloni ×3 (uno caldo o foderato)",
      "Calze calde ×6–7, intimo per una settimana (si lava a metà viaggio)",
      "Berretto, guanti (touch), sciarpa",
      "Pigiama caldo: le case a sud spesso non hanno riscaldamento",
    ],
  },
  {
    id: "shoes",
    title: "Scarpe e pioggia",
    items: [
      "Scarpe da camminata impermeabili, già rodate (scale di Chongqing, sentieri di Zhangjiajie)",
      "Secondo paio comodo per la città",
      "Ombrello pieghevole",
      "Ciabatte (ostello di Chengdu)",
    ],
  },
  {
    id: "tech",
    title: "Elettronica · power bank solo a mano",
    items: [
      "Telefono con eSIM installata e app pronte",
      "Power bank sotto 100 Wh con marchio 3C",
      "Caricatore, cavi, adattatore universale",
      "Auricolari",
      "Spillo per la SIM, in portafoglio",
    ],
  },
  {
    id: "health",
    title: "Salute e bagno",
    items: [
      "Farmaci abituali in confezione originale + copia della ricetta",
      "Paracetamolo, ibuprofene, antidiarroico, fermenti, sali reidratanti",
      "Cerotti e cerotti per vesciche",
      "Mascherine KN95 ×6",
      "Fazzoletti e gel igienizzante (bagni senza carta)",
      "Burrocacao e crema idratante (Pechino è secchissima)",
      "Occhiali da sole",
    ],
  },
  {
    id: "day",
    title: "Zainetto da giorno",
    items: [
      "Zainetto leggero",
      "Borraccia (acqua del rubinetto non potabile: riempirla con quella in bottiglia o calda)",
      "Sacchetto per la biancheria sporca",
      "Lucchetto piccolo per l'armadietto dell'ostello",
    ],
  },
];

// ---------------------------------------------------------------------------
// Info rapide
// ---------------------------------------------------------------------------

export const EMERGENCY: Array<{ label: string; number: string; note?: string }> = [
  { label: "Polizia", number: "110" },
  { label: "Ambulanza", number: "120" },
  { label: "Vigili del fuoco", number: "119" },
  { label: "Assistenza AXA 24/7", number: "+39 02 5003 3158", note: "Chiamare prima di un ricovero o se la spesa supera 500 €: paga lei l'ospedale. Franchigia 45 €." },
  { label: "Ambasciata d'Italia a Pechino", number: "+86 10 8532 7600" },
  { label: "Consolato d'Italia a Shanghai", number: "+86 21 6596 5900" },
  { label: "Unità di crisi Farnesina", number: "+39 06 36225", note: "Prima di partire registrarsi su dovesiamonelmondo.it." },
];

export const APPS: Array<{ name: string; what: string }> = [
  { name: "eSIM Nomad (o Saily)", what: "Internet senza VPN: Google, WhatsApp, Gmail, Drive funzionano." },
  { name: "Alipay", what: "Pagamenti, metro (QR «Transport»), DiDi, biglietti: è il coltellino svizzero." },
  { name: "WeChat", what: "Messaggi con hotel e guide, WeChat Pay, mini-programmi di musei." },
  { name: "Google Traduttore offline / Traduci di Apple", what: "Conversazioni e testo, anche senza rete." },
  { name: "Baidu Translate (百度翻译)", what: "Fotocamera su menu e cartelli: la più precisa in Cina." },
  { name: "Pleco", what: "Dizionario per capire un carattere." },
  { name: "Gaode (高德地图) o Mappe di Apple", what: "Navigazione esatta in Cina; Google Maps è sfasato." },
  { name: "DiDi (in Alipay)", what: "Taxi: si scrive la destinazione in cinese o si incolla l'indirizzo del Wallet." },
  { name: "MetroMan", what: "Mappe metro in inglese, offline." },
  { name: "Trip.com", what: "Treni, volo interno, hotel: varchi e cambi aggiornati." },
];

export const PHRASES: Array<{ zh: string; pinyin: string; it: string }> = [
  { zh: "你好", pinyin: "nǐ hǎo", it: "Ciao / buongiorno" },
  { zh: "谢谢", pinyin: "xièxie", it: "Grazie" },
  { zh: "多少钱？", pinyin: "duōshao qián?", it: "Quanto costa?" },
  { zh: "这个", pinyin: "zhège", it: "Questo (indicando)" },
  { zh: "不要辣", pinyin: "bú yào là", it: "Non piccante" },
  { zh: "微辣", pinyin: "wēi là", it: "Poco piccante" },
  { zh: "洗手间在哪里？", pinyin: "xǐshǒujiān zài nǎlǐ?", it: "Dov'è il bagno?" },
  { zh: "我不懂", pinyin: "wǒ bù dǒng", it: "Non capisco" },
  { zh: "买单", pinyin: "mǎi dān", it: "Il conto" },
  { zh: "不用了，谢谢", pinyin: "bú yòng le, xièxie", it: "No grazie (ai venditori)" },
];
