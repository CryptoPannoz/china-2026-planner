"use client";

import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, type Timestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

type Currency = "EUR" | "CNY";
type ScheduleKind = "activity" | "transport" | "hotel";

type Activity = {
  id: string;
  name: string;
  nameZh?: string;
  description: string;
  price: number;
  currency?: Currency;
  selected: boolean;
  sourceUrl?: string;
};

type ScheduleItem = {
  id: string;
  date: string;
  stopId: string;
  startTime: string;
  endTime: string;
  name: string;
  nameZh?: string;
  kind?: ScheduleKind;
  category: string;
  location: string;
  locationZh?: string;
  ticketUrl?: string;
  fromLocation?: string;
  transportMode?: string;
  mapUrl?: string;
  wechatUrl?: string;
  alipayUrl?: string;
  notes: string;
  price: number;
  currency?: Currency;
  bookingStatus: "da-prenotare" | "prenotato" | "non-serve";
  paidBy?: Payer;
  sourceUrl?: string;
  sourceActivityId?: string;
};

type HotelStay = {
  id: string;
  stopId: string;
  name: string;
  nameZh?: string;
  address: string;
  addressZh?: string;
  checkInDate: string;
  checkOutDate: string;
  nightlyPrice: number;
  totalPrice?: number;
  currency: Currency;
  bookingStatus: "da-prenotare" | "prenotato";
  confirmationNumber?: string;
  paidBy?: Payer;
  bookingUrl?: string;
  mapUrl?: string;
  wechatUrl?: string;
  alipayUrl?: string;
  notes: string;
};

type Stop = {
  id: string;
  name: string;
  nameZh?: string;
  lat: number;
  lng: number;
  nights: number;
  hotelNightly: number;
  activities: Activity[];
};

type TaxiInfo = {
  kind: "hotel" | "place";
  title: string;
  titleZh?: string;
  subtitle: string;
  subtitleZh?: string;
};

type SuggestedStop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  nights: number;
  hotelNightly: number;
  recap: string;
  transport: string;
  season: string;
  insertAfterId: string;
  activities: Activity[];
};

type Leg = {
  id: string;
  fromId: string;
  toId: string;
  mode: string;
  duration: string;
  cost: number;
  currency?: Currency;
  included: boolean;
  note: string;
};

type CostEntry = {
  id: string;
  label: string;
  amount: number;
  currency: Currency;
};

type Payer = "alberto" | "sofia";

type ExpenseCategory = "voli" | "hotel" | "trasporti" | "attivita" | "cibo" | "extra";

type Expense = {
  id: string;
  date: string;
  label: string;
  amount: number;
  currency: Currency;
  paidBy: Payer;
  category: ExpenseCategory;
};

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

type TripLink = {
  id: string;
  stopId: string;
  label: string;
  url: string;
};

type PlanData = {
  itineraryVersion: number;
  stops: Stop[];
  legs: Leg[];
  scheduleItems: ScheduleItem[];
  hotelStays: HotelStay[];
  checklist: boolean[];
  extraChecklist: ChecklistItem[];
  sharedLinks: TripLink[];
  notes: string;
  cnyPerEuro: number;
  costEntries: CostEntry[];
  expenses: Expense[];
  customCategories: string[];
  dismissedSuggestions: string[];
  coverPhoto?: string;
};

type ChangeLogEntry = {
  id: string;
  authorEmail: string;
  authorName: string;
  action: string;
  detail: string;
  createdAt?: Timestamp | null;
};

type LeafletMap = {
  fitBounds(coords: Array<[number, number]>, options?: Record<string, unknown>): LeafletMap;
  invalidateSize(): void;
  remove(): void;
  setView(coords: [number, number], zoom: number): LeafletMap;
};

type LeafletMarker = {
  addTo(map: LeafletMap): LeafletMarker;
  bindPopup(html: string): LeafletMarker;
  bindTooltip(text: string, options?: Record<string, unknown>): LeafletMarker;
  getElement(): HTMLElement | null;
  on(event: string, handler: () => void): LeafletMarker;
  openPopup(): void;
};

type LeafletPolyline = {
  addTo(map: LeafletMap): LeafletPolyline;
  bindTooltip(text: string): LeafletPolyline;
};

type LeafletNamespace = {
  map(element: HTMLElement, options?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, options?: Record<string, unknown>): { addTo(map: LeafletMap): unknown };
  divIcon(options: Record<string, unknown>): unknown;
  marker(coords: [number, number], options?: Record<string, unknown>): LeafletMarker;
  polyline(coords: Array<[number, number]>, options?: Record<string, unknown>): LeafletPolyline;
};

type LeafletWindow = Window & {
  L?: LeafletNamespace;
  __chinaLeafletPromise?: Promise<LeafletNamespace>;
};

const ARRIVAL_DATE = new Date("2026-11-17T00:00:00");
const DEPARTURE_DATE = new Date("2026-12-04T00:00:00");
const TRIP_NIGHTS = Math.round((DEPARTURE_DATE.getTime() - ARRIVAL_DATE.getTime()) / 86_400_000);
const FLIGHTS_COST = 1384.44;
const PLAN_STORAGE_KEY = "china-planner-v2";
const ITINERARY_SCHEMA_VERSION = 2;
const BUILT_IN_CATEGORIES = [
  { value: "visita", label: "Visita" },
  { value: "cibo", label: "Cibo" },
  { value: "tempo-libero", label: "Tempo libero" },
  { value: "shopping", label: "Shopping" },
  { value: "spettacolo", label: "Spettacolo" },
];
const KIND_LABELS: Record<ScheduleKind, string> = {
  activity: "Attività",
  transport: "Trasporto",
  hotel: "Hotel / notte",
};
const ALLOWED_EMAILS = new Set([
  "bebroggi@gmail.com",
  "sofiakovaleva1998@gmail.com",
]);
const PAYER_LABELS: Record<Payer, string> = { alberto: "Alberto", sofia: "Sofia" };
const EXPENSE_CATEGORIES: Array<{ value: ExpenseCategory; label: string }> = [
  { value: "hotel", label: "Hotel" },
  { value: "trasporti", label: "Trasporti" },
  { value: "attivita", label: "Attività" },
  { value: "cibo", label: "Cibo" },
  { value: "voli", label: "Voli" },
  { value: "extra", label: "Extra" },
];

const initialStops: Stop[] = [
  {
    id: "beijing",
    name: "Pechino",
    lat: 39.9042,
    lng: 116.4074,
    nights: 3,
    hotelNightly: 95,
    activities: [
      { id: "forbidden-city", name: "Città Proibita + Jingshan", description: "Prenotazione online obbligatoria con passaporto, 7 gg prima; chiuso lunedì", price: 12, selected: false },
      { id: "great-wall", name: "Grande Muraglia di Mutianyu", description: "40 ¥ ingresso + 15 ¥ navetta + 140 ¥ funivia A/R a testa; poca folla a novembre", price: 49, selected: false },
      { id: "temple-heaven", name: "Tempio del Cielo", description: "Cumulativo 28 ¥/pp in bassa stagione; al mattino tai chi e vita locale", price: 7, selected: false },
      { id: "summer-palace", name: "Palazzo d'Estate", description: "Biglietto completo 50 ¥/pp (nov–mar); lago Kunming, possibile ghiaccio", price: 13, selected: false },
      { id: "peking-duck", name: "Anatra alla pechinese (Siji Minfu)", description: "Anatra intera ~259 ¥ + contorni; prenotare o coda presto, file lunghe", price: 50, selected: false },
      { id: "hutong-houhai", name: "Hutong e lago Houhai", description: "Gratis; passeggiata nei vicoli storici e tramonto sul lago", price: 0, selected: false },
      { id: "lama-temple", name: "Tempio dei Lama (Yonghegong)", description: "25 ¥/pp con incenso incluso; chiude alle 16 in inverno", price: 6, selected: false },
    ],
  },
  {
    id: "xian",
    name: "Xi’an",
    lat: 34.3416,
    lng: 108.9398,
    nights: 2,
    hotelNightly: 85,
    activities: [
      { id: "terracotta", name: "Esercito di Terracotta", description: "120 ¥/pp, biglietto nominativo con passaporto, max 7 gg prima; mezza giornata", price: 30, selected: false },
      { id: "city-wall-bike", name: "Mura della città in bicicletta", description: "54 ¥ ingresso + 45 ¥ bici per 3h; partenza Porta Sud, giro completo 14 km", price: 25, selected: false },
      { id: "muslim-quarter", name: "Quartiere musulmano e street food", description: "Gratis; serata tra bancarelle: roujiamo e biangbiang noodles", price: 0, selected: false },
      { id: "big-wild-goose-pagoda", name: "Grande Pagoda dell'Oca Selvatica", description: "Tempio ~40 ¥ + salita 25 ¥; la sera fontane danzanti gratuite", price: 16, selected: false },
      { id: "tang-dynasty-show", name: "Tang Dynasty Show con banchetto di ravioli", description: "~350 ¥/pp show + cena (solo show 218 ¥); ore 19:30, prenotare", price: 88, selected: false },
    ],
  },
  {
    id: "chengdu",
    name: "Chengdu",
    lat: 30.5728,
    lng: 104.0668,
    nights: 2,
    hotelNightly: 80,
    activities: [
      { id: "pandas", name: "Chengdu Panda Base", description: "55 ¥/pp, prenotare online; arrivare alle 7:30–9, i panda sono attivi al mattino", price: 14, selected: false },
      { id: "sichuan-opera", name: "Opera del Sichuan e cambio faccia", description: "~180–320 ¥/pp con tè (Shufeng Yayun); show ore 20, posti centrali in anticipo", price: 55, selected: false },
      { id: "peoples-park", name: "Casa da tè al Parco del Popolo", description: "Parco gratuito, tè 20–30 ¥; pulizia orecchie, mahjong e atmosfera locale", price: 6, selected: false },
      { id: "jinli-street", name: "Jinli Street e Tempio di Wuhou", description: "Via gratuita, magica di sera con le lanterne; tempio adiacente ~50 ¥ opz.", price: 0, selected: false },
      { id: "leshan-buddha", name: "Buddha Gigante di Leshan (day trip)", description: "Treno AV ~1h + ingresso 50 ¥ inverno; crociera 70 ¥ opz., giornata intera", price: 46, selected: false },
      { id: "wenshu-monastery", name: "Monastero di Wenshu", description: "Gratuito; monastero attivo con casa da tè storica e ristorante vegetariano", price: 0, selected: false },
    ],
  },
  {
    id: "kunming",
    name: "Kunming · Yunnan",
    lat: 25.0389,
    lng: 102.7183,
    nights: 3,
    hotelNightly: 75,
    activities: [
      { id: "stone-forest", name: "Foresta di Pietra di Shilin", description: "Karst UNESCO a 90 min; 130 ¥/pp + navetta 25 ¥, prenotare su Trip.com", price: 33, selected: false },
      { id: "green-lake-gulls", name: "Green Lake e gabbiani siberiani", description: "Gratis; da novembre migliaia di gabbiani dal Bajkal, meglio al mattino", price: 0, selected: false },
      { id: "western-hills-dragon-gate", name: "Colline Occidentali e Porta del Drago", description: "40 ¥/pp + navetta; vista sul lago Dianchi", price: 16, selected: false },
      { id: "dianchi-haigeng", name: "Diga di Haigeng sul lago Dianchi", description: "Gratis; gabbiani nov–mar e tramonto spettacolare, si abbina alle Colline", price: 0, selected: false },
      { id: "yuantong-temple", name: "Tempio Yuantong", description: "Tempio buddista di 1200 anni in centro; ingresso simbolico, 8–18", price: 2, selected: false },
      { id: "flower-bird-market", name: "Mercato dei fiori e degli uccelli", description: "Gratis; bazar storico vicino al Green Lake, ottimo in inverno", price: 0, selected: false },
    ],
  },
  {
    id: "zhangjiajie",
    name: "Zhangjiajie",
    lat: 29.347,
    lng: 110.4792,
    nights: 2,
    hotelNightly: 90,
    activities: [
      { id: "forest-park", name: "Parco Nazionale · Yuanjiajie/Avatar e Tianzi", description: "239 ¥/pp valido 4 giorni con bus interni; prenotazione online obbligatoria", price: 60, selected: false },
      { id: "tianmen-mountain", name: "Tianmen Mountain con funivia e skywalk", description: "258 ¥/pp con funivia (225 da dic); nebbia frequente, skywalk in vetro", price: 65, selected: false },
      { id: "grand-canyon-glass-bridge", name: "Glass Bridge del Grand Canyon", description: "178 ¥/pp canyon + ponte; prenotare slot orario, può chiudere per ghiaccio", price: 45, selected: false },
      { id: "bailong-elevator", name: "Ascensore Bailong", description: "65 ¥/pp a tratta; sale 326 m nella roccia verso Yuanjiajie, extra al pass", price: 16, selected: false },
      { id: "tianzi-cable-car", name: "Funivia di Tianzi Mountain", description: "~65 ¥/pp a tratta; risparmia la salita a piedi, picchi nella nebbia", price: 16, selected: false },
    ],
  },
  {
    id: "fenghuang",
    name: "Fenghuang",
    lat: 27.9483,
    lng: 109.5987,
    nights: 1,
    hotelNightly: 65,
    activities: [
      { id: "tuojiang", name: "Barca sul fiume Tuojiang", description: "80 ¥/pp di giorno, 120 ¥ di notte (~30 min); la notturna è la più scenica", price: 30, selected: false },
      { id: "old-town-night", name: "Città antica illuminata di notte", description: "Gratis; luci su palafitte, torre Wanming e Hong Bridge fino a tarda sera", price: 0, selected: false },
      { id: "combo-ticket-attractions", name: "Biglietto combinato 8 attrazioni", description: "128 ¥/pp per 2 giorni: casa di Shen Congwen, East Gate, museo", price: 32, selected: false },
      { id: "stepping-stones-bridges", name: "Pietre del guado e ponti sul Tuojiang", description: "Gratis; attraversata sulle pietre all'alba con la foschia, prima della folla", price: 0, selected: false },
    ],
  },
  {
    id: "wuzhen",
    name: "Wuzhen",
    lat: 30.7462,
    lng: 120.4943,
    nights: 1,
    hotelNightly: 100,
    activities: [
      { id: "xizha", name: "Xizha illuminata di sera", description: "150 ¥/pp; luci dal tramonto (~17 a dicembre); dormire nel borgo è il top", price: 38, selected: false },
      { id: "canal-night-boat", name: "Barca notturna sui canali", description: "Privata ~480 ¥ fino a 8 posti; condivisa 60 ¥/pp", price: 60, selected: false },
      { id: "dongzha-morning", name: "Dongzha al mattino", description: "110 ¥/pp; conviene il combinato Xizha+Dongzha a 190 ¥; case-museo", price: 28, selected: false },
      { id: "folk-shows", name: "Spettacoli folk inclusi", description: "Ombre cinesi, opera e tintoria di indaco inclusi nel biglietto; orari invernali", price: 0, selected: false },
    ],
  },
  {
    id: "suzhou",
    name: "Suzhou",
    lat: 31.2989,
    lng: 120.5853,
    nights: 1,
    hotelNightly: 75,
    activities: [
      { id: "humble-garden", name: "Giardino dell’Umile Amministratore", description: "70 ¥/pp bassa stagione; prenotare online con passaporto, chiude alle 17", price: 18, selected: false },
      { id: "pingjiang-road", name: "Pingjiang Road", description: "Gratis; canale storico, case da tè e negozi, perfetta nel tardo pomeriggio", price: 0, selected: false },
      { id: "suzhou-museum", name: "Museo di Suzhou (I.M. Pei)", description: "Gratuito; prenotazione WeChat 7 gg prima con passaporto; chiuso lunedì", price: 0, selected: false },
      { id: "master-of-nets-night", name: "Master of the Nets serale", description: "Show ~120 ¥/pp ma spesso sospeso d'inverno: verificare, altrimenti diurna", price: 30, selected: false },
      { id: "tiger-hill", name: "Tiger Hill e pagoda pendente", description: "60 ¥/pp a dicembre; simbolo di Suzhou, 2–3 ore con il parco", price: 15, selected: false },
      { id: "shantang-street", name: "Shantang Street di sera", description: "Gratis; lanterne rosse sui canali, sale interne a pagamento", price: 0, selected: false },
    ],
  },
  {
    id: "shanghai",
    name: "Shanghai",
    lat: 31.2304,
    lng: 121.4737,
    nights: 2,
    hotelNightly: 120,
    activities: [
      { id: "bund-night", name: "Bund illuminato di sera", description: "Gratis; skyline di Pudong acceso ~18:30–22; a dicembre vento freddo", price: 0, selected: false },
      { id: "tower", name: "Shanghai Tower Observatory", description: "180 ¥/pp per il 118° piano; prenotare online, scegliere giornata limpida", price: 45, selected: false },
      { id: "yu-garden", name: "Yu Garden e bazaar", description: "~40 ¥/pp, chiuso lunedì; il bazaar attorno è gratuito e scenografico la sera", price: 10, selected: false },
      { id: "huangpu-cruise", name: "Crociera serale sull'Huangpu", description: "115 ¥/pp in bassa stagione, 50 min da Shiliupu; prenotare su Trip.com", price: 29, selected: false },
      { id: "french-concession", name: "Concessione Francese e Wukang Road", description: "Gratis; platani, ville e caffè tra Wukang Road e Tianzifang", price: 0, selected: false },
      { id: "shanghai-museum", name: "Museo di Shanghai", description: "Gratuito; prenotazione online con passaporto, chiuso lunedì; bronzi e giade", price: 0, selected: false },
    ],
  },
];

const SUGGESTED_STOPS: SuggestedStop[] = [
  {
    id: "chongqing",
    name: "Chongqing",
    lat: 29.563,
    lng: 106.552,
    nights: 2,
    hotelNightly: 60,
    insertAfterId: "chengdu",
    recap: "La metropoli cyberpunk sul Yangtze: grattacieli a strapiombo, monorotaia tra i palazzi, hotpot leggendario e le sculture UNESCO di Dazu. Deviazione facilissima da Chengdu.",
    transport: "Treno AV da Chengdu Est 1h15–2h, ~154 ¥ (150 corse al giorno)",
    season: "Mite (10–15°C) ma capitale della nebbia; luci notturne comunque spettacolari, hotel scontati",
    activities: [
      { id: "hongya-cave", name: "Hongyadong illuminata di notte", description: "Palafitte di 11 piani, gratis; al tramonto, vista dal ponte Qiansimen", price: 0, selected: false },
      { id: "dazu-rock-carvings", name: "Sculture rupestri di Dazu (UNESCO)", description: "Mezza giornata a Baodingshan; biglietto invernale ridotto ~120 ¥/pp", price: 30, selected: false },
      { id: "yangtze-cableway", name: "Funivia sul fiume Yangtze", description: "Traversata panoramica, ~30 ¥ A/R a testa; meglio nei feriali", price: 8, selected: false },
    ],
  },
  {
    id: "guilin",
    name: "Guilin & Yangshuo",
    lat: 25.274,
    lng: 110.29,
    nights: 3,
    hotelNightly: 65,
    insertAfterId: "kunming",
    recap: "Il paesaggio carsico più iconico della Cina: crociera sul fiume Li tra i pinnacoli fino a Yangshuo, risaie e bambù. A dicembre pochissimi turisti e clima secco.",
    transport: "Volo da Chengdu ~2h (500–1100 ¥) o treno AV da Kunming ~4h30 (~250 ¥)",
    season: "Stagione secca: 13–21°C di giorno; fiume in magra (crociera a volte accorciata), foschia al mattino",
    activities: [
      { id: "li-river-cruise", name: "Crociera sul fiume Li fino a Yangshuo", description: "4–4,5h tra i pinnacoli; 3 stelle 215 ¥/pp, 4 stelle 360–480 ¥", price: 55, selected: false },
      { id: "yulong-bamboo-raft", name: "Zattera di bambù sul fiume Yulong", description: "Zattera per 2 ~220 ¥ tra risaie e ponti antichi", price: 28, selected: false },
      { id: "reed-flute-cave", name: "Grotta del Flauto di Canna", description: "Stalattiti illuminate in città, ~90 ¥/pp, visita 1h", price: 23, selected: false },
    ],
  },
  {
    id: "lijiang",
    name: "Lijiang",
    lat: 26.855,
    lng: 100.227,
    nights: 3,
    hotelNightly: 55,
    insertAfterId: "kunming",
    recap: "Città vecchia Naxi patrimonio UNESCO ai piedi della Montagna Innevata del Drago di Giada: a inizio dicembre cieli tersi e vicoli senza folla. La più romantica del gruppo.",
    transport: "Treno da Kunming 3–3,5h, 166–220 ¥ (12 coppie di treni al giorno)",
    season: "Sole quasi garantito: ~14°C di giorno ma fino a 0°C la notte; bassa stagione, prezzi ridotti",
    activities: [
      { id: "jade-dragon-snow-mountain", name: "Montagna Innevata del Drago di Giada", description: "Ingresso ~100 ¥ + funivia Glacier Park ~140 ¥/pp; prenotare la funivia", price: 60, selected: false },
      { id: "lijiang-old-town", name: "Città vecchia e Stagno del Drago Nero", description: "Vicoli e canali Naxi; tassa 50 ¥/pp che include il parco", price: 13, selected: false },
      { id: "shuhe-old-town", name: "Borgo antico di Shuhe in bici", description: "Versione tranquilla di Lijiang a 20 min, ingresso libero", price: 0, selected: false },
    ],
  },
  {
    id: "dali",
    name: "Dali",
    lat: 25.606,
    lng: 100.268,
    nights: 2,
    hotelNightly: 50,
    insertAfterId: "kunming",
    recap: "Atmosfera rilassata tra il lago Erhai e i monti Cangshan, cultura Bai e borghi come Xizhou: il ritmo lento ideale per spezzare l'itinerario.",
    transport: "Treno AV da Kunming ~2h, 109–155 ¥; da Dali a Lijiang altri ~2h di treno",
    season: "Il mese più secco: sole e ~16°C di giorno, 3°C la notte, vento sul lago; pochissimi turisti",
    activities: [
      { id: "three-pagodas", name: "Tre Pagode del Tempio Chongsheng", description: "Icona millenaria col riflesso nel laghetto; ~121 ¥/pp, 2–3h", price: 30, selected: false },
      { id: "erhai-lake-loop", name: "Giro del lago Erhai in e-bike", description: "Scooter elettrico 60–100 ¥ al giorno; tappe a Xizhou e Shuanglang", price: 12, selected: false },
      { id: "cangshan-cableway", name: "Funivia sui monti Cangshan", description: "Funivia Gantong ~80 ¥/pp e sentiero panoramico Jade Belt", price: 20, selected: false },
    ],
  },
  {
    id: "emeishan",
    name: "Emeishan",
    lat: 29.601,
    lng: 103.484,
    nights: 2,
    hotelNightly: 65,
    insertAfterId: "chengdu",
    recap: "Montagna sacra buddhista con la statua dorata a 3.079 m sopra il mare di nuvole: in inverno neve in vetta e terme ai piedi del monte. Si abbina al Buddha di Leshan, a un'ora da Chengdu.",
    transport: "Treno AV da Chengdu 1h–1h30 (~55–65 ¥); navetta interna 90 ¥ A/R",
    season: "Neve da metà dicembre in quota; stagione Ice & Snow con terme, ingresso ridotto 110 ¥",
    activities: [
      { id: "cima-dorata-jinding", name: "Cima Dorata (Jinding)", description: "Ingresso 110–160 ¥ + bus 90 ¥ + funivia ~50 ¥; alba sul mare di nuvole", price: 60, selected: false },
      { id: "buddha-gigante-leshan", name: "Buddha Gigante di Leshan", description: "Statua rupestre di 71 m, mezza giornata in treno da Emeishan; 80 ¥", price: 20, selected: false },
      { id: "terme-di-emei", name: "Terme ai piedi del monte", description: "Sorgenti calde serali (es. Lingxiu Hot Spring), 150–200 ¥/pp", price: 45, selected: false },
    ],
  },
  {
    id: "xiamen",
    name: "Xiamen",
    lat: 24.48,
    lng: 118.089,
    nights: 2,
    hotelNightly: 70,
    insertAfterId: "fenghuang",
    recap: "L'unica tappa mite possibile a dicembre: città di mare rilassata con l'isola pedonale di Gulangyu (UNESCO), ville coloniali e caffè. Richiede però una deviazione lunga.",
    transport: "Volo da Changsha (vicino Fenghuang) 1h30 (~60–110 € a testa) o AV da Shanghai ~5h",
    season: "Mite e soleggiato (11–20°C), bassa stagione; il vento può sospendere i traghetti",
    activities: [
      { id: "gulangyu-sunlight-rock", name: "Gulangyu e Sunlight Rock", description: "Traghetto A/R 35 ¥ + rocca panoramica 50 ¥; ville coloniali", price: 21, selected: false },
      { id: "tempio-nanputuo", name: "Tempio Nanputuo", description: "Tempio buddhista accanto all'università; gratuito", price: 0, selected: false },
      { id: "zengcuoan-lungomare", name: "Zengcuoan e lungomare", description: "Ex villaggio di pescatori con street food e caffè; gratis", price: 0, selected: false },
    ],
  },
  {
    id: "hangzhou",
    name: "Hangzhou",
    lat: 30.274,
    lng: 120.155,
    nights: 2,
    hotelNightly: 75,
    insertAfterId: "wuzhen",
    recap: "Il Lago dell'Ovest è il paesaggio classico della poesia cinese: pagode, ponti e colline di tè a 45 minuti da Shanghai. Si incastra tra Wuzhen e Suzhou senza stravolgere l'itinerario.",
    transport: "Bus diretto da Wuzhen ~1h; AV per Suzhou ~1h30 o Shanghai 45–60 min (~73 ¥)",
    season: "Freddo secco (0–10°C), poca pioggia, folla minima; hotel a prezzi invernali",
    activities: [
      { id: "crociera-lago-ovest", name: "Crociera sul Lago dell'Ovest", description: "Battello per le Tre Pagode riflesse; al tramonto, 55–70 ¥/pp", price: 18, selected: false },
      { id: "lingyin-feilai-feng", name: "Tempio Lingyin e Feilai Feng", description: "Area gratuita da dic 2025 (prenotare su WeChat); tempio 30 ¥", price: 8, selected: false },
      { id: "villaggio-te-longjing", name: "Villaggio del tè Longjing", description: "Colline di tè Dragon Well, ingresso libero; degustazione ~50 ¥/pp", price: 13, selected: false },
    ],
  },
  {
    id: "huangshan",
    name: "Huangshan e borghi Hui",
    lat: 29.717,
    lng: 118.339,
    nights: 2,
    hotelNightly: 95,
    insertAfterId: "wuzhen",
    recap: "Le Montagne Gialle innevate con pini brinati e mare di nuvole sono lo scenario più iconico della Cina; in inverno folla ai minimi. Con i borghi UNESCO Hongcun e Xidi.",
    transport: "Treno AV da Hangzhou 1h15 (~112 ¥) o da Shanghai ~3h; poi bus ~1h per Tangkou",
    season: "Tariffa invernale (150 ¥ invece di 230); neve e ghiaccio probabili, ramponi utili, notte in vetta per l'alba",
    activities: [
      { id: "vetta-huangshan", name: "Scalata dello Huangshan", description: "Ingresso inverno 150 ¥ + funivia Yungu 65 ¥ a tratta; notte in vetta", price: 70, selected: false },
      { id: "borgo-hongcun", name: "Borgo di Hongcun", description: "Villaggio UNESCO del film La tigre e il dragone; 104 ¥, valido 3 giorni", price: 26, selected: false },
      { id: "borgo-xidi", name: "Borgo di Xidi", description: "Architettura Hui e vicoli lastricati, più quieto di Hongcun; 104 ¥/pp", price: 26, selected: false },
    ],
  },
  {
    id: "pingyao",
    name: "Pingyao",
    lat: 37.2,
    lng: 112.176,
    nights: 1,
    hotelNightly: 45,
    insertAfterId: "beijing",
    recap: "La città murata Ming meglio conservata della Cina (UNESCO): mura intatte, le prime banche dell'800, cortili e lanterne rosse. Spezza perfettamente il viaggio Pechino → Xi'an ed è magica la sera.",
    transport: "Treno AV da Pechino ~4h (staz. Pingyao Gucheng), poi AV per Xi'an ~3h: tappa a metà strada",
    season: "Freddo secco (−5/5°C) ma cieli tersi e vicoli quasi vuoti; guesthouse nei cortili storici a prezzi minimi",
    activities: [
      { id: "pingyao-pass", name: "Biglietto unico della città antica", description: "Mura, Rishengchang (prima banca cinese) e residenze; ~125 ¥/pp, valido 3 giorni", price: 32, selected: false },
      { id: "pingyao-qiao", name: "Cortile della famiglia Qiao", description: "La residenza di «Lanterne rosse», a 40 min di auto; ~115 ¥/pp", price: 29, selected: false },
      { id: "pingyao-shuanglin", name: "Tempio Shuanglin", description: "Sculture in argilla dipinta uniche, a 6 km dalle mura; ~35 ¥/pp", price: 9, selected: false },
    ],
  },
  {
    id: "huashan",
    name: "Monte Hua (Huashan)",
    lat: 34.49,
    lng: 110.085,
    nights: 1,
    hotelNightly: 55,
    insertAfterId: "xian",
    recap: "La montagna sacra dell'ovest: creste di granito a strapiombo, scalinate scavate nella roccia e la famosa passerella di assi sospesa nel vuoto. Fattibile anche in giornata da Xi'an (idea dal blog Zipangu).",
    transport: "AV da Xi'an Nord a Huashan Nord in 30–40 min (~55 ¥); navetta + funivia fino in cresta",
    season: "In cresta freddo e vento (−5°C) ma cieli limpidi e sentieri deserti; ramponcini utili se ha nevicato",
    activities: [
      { id: "huashan-west-cable", name: "Funivia del Picco Ovest", description: "La salita più spettacolare; funivia ~140 ¥ + bus ~40 ¥ a tratta", price: 45, selected: false },
      { id: "huashan-plank-walk", name: "Passerella nel vuoto (Plank Walk)", description: "Assi di legno sul precipizio, imbrago incluso; ~30 ¥/pp", price: 8, selected: false },
      { id: "huashan-peaks-loop", name: "Anello dei cinque picchi", description: "Cresta tra picco Nord, Est e Sud; ingresso invernale ~100 ¥/pp", price: 25, selected: false },
    ],
  },
  {
    id: "luoyang",
    name: "Luoyang & Shaolin",
    lat: 34.62,
    lng: 112.454,
    nights: 2,
    hotelNightly: 50,
    insertAfterId: "xian",
    recap: "Le grotte di Longmen (UNESCO) con centomila Buddha scolpiti nella roccia e il monastero Shaolin sul monte Songshan, culla del kung fu: la grande deviazione storica a est di Xi'an suggerita dal blog.",
    transport: "AV da Xi'an Nord ~1h30 (~175 ¥); Shaolin a ~1h30 di bus/auto da Luoyang",
    season: "Freddo secco (0–8°C), siti all'aperto senza folla; spettacoli di kung fu al coperto",
    activities: [
      { id: "longmen-grottoes", name: "Grotte di Longmen", description: "100.000 statue rupestri sul fiume Yi, illuminate anche la sera; ~90 ¥/pp", price: 23, selected: false },
      { id: "shaolin-monastery", name: "Monastero Shaolin e foresta di pagode", description: "Spettacolo di kung fu incluso nel biglietto; ~80 ¥/pp + transfer", price: 20, selected: false },
      { id: "white-horse-temple", name: "Tempio del Cavallo Bianco", description: "Il primo tempio buddhista della Cina (68 d.C.); ~35 ¥/pp", price: 9, selected: false },
    ],
  },
  {
    id: "wudangshan",
    name: "Wudangshan",
    lat: 32.4,
    lng: 111.004,
    nights: 2,
    hotelNightly: 60,
    insertAfterId: "xian",
    recap: "La montagna del tai chi: monasteri taoisti UNESCO arroccati tra le nubi e la Vetta d'Oro. Il blog la segnala come nuova opzione: dal 30 giugno 2026 l'alta velocità Xi'an–Wuhan la mette a ~2h da Xi'an.",
    transport: "Nuova AV Xi'an → Wudangshan ~2h (linea aperta a giugno 2026); navetta interna al parco",
    season: "Freddo (0–10°C) e possibile neve sui gradini; con la nebbia l'atmosfera è ancora più mistica",
    activities: [
      { id: "wudang-golden-summit", name: "Vetta d'Oro (Jinding)", description: "Ingresso+bus ~230 ¥ + funivia ~90 ¥; tempio dorato a 1.612 m", price: 60, selected: false },
      { id: "wudang-zixiao", name: "Palazzo delle Nubi Purpuree", description: "Il complesso taoista meglio conservato, ~15 ¥ extra", price: 4, selected: false },
      { id: "wudang-taichi", name: "Lezione di tai chi", description: "1–2h con maestro locale nelle scuole ai piedi del monte; ~150 ¥/pp", price: 38, selected: false },
    ],
  },
  {
    id: "qingcheng-dujiangyan",
    name: "Qingchengshan & Dujiangyan",
    lat: 30.9,
    lng: 103.605,
    nights: 1,
    hotelNightly: 55,
    insertAfterId: "chengdu",
    recap: "Il monte taoista Qingcheng e l'antico sistema di irrigazione di Dujiangyan (entrambi UNESCO) a mezz'ora di treno da Chengdu: boschi sempreverdi, templi e ponti sospesi. Perfetta anche in giornata senza spostare i bagagli.",
    transport: "AV da Chengdu ~30–50 min (~15–25 ¥ a tratta); si può fare A/R in giornata",
    season: "Fresco e umido (5–12°C) ma il bosco resta verde; pochissimi visitatori",
    activities: [
      { id: "qingcheng-front", name: "Monte Qingcheng (versante anteriore)", description: "Templi taoisti nel bosco; ingresso ~80 ¥ + funivia ~35 ¥", price: 29, selected: false },
      { id: "dujiangyan-anlan", name: "Dujiangyan e ponte sospeso Anlan", description: "Capolavoro idraulico del 256 a.C. ancora in funzione; ~80 ¥/pp", price: 20, selected: false },
      { id: "dujiangyan-panda", name: "Base panda di Dujiangyan", description: "Molto più tranquilla di quella di Chengdu; ~55 ¥/pp", price: 14, selected: false },
    ],
  },
  {
    id: "putuoshan",
    name: "Putuoshan",
    lat: 30.007,
    lng: 122.387,
    nights: 2,
    hotelNightly: 75,
    insertAfterId: "suzhou",
    recap: "L'isola sacra di Guanyin nell'arcipelago di Zhoushan: templi in riva al mare, spiagge e la statua alta 33 m. È la montagna buddhista «sul mare» vicina a Shanghai citata dal blog.",
    transport: "AV Suzhou/Shanghai → Ningbo ~1h30, poi bus + traghetto (~2h); il vento forte può fermare i traghetti",
    season: "Clima costiero mite (5–12°C); nei feriali d'inverno pellegrini e turisti pochissimi",
    activities: [
      { id: "putuo-puji", name: "Tempio Puji e isola a piedi", description: "Ingresso isola ~140 ¥ + tempio ~5 ¥; sentieri costieri tra i templi", price: 37, selected: false },
      { id: "putuo-guanyin", name: "Statua di Nanhai Guanyin", description: "La Guanyin dorata di 33 m sul promontorio; ~6 ¥/pp", price: 2, selected: false },
      { id: "putuo-fanyin", name: "Grotta di Fanyin", description: "Tempio sospeso sulla scogliera dove «si sente la voce del mare»; ~5 ¥", price: 2, selected: false },
    ],
  },
];

// Nomi in cinese di città e attività: servono per chiedere indicazioni o mostrarli a un tassista.
const STOP_ZH: Record<string, string> = {
  beijing: "北京",
  xian: "西安",
  chengdu: "成都",
  kunming: "昆明",
  zhangjiajie: "张家界",
  fenghuang: "凤凰古城",
  wuzhen: "乌镇",
  suzhou: "苏州",
  shanghai: "上海",
  chongqing: "重庆",
  guilin: "桂林·阳朔",
  lijiang: "丽江",
  dali: "大理",
  emeishan: "峨眉山",
  xiamen: "厦门",
  hangzhou: "杭州",
  huangshan: "黄山",
  pingyao: "平遥古城",
  huashan: "华山",
  luoyang: "洛阳",
  wudangshan: "武当山",
  "qingcheng-dujiangyan": "青城山·都江堰",
  putuoshan: "普陀山",
};

const ACTIVITY_ZH: Record<string, string> = {
  "forbidden-city": "故宫博物院",
  "great-wall": "慕田峪长城",
  "temple-heaven": "天坛公园",
  "summer-palace": "颐和园",
  "peking-duck": "四季民福烤鸭店",
  "hutong-houhai": "什刹海·后海",
  "lama-temple": "雍和宫",
  terracotta: "秦始皇兵马俑博物馆",
  "city-wall-bike": "西安城墙（南门）",
  "muslim-quarter": "回民街",
  "big-wild-goose-pagoda": "大雁塔",
  "tang-dynasty-show": "唐乐宫",
  pandas: "成都大熊猫繁育研究基地",
  "sichuan-opera": "蜀风雅韵（川剧变脸）",
  "peoples-park": "人民公园·鹤鸣茶社",
  "jinli-street": "锦里·武侯祠",
  "leshan-buddha": "乐山大佛",
  "wenshu-monastery": "文殊院",
  "stone-forest": "石林风景区",
  "green-lake-gulls": "翠湖公园",
  "western-hills-dragon-gate": "西山龙门",
  "dianchi-haigeng": "海埂大坝",
  "yuantong-temple": "圆通寺",
  "flower-bird-market": "景星花鸟市场",
  "forest-park": "张家界国家森林公园",
  "tianmen-mountain": "天门山",
  "grand-canyon-glass-bridge": "张家界大峡谷玻璃桥",
  "bailong-elevator": "百龙天梯",
  "tianzi-cable-car": "天子山索道",
  tuojiang: "沱江泛舟",
  "old-town-night": "凤凰古城",
  "combo-ticket-attractions": "凤凰古城景点联票",
  "stepping-stones-bridges": "沱江跳岩",
  xizha: "西栅景区",
  "canal-night-boat": "乌镇摇橹船",
  "dongzha-morning": "东栅景区",
  "folk-shows": "乌镇民俗表演",
  "humble-garden": "拙政园",
  "pingjiang-road": "平江路",
  "suzhou-museum": "苏州博物馆",
  "master-of-nets-night": "网师园",
  "tiger-hill": "虎丘",
  "shantang-street": "山塘街",
  "bund-night": "外滩",
  tower: "上海中心大厦",
  "yu-garden": "豫园",
  "huangpu-cruise": "黄浦江游船",
  "french-concession": "武康路·法租界",
  "shanghai-museum": "上海博物馆",
  "hongya-cave": "洪崖洞",
  "dazu-rock-carvings": "大足石刻",
  "yangtze-cableway": "长江索道",
  "li-river-cruise": "漓江游船",
  "yulong-bamboo-raft": "遇龙河竹筏",
  "reed-flute-cave": "芦笛岩",
  "jade-dragon-snow-mountain": "玉龙雪山",
  "lijiang-old-town": "丽江古城·黑龙潭",
  "shuhe-old-town": "束河古镇",
  "three-pagodas": "崇圣寺三塔",
  "erhai-lake-loop": "洱海",
  "cangshan-cableway": "苍山索道",
  "cima-dorata-jinding": "峨眉山金顶",
  "buddha-gigante-leshan": "乐山大佛",
  "terme-di-emei": "峨眉山温泉",
  "gulangyu-sunlight-rock": "鼓浪屿·日光岩",
  "tempio-nanputuo": "南普陀寺",
  "zengcuoan-lungomare": "曾厝垵",
  "crociera-lago-ovest": "西湖游船",
  "lingyin-feilai-feng": "灵隐寺·飞来峰",
  "villaggio-te-longjing": "龙井村",
  "vetta-huangshan": "黄山",
  "borgo-hongcun": "宏村",
  "borgo-xidi": "西递",
  "pingyao-pass": "平遥古城通票",
  "pingyao-qiao": "乔家大院",
  "pingyao-shuanglin": "双林寺",
  "huashan-west-cable": "华山西峰索道",
  "huashan-plank-walk": "长空栈道",
  "huashan-peaks-loop": "华山五峰",
  "longmen-grottoes": "龙门石窟",
  "shaolin-monastery": "少林寺",
  "white-horse-temple": "白马寺",
  "wudang-golden-summit": "武当山金顶",
  "wudang-zixiao": "紫霄宫",
  "wudang-taichi": "武当太极",
  "qingcheng-front": "青城山前山",
  "dujiangyan-anlan": "都江堰·安澜索桥",
  "dujiangyan-panda": "都江堰熊猫谷",
  "putuo-puji": "普济禅寺",
  "putuo-guanyin": "南海观音",
  "putuo-fanyin": "梵音洞",
};

function enrichStopsZh(stops: Stop[]): Stop[] {
  return stops.map((stop) => ({
    ...stop,
    nameZh: stop.nameZh || STOP_ZH[stop.id],
    activities: stop.activities.map((activity) => ({ ...activity, nameZh: activity.nameZh || ACTIVITY_ZH[activity.id] })),
  }));
}

function enrichScheduleZh(items: ScheduleItem[], stops: Stop[]): ScheduleItem[] {
  return items.map((item) => ({
    ...item,
    nameZh: item.nameZh || (item.sourceActivityId ? ACTIVITY_ZH[item.sourceActivityId] : undefined),
    locationZh: item.locationZh || (scheduleKind(item) === "activity" ? stops.find((stop) => stop.id === item.stopId)?.nameZh || STOP_ZH[item.stopId] : undefined),
  }));
}

const initialHotelStays = makeDefaultHotelStays(initialStops);

const initialLegs: Leg[] = [
  { id: "beijing-xian", fromId: "beijing", toId: "xian", mode: "🚄 Alta velocità", duration: "4h30–5h", cost: 120, included: true, note: "Beijing West → Xi’an North" },
  { id: "xian-chengdu", fromId: "xian", toId: "chengdu", mode: "🚄 Alta velocità", duration: "3h30–4h", cost: 95, included: true, note: "Xi’an North → Chengdu East" },
  { id: "chengdu-kunming", fromId: "chengdu", toId: "kunming", mode: "✈️ Volo diretto", duration: "1h30", cost: 150, included: true, note: "Protegge mezza giornata" },
  { id: "kunming-zhangjiajie", fromId: "kunming", toId: "zhangjiajie", mode: "🚄 Treno con cambio", duration: "5–11h30", cost: 110, included: true, note: "Verificare Huaihua o Changsha" },
  { id: "zhangjiajie-fenghuang", fromId: "zhangjiajie", toId: "fenghuang", mode: "🚄 Treno + Didi", duration: "~2h", cost: 45, included: true, note: "Arrivo a Fenghuanggucheng" },
  { id: "fenghuang-wuzhen", fromId: "fenghuang", toId: "wuzhen", mode: "🚄 Treni via Changsha", duration: "7–9h", cost: 130, included: true, note: "La tratta più delicata" },
  { id: "wuzhen-suzhou", fromId: "wuzhen", toId: "suzhou", mode: "🚕 Didi / transfer", duration: "1h30–2h", cost: 55, included: true, note: "Alternativa: bus diretto" },
  { id: "suzhou-shanghai", fromId: "suzhou", toId: "shanghai", mode: "🚄 Alta velocità", duration: "25–40 min", cost: 20, included: true, note: "Preferire stazioni centrali" },
];

const initialSchedule: ScheduleItem[] = [
  { id: "d01-arrival", date: "2026-11-17", stopId: "beijing", startTime: "12:25", endTime: "15:30", name: "Arrivo a Pechino e transfer", category: "trasporto", location: "PEK → hotel", notes: "Ritiro bagagli e check-in. Non fissare attività impegnative.", price: 0, bookingStatus: "prenotato" },
  { id: "d01-evening", date: "2026-11-17", stopId: "beijing", startTime: "17:30", endTime: "20:00", name: "Passeggiata nei hutong e cena", category: "cibo", location: "Shichahai / Gulou", notes: "Serata leggera per assorbire il fuso orario.", price: 35, bookingStatus: "non-serve" },
  { id: "d02-forbidden", date: "2026-11-18", stopId: "beijing", startTime: "08:30", endTime: "13:00", name: "Tian’anmen e Città Proibita", category: "visita", location: "Ingresso Meridian Gate", notes: "Passaporti con sé. Prenotare appena apre la finestra ufficiale.", price: 24, bookingStatus: "da-prenotare", sourceActivityId: "forbidden-city" },
  { id: "d02-jingshan", date: "2026-11-18", stopId: "beijing", startTime: "14:00", endTime: "17:00", name: "Jingshan e Beihai", category: "visita", location: "Jingshan Park", notes: "Salita al belvedere prima del tramonto.", price: 5, bookingStatus: "non-serve" },
  { id: "d03-wall", date: "2026-11-19", stopId: "beijing", startTime: "07:30", endTime: "16:30", name: "Grande Muraglia di Mutianyu", category: "visita", location: "Mutianyu", notes: "Partenza presto; verificare transfer privato o bus turistico.", price: 110, bookingStatus: "da-prenotare", sourceActivityId: "great-wall" },
  { id: "d03-duck", date: "2026-11-19", stopId: "beijing", startTime: "19:00", endTime: "21:00", name: "Cena con anatra alla pechinese", category: "cibo", location: "Dongcheng", notes: "Prenotare un ristorante vicino all’hotel.", price: 55, bookingStatus: "da-prenotare" },
  { id: "d04-train", date: "2026-11-20", stopId: "xian", startTime: "08:00", endTime: "14:30", name: "Treno Pechino → Xi’an", category: "trasporto", location: "Beijing West → Xi’an North", notes: "Arrivare in stazione almeno 60 minuti prima.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d04-quarter", date: "2026-11-20", stopId: "xian", startTime: "17:30", endTime: "20:30", name: "Quartiere musulmano e Drum Tower", category: "cibo", location: "Huimin Jie", notes: "Street food e prima passeggiata sulle mura.", price: 30, bookingStatus: "non-serve" },
  { id: "d05-terracotta", date: "2026-11-21", stopId: "xian", startTime: "08:00", endTime: "14:00", name: "Esercito di Terracotta", category: "visita", location: "Emperor Qinshihuang’s Mausoleum", notes: "Transfer A/R; guida opzionale.", price: 60, bookingStatus: "da-prenotare", sourceActivityId: "terracotta" },
  { id: "d05-wall", date: "2026-11-21", stopId: "xian", startTime: "16:00", endTime: "19:00", name: "Mura di Xi’an al tramonto", category: "visita", location: "South Gate", notes: "Valutare noleggio bici in base al meteo.", price: 18, bookingStatus: "non-serve" },
  { id: "d06-train", date: "2026-11-22", stopId: "chengdu", startTime: "09:00", endTime: "14:30", name: "Treno Xi’an → Chengdu", category: "trasporto", location: "Xi’an North → Chengdu East", notes: "Check-in hotel e pomeriggio tranquillo.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d06-jinli", date: "2026-11-22", stopId: "chengdu", startTime: "17:00", endTime: "20:30", name: "Jinli Street e cena Sichuan", category: "cibo", location: "Jinli Ancient Street", notes: "Chiedere livello di piccantezza medio.", price: 40, bookingStatus: "non-serve" },
  { id: "d07-pandas", date: "2026-11-23", stopId: "chengdu", startTime: "07:00", endTime: "12:30", name: "Chengdu Panda Base", category: "visita", location: "Research Base of Giant Panda Breeding", notes: "Essere all’ingresso all’apertura: i panda sono più attivi al mattino.", price: 30, bookingStatus: "da-prenotare", sourceActivityId: "pandas" },
  { id: "d07-tea", date: "2026-11-23", stopId: "chengdu", startTime: "15:00", endTime: "18:00", name: "People’s Park e casa da tè", category: "tempo-libero", location: "Heming Teahouse", notes: "Pomeriggio lento; eventuale opera Sichuan la sera.", price: 20, bookingStatus: "non-serve" },
  { id: "d08-flight", date: "2026-11-24", stopId: "kunming", startTime: "09:00", endTime: "13:00", name: "Volo Chengdu → Kunming", category: "trasporto", location: "CTU/TFU → KMG", notes: "Controllare aeroporto di partenza prima di prenotare.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d08-lake", date: "2026-11-24", stopId: "kunming", startTime: "16:00", endTime: "19:00", name: "Green Lake e Yuantong Street", category: "tempo-libero", location: "Cuihu Park", notes: "Passeggiata di orientamento e cena Yunnan.", price: 25, bookingStatus: "non-serve" },
  { id: "d09-stone", date: "2026-11-25", stopId: "kunming", startTime: "08:00", endTime: "17:00", name: "Foresta di Pietra di Shilin", category: "visita", location: "Shilin Scenic Area", notes: "Escursione intera giornata; portare strato antivento.", price: 80, bookingStatus: "da-prenotare", sourceActivityId: "stone-forest" },
  { id: "d10-dianchi", date: "2026-11-26", stopId: "kunming", startTime: "09:30", endTime: "13:00", name: "Dianchi Lake e Western Hills", category: "visita", location: "Haigeng Park", notes: "Tenere il pomeriggio libero per lavanderia e preparazione treno.", price: 25, bookingStatus: "non-serve" },
  { id: "d10-buffer", date: "2026-11-26", stopId: "kunming", startTime: "15:00", endTime: "18:00", name: "Tempo cuscinetto e organizzazione", category: "tempo-libero", location: "Hotel / centro", notes: "Controllare biglietti e meteo per Zhangjiajie.", price: 0, bookingStatus: "non-serve" },
  { id: "d11-transfer", date: "2026-11-27", stopId: "zhangjiajie", startTime: "07:30", endTime: "16:30", name: "Kunming → Zhangjiajie", category: "trasporto", location: "Treno con cambio / volo", notes: "Tratta critica: bloccare l’opzione definitiva appena escono gli orari.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d11-checkin", date: "2026-11-27", stopId: "zhangjiajie", startTime: "18:00", endTime: "20:00", name: "Cena e acquisti a Wulingyuan", category: "cibo", location: "Wulingyuan", notes: "Dopo il check-in, acquistare snack e acqua per il parco.", price: 25, bookingStatus: "non-serve" },
  { id: "d12-park", date: "2026-11-28", stopId: "zhangjiajie", startTime: "07:30", endTime: "17:30", name: "Zhangjiajie National Forest Park", category: "visita", location: "Wulingyuan Entrance", notes: "Itinerario Yuanjiajie + Tianzi Mountain; adattare a meteo e code.", price: 90, bookingStatus: "da-prenotare", sourceActivityId: "forest-park" },
  { id: "d13-fenghuang", date: "2026-11-29", stopId: "fenghuang", startTime: "09:00", endTime: "12:00", name: "Trasferimento a Fenghuang", category: "trasporto", location: "Zhangjiajie → Fenghuanggucheng", notes: "Treno veloce e Didi fino all’alloggio.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d13-river", date: "2026-11-29", stopId: "fenghuang", startTime: "15:00", endTime: "20:30", name: "Città antica e Tuojiang illuminato", category: "visita", location: "Fenghuang Ancient Town", notes: "Barca prima del tramonto; passeggiata serale.", price: 15, bookingStatus: "non-serve", sourceActivityId: "tuojiang" },
  { id: "d14-wuzhen", date: "2026-11-30", stopId: "wuzhen", startTime: "07:00", endTime: "16:00", name: "Fenghuang → Wuzhen", category: "trasporto", location: "Via Changsha / Tongxiang", notes: "Seconda tratta critica; lasciare margine tra i cambi.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d14-xizha", date: "2026-11-30", stopId: "wuzhen", startTime: "17:30", endTime: "20:30", name: "Xizha di sera", category: "visita", location: "Xizha Scenic Area", notes: "Dormire dentro o vicino all’area scenica.", price: 40, bookingStatus: "da-prenotare", sourceActivityId: "xizha" },
  { id: "d15-suzhou", date: "2026-12-01", stopId: "suzhou", startTime: "09:00", endTime: "11:00", name: "Transfer Wuzhen → Suzhou", category: "trasporto", location: "Hotel → Suzhou", notes: "Didi o transfer prenotato.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d15-gardens", date: "2026-12-01", stopId: "suzhou", startTime: "12:00", endTime: "17:00", name: "Giardini classici e Pingjiang Road", category: "visita", location: "Humble Administrator’s Garden", notes: "Giardino prima, canali e cena dopo.", price: 20, bookingStatus: "da-prenotare", sourceActivityId: "humble-garden" },
  { id: "d16-shanghai", date: "2026-12-02", stopId: "shanghai", startTime: "09:00", endTime: "11:30", name: "Treno Suzhou → Shanghai", category: "trasporto", location: "Suzhou → Shanghai", notes: "Preferire Hongqiao se comodo per l’hotel.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d16-bund", date: "2026-12-02", stopId: "shanghai", startTime: "14:00", endTime: "20:00", name: "Concessione Francese e Bund", category: "visita", location: "Xintiandi → Bund", notes: "Arrivare sul Bund poco prima dell’accensione delle luci.", price: 20, bookingStatus: "non-serve" },
  { id: "d17-shanghai", date: "2026-12-03", stopId: "shanghai", startTime: "09:30", endTime: "13:00", name: "Yu Garden e Old City", category: "visita", location: "Yuyuan", notes: "Ultimi acquisti senza allontanarsi troppo.", price: 20, bookingStatus: "da-prenotare" },
  { id: "d17-tower", date: "2026-12-03", stopId: "shanghai", startTime: "16:00", endTime: "19:00", name: "Shanghai Tower e ultima cena", category: "visita", location: "Lujiazui", notes: "Scegliere fascia tramonto; preparare i bagagli prima di uscire.", price: 45, bookingStatus: "da-prenotare", sourceActivityId: "tower" },
];

const defaultChecklist = [
  "Confermare ritmo e tappe insieme",
  "Prenotare hotel cancellabili",
  "Risolvere Kunming → Zhangjiajie",
  "Risolvere Fenghuang → Wuzhen",
  "Prenotare ingressi di Pechino",
  "Verificare visto / ingresso in Cina",
  "Preparare eSIM, VPN e mappe offline",
  "Confermare assicurazione viaggio",
];

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const yuan = new Intl.NumberFormat("it-IT", { style: "currency", currency: "CNY" });
const shortDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "long" });

function normalizePlanData(value: unknown): PlanData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<PlanData>;
  if (!Array.isArray(data.stops) || !Array.isArray(data.legs) || !Array.isArray(data.scheduleItems)) return null;

  const needsItineraryRestore = (data.itineraryVersion || 0) < ITINERARY_SCHEMA_VERSION;
  const normalizedSchedule = data.scheduleItems
    .map(normalizeScheduleItem)
    .filter((item) => scheduleKind(item) !== "hotel");
  const stops = needsItineraryRestore ? mergeStopsWithDefaults(data.stops) : data.stops;
  const legs = needsItineraryRestore ? mergeById(initialLegs, data.legs) : data.legs;
  const scheduleItems = needsItineraryRestore
    ? mergeById(initialSchedule.map(normalizeScheduleItem), normalizedSchedule)
        .sort((left, right) => `${left.date}-${left.startTime}`.localeCompare(`${right.date}-${right.startTime}`))
    : normalizedSchedule;
  const savedHotels = Array.isArray(data.hotelStays) ? data.hotelStays : [];
  const mergedHotels = needsItineraryRestore
    ? mergeById(makeDefaultHotelStays(stops), savedHotels)
    : savedHotels;
  // Ogni destinazione deve avere il suo blocco hotel: se manca, ne aggiungiamo uno "da prenotare" con le date della tappa.
  const existingHotelIds = new Set(mergedHotels.map((stay) => stay.id));
  const hotelStays = [
    ...mergedHotels,
    ...makeDefaultHotelStays(stops).filter((defaultStay) => !existingHotelIds.has(defaultStay.id) && !mergedHotels.some((stay) => stay.stopId === defaultStay.stopId)),
  ];

  const stopsZh = enrichStopsZh(stops);

  return {
    itineraryVersion: ITINERARY_SCHEMA_VERSION,
    stops: stopsZh,
    legs,
    scheduleItems: enrichScheduleZh(scheduleItems, stopsZh),
    hotelStays,
    checklist: Array.isArray(data.checklist) && data.checklist.length === defaultChecklist.length ? data.checklist : defaultChecklist.map(() => false),
    extraChecklist: Array.isArray(data.extraChecklist)
      ? data.extraChecklist.filter((item): item is ChecklistItem => Boolean(item && typeof item === "object" && typeof (item as ChecklistItem).id === "string" && typeof (item as ChecklistItem).label === "string"))
      : [],
    sharedLinks: Array.isArray(data.sharedLinks)
      ? data.sharedLinks.filter((item): item is TripLink => Boolean(item && typeof item === "object" && typeof (item as TripLink).id === "string" && typeof (item as TripLink).url === "string"))
      : [],
    notes: typeof data.notes === "string" ? data.notes : "",
    cnyPerEuro: typeof data.cnyPerEuro === "number" ? data.cnyPerEuro : 8,
    costEntries: Array.isArray(data.costEntries) ? data.costEntries : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    customCategories: Array.isArray(data.customCategories) ? data.customCategories.filter((item): item is string => typeof item === "string") : [],
    dismissedSuggestions: Array.isArray(data.dismissedSuggestions) ? data.dismissedSuggestions.filter((item): item is string => typeof item === "string") : [],
    coverPhoto: typeof data.coverPhoto === "string" ? data.coverPhoto : "",
  };
}

function mergeById<T extends { id: string }>(defaults: T[], saved: T[]) {
  const savedById = new Map(saved.map((item) => [item.id, item]));
  const defaultIds = new Set(defaults.map((item) => item.id));
  return [
    ...defaults.map((item) => savedById.get(item.id) || item),
    ...saved.filter((item) => !defaultIds.has(item.id)),
  ];
}

function mergeStopsWithDefaults(savedStops: Stop[]) {
  const savedById = new Map(savedStops.map((stop) => [stop.id, stop]));
  const defaultIds = new Set(initialStops.map((stop) => stop.id));
  const restoredStops = initialStops.map((defaultStop) => {
    const savedStop = savedById.get(defaultStop.id);
    if (!savedStop) return defaultStop;
    return {
      ...defaultStop,
      ...savedStop,
      activities: mergeById(defaultStop.activities, savedStop.activities || []),
    };
  });
  return [...restoredStops, ...savedStops.filter((stop) => !defaultIds.has(stop.id))];
}

function inferScheduleKind(category: string): ScheduleKind {
  if (category === "trasporto" || category === "trasferimento") return "transport";
  if (category === "hotel" || category === "pernottamento") return "hotel";
  return "activity";
}

function normalizeScheduleItem(item: ScheduleItem): ScheduleItem {
  const kind = item.kind || inferScheduleKind(item.category);
  const routeParts = kind === "transport" ? item.location.split("→").map((part) => part.trim()).filter(Boolean) : [];
  return {
    ...item,
    kind,
    category: item.category === "trasporto" ? "trasferimento" : item.category === "hotel" ? "pernottamento" : item.category,
    fromLocation: item.fromLocation || (routeParts.length > 1 ? routeParts[0] : ""),
    location: routeParts.length > 1 ? routeParts.at(-1) || item.location : item.location,
  };
}

function makeDefaultHotelStays(stops: Stop[]): HotelStay[] {
  let cursor = new Date(ARRIVAL_DATE);
  return stops.map((stop) => {
    const checkInDate = dateKey(cursor);
    cursor = addDays(cursor, stop.nights);
    return {
      id: `hotel-${stop.id}`,
      stopId: stop.id,
      name: `Hotel da scegliere · ${stop.name}`,
      address: stop.name,
      checkInDate,
      checkOutDate: dateKey(cursor),
      nightlyPrice: stop.hotelNightly,
      currency: "EUR",
      bookingStatus: "da-prenotare",
      notes: "",
    };
  });
}

function scheduleKind(item: ScheduleItem): ScheduleKind {
  return item.kind || inferScheduleKind(item.category);
}

function googleMapsSearchUrl(place: string, city = "") {
  const queryText = [place, city].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`;
}

function googleMapsStopUrl(stop: Pick<Stop, "lat" | "lng" | "name">) {
  return `https://www.google.com/maps/search/?api=1&query=${stop.lat}%2C${stop.lng}`;
}

function mapLinkFor(item: ScheduleItem, city: string) {
  const customLink = safeExternalLink(item.mapUrl);
  if (customLink) return customLink;
  const place = item.location.split("→").at(-1)?.trim() || item.location.trim();
  return place ? googleMapsSearchUrl(place, city) : "";
}

function webSearchUrl(queryText: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(queryText)}`;
}

function translateZhUrl(text: string) {
  return `https://translate.google.com/?sl=auto&tl=zh-CN&text=${encodeURIComponent(text)}&op=translate`;
}

function safeExternalLink(value: string | undefined) {
  const link = value?.trim() || "";
  return /^(https?:\/\/|weixin:\/\/|alipays?:\/\/)/i.test(link) ? link : "";
}

function hotelNights(stay: HotelStay) {
  const checkIn = new Date(`${stay.checkInDate}T12:00:00`);
  const checkOut = new Date(`${stay.checkOutDate}T12:00:00`);
  return Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
}

// Prezzo totale del soggiorno: usa il totale inserito, altrimenti stima notti × prezzo/notte.
function hotelTotalPrice(stay: HotelStay) {
  return typeof stay.totalPrice === "number" && stay.totalPrice > 0 ? stay.totalPrice : hotelNights(stay) * stay.nightlyPrice;
}

// Categoria di budget in cui ricade un blocco d'agenda confermato.
function scheduleExpenseCategory(item: ScheduleItem): ExpenseCategory {
  if (scheduleKind(item) === "transport") return "trasporti";
  if (item.category === "cibo") return "cibo";
  return "attivita";
}

async function compressCoverPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Scegli un file immagine.");
  if (file.size > 12_000_000) throw new Error("La foto supera 12 MB.");

  const source = await createImageBitmap(file);
  const maxWidth = 1400;
  const maxHeight = 900;
  const scale = Math.min(1, maxWidth / source.width, maxHeight / source.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossibile preparare la foto.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();

  let quality = .8;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 560_000 && quality > .45) {
    quality -= .08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > 650_000) throw new Error("La foto resta troppo grande: scegline una più leggera.");
  return dataUrl;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function escapeMapText(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function loadLeaflet() {
  const leafletWindow = window as LeafletWindow;
  if (leafletWindow.L) return Promise.resolve(leafletWindow.L);
  if (leafletWindow.__chinaLeafletPromise) return leafletWindow.__chinaLeafletPromise;

  leafletWindow.__chinaLeafletPromise = new Promise<LeafletNamespace>((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const stylesheet = document.createElement("link");
      stylesheet.id = "leaflet-css";
      stylesheet.rel = "stylesheet";
      stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      stylesheet.crossOrigin = "";
      document.head.appendChild(stylesheet);
    }

    const complete = () => leafletWindow.L ? resolve(leafletWindow.L) : reject(new Error("Leaflet non disponibile"));
    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", complete, { once: true });
      existing.addEventListener("error", () => reject(new Error("Impossibile caricare Leaflet")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.crossOrigin = "";
    script.onload = complete;
    script.onerror = () => reject(new Error("Impossibile caricare Leaflet"));
    document.head.appendChild(script);
  });
  return leafletWindow.__chinaLeafletPromise;
}

function InteractiveRouteMap({
  stops,
  legs,
  suggestions,
  onSelect,
}: {
  stops: Stop[];
  legs: Leg[];
  suggestions: SuggestedStop[];
  onSelect: Dispatch<SetStateAction<string>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<string, LeafletMarker>>({});
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdMap: LeafletMap | null = null;
    loadLeaflet().then((leaflet) => {
      if (cancelled || !containerRef.current) return;
      if (mapRef.current) mapRef.current.remove();
      containerRef.current.innerHTML = "";

      createdMap = leaflet.map(containerRef.current, { scrollWheelZoom: false, zoomControl: true });
      mapRef.current = createdMap;
      leaflet.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; CARTO',
      }).addTo(createdMap);

      const markerMap: Record<string, LeafletMarker> = {};
      stops.forEach((stop, index) => {
        const marker = leaflet.marker([stop.lat, stop.lng], {
          icon: leaflet.divIcon({
            className: "route-pin-wrap",
            html: `<span class="route-pin ${index === 0 || index === stops.length - 1 ? "edge" : ""}">${index + 1}</span>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
          title: stop.name,
          alt: stop.name,
        });
        marker
          .addTo(createdMap as LeafletMap)
          .bindTooltip(stop.name, { permanent: index === 0 || index === stops.length - 1, direction: "top", offset: [0, -18], className: "route-tooltip" })
          .bindPopup(`<div class="route-popup"><b>${escapeMapText(stop.name)}</b><span>${stop.nights} ${stop.nights === 1 ? "notte" : "notti"}</span><small>Clicca per aprire attività e budget</small></div>`)
          .on("click", () => onSelect(stop.id));
        requestAnimationFrame(() => marker.getElement()?.setAttribute("aria-label", `${index + 1}. ${stop.name}`));
        markerMap[stop.id] = marker;
      });
      markersRef.current = markerMap;

      legs.forEach((leg) => {
        const from = stops.find((stop) => stop.id === leg.fromId);
        const to = stops.find((stop) => stop.id === leg.toId);
        if (!from || !to) return;
        leaflet.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
          color: leg.included ? "#e96f3b" : "#8f9994",
          weight: leg.included ? 4 : 3,
          opacity: leg.included ? .9 : .55,
          dashArray: leg.included ? undefined : "7 8",
        }).addTo(createdMap as LeafletMap).bindTooltip(`${from.name} → ${to.name} · ${leg.mode}`);
      });

      suggestions.forEach((suggestion) => {
        leaflet.marker([suggestion.lat, suggestion.lng], {
          icon: leaflet.divIcon({
            className: "route-pin-wrap",
            html: `<span class="route-pin suggested">?</span>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          title: `${suggestion.name} (da valutare)`,
          alt: `${suggestion.name} (da valutare)`,
        })
          .addTo(createdMap as LeafletMap)
          .bindTooltip(suggestion.name, { direction: "top", offset: [0, -15], className: "route-tooltip" })
          .bindPopup(`<div class="route-popup"><b>${escapeMapText(suggestion.name)}</b><span>Città da valutare · ${suggestion.nights} ${suggestion.nights === 1 ? "notte" : "notti"}</span><small>${escapeMapText(suggestion.transport)}</small></div>`);
      });

      const fitPoints = [
        ...stops.map((stop) => [stop.lat, stop.lng] as [number, number]),
        ...suggestions.map((suggestion) => [suggestion.lat, suggestion.lng] as [number, number]),
      ];
      createdMap.fitBounds(fitPoints, {
        padding: containerRef.current.clientWidth < 640 ? [18, 18] : [38, 38],
      });
      requestAnimationFrame(() => createdMap?.invalidateSize());
      setMapError("");
      setMapReady(true);
    }).catch(() => {
      if (!cancelled) setMapError("La cartografia non è disponibile. Controlla la connessione e ricarica la pagina.");
    });

    return () => {
      cancelled = true;
      if (createdMap) createdMap.remove();
      if (mapRef.current === createdMap) mapRef.current = null;
      markersRef.current = {};
    };
  }, [stops, legs, suggestions, onSelect]);

  return (
    <div className="real-map-shell">
      <div ref={containerRef} className="real-map" aria-label="Mappa interattiva dell’itinerario in Cina" />
      {!mapReady && !mapError && <div className="map-loading">Caricamento mappa geografica…</div>}
      {mapError && <div className="map-error">{mapError}</div>}
      {mapReady && <div className="map-tools"><button onClick={() => mapRef.current?.fitBounds(stops.map((stop) => [stop.lat, stop.lng] as [number, number]), { padding: [30, 30] })}>Rotta completa</button><button onClick={() => mapRef.current?.setView([31.1, 120.7], 8)}>Zoom Wuzhen–Shanghai</button></div>}
      <div className="map-legend"><span><i /> Tappa</span><span><i className="suggested" /> Da valutare</span><span><i className="route" /> Trasporto incluso</span><span><i className="route off" /> Escluso</span></div>
    </div>
  );
}

export function ChinaPlanner() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      const email = user?.email?.toLowerCase() || "";
      if (user && !ALLOWED_EMAILS.has(email)) {
        setAuthError("Questo account non è autorizzato per il planner.");
        await signOut(auth);
        setCurrentUser(null);
      } else {
        setCurrentUser(user);
      }
      setAuthReady(true);
    });
  }, []);

  async function login() {
    setSigningIn(true);
    setAuthError("");
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const email = credential.user.email?.toLowerCase() || "";
      if (!ALLOWED_EMAILS.has(email)) {
        await signOut(auth);
        setAuthError("Usa l’account di Alberto o quello di Sofia.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("popup-closed-by-user")) {
        setAuthError("Accesso non riuscito. Riprova con Google.");
      }
    } finally {
      setSigningIn(false);
    }
  }

  if (!authReady) {
    return <main className="access-page"><div className="access-card"><p className="eyebrow">Cina 2026</p><h1>Caricamento del planner…</h1></div></main>;
  }

  if (!currentUser) {
    return <main className="access-page">
      <div className="access-card">
        <p className="eyebrow">Alberto & Sofia · Cina 2026</p>
        <h1>Il viaggio, sempre con voi.</h1>
        <p>Accedi con uno dei due account autorizzati. Agenda, costi e note saranno sincronizzati tra computer e telefono.</p>
        <button className="google-login" onClick={login} disabled={signingIn}>{signingIn ? "Accesso…" : "Continua con Google"}</button>
        {authError && <p className="access-error">{authError}</p>}
        <small>Account autorizzati: Alberto e Sofia.</small>
      </div>
    </main>;
  }

  return <PlannerApp currentUser={currentUser} />;
}

function PlannerApp({ currentUser }: { currentUser: User }) {
  const [section, setSection] = useState("itinerary");
  const [stops, setStops] = useState<Stop[]>(initialStops);
  const [legs, setLegs] = useState<Leg[]>(initialLegs);
  const [nightsNotice, setNightsNotice] = useState("");
  const nightsNoticeTimer = useRef<number | null>(null);
  const [taxiInfo, setTaxiInfo] = useState<TaxiInfo | null>(null);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(initialSchedule);
  const [hotelStays, setHotelStays] = useState<HotelStay[]>(initialHotelStays);
  const [selectedDate, setSelectedDate] = useState("2026-11-17");
  const [selectedStopId, setSelectedStopId] = useState("beijing");
  const [newStopName, setNewStopName] = useState("");
  const [newScheduleItem, setNewScheduleItem] = useState({
    kind: "activity" as ScheduleKind,
    startTime: "09:00",
    endTime: "11:00",
    name: "",
    category: "visita",
    fromLocation: "",
    location: "",
    transportMode: "",
    mapUrl: "",
    notes: "",
    price: 0,
    currency: "EUR" as Currency,
    bookingStatus: "da-prenotare" as ScheduleItem["bookingStatus"],
  });
  const [newHotel, setNewHotel] = useState({
    stopId: "beijing",
    name: "",
    address: "",
    checkInDate: "2026-11-17",
    checkOutDate: "2026-11-18",
    totalPrice: 0,
    currency: "EUR" as Currency,
    bookingStatus: "da-prenotare" as HotelStay["bookingStatus"],
    confirmationNumber: "",
    paidBy: undefined as Payer | undefined,
    bookingUrl: "",
    mapUrl: "",
    notes: "",
  });
  const [checklist, setChecklist] = useState<boolean[]>(defaultChecklist.map(() => false));
  const [extraChecklist, setExtraChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [sharedLinks, setSharedLinks] = useState<TripLink[]>([]);
  const [newLink, setNewLink] = useState({ stopId: "", label: "", url: "" });
  const [notes, setNotes] = useState("");
  const [cnyPerEuro, setCnyPerEuro] = useState(8);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([
    { id: "food", label: "Cibo e bevande", amount: 900, currency: "EUR" },
    { id: "local", label: "Trasporti locali", amount: 300, currency: "EUR" },
    { id: "extras", label: "Assicurazione, connettività ed extra", amount: 720, currency: "EUR" },
  ]);
  const [newCost, setNewCost] = useState({ label: "", amount: 0, currency: "EUR" as Currency });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState({ label: "", amount: 0, currency: "EUR" as Currency, paidBy: "alberto" as Payer, category: "cibo" as ExpenseCategory });
  const [newClouActivity, setNewClouActivity] = useState({ name: "", price: 0 });
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [coverPhoto, setCoverPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "synced" | "error">("loading");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastCloudValueRef = useRef("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = normalizePlanData(JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) || "null"));
        if (saved) {
          setStops(saved.stops);
          setLegs(saved.legs);
          setScheduleItems(saved.scheduleItems);
          setHotelStays(saved.hotelStays);
          setChecklist(saved.checklist);
          setExtraChecklist(saved.extraChecklist);
          setSharedLinks(saved.sharedLinks);
          setNotes(saved.notes);
          setCnyPerEuro(saved.cnyPerEuro);
          setCostEntries(saved.costEntries);
          setExpenses(saved.expenses);
          setCustomCategories(saved.customCategories);
          setDismissedSuggestions(saved.dismissedSuggestions);
          setCoverPhoto(saved.coverPhoto || "");
        }
      } catch {
        // Mantiene i dati iniziali se il salvataggio locale non è leggibile.
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const planDocument = doc(db, "travel-plans", "china-2026");

    return onSnapshot(planDocument, async (snapshot) => {
      if (snapshot.exists()) {
        const remoteData = snapshot.data();
        const remotePlan = normalizePlanData(remoteData);
        if (!remotePlan) {
          setSyncStatus("error");
          return;
        }

        const serialized = JSON.stringify(remotePlan);
        lastCloudValueRef.current = serialized;
        setStops(remotePlan.stops);
        setLegs(remotePlan.legs);
        setScheduleItems(remotePlan.scheduleItems);
        setHotelStays(remotePlan.hotelStays);
        setChecklist(remotePlan.checklist);
        setExtraChecklist(remotePlan.extraChecklist);
        setSharedLinks(remotePlan.sharedLinks);
        setNotes(remotePlan.notes);
        setCnyPerEuro(remotePlan.cnyPerEuro);
        setCostEntries(remotePlan.costEntries);
        setExpenses(remotePlan.expenses);
        setCustomCategories(remotePlan.customCategories);
        setDismissedSuggestions(remotePlan.dismissedSuggestions);
        setCoverPhoto(remotePlan.coverPhoto || "");
        localStorage.setItem(PLAN_STORAGE_KEY, serialized);
        setCloudReady(true);
        setSyncStatus("synced");
        const updatedAt = remoteData.updatedAt as Timestamp | undefined;
        setLastSavedAt(updatedAt?.toDate?.() || new Date());
        if ((remoteData.itineraryVersion || 0) < ITINERARY_SCHEMA_VERSION) {
          try {
            await setDoc(planDocument, { ...remotePlan, updatedAt: serverTimestamp() });
            await addDoc(collection(db, "travel-plans", "china-2026", "change-log"), {
              authorEmail: currentUser.email || "",
              authorName: currentUser.displayName || currentUser.email || "Utente",
              action: "Itinerario ripristinato",
              detail: "Recuperate tutte le tappe, le giornate e le attività del piano originale.",
              createdAt: serverTimestamp(),
            });
            setLastSavedAt(new Date());
          } catch {
            setSyncStatus("error");
          }
        }
        return;
      }

      let seedPlan: PlanData = {
        itineraryVersion: ITINERARY_SCHEMA_VERSION,
        stops: initialStops,
        legs: initialLegs,
        scheduleItems: initialSchedule,
        hotelStays: initialHotelStays,
        checklist: defaultChecklist.map(() => false),
        extraChecklist: [],
        sharedLinks: [],
        notes: "",
        cnyPerEuro: 8,
        customCategories: [],
        dismissedSuggestions: [],
        coverPhoto: "",
        expenses: [],
        costEntries: [
          { id: "food", label: "Cibo e bevande", amount: 900, currency: "EUR" },
          { id: "local", label: "Trasporti locali", amount: 300, currency: "EUR" },
          { id: "extras", label: "Assicurazione, connettività ed extra", amount: 720, currency: "EUR" },
        ],
      };

      try {
        seedPlan = normalizePlanData(JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) || "null")) || seedPlan;
      } catch {
        // Usa il piano iniziale se il vecchio salvataggio non è leggibile.
      }
      seedPlan = { ...seedPlan, stops: enrichStopsZh(seedPlan.stops), scheduleItems: enrichScheduleZh(seedPlan.scheduleItems, enrichStopsZh(seedPlan.stops)) };

      const serialized = JSON.stringify(seedPlan);
      lastCloudValueRef.current = serialized;
      try {
        await setDoc(planDocument, { ...seedPlan, updatedAt: serverTimestamp() });
        setCloudReady(true);
        setSyncStatus("synced");
        setLastSavedAt(new Date());
      } catch {
        setSyncStatus("error");
      }
    }, () => {
      setSyncStatus("error");
    });
  }, [hydrated, currentUser]);

  useEffect(() => {
    if (!hydrated) return;
    const planData: PlanData = {
      itineraryVersion: ITINERARY_SCHEMA_VERSION,
      stops,
      legs,
      scheduleItems,
      hotelStays,
      checklist,
      extraChecklist,
      sharedLinks,
      notes,
      cnyPerEuro,
      costEntries,
      expenses,
      customCategories,
      dismissedSuggestions,
      coverPhoto,
    };
    const serialized = JSON.stringify(planData);
    localStorage.setItem(PLAN_STORAGE_KEY, serialized);

    if (!cloudReady || serialized === lastCloudValueRef.current) return;
    setSyncStatus("saving");
    const timer = window.setTimeout(async () => {
      try {
        const safePlanData = JSON.parse(serialized) as PlanData;
        await setDoc(doc(db, "travel-plans", "china-2026"), { ...safePlanData, updatedAt: serverTimestamp() });
        lastCloudValueRef.current = serialized;
        setSyncStatus("synced");
        setLastSavedAt(new Date());
      } catch {
        setSyncStatus("error");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [stops, legs, scheduleItems, hotelStays, checklist, extraChecklist, sharedLinks, notes, cnyPerEuro, costEntries, expenses, customCategories, dismissedSuggestions, coverPhoto, hydrated, cloudReady]);

  useEffect(() => {
    if (!hydrated) return;
    const logQuery = query(collection(db, "travel-plans", "china-2026", "change-log"), orderBy("createdAt", "desc"), limit(80));
    return onSnapshot(logQuery, (snapshot) => {
      setChangeLog(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as ChangeLogEntry)));
    }, () => setChangeLog([]));
  }, [hydrated]);

  useEffect(() => {
    if (section !== "calendar") return;
    document.querySelector(".day-strip button.active")?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedDate, section]);

  const timeline = useMemo(() => {
    return stops.map((stop, index) => {
      const previousNights = stops.slice(0, index).reduce((sum, item) => sum + item.nights, 0);
      const arrival = addDays(ARRIVAL_DATE, previousNights);
      const departure = addDays(arrival, stop.nights);
      return { stop, arrival, departure };
    });
  }, [stops]);

  function toEuro(value: number, currency: Currency | undefined) {
    return currency === "CNY" ? value / Math.max(cnyPerEuro, 0.01) : value;
  }

  function formatCost(value: number, currency: Currency | undefined) {
    return currency === "CNY" ? yuan.format(value) : euro.format(value);
  }

  const normalizedLegs = useMemo(() => {
    return stops.slice(0, -1).map((stop, index) => {
      const next = stops[index + 1];
      return legs.find((leg) => leg.fromId === stop.id && leg.toId === next.id) ?? {
        id: `${stop.id}-${next.id}`,
        fromId: stop.id,
        toId: next.id,
        mode: "Trasporto da definire",
        duration: "Da verificare",
        cost: 0,
        included: true,
        note: "Inserisci qui la soluzione scelta",
      };
    });
  }, [stops, legs]);

  const selectedStop = stops.find((stop) => stop.id === selectedStopId) ?? stops[0];
  const usedNights = stops.reduce((sum, stop) => sum + stop.nights, 0);
  const remainingNights = TRIP_NIGHTS - usedNights;
  const plannedActivities = scheduleItems.map((item) => ({ ...item, city: stops.find((stop) => stop.id === item.stopId)?.name || "Tappa" }));
  const budgetedActivities = plannedActivities.filter((item) => item.price > 0);
  const activitiesCost = budgetedActivities.reduce((sum, item) => sum + toEuro(item.price, item.currency), 0);
  const hotelCost = hotelStays.reduce((sum, stay) => sum + toEuro(hotelTotalPrice(stay), stay.currency), 0);
  const transportCost = normalizedLegs.filter((leg) => leg.included).reduce((sum, leg) => sum + toEuro(leg.cost, leg.currency), 0);
  const addedCostsTotal = costEntries.reduce((sum, entry) => sum + toEuro(entry.amount, entry.currency), 0);
  const totalBudget = FLIGHTS_COST + hotelCost + transportCost + activitiesCost + addedCostsTotal;

  const calendarDays = useMemo(() => {
    const entries: Array<{ date: Date; dateKey: string; stopId: string; city: string; type: string; detail: string }> = [];
    timeline.forEach((item, stopIndex) => {
      for (let night = 0; night < item.stop.nights; night++) {
        const date = addDays(item.arrival, night);
        const leg = stopIndex > 0 ? normalizedLegs[stopIndex - 1] : null;
        entries.push({
          date,
          dateKey: dateKey(date),
          stopId: item.stop.id,
          city: item.stop.name,
          type: night === 0 && stopIndex > 0 ? "travel" : "stay",
          detail: night === 0 && leg?.included ? `${leg.mode} · ${leg.duration}` : "Giornata in città",
        });
      }
    });
    // Le date del viaggio sono fisse: i giorni senza tappa restano visibili come "da pianificare".
    for (let night = usedNights; night < TRIP_NIGHTS; night++) {
      const date = addDays(ARRIVAL_DATE, night);
      entries.push({
        date,
        dateKey: dateKey(date),
        stopId: "",
        city: "Da pianificare",
        type: "free",
        detail: "Notte ancora da assegnare a una tappa",
      });
    }
    return entries;
  }, [timeline, normalizedLegs, usedNights]);

  const selectedDay = calendarDays.find((entry) => entry.dateKey === selectedDate) ?? calendarDays[0];
  const selectedDayItems = scheduleItems
    .filter((item) => item.date === selectedDay?.dateKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const selectedDayHotels = hotelStays.filter((stay) => selectedDay && stay.checkInDate <= selectedDay.dateKey && stay.checkOutDate > selectedDay.dateKey);
  const conflictingIds = new Set<string>();
  selectedDayItems.forEach((item, index) => {
    const previous = selectedDayItems[index - 1];
    if (previous && item.startTime < previous.endTime) {
      conflictingIds.add(previous.id);
      conflictingIds.add(item.id);
    }
  });
  const dayCost = selectedDayItems.reduce((sum, item) => sum + toEuro(item.price, item.currency), 0);
  const bookingCount = scheduleItems.filter((item) => item.bookingStatus === "da-prenotare").length;
  // Consuntivo automatico: tutto ciò che è già prenotato/confermato entra nello "speso" senza doverlo registrare a mano.
  const confirmedEntries = [
    ...hotelStays.filter((stay) => stay.bookingStatus === "prenotato").map((stay) => ({
      id: `conf-${stay.id}`,
      label: stay.name,
      date: stay.checkInDate,
      detail: `Hotel prenotato${stay.confirmationNumber ? ` · n. ${stay.confirmationNumber}` : ""}`,
      amount: hotelTotalPrice(stay),
      currency: stay.currency,
      paidBy: stay.paidBy,
      category: "hotel" as ExpenseCategory,
    })),
    ...scheduleItems.filter((item) => item.bookingStatus === "prenotato" && item.price > 0).map((item) => ({
      id: `conf-${item.id}`,
      label: item.name,
      date: item.date,
      detail: "Prenotato in agenda",
      amount: item.price,
      currency: item.currency,
      paidBy: item.paidBy,
      category: scheduleExpenseCategory(item),
    })),
  ];
  const confirmedTotal = confirmedEntries.reduce((sum, entry) => sum + toEuro(entry.amount, entry.currency), 0);
  const confirmedByPayer = (payer: Payer) => confirmedEntries.filter((entry) => entry.paidBy === payer).reduce((sum, entry) => sum + toEuro(entry.amount, entry.currency), 0);
  const spentTotal = FLIGHTS_COST + confirmedTotal + expenses.reduce((sum, expense) => sum + toEuro(expense.amount, expense.currency), 0);
  // I voli sono già pagati in pari: metà a testa, quindi non spostano il bilancio.
  const spentByPayer: Record<Payer, number> = {
    alberto: FLIGHTS_COST / 2 + confirmedByPayer("alberto") + expenses.filter((expense) => expense.paidBy === "alberto").reduce((sum, expense) => sum + toEuro(expense.amount, expense.currency), 0),
    sofia: FLIGHTS_COST / 2 + confirmedByPayer("sofia") + expenses.filter((expense) => expense.paidBy === "sofia").reduce((sum, expense) => sum + toEuro(expense.amount, expense.currency), 0),
  };
  const splitBalance = (spentByPayer.alberto - spentByPayer.sofia) / 2;
  const spentInCategory = (categories: ExpenseCategory[]) =>
    expenses.filter((expense) => categories.includes(expense.category)).reduce((sum, expense) => sum + toEuro(expense.amount, expense.currency), 0)
    + confirmedEntries.filter((entry) => categories.includes(entry.category)).reduce((sum, entry) => sum + toEuro(entry.amount, entry.currency), 0)
    + (categories.includes("voli") ? FLIGHTS_COST : 0);
  const bookedStaysCount = hotelStays.filter((stay) => stay.bookingStatus === "prenotato").length;
  const budgetComparison = [
    { key: "voli", label: "Voli internazionali", note: "Già pagati · divisi a metà", planned: FLIGHTS_COST, spent: spentInCategory(["voli"]) },
    { key: "hotel", label: "Hotel", note: `${hotelStays.reduce((sum, stay) => sum + hotelNights(stay), 0)} notti · ${bookedStaysCount}/${hotelStays.length} soggiorni prenotati`, planned: hotelCost, spent: spentInCategory(["hotel"]) },
    { key: "trasporti", label: "Trasporti", note: `${normalizedLegs.filter((leg) => leg.included).length} tratte tra le tappe`, planned: transportCost, spent: spentInCategory(["trasporti"]) },
    { key: "attivita", label: "Attività a pagamento", note: `${budgetedActivities.length} blocchi in agenda con costo`, planned: activitiesCost, spent: spentInCategory(["attivita"]) },
    { key: "cibo-extra", label: "Cibo & extra", note: `${costEntries.length} voci pianificate`, planned: addedCostsTotal, spent: spentInCategory(["cibo", "extra"]) },
  ];
  const dayExpenses = expenses.filter((expense) => expense.date === selectedDay?.dateKey).sort((a, b) => a.id.localeCompare(b.id));
  const dayExpensesTotal = dayExpenses.reduce((sum, expense) => sum + toEuro(expense.amount, expense.currency), 0);
  const selectedStopDays = calendarDays.filter((day) => day.stopId === selectedStop.id);
  const visibleSuggestions = SUGGESTED_STOPS.filter((suggestion) => !stops.some((stop) => stop.id === suggestion.id) && !dismissedSuggestions.includes(suggestion.id));
  const categoryOptions = useMemo(() => [
    ...BUILT_IN_CATEGORIES,
    ...customCategories.map((category) => ({ value: category, label: category })),
  ], [customCategories]);

  function recordChange(action: string, detail: string) {
    const email = currentUser.email?.toLowerCase() || "";
    const authorName = email === "sofiakovaleva1998@gmail.com" ? "Sofia" : email === "bebroggi@gmail.com" ? "Alberto" : currentUser.displayName || email;
    void addDoc(collection(db, "travel-plans", "china-2026", "change-log"), {
      authorEmail: email,
      authorName,
      action,
      detail,
      createdAt: serverTimestamp(),
    }).catch(() => undefined);
  }

  function logScheduleField(item: ScheduleItem, field: string, value: string) {
    recordChange("Modifica agenda", `${item.name}: ${field} ${value}`);
  }

  async function changeCoverPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError("");
    try {
      const compressed = await compressCoverPhoto(file);
      setCoverPhoto(compressed);
      recordChange("Copertina aggiornata", "Ha caricato una nuova foto di viaggio");
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Non riesco a preparare questa foto.");
    }
  }

  function removeCoverPhoto() {
    setCoverPhoto("");
    recordChange("Copertina rimossa", "Ha rimosso la foto di viaggio");
  }

  function addCustomCategory() {
    const category = newCategory.trim();
    if (!category || categoryOptions.some((item) => item.value.toLocaleLowerCase("it") === category.toLocaleLowerCase("it"))) return;
    setCustomCategories((current) => [...current, category]);
    setNewScheduleItem((current) => ({ ...current, category }));
    setNewCategory("");
    recordChange("Categoria aggiunta", category);
  }

  function updateStop(id: string, patch: Partial<Stop>) {
    setStops((current) => current.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)));
  }

  function showNightsNotice(message: string) {
    setNightsNotice(message);
    if (nightsNoticeTimer.current) window.clearTimeout(nightsNoticeTimer.current);
    nightsNoticeTimer.current = window.setTimeout(() => setNightsNotice(""), 7000);
  }

  function changeStopNights(id: string, requested: number) {
    const stop = stops.find((item) => item.id === id);
    if (!stop) return;
    const maxAllowed = stop.nights + Math.max(0, remainingNights);
    const nights = Math.min(Math.max(1, requested), maxAllowed);
    if (requested > maxAllowed) {
      showNightsNotice(`Le date dei voli sono fisse (17 nov → 4 dic): ${stop.name} può avere al massimo ${maxAllowed} ${maxAllowed === 1 ? "notte" : "notti"}. Per aumentarle, libera prima una notte da un'altra tappa.`);
    }
    if (nights !== stop.nights) updateStop(id, { nights });
  }

  function updateHotelStay(id: string, patch: Partial<HotelStay>) {
    setHotelStays((current) => current.map((stay) => stay.id === id ? { ...stay, ...patch } : stay));
  }

  function addHotelStay(event: FormEvent) {
    event.preventDefault();
    if (!newHotel.name.trim() || !newHotel.checkInDate || !newHotel.checkOutDate || newHotel.checkOutDate <= newHotel.checkInDate) return;
    const { totalPrice, ...hotelFields } = newHotel;
    const total = Number(totalPrice) || 0;
    const stay: HotelStay = {
      id: uid("hotel"),
      ...hotelFields,
      name: newHotel.name.trim(),
      address: newHotel.address.trim(),
      totalPrice: total,
      nightlyPrice: 0,
      notes: newHotel.notes.trim(),
    };
    const nights = hotelNights(stay);
    stay.nightlyPrice = nights > 0 ? total / nights : 0;
    if (stay.bookingStatus !== "prenotato") {
      delete stay.confirmationNumber;
      delete stay.paidBy;
    }
    setHotelStays((current) => [...current, stay]);
    setNewHotel((current) => ({ ...current, name: "", address: "", totalPrice: 0, bookingStatus: "da-prenotare", confirmationNumber: "", paidBy: undefined, bookingUrl: "", mapUrl: "", notes: "" }));
    recordChange("Hotel aggiunto", `${stay.name} · ${stay.checkInDate} → ${stay.checkOutDate}${stay.bookingStatus === "prenotato" ? ` · prenotato${stay.paidBy ? `, ha pagato ${PAYER_LABELS[stay.paidBy]}` : ""}` : ""}`);
  }

  function addChecklistItem(event: FormEvent) {
    event.preventDefault();
    const label = newChecklistItem.trim();
    if (!label) return;
    setExtraChecklist((current) => [...current, { id: uid("check"), label, done: false }]);
    setNewChecklistItem("");
    recordChange("Checklist ampliata", label);
  }

  function toggleExtraChecklistItem(id: string) {
    const item = extraChecklist.find((entry) => entry.id === id);
    setExtraChecklist((current) => current.map((entry) => entry.id === id ? { ...entry, done: !entry.done } : entry));
    if (item) recordChange(item.done ? "Checklist riaperta" : "Checklist completata", item.label);
  }

  function removeExtraChecklistItem(id: string) {
    const removed = extraChecklist.find((entry) => entry.id === id);
    setExtraChecklist((current) => current.filter((entry) => entry.id !== id));
    if (removed) recordChange("Checklist ridotta", removed.label);
  }

  function normalizeLinkUrl(value: string) {
    const url = value.trim();
    if (!url) return "";
    return /^(https?:\/\/|weixin:\/\/|alipays?:\/\/)/i.test(url) ? url : `https://${url}`;
  }

  function addSharedLink(event: FormEvent) {
    event.preventDefault();
    const url = normalizeLinkUrl(newLink.url);
    if (!url) return;
    const link: TripLink = { id: uid("link"), stopId: newLink.stopId, label: newLink.label.trim(), url };
    setSharedLinks((current) => [...current, link]);
    setNewLink({ stopId: "", label: "", url: "" });
    const stopName = stops.find((stop) => stop.id === link.stopId)?.name || "Tutto il viaggio";
    recordChange("Link aggiunto", `${stopName}: ${link.label || link.url}`);
  }

  function updateSharedLink(id: string, patch: Partial<TripLink>) {
    setSharedLinks((current) => current.map((link) => link.id === id ? { ...link, ...patch } : link));
  }

  function removeSharedLink(id: string) {
    const removed = sharedLinks.find((link) => link.id === id);
    setSharedLinks((current) => current.filter((link) => link.id !== id));
    if (removed) recordChange("Link eliminato", removed.label || removed.url);
  }

  function removeHotelStay(id: string) {
    const removed = hotelStays.find((stay) => stay.id === id);
    setHotelStays((current) => current.filter((stay) => stay.id !== id));
    if (removed) recordChange("Hotel eliminato", `${removed.name} · ${removed.checkInDate} → ${removed.checkOutDate}`);
  }

  function removeStop(id: string) {
    if (id === "beijing" || id === "shanghai") return;
    const removed = stops.find((stop) => stop.id === id);
    setStops((current) => current.filter((stop) => stop.id !== id));
    if (selectedStopId === id) setSelectedStopId("beijing");
    if (removed) recordChange("Tappa eliminata", removed.name);
  }

  function moveStop(id: string, direction: -1 | 1) {
    setStops((current) => {
      const index = current.findIndex((stop) => stop.id === id);
      const target = index + direction;
      if (index <= 0 || index >= current.length - 1 || target <= 0 || target >= current.length - 1) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function addStop(event: FormEvent) {
    event.preventDefault();
    const name = newStopName.trim();
    if (!name) return;
    if (remainingNights < 1) {
      showNightsNotice("Tutte le notti tra il 17 novembre e il 4 dicembre sono già assegnate: per aggiungere una città, togli prima una notte a un'altra tappa.");
      return;
    }
    const stop: Stop = { id: uid("stop"), name, lat: 30, lng: 111, nights: 1, hotelNightly: 80, activities: [] };
    const nextStops = [...stops.slice(0, -1), stop, stops[stops.length - 1]];
    setStops(nextStops);
    addHotelStayForStop(stop, nextStops);
    setSelectedStopId(stop.id);
    setNewStopName("");
    recordChange("Tappa aggiunta", stop.name);
  }

  // Ogni nuova destinazione parte con il suo blocco hotel "da prenotare", con le date della tappa.
  function addHotelStayForStop(stop: Stop, nextStops: Stop[]) {
    const defaultStay = makeDefaultHotelStays(nextStops).find((stay) => stay.stopId === stop.id);
    if (!defaultStay) return;
    setHotelStays((current) => {
      if (current.some((stay) => stay.stopId === stop.id)) return current;
      const stay = current.some((existing) => existing.id === defaultStay.id) ? { ...defaultStay, id: uid("hotel") } : defaultStay;
      return [...current, stay];
    });
    recordChange("Hotel da prenotare creato", `${stop.name}: blocco hotel aggiunto automaticamente`);
  }

  function updateLeg(id: string, patch: Partial<Leg>) {
    setLegs((current) => {
      if (current.some((leg) => leg.id === id)) return current.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg));
      const derived = normalizedLegs.find((leg) => leg.id === id);
      return derived ? [...current, { ...derived, ...patch }] : current;
    });
  }

  function updateActivity(stopId: string, activityId: string, patch: Partial<Activity>) {
    setStops((current) => current.map((stop) => stop.id !== stopId ? stop : { ...stop, activities: stop.activities.map((activity) => activity.id === activityId ? { ...activity, ...patch } : activity) }));
  }

  function addScheduleItem(event: FormEvent) {
    event.preventDefault();
    if (!selectedDay || !newScheduleItem.name.trim()) return;
    const item: ScheduleItem = {
      id: uid("plan"),
      date: selectedDay.dateKey,
      stopId: selectedDay.stopId,
      ...newScheduleItem,
      name: newScheduleItem.name.trim(),
      location: newScheduleItem.location.trim(),
      notes: newScheduleItem.notes.trim(),
      price: Number(newScheduleItem.price) || 0,
      currency: newScheduleItem.currency,
    };
    setScheduleItems((current) => [...current, item]);
    setNewScheduleItem((current) => ({ ...current, name: "", fromLocation: "", location: "", transportMode: "", mapUrl: "", notes: "", price: 0 }));
    recordChange(`${KIND_LABELS[item.kind || "activity"]} aggiunto`, `${item.name} · ${item.date} ${item.startTime}–${item.endTime}`);
  }

  function updateScheduleItem(id: string, patch: Partial<ScheduleItem>) {
    setScheduleItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function removeScheduleItem(id: string) {
    const removed = scheduleItems.find((item) => item.id === id);
    setScheduleItems((current) => current.filter((item) => item.id !== id));
    if (removed) recordChange(`${KIND_LABELS[scheduleKind(removed)]} eliminato`, `${removed.name} · ${removed.date}`);
  }

  function scheduleActivity(stop: Stop, activity: Activity) {
    const candidateDays = calendarDays.filter((day) => day.stopId === stop.id);
    if (candidateDays.length === 0) return;
    const targetDay = [...candidateDays].sort((a, b) => {
      const aCount = scheduleItems.filter((item) => item.date === a.dateKey).length;
      const bCount = scheduleItems.filter((item) => item.date === b.dateKey).length;
      return aCount - bCount;
    })[0];
    const count = scheduleItems.filter((item) => item.date === targetDay.dateKey).length;
    const slots = [["09:00", "12:00"], ["14:00", "17:00"], ["18:00", "20:00"]];
    const [startTime, endTime] = slots[Math.min(count, slots.length - 1)];
    setScheduleItems((current) => [...current, {
      id: uid("plan"),
      date: targetDay.dateKey,
      stopId: stop.id,
      startTime,
      endTime,
      name: activity.name,
      nameZh: activity.nameZh,
      kind: "activity",
      category: "visita",
      location: stop.name,
      locationZh: stop.nameZh,
      notes: activity.description,
      price: activity.price,
      currency: activity.currency || "EUR",
      bookingStatus: "da-prenotare",
      sourceUrl: activity.sourceUrl,
      sourceActivityId: activity.id,
    }]);
    setStops((current) => current.map((item) => item.id !== stop.id ? item : {
      ...item,
      activities: item.activities.map((entry) => entry.id === activity.id ? { ...entry, selected: true } : entry),
    }));
    setSelectedDate(targetDay.dateKey);
    setSection("calendar");
    recordChange("Attività aggiunta", `${activity.name} · ${targetDay.dateKey}`);
  }

  function addCostEntry(event: FormEvent) {
    event.preventDefault();
    if (!newCost.label.trim() || newCost.amount <= 0) return;
    setCostEntries((current) => [...current, {
      id: uid("cost"),
      label: newCost.label.trim(),
      amount: Number(newCost.amount) || 0,
      currency: newCost.currency,
    }]);
    setNewCost((current) => ({ ...current, label: "", amount: 0 }));
    recordChange("Costo aggiunto", `${newCost.label.trim()} · ${formatCost(newCost.amount, newCost.currency)}`);
  }

  function updateCostEntry(id: string, patch: Partial<CostEntry>) {
    setCostEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function removeCostEntry(id: string) {
    const removed = costEntries.find((entry) => entry.id === id);
    setCostEntries((current) => current.filter((entry) => entry.id !== id));
    if (removed) recordChange("Costo eliminato", `${removed.label} · ${formatCost(removed.amount, removed.currency)}`);
  }

  function addExpense(event: FormEvent) {
    event.preventDefault();
    if (!selectedDay || !newExpense.label.trim() || newExpense.amount <= 0) return;
    const expense: Expense = {
      id: uid("spesa"),
      date: selectedDay.dateKey,
      label: newExpense.label.trim(),
      amount: Number(newExpense.amount) || 0,
      currency: newExpense.currency,
      paidBy: newExpense.paidBy,
      category: newExpense.category,
    };
    setExpenses((current) => [...current, expense]);
    setNewExpense((current) => ({ ...current, label: "", amount: 0 }));
    recordChange("Spesa registrata", `${expense.label} · ${formatCost(expense.amount, expense.currency)} · ha pagato ${PAYER_LABELS[expense.paidBy]}`);
  }

  function removeExpense(id: string) {
    const removed = expenses.find((expense) => expense.id === id);
    setExpenses((current) => current.filter((expense) => expense.id !== id));
    if (removed) recordChange("Spesa eliminata", `${removed.label} · ${formatCost(removed.amount, removed.currency)}`);
  }

  function addClouActivity(event: FormEvent) {
    event.preventDefault();
    const name = newClouActivity.name.trim();
    if (!name) return;
    const activity: Activity = { id: uid("clou"), name, description: "", price: Number(newClouActivity.price) || 0, currency: "EUR", selected: false };
    setStops((current) => current.map((stop) => stop.id !== selectedStop.id ? stop : { ...stop, activities: [...stop.activities, activity] }));
    setNewClouActivity({ name: "", price: 0 });
    recordChange("Attività clou aggiunta", `${selectedStop.name}: ${name}`);
  }

  function removeClouActivity(stopId: string, activityId: string) {
    const stop = stops.find((item) => item.id === stopId);
    const removed = stop?.activities.find((activity) => activity.id === activityId);
    setStops((current) => current.map((item) => item.id !== stopId ? item : { ...item, activities: item.activities.filter((activity) => activity.id !== activityId) }));
    if (removed) recordChange("Attività clou rimossa", `${stop?.name || "Tappa"}: ${removed.name}`);
  }

  function scheduleClouOnSelectedDay(activity: Activity) {
    if (!selectedDay) return;
    const stop = stops.find((item) => item.id === selectedDay.stopId);
    if (!stop || scheduleItems.some((item) => item.sourceActivityId === activity.id)) return;
    const count = scheduleItems.filter((item) => item.date === selectedDay.dateKey).length;
    const slots = [["09:00", "12:00"], ["14:00", "17:00"], ["18:00", "20:00"]];
    const [startTime, endTime] = slots[Math.min(count, slots.length - 1)];
    setScheduleItems((current) => [...current, {
      id: uid("plan"),
      date: selectedDay.dateKey,
      stopId: stop.id,
      startTime,
      endTime,
      name: activity.name,
      nameZh: activity.nameZh,
      kind: "activity" as ScheduleKind,
      category: "visita",
      location: stop.name,
      locationZh: stop.nameZh,
      notes: activity.description,
      price: activity.price,
      currency: activity.currency || "EUR",
      bookingStatus: "da-prenotare" as ScheduleItem["bookingStatus"],
      sourceUrl: activity.sourceUrl,
      sourceActivityId: activity.id,
    }]);
    setStops((current) => current.map((item) => item.id !== stop.id ? item : {
      ...item,
      activities: item.activities.map((entry) => entry.id === activity.id ? { ...entry, selected: true } : entry),
    }));
    recordChange("Attività clou aggiunta in agenda", `${activity.name} · ${selectedDay.dateKey}`);
  }

  function addSuggestedStop(suggestion: SuggestedStop) {
    if (stops.some((stop) => stop.id === suggestion.id)) return;
    if (remainingNights < 1) {
      showNightsNotice(`Non ci sono notti libere per ${suggestion.name}: le date dei voli sono fisse (17 nov → 4 dic). Togli prima una notte a un'altra tappa e riprova.`);
      return;
    }
    const nights = Math.min(suggestion.nights, remainingNights);
    if (nights < suggestion.nights) {
      showNightsNotice(`${suggestion.name} aggiunta con ${nights} ${nights === 1 ? "notte" : "notti"} invece di ${suggestion.nights}: erano le uniche libere. Puoi ribilanciare le notti tra le tappe.`);
    }
    const stop: Stop = {
      id: suggestion.id,
      name: suggestion.name,
      lat: suggestion.lat,
      lng: suggestion.lng,
      nights,
      hotelNightly: suggestion.hotelNightly,
      activities: suggestion.activities.map((activity) => ({ ...activity })),
    };
    const anchorIndex = stops.findIndex((item) => item.id === suggestion.insertAfterId);
    const index = anchorIndex >= 0 ? anchorIndex + 1 : Math.max(1, stops.length - 1);
    const nextStops = [...stops.slice(0, index), stop, ...stops.slice(index)];
    setStops(nextStops);
    addHotelStayForStop(stop, nextStops);
    setSelectedStopId(stop.id);
    recordChange("Tappa aggiunta dalle proposte", `${stop.name} · ${stop.nights} ${stop.nights === 1 ? "notte" : "notti"}`);
  }

  function dismissSuggestion(suggestion: SuggestedStop) {
    setDismissedSuggestions((current) => current.includes(suggestion.id) ? current : [...current, suggestion.id]);
    recordChange("Proposta scartata", suggestion.name);
  }

  function restoreSuggestions() {
    setDismissedSuggestions([]);
    recordChange("Proposte ripristinate", "Tutte le città scartate sono di nuovo visibili");
  }

  function openDayInAgenda(dateValue: string) {
    setSelectedDate(dateValue);
    setSection("calendar");
  }

  function prepareNewTransport() {
    setNewScheduleItem((current) => ({
      ...current,
      kind: "transport",
      category: "trasferimento",
      name: "",
      fromLocation: "",
      location: "",
      transportMode: "",
      notes: "",
    }));
    setSection("calendar");
    window.setTimeout(() => document.getElementById("new-plan")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  const navItems = [
    ["itinerary", "Itinerario"],
    ["calendar", "Agenda & spese"],
    ["hotels", "Hotel"],
    ["transport", "Trasporti"],
    ["budget", "Budget & bilancio"],
    ["planner", "Checklist & note"],
    ["history", "Modifiche"],
  ];
  function showHotelInChinese(stay: HotelStay) {
    setTaxiInfo({ kind: "hotel", title: stay.name, titleZh: stay.nameZh, subtitle: stay.address, subtitleZh: stay.addressZh });
  }

  function showPlaceInChinese(title: string, titleZh: string | undefined, subtitle: string, subtitleZh?: string) {
    setTaxiInfo({ kind: "place", title, titleZh, subtitle, subtitleZh });
  }

  const syncLabel = {
    loading: "Collegamento al database…",
    saving: "Salvataggio…",
    synced: "Tutto sincronizzato",
    error: "Sincronizzazione non disponibile",
  }[syncStatus];

  return (
    <main className="shell">
      <header className="hero has-photo" style={{ backgroundImage: `linear-gradient(0deg, rgba(6,27,20,.62), rgba(6,27,20,.06) 55%), url("${coverPhoto || "china-hero-couple.jpg"}")` }}>
        <div className="hero-bar">
          <p className="eyebrow">Alberto & Sofia · Cina 2026 · 17 nov → 4 dic</p>
          <div className="cover-actions">
            <label>📷 {coverPhoto ? "Cambia foto" : "Aggiungi foto"}<input type="file" accept="image/*" onChange={changeCoverPhoto} /></label>
            {coverPhoto && <button onClick={removeCoverPhoto}>Rimuovi</button>}
          </div>
        </div>
        {photoError && <p className="photo-error">{photoError}</p>}
      </header>

      <div className="flight-anchors">
        <div><span className="anchor-icon">↓</span><p><b>Arrivo a Pechino</b><strong>Martedì 17 novembre · 12:25</strong><small>PEK · transfer verso l’hotel</small></p></div>
        <div className="window-meter"><span style={{ width: `${Math.min(100, (usedNights / TRIP_NIGHTS) * 100)}%` }} /><b>{usedNights} / {TRIP_NIGHTS} notti assegnate</b></div>
        <div><span className="anchor-icon outbound">↑</span><p><b>Partenza da Shanghai</b><strong>Venerdì 4 dicembre · 09:40</strong><small>PVG · arrivo consigliato 06:40</small></p></div>
      </div>

      <nav className="nav" aria-label="Sezioni del viaggio">
        {navItems.map(([id, label]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>{label}</button>)}
      </nav>
      <div className={`sync-bar ${syncStatus}`}>
        <span><i />{syncLabel}</span>
        <small>{lastSavedAt ? `Ultimo autosalvataggio ${lastSavedAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · ` : ""}{currentUser.email}</small>
        <button onClick={() => signOut(auth)}>Esci</button>
      </div>

      {section === "itinerary" && (
        <>
        <div className="trip-strip" aria-label="I 17 giorni del viaggio">
          {calendarDays.map((entry, index) => (
            <button key={entry.dateKey} className={`${entry.stopId && entry.stopId === selectedStop.id ? "current" : ""} ${entry.type}`} onClick={() => entry.stopId && setSelectedStopId(entry.stopId)} title={`Giorno ${index + 1} · ${entry.city}`}>
              <small>G{index + 1}</small>
              <b>{shortDate.format(entry.date)}</b>
              <span>{entry.city}</span>
            </button>
          ))}
        </div>
        <section className="section-grid">
          <div className="stack">
            <article className="card map-card">
              <div className="card-head"><div><p className="eyebrow">Panoramica itinerario · OpenStreetMap</p><h2>La rotta completa, tappa per tappa</h2></div><span className="subtle">Punti numerati = tappe del piano · «?» = città da valutare</span></div>
              <InteractiveRouteMap stops={stops} legs={normalizedLegs} suggestions={visibleSuggestions} onSelect={setSelectedStopId} />
              <div className="china-map-note">
                <div><b>Ogni luogo si apre in Google Maps</b><span>Hotel, attività e trasporti hanno il proprio collegamento; qui puoi aprire anche la città selezionata.</span></div>
                <a href={googleMapsStopUrl(selectedStop)} target="_blank" rel="noreferrer">Apri {selectedStop.name} in Google Maps ↗</a>
              </div>
            </article>

            <article className="card">
              <div className="card-head"><div><p className="eyebrow">Recap modificabile · 17 nov → 4 dic fissi</p><h2>Tappe e collegamenti</h2></div><span className={`fit-badge ${remainingNights === 0 ? "ok" : ""}`}>{remainingNights === 0 ? "Finestra completa" : remainingNights > 0 ? `${remainingNights} notti da assegnare` : `${Math.abs(remainingNights)} notti oltre il volo`}</span></div>
              {nightsNotice && <div className="nights-notice" role="status">✈️ {nightsNotice}</div>}
              <div className="route-editor">
                {timeline.map((item, index) => {
                  const leg = normalizedLegs[index];
                  const locked = item.stop.id === "beijing" || item.stop.id === "shanghai";
                  return <div key={item.stop.id}>
                    <div className={`stop-editor ${selectedStop.id === item.stop.id ? "selected" : ""}`} onClick={() => setSelectedStopId(item.stop.id)}>
                      <span className="stop-number">{index + 1}</span>
                      <div className="stop-main"><b>{item.stop.name}</b><small>{shortDate.format(item.arrival)} → {shortDate.format(item.departure)} · {item.stop.nights} {item.stop.nights === 1 ? "notte" : "notti"}</small></div>
                      <label>Notti<input type="number" min="1" max={item.stop.nights + Math.max(0, remainingNights)} value={item.stop.nights} onClick={(event) => event.stopPropagation()} onChange={(event) => changeStopNights(item.stop.id, Number(event.target.value) || 1)} /></label>
                      <div className="stop-actions">
                        {!locked && <><button title="Sposta su" onClick={(event) => { event.stopPropagation(); moveStop(item.stop.id, -1); }}>↑</button><button title="Sposta giù" onClick={(event) => { event.stopPropagation(); moveStop(item.stop.id, 1); }}>↓</button><button className="danger" title="Elimina tappa" onClick={(event) => { event.stopPropagation(); removeStop(item.stop.id); }}>×</button></>}
                        {locked && <span className="lock">volo</span>}
                      </div>
                    </div>
                    {leg && <div className={`leg-inline ${leg.included ? "" : "disabled"}`}>
                      <span className="leg-rail" />
                      <div><b>{leg.included ? leg.mode : "Trasporto escluso"}</b><small>{leg.included ? `${leg.duration} · ${formatCost(leg.cost, leg.currency)}` : "Il calendario segnala un collegamento mancante"}</small></div>
                      <button onClick={() => updateLeg(leg.id, { included: !leg.included })}>{leg.included ? "Togli" : "Aggiungi"}</button>
                    </div>}
                  </div>;
                })}
                <form className="add-stop" onSubmit={addStop}><input value={newStopName} onChange={(event) => setNewStopName(event.target.value)} placeholder={remainingNights > 0 ? `Aggiungi una città (${remainingNights} ${remainingNights === 1 ? "notte libera" : "notti libere"})` : "Libera una notte da una tappa per aggiungere una città"} /><button type="submit">+ Aggiungi tappa</button></form>
              </div>
            </article>

            <article className="card suggestions-card">
              <div className="card-head"><div><p className="eyebrow">Varianti possibili · dalla tappa 3 in poi</p><h2>Città da valutare</h2></div><span className="subtle">Aggiungi o scarta: il piano si costruisce man mano</span></div>
              <div className="suggestion-list">
                {visibleSuggestions.length === 0 && <p className="empty">Nessuna proposta in sospeso: le hai aggiunte al piano o scartate tutte.</p>}
                {visibleSuggestions.map((suggestion) => <div className="suggestion-row" key={suggestion.id}>
                  <div className="suggestion-main">
                    <div className="suggestion-title"><b>{suggestion.name}</b><span>{suggestion.nights} {suggestion.nights === 1 ? "notte" : "notti"} · hotel ~{euro.format(suggestion.hotelNightly)}/notte</span></div>
                    <p>{suggestion.recap}</p>
                    <small>🚄 {suggestion.transport}</small>
                    <small>❄️ {suggestion.season}</small>
                    <span className="activity-links"><a href={webSearchUrl(`${suggestion.name} Cina cosa vedere`)} target="_blank" rel="noreferrer">Cerca sul web ↗</a><a href={googleMapsStopUrl(suggestion)} target="_blank" rel="noreferrer">Google Maps ↗</a></span>
                  </div>
                  <div className="suggestion-actions">
                    <button className="primary" onClick={() => addSuggestedStop(suggestion)}>+ Aggiungi al piano</button>
                    <button className="danger-text" onClick={() => dismissSuggestion(suggestion)}>Scarta</button>
                  </div>
                </div>)}
              </div>
              {dismissedSuggestions.length > 0 && <button className="restore-suggestions" onClick={restoreSuggestions}>↻ Ripristina {dismissedSuggestions.length} {dismissedSuggestions.length === 1 ? "proposta scartata" : "proposte scartate"}</button>}
            </article>
          </div>

          <aside className="card city-workspace">
            <div className="card-head sticky"><div><p className="eyebrow">Tappa selezionata</p><h2>{selectedStop.name}</h2></div><span className="city-dates">{shortDate.format(timeline.find((item) => item.stop.id === selectedStop.id)?.arrival || ARRIVAL_DATE)} → {shortDate.format(timeline.find((item) => item.stop.id === selectedStop.id)?.departure || DEPARTURE_DATE)}</span></div>
            <div className="city-body">
              <div className="mini-budget"><span>Blocchi in agenda</span><b>{scheduleItems.filter((item) => item.stopId === selectedStop.id).length}</b><small>{euro.format(scheduleItems.filter((item) => item.stopId === selectedStop.id).reduce((sum, item) => sum + toEuro(item.price, item.currency), 0))} nel budget</small></div>
              <button className="hotel-field hotel-link" onClick={() => setSection("hotels")}><span>⌂ Hotel e date del soggiorno</span><strong>{hotelStays.filter((stay) => stay.stopId === selectedStop.id).length || "—"} →</strong></button>

              <h3>Agenda giorno per giorno</h3>
              <div className="city-days">
                {selectedStopDays.map((day) => {
                  const dayItems = scheduleItems.filter((item) => item.date === day.dateKey).sort((a, b) => a.startTime.localeCompare(b.startTime));
                  const dayNumber = calendarDays.findIndex((entry) => entry.dateKey === day.dateKey) + 1;
                  return <button className="city-day" key={day.dateKey} onClick={() => openDayInAgenda(day.dateKey)}>
                    <div className="city-day-head"><small>G{dayNumber}</small><b>{longDate.format(day.date)}</b><i>Apri →</i></div>
                    {dayItems.length === 0 ? <p className="empty">Giornata ancora libera</p> : <ul>
                      {dayItems.map((item) => <li key={item.id} className={`kind-${scheduleKind(item)}`}><span>{item.startTime}</span>{item.name}{item.price > 0 && <em>{formatCost(item.price, item.currency)}</em>}</li>)}
                    </ul>}
                  </button>;
                })}
              </div>

              <h3>Attività clou · le imperdibili</h3>
              <div className="activity-list">
                {selectedStop.activities.length === 0 && <p className="empty">Nessuna attività clou salvata: aggiungila qui sotto o cerca idee sul web.</p>}
                {selectedStop.activities.map((activity) => <div className={`activity-row ${scheduleItems.some((item) => item.sourceActivityId === activity.id) ? "selected" : ""}`} key={activity.id}>
                  <button className="check" title="Metti in agenda nella prima giornata disponibile" onClick={() => scheduleActivity(selectedStop, activity)}>{scheduleItems.some((item) => item.sourceActivityId === activity.id) ? "✓" : "+"}</button>
                  <div><b>{activity.name}</b>{activity.nameZh && <button className="zh-chip" title="Mostra in cinese a schermo intero" onClick={() => showPlaceInChinese(activity.name, activity.nameZh, selectedStop.name, selectedStop.nameZh)}>中 {activity.nameZh}</button>}{activity.description && <small>{activity.description}</small>}<span className="activity-links"><a href={webSearchUrl(`${activity.name} ${selectedStop.name} biglietti sito ufficiale`)} target="_blank" rel="noreferrer">Cerca sul web ↗</a><a href={googleMapsSearchUrl(activity.name, selectedStop.name)} target="_blank" rel="noreferrer">Google Maps ↗</a>{activity.sourceUrl && <a href={activity.sourceUrl} target="_blank" rel="noreferrer">Fonte ↗</a>}</span></div>
                  <div className="clou-side">
                    <label className="money-input"><input type="number" min="0" value={activity.price} onChange={(event) => updateActivity(selectedStop.id, activity.id, { price: Number(event.target.value) || 0 })} /><select aria-label={`Valuta ${activity.name}`} value={activity.currency || "EUR"} onChange={(event) => updateActivity(selectedStop.id, activity.id, { currency: event.target.value as Currency })}><option value="EUR">€</option><option value="CNY">¥</option></select></label>
                    <button className="danger-text" onClick={() => removeClouActivity(selectedStop.id, activity.id)}>Togli</button>
                  </div>
                </div>)}
              </div>
              <form className="add-clou" onSubmit={addClouActivity}>
                <input value={newClouActivity.name} placeholder={`Nuova attività clou a ${selectedStop.name}`} onChange={(event) => setNewClouActivity((current) => ({ ...current, name: event.target.value }))} />
                <input type="number" min="0" step="0.01" aria-label="Costo stimato in euro" placeholder="€ per 2" value={newClouActivity.price || ""} onChange={(event) => setNewClouActivity((current) => ({ ...current, price: Number(event.target.value) || 0 }))} />
                <button type="submit">+ Aggiungi</button>
              </form>
              <a className="clou-search" href={webSearchUrl(`cosa vedere a ${selectedStop.name} Cina attrazioni imperdibili`)} target="_blank" rel="noreferrer">🔍 Cerca idee sul web per {selectedStop.name} ↗</a>
            </div>
          </aside>
        </section>
        </>
      )}

      {section === "hotels" && <section className="panel-section">
        <div className="section-title hotel-title">
          <div><p className="eyebrow">Sezione indipendente · nessun orario giornaliero</p><h2>Hotel e soggiorni</h2></div>
          <div><span><b>{hotelStays.length}</b> soggiorni</span><strong>{euro.format(hotelCost)}</strong></div>
        </div>
        <div className="hotel-stay-list">
          {[...hotelStays].sort((a, b) => a.checkInDate.localeCompare(b.checkInDate)).map((stay) => {
            const stop = stops.find((item) => item.id === stay.stopId);
            const mapUrl = safeExternalLink(stay.mapUrl) || googleMapsSearchUrl(stay.address || stay.name, stop?.name || "");
            const bookingUrl = safeExternalLink(stay.bookingUrl);
            return <article className={`card hotel-stay-card ${stay.bookingStatus === "prenotato" ? "booked" : ""}`} key={stay.id}>
              <div className="hotel-date-band">
                <span>Check-in<b>{shortDate.format(new Date(`${stay.checkInDate}T12:00:00`))}</b></span>
                <i>→</i>
                <span>Check-out<b>{shortDate.format(new Date(`${stay.checkOutDate}T12:00:00`))}</b></span>
                <small>{hotelNights(stay)} {hotelNights(stay) === 1 ? "notte" : "notti"}</small>
                {stay.bookingStatus === "prenotato" && <em className="booked-badge">✓ Prenotato{stay.paidBy ? ` · ${PAYER_LABELS[stay.paidBy]}` : ""}</em>}
              </div>
              <div className="hotel-stay-content">
                <div className="hotel-stay-head"><div><span>⌂ {stop?.name || "Tappa"}</span><input aria-label="Nome hotel" value={stay.name} onChange={(event) => updateHotelStay(stay.id, { name: event.target.value })} onBlur={(event) => recordChange("Hotel modificato", event.target.value)} /></div><button className="danger-text" onClick={() => removeHotelStay(stay.id)}>Elimina</button></div>
                <div className="hotel-fields">
                  <label>Data check-in<input type="date" value={stay.checkInDate} onChange={(event) => updateHotelStay(stay.id, { checkInDate: event.target.value })} onBlur={(event) => recordChange("Check-in modificato", `${stay.name}: ${event.target.value}`)} /></label>
                  <label>Data check-out<input type="date" value={stay.checkOutDate} onChange={(event) => updateHotelStay(stay.id, { checkOutDate: event.target.value })} onBlur={(event) => recordChange("Check-out modificato", `${stay.name}: ${event.target.value}`)} /></label>
                  <label className="wide">Indirizzo<input value={stay.address} placeholder="Nome e indirizzo dell'hotel" onChange={(event) => updateHotelStay(stay.id, { address: event.target.value })} onBlur={(event) => recordChange("Indirizzo hotel modificato", `${stay.name}: ${event.target.value}`)} /></label>
                  <label>Nome in cinese <a className="translate-link" href={translateZhUrl(stay.name)} target="_blank" rel="noreferrer">Traduci ↗</a><input value={stay.nameZh || ""} placeholder="Traduci il nome e incollalo qui" onChange={(event) => updateHotelStay(stay.id, { nameZh: event.target.value })} onBlur={() => recordChange("Nome cinese aggiornato", stay.name)} /></label>
                  <label className="wide">Indirizzo in cinese <a className="translate-link" href={translateZhUrl(stay.address || stay.name)} target="_blank" rel="noreferrer">Traduci ↗</a><input value={stay.addressZh || ""} placeholder="Traduci l'indirizzo e incollalo qui" onChange={(event) => updateHotelStay(stay.id, { addressZh: event.target.value })} onBlur={() => recordChange("Indirizzo cinese aggiornato", stay.name)} /></label>
                  <label>{stay.bookingStatus === "prenotato" ? "Prezzo totale pagato" : "Prezzo totale soggiorno"}<span className="money-input"><input type="number" min="0" step="0.01" value={hotelTotalPrice(stay)} onChange={(event) => updateHotelStay(stay.id, { totalPrice: Number(event.target.value) || 0 })} onBlur={(event) => recordChange("Prezzo hotel modificato", `${stay.name}: ${formatCost(Number(event.target.value) || 0, stay.currency)} totali`)} /><select aria-label={`Valuta ${stay.name}`} value={stay.currency} onChange={(event) => updateHotelStay(stay.id, { currency: event.target.value as Currency })}><option value="EUR">€</option><option value="CNY">¥</option></select></span></label>
                  <label>Stato<select value={stay.bookingStatus} onChange={(event) => { updateHotelStay(stay.id, { bookingStatus: event.target.value as HotelStay["bookingStatus"] }); recordChange("Stato hotel modificato", `${stay.name}: ${event.target.options[event.target.selectedIndex].text}`); }}><option value="da-prenotare">Da prenotare</option><option value="prenotato">Prenotato</option></select></label>
                  {stay.bookingStatus === "prenotato" && <>
                    <label>Numero prenotazione<input value={stay.confirmationNumber || ""} placeholder="Es. codice Booking / Trip.com" onChange={(event) => updateHotelStay(stay.id, { confirmationNumber: event.target.value })} onBlur={(event) => { if (event.target.value.trim()) recordChange("Numero prenotazione salvato", `${stay.name}: ${event.target.value.trim()}`); }} /></label>
                    <div className="hotel-payer">
                      <span>Chi ha pagato?</span>
                      <div>
                        {(["alberto", "sofia"] as Payer[]).map((payer) => <button type="button" key={payer} className={stay.paidBy === payer ? `active ${payer}` : ""} onClick={() => { if (stay.paidBy === payer) return; updateHotelStay(stay.id, { paidBy: payer }); recordChange("Pagamento hotel registrato", `${stay.name}: ha pagato ${PAYER_LABELS[payer]}`); }}>{PAYER_LABELS[payer]}</button>)}
                      </div>
                    </div>
                  </>}
                  <label className="wide">Note<textarea value={stay.notes} placeholder="Colazione, cancellazione, camera, deposito bagagli…" onChange={(event) => updateHotelStay(stay.id, { notes: event.target.value })} onBlur={() => recordChange("Note hotel aggiornate", stay.name)} /></label>
                </div>
                <details className="app-links-editor"><summary>Link prenotazione e mappa</summary><div>
                  <label>Prenotazione<input value={stay.bookingUrl || ""} placeholder="https://…" onChange={(event) => updateHotelStay(stay.id, { bookingUrl: event.target.value })} /></label>
                  <label>Link mappa<input value={stay.mapUrl || ""} placeholder="Automatico se vuoto" onChange={(event) => updateHotelStay(stay.id, { mapUrl: event.target.value })} /></label>
                </div></details>
                <div className="hotel-actions"><button className="taxi-button" onClick={() => showHotelInChinese(stay)}>🚕 Mostra in cinese</button><a href={mapUrl} target="_blank" rel="noreferrer">Google Maps ↗</a>{bookingUrl && <a href={bookingUrl} target="_blank" rel="noreferrer">Prenotazione ↗</a>}</div>
              </div>
            </article>;
          })}
        </div>
        <form className="card add-hotel-card" onSubmit={addHotelStay}>
          <div className="card-head"><div><p className="eyebrow">Cambio hotel o soggiorno aggiuntivo</p><h2>Aggiungi hotel</h2></div></div>
          <div className="hotel-fields">
            <label>Città<select value={newHotel.stopId} onChange={(event) => {
              const stopId = event.target.value;
              const stopTimeline = timeline.find((item) => item.stop.id === stopId);
              setNewHotel((current) => ({ ...current, stopId, checkInDate: stopTimeline ? dateKey(stopTimeline.arrival) : current.checkInDate, checkOutDate: stopTimeline ? dateKey(stopTimeline.departure) : current.checkOutDate }));
            }}>{stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select></label>
            <label className="wide">Nome hotel<input required value={newHotel.name} placeholder="Es. Hotel a Pechino" onChange={(event) => setNewHotel((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>Check-in<input type="date" required value={newHotel.checkInDate} onChange={(event) => setNewHotel((current) => ({ ...current, checkInDate: event.target.value }))} /></label>
            <label>Check-out<input type="date" required value={newHotel.checkOutDate} onChange={(event) => setNewHotel((current) => ({ ...current, checkOutDate: event.target.value }))} /></label>
            <label className="wide">Indirizzo<input value={newHotel.address} onChange={(event) => setNewHotel((current) => ({ ...current, address: event.target.value }))} /></label>
            <label>Prezzo totale<span className="money-input"><input type="number" min="0" step="0.01" value={newHotel.totalPrice || ""} onChange={(event) => setNewHotel((current) => ({ ...current, totalPrice: Number(event.target.value) || 0 }))} /><select value={newHotel.currency} onChange={(event) => setNewHotel((current) => ({ ...current, currency: event.target.value as Currency }))}><option value="EUR">€</option><option value="CNY">¥</option></select></span></label>
            <label>Stato<select value={newHotel.bookingStatus} onChange={(event) => setNewHotel((current) => ({ ...current, bookingStatus: event.target.value as HotelStay["bookingStatus"] }))}><option value="da-prenotare">Da prenotare</option><option value="prenotato">Prenotato</option></select></label>
            {newHotel.bookingStatus === "prenotato" && <>
              <label>Numero prenotazione<input value={newHotel.confirmationNumber} placeholder="Es. codice Booking / Trip.com" onChange={(event) => setNewHotel((current) => ({ ...current, confirmationNumber: event.target.value }))} /></label>
              <div className="hotel-payer">
                <span>Chi ha pagato?</span>
                <div>
                  {(["alberto", "sofia"] as Payer[]).map((payer) => <button type="button" key={payer} className={newHotel.paidBy === payer ? `active ${payer}` : ""} onClick={() => setNewHotel((current) => ({ ...current, paidBy: current.paidBy === payer ? undefined : payer }))}>{PAYER_LABELS[payer]}</button>)}
                </div>
              </div>
            </>}
            <label className="wide">Note<textarea value={newHotel.notes} onChange={(event) => setNewHotel((current) => ({ ...current, notes: event.target.value }))} /></label>
          </div>
          <button className="primary" type="submit">+ Aggiungi soggiorno</button>
        </form>
      </section>}

      {section === "calendar" && <section className="panel-section">
        <div className="section-title agenda-title">
          <div><p className="eyebrow">Agenda condivisa · sincronizzata tra i vostri dispositivi</p><h2>Giorno per giorno, ora per ora</h2></div>
          <div className="agenda-summary"><span><b>{scheduleItems.length}</b> attività</span><span><b>{bookingCount}</b> da prenotare</span><span><b>{euro.format(activitiesCost)}</b> pianificati</span><button onClick={() => window.print()}>Stampa piano</button></div>
        </div>

        <div className="day-strip-wrap">
          <div className="day-strip-current" aria-live="polite">
            <small>G{calendarDays.findIndex((entry) => entry.dateKey === selectedDay?.dateKey) + 1}</small>
            <b>{selectedDay ? longDate.format(selectedDay.date) : ""}</b>
            <span>{selectedDay?.city}</span>
          </div>
          <div className="day-strip" aria-label="Giorni del viaggio">
            {calendarDays.map((entry, index) => {
              const itemCount = scheduleItems.filter((item) => item.date === entry.dateKey).length;
              return <button key={entry.dateKey} className={`${selectedDate === entry.dateKey ? "active" : ""} ${entry.type}`} onClick={() => setSelectedDate(entry.dateKey)}>
                <small>G{index + 1}</small>
                <b>{shortDate.format(entry.date)}</b>
                <span>{entry.city}</span>
                <i>{itemCount} blocchi</i>
              </button>;
            })}
          </div>
        </div>

        <div className="agenda-layout">
          <div className="agenda-main">
            <article className="card day-overview">
              <div>
                <p className="eyebrow">{selectedDay?.type === "travel" ? "Giornata di spostamento" : selectedDay?.type === "free" ? "Giornata da pianificare · assegna le notti dall'Itinerario" : "Giornata in città"}</p>
                <h2>{selectedDay ? longDate.format(selectedDay.date) : ""}</h2>
                <strong>{selectedDay?.city}</strong>
              </div>
              <div className="day-kpis">
                <span><b>{selectedDayItems.length}</b> blocchi</span>
                <span><b>{selectedDayItems[0]?.startTime || "—"}</b> inizio</span>
                <span><b>{selectedDayItems.at(-1)?.endTime || "—"}</b> fine</span>
                <span><b>{euro.format(dayCost)}</b> pianificato</span>
                <span><b>{euro.format(dayExpensesTotal)}</b> speso</span>
              </div>
            </article>
            <div className="day-hotels">
              {selectedDayHotels.length === 0 ? <button className="day-hotel-empty" onClick={() => setSection("hotels")}><span>⌂</span><div><b>Nessun hotel assegnato a questa notte</b><small>Aggiungi un soggiorno con check-in e check-out.</small></div><i>Gestisci hotel →</i></button> : selectedDayHotels.map((stay) => {
                const stop = stops.find((item) => item.id === stay.stopId);
                return <article className="day-hotel-banner" key={stay.id}>
                  <span className="day-hotel-icon">⌂</span>
                  <div><small>Hotel della giornata · {stay.checkInDate === selectedDay?.dateKey ? "check-in" : stay.checkOutDate === dateKey(addDays(selectedDay?.date || ARRIVAL_DATE, 1)) ? "ultima notte" : `${hotelNights(stay)} notti`}</small><b>{stay.name}</b><p>{stay.address || stop?.name}</p></div>
                  <div className="day-hotel-dates"><span>{shortDate.format(new Date(`${stay.checkInDate}T12:00:00`))}<small>in</small></span><i>→</i><span>{shortDate.format(new Date(`${stay.checkOutDate}T12:00:00`))}<small>out</small></span></div>
                  <div className="day-hotel-actions"><button className="taxi-button" onClick={() => showHotelInChinese(stay)}>🚕 Mostra in cinese</button><a href={safeExternalLink(stay.mapUrl) || googleMapsSearchUrl(stay.address || stay.name, stop?.name || "")} target="_blank" rel="noreferrer">Google Maps ↗</a><button onClick={() => setSection("hotels")}>Modifica</button></div>
                </article>;
              })}
            </div>
            {conflictingIds.size > 0 && <div className="agenda-warning"><b>Attenzione agli orari</b><span>Due o più attività si sovrappongono. Modifica inizio o fine nei blocchi evidenziati.</span></div>}

            {(stops.find((item) => item.id === selectedDay?.stopId)?.activities.length || 0) > 0 && <div className="day-clou">
              <span className="day-clou-label">✦ Attività clou di {selectedDay?.city}</span>
              <div className="day-clou-chips">
                {stops.find((item) => item.id === selectedDay?.stopId)?.activities.map((activity) => {
                  const scheduled = scheduleItems.some((item) => item.sourceActivityId === activity.id);
                  return <button key={activity.id} className={scheduled ? "done" : ""} disabled={scheduled} title={scheduled ? "Già in agenda" : `Aggiungi a questa giornata · ${activity.description}`} onClick={() => scheduleClouOnSelectedDay(activity)}>
                    <i>{scheduled ? "✓" : "+"}</i>{activity.name}{activity.price > 0 && <em>{formatCost(activity.price, activity.currency)}</em>}
                  </button>;
                })}
              </div>
            </div>}

            <div className="time-plan">
              {selectedDayItems.length === 0 && <div className="empty-day"><span>+</span><b>Questa giornata è ancora libera</b><p>Aggiungi il primo blocco con il modulo qui sotto.</p></div>}
              {selectedDayItems.map((item) => {
                const kind = scheduleKind(item);
                const itemMapLink = mapLinkFor(item, selectedDay?.city || "");
                return <article className={`schedule-item kind-${kind} ${conflictingIds.has(item.id) ? "conflict" : ""} ${item.bookingStatus === "prenotato" ? "booked" : ""}`} key={item.id}>
                <div className="schedule-time">
                  <label>Inizio<input type="time" step="300" value={item.startTime} onChange={(event) => updateScheduleItem(item.id, { startTime: event.target.value })} onBlur={(event) => logScheduleField(item, "inizio", event.target.value)} /></label>
                  <span>↓</span>
                  <label>Fine<input type="time" step="300" value={item.endTime} onChange={(event) => updateScheduleItem(item.id, { endTime: event.target.value })} onBlur={(event) => logScheduleField(item, "fine", event.target.value)} /></label>
                </div>
                <div className="schedule-content">
                  <div className="kind-badge"><span>{kind === "activity" ? "◎" : kind === "transport" ? "→" : "⌂"}</span>{KIND_LABELS[kind]}</div>
                  <div className="schedule-topline">
                    <input className="schedule-name" aria-label="Nome attività" value={item.name} onChange={(event) => updateScheduleItem(item.id, { name: event.target.value })} onBlur={(event) => logScheduleField(item, "titolo aggiornato in", event.target.value)} />
                    <select aria-label="Tipo di blocco" value={kind} onChange={(event) => {
                      const nextKind = event.target.value as ScheduleKind;
                      updateScheduleItem(item.id, { kind: nextKind, category: nextKind === "transport" ? "trasferimento" : nextKind === "hotel" ? "pernottamento" : "visita" });
                      recordChange("Tipo modificato", `${item.name}: ${KIND_LABELS[nextKind]}`);
                    }}>
                      <option value="activity">Attività</option><option value="transport">Trasporto</option>
                    </select>
                  </div>
                  <div className="schedule-quick">
                    {item.location && <span className="quick-place">📍 {item.location}</span>}
                    {item.nameZh && <button className="quick-zh" title="Mostra in cinese a schermo intero" onClick={() => showPlaceInChinese(item.name, item.nameZh, item.location || selectedDay?.city || "", item.locationZh)}>中 {item.nameZh}</button>}
                    {itemMapLink && <a href={itemMapLink} target="_blank" rel="noreferrer">Mappa ↗</a>}
                    {safeExternalLink(item.ticketUrl) && <a href={safeExternalLink(item.ticketUrl)} target="_blank" rel="noreferrer">🎟 Biglietto ↗</a>}
                  </div>
                  <div className="schedule-meta">
                    <label>Costo per 2 <span className="money-input"><input type="number" min="0" step="0.01" value={item.price} onChange={(event) => updateScheduleItem(item.id, { price: Number(event.target.value) || 0 })} onBlur={(event) => logScheduleField(item, "costo", formatCost(Number(event.target.value) || 0, item.currency))} /><select aria-label={`Valuta ${item.name}`} value={item.currency || "EUR"} onChange={(event) => { updateScheduleItem(item.id, { currency: event.target.value as Currency }); recordChange("Valuta modificata", `${item.name}: ${event.target.value}`); }}><option value="EUR">€</option><option value="CNY">¥</option></select></span></label>
                    <label>Stato <select value={item.bookingStatus} onChange={(event) => { updateScheduleItem(item.id, { bookingStatus: event.target.value as ScheduleItem["bookingStatus"] }); recordChange("Stato modificato", `${item.name}: ${event.target.options[event.target.selectedIndex].text}`); }}><option value="da-prenotare">Da prenotare</option><option value="prenotato">Prenotato</option><option value="non-serve">Nessuna prenotazione</option></select></label>
                    {item.bookingStatus === "prenotato" && item.price > 0 && <label>Chi ha pagato <select value={item.paidBy || ""} onChange={(event) => { const payer = (event.target.value || undefined) as Payer | undefined; updateScheduleItem(item.id, { paidBy: payer }); if (payer) recordChange("Pagamento registrato", `${item.name}: ha pagato ${PAYER_LABELS[payer]}`); }}><option value="">Da assegnare</option><option value="alberto">Alberto</option><option value="sofia">Sofia</option></select></label>}
                    <button className="danger-text" onClick={() => removeScheduleItem(item.id)}>Elimina</button>
                  </div>
                  <details className="schedule-more">
                    <summary>Dettagli · luogo, biglietto, cinese, note</summary>
                    <div className="schedule-specifics">
                      {kind === "activity" && <label>Categoria<select aria-label="Categoria" value={item.category} onChange={(event) => { updateScheduleItem(item.id, { category: event.target.value }); recordChange("Categoria modificata", `${item.name}: ${event.target.options[event.target.selectedIndex].text}`); }}>{categoryOptions.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}</select></label>}
                      {kind === "transport" && <><label>Mezzo<input value={item.transportMode || ""} placeholder="Treno, Didi, metro…" onChange={(event) => updateScheduleItem(item.id, { transportMode: event.target.value })} onBlur={(event) => logScheduleField(item, "mezzo", event.target.value)} /></label><label>Da<input value={item.fromLocation || ""} placeholder="Hotel o punto di partenza" onChange={(event) => updateScheduleItem(item.id, { fromLocation: event.target.value })} onBlur={(event) => logScheduleField(item, "partenza", event.target.value)} /></label></>}
                      <label className={kind === "activity" ? "wide" : ""}>{kind === "transport" ? "A / destinazione" : "Luogo"}<input value={item.location} placeholder="Nome, indirizzo o stazione" onChange={(event) => updateScheduleItem(item.id, { location: event.target.value })} onBlur={(event) => logScheduleField(item, "luogo", event.target.value)} /></label>
                      <label>Nome in cinese<input value={item.nameZh || ""} placeholder="Es. 故宫博物院" onChange={(event) => updateScheduleItem(item.id, { nameZh: event.target.value })} /></label>
                      <label>Luogo in cinese<input value={item.locationZh || ""} placeholder="Indirizzo o zona in cinese" onChange={(event) => updateScheduleItem(item.id, { locationZh: event.target.value })} /></label>
                      <label className="wide">Link biglietto / PDF<input value={item.ticketUrl || ""} placeholder="Link a biglietto, PDF su Drive o mail di conferma" onChange={(event) => updateScheduleItem(item.id, { ticketUrl: event.target.value })} onBlur={(event) => { if (event.target.value.trim()) logScheduleField(item, "biglietto", "link salvato"); }} /></label>
                      <label className="wide">Link mappa personalizzato<input value={item.mapUrl || ""} placeholder="Automatico se vuoto" onChange={(event) => updateScheduleItem(item.id, { mapUrl: event.target.value })} /></label>
                    </div>
                    <div className="zh-tools">
                      <button type="button" onClick={() => showPlaceInChinese(item.name, item.nameZh, item.location || selectedDay?.city || "", item.locationZh)}>🈶 Mostra in cinese</button>
                      <a href={translateZhUrl(`${item.name}${item.location ? ", " + item.location : ""}`)} target="_blank" rel="noreferrer">Traduci con Google ↗</a>
                      <a href={webSearchUrl(`${item.name} ${selectedDay?.city || ""} biglietti sito ufficiale`)} target="_blank" rel="noreferrer">Cerca link ufficiale ↗</a>
                      {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Fonte ↗</a>}
                    </div>
                    <textarea aria-label="Note attività" value={item.notes} placeholder="Biglietti, cosa portare, note pratiche…" onChange={(event) => updateScheduleItem(item.id, { notes: event.target.value })} onBlur={() => recordChange("Note aggiornate", item.name)} />
                  </details>
                </div>
              </article>;
              })}
            </div>

            <form className="card add-plan-card" id="new-plan" onSubmit={addScheduleItem}>
              <div className="card-head"><div><p className="eyebrow">Nuovo blocco · scegli prima il tipo</p><h3>Nuovo {KIND_LABELS[newScheduleItem.kind].toLocaleLowerCase("it")}</h3></div><span>{selectedDay?.city}</span></div>
              <div className="kind-picker" role="group" aria-label="Tipo di nuovo blocco">
                {(["activity", "transport"] as ScheduleKind[]).map((kind) => <button type="button" key={kind} className={newScheduleItem.kind === kind ? "active" : ""} onClick={() => setNewScheduleItem((current) => ({ ...current, kind, category: kind === "transport" ? "trasferimento" : "visita" }))}><span>{kind === "activity" ? "◎" : "→"}</span>{KIND_LABELS[kind]}</button>)}
              </div>
              <div className="add-plan-grid">
                <label>Inizio<input type="time" step="300" value={newScheduleItem.startTime} onChange={(event) => setNewScheduleItem((current) => ({ ...current, startTime: event.target.value }))} /></label>
                <label>Fine<input type="time" step="300" value={newScheduleItem.endTime} onChange={(event) => setNewScheduleItem((current) => ({ ...current, endTime: event.target.value }))} /></label>
                <label className="wide">Titolo<input required value={newScheduleItem.name} placeholder={newScheduleItem.kind === "transport" ? "Es. Hotel → Muraglia di Mutianyu" : newScheduleItem.kind === "hotel" ? "Es. Hotel a Pechino" : "Es. Tempio del Cielo"} onChange={(event) => setNewScheduleItem((current) => ({ ...current, name: event.target.value }))} /></label>
                {newScheduleItem.kind === "activity" && <label>Categoria<select value={newScheduleItem.category} onChange={(event) => setNewScheduleItem((current) => ({ ...current, category: event.target.value }))}>{categoryOptions.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}</select></label>}
                {newScheduleItem.kind === "transport" && <><label>Mezzo<input value={newScheduleItem.transportMode} placeholder="Treno, Didi, metro…" onChange={(event) => setNewScheduleItem((current) => ({ ...current, transportMode: event.target.value }))} /></label><label className="wide">Da<input value={newScheduleItem.fromLocation} placeholder="Hotel o punto di partenza" onChange={(event) => setNewScheduleItem((current) => ({ ...current, fromLocation: event.target.value }))} /></label></>}
                <label className="wide">{newScheduleItem.kind === "transport" ? "A / destinazione" : newScheduleItem.kind === "hotel" ? "Hotel / indirizzo" : "Luogo"}<input value={newScheduleItem.location} placeholder="Nome, indirizzo o stazione (meglio anche in cinese)" onChange={(event) => setNewScheduleItem((current) => ({ ...current, location: event.target.value }))} /></label>
                <label>Link mappa (opzionale)<input type="url" value={newScheduleItem.mapUrl} placeholder="Link Google Maps del luogo" onChange={(event) => setNewScheduleItem((current) => ({ ...current, mapUrl: event.target.value }))} /></label>
                <label>Costo per 2<span className="money-input"><input type="number" min="0" step="0.01" value={newScheduleItem.price} onChange={(event) => setNewScheduleItem((current) => ({ ...current, price: Number(event.target.value) || 0 }))} /><select aria-label="Valuta nuova attività" value={newScheduleItem.currency} onChange={(event) => setNewScheduleItem((current) => ({ ...current, currency: event.target.value as Currency }))}><option value="EUR">€</option><option value="CNY">¥</option></select></span></label>
                <label>Stato<select value={newScheduleItem.bookingStatus} onChange={(event) => setNewScheduleItem((current) => ({ ...current, bookingStatus: event.target.value as ScheduleItem["bookingStatus"] }))}><option value="da-prenotare">Da prenotare</option><option value="prenotato">Prenotato</option><option value="non-serve">Nessuna prenotazione</option></select></label>
                <label className="full">Note<textarea value={newScheduleItem.notes} placeholder="Tempi di trasferimento, biglietti, promemoria…" onChange={(event) => setNewScheduleItem((current) => ({ ...current, notes: event.target.value }))} /></label>
              </div>
              {newScheduleItem.kind === "activity" && <div className="category-creator"><span>Non trovi la categoria?</span><input value={newCategory} placeholder="Es. Fotografia" onChange={(event) => setNewCategory(event.target.value)} /><button type="button" onClick={addCustomCategory}>+ Crea categoria</button></div>}
              <div className="add-plan-footer"><button className="primary" type="submit">+ Aggiungi alla giornata</button><small>Dopo l’aggiunta, ogni modifica viene salvata automaticamente.</small></div>
            </form>

            <article className="card day-expenses">
              <div className="card-head"><div><p className="eyebrow">Fine giornata · chi ha pagato cosa</p><h3>Spese effettive del giorno</h3></div><b>{euro.format(dayExpensesTotal)}</b></div>
              <div className="expense-list">
                {dayExpenses.length === 0 && <p className="empty">Nessuna spesa registrata. A fine giornata, segnate qui chi ha pagato cosa: il budget e il bilancio Alberto/Sofia si aggiornano da soli.</p>}
                {dayExpenses.map((expense) => <div className="expense-row" key={expense.id}>
                  <span className={`payer-badge ${expense.paidBy}`}>{PAYER_LABELS[expense.paidBy].charAt(0)}</span>
                  <div><b>{expense.label}</b><small>{EXPENSE_CATEGORIES.find((category) => category.value === expense.category)?.label || "Extra"} · ha pagato {PAYER_LABELS[expense.paidBy]}</small></div>
                  <strong>{formatCost(expense.amount, expense.currency)}{expense.currency === "CNY" && <small>≈ {euro.format(toEuro(expense.amount, expense.currency))}</small>}</strong>
                  <button className="danger-text" onClick={() => removeExpense(expense.id)}>Togli</button>
                </div>)}
              </div>
              <form className="add-expense" onSubmit={addExpense}>
                <input required aria-label="Descrizione spesa" placeholder="Es. Cena, biglietti, taxi…" value={newExpense.label} onChange={(event) => setNewExpense((current) => ({ ...current, label: event.target.value }))} />
                <input required aria-label="Importo spesa" type="number" min="0.01" step="0.01" placeholder="0" value={newExpense.amount || ""} onChange={(event) => setNewExpense((current) => ({ ...current, amount: Number(event.target.value) || 0 }))} />
                <select aria-label="Valuta spesa" value={newExpense.currency} onChange={(event) => setNewExpense((current) => ({ ...current, currency: event.target.value as Currency }))}><option value="EUR">€</option><option value="CNY">¥</option></select>
                <select aria-label="Categoria spesa" value={newExpense.category} onChange={(event) => setNewExpense((current) => ({ ...current, category: event.target.value as ExpenseCategory }))}>{EXPENSE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select>
                <select aria-label="Chi ha pagato" value={newExpense.paidBy} onChange={(event) => setNewExpense((current) => ({ ...current, paidBy: event.target.value as Payer }))}><option value="alberto">Alberto</option><option value="sofia">Sofia</option></select>
                <button className="primary" type="submit">+ Registra</button>
              </form>
            </article>
          </div>

        </div>
      </section>}

      {section === "transport" && <section className="panel-section">
        <div className="section-title transport-title"><div><p className="eyebrow">Tra le città e dentro ogni giornata</p><h2>Trasporti</h2></div><div><strong>{euro.format(transportCost)}</strong><button className="primary" onClick={prepareNewTransport}>+ Aggiungi trasferimento</button></div></div>
        <article className="card daily-transports">
          <div className="card-head"><div><p className="eyebrow">Dall’agenda</p><h2>Spostamenti giornalieri</h2></div><span>{scheduleItems.filter((item) => scheduleKind(item) === "transport").length} inseriti</span></div>
          <div className="daily-transport-list">
            {scheduleItems.filter((item) => scheduleKind(item) === "transport").sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)).map((item) => <button key={item.id} onClick={() => { setSelectedDate(item.date); setSection("calendar"); }}>
              <span><b>{shortDate.format(new Date(`${item.date}T12:00:00`))}</b><small>{item.startTime}–{item.endTime}</small></span>
              <span><strong>{item.transportMode || "Trasporto"}</strong>{item.fromLocation || "Partenza da definire"} → {item.location || "Destinazione da definire"}</span>
              <i>Modifica in agenda →</i>
            </button>)}
          </div>
        </article>
        <div className="section-title compact"><div><p className="eyebrow">Tratte principali</p><h2>Collegamenti tra le tappe</h2></div></div>
        <div className="transport-list">
          {normalizedLegs.map((leg) => {
            const fromStop = stops.find((stop) => stop.id === leg.fromId);
            const toStop = stops.find((stop) => stop.id === leg.toId);
            return <article key={leg.id} className={`transport-card ${leg.included ? "" : "disabled"}`}>
              <div className="transport-route"><span>{fromStop?.name}</span><i>→</i><span>{toStop?.name}</span></div>
              <div className="transport-fields">
                <label>Mezzo<input value={leg.mode} onChange={(event) => updateLeg(leg.id, { mode: event.target.value })} /></label>
                <label>Durata<input value={leg.duration} onChange={(event) => updateLeg(leg.id, { duration: event.target.value })} /></label>
                <label>Costo per 2<span className="money-input"><input type="number" min="0" value={leg.cost} onChange={(event) => updateLeg(leg.id, { cost: Number(event.target.value) || 0 })} /><select aria-label={`Valuta ${fromStop?.name} ${toStop?.name}`} value={leg.currency || "EUR"} onChange={(event) => updateLeg(leg.id, { currency: event.target.value as Currency })}><option value="EUR">€</option><option value="CNY">¥</option></select></span></label>
              </div>
              <p>{leg.note}</p>
              <div className="transport-actions"><button onClick={() => updateLeg(leg.id, { included: !leg.included })}>{leg.included ? "Togli dal viaggio" : "Aggiungi al viaggio"}</button><a href={googleMapsSearchUrl(toStop?.name || "")} target="_blank" rel="noreferrer">Destinazione su Google Maps ↗</a></div>
            </article>;
          })}
        </div>
      </section>}

      {section === "budget" && <section className="panel-section">
        <div className="budget-hero">
          <div><p className="eyebrow">Budget previsionale · per due</p><strong>{euro.format(totalBudget)}</strong><span>{euro.format(totalBudget / 2)} a persona</span></div>
          <div className="budget-hero-side">
            <div><small>Consuntivo · speso e prenotato</small><b>{euro.format(spentTotal)}</b></div>
            <div><small>Residuo previsionale</small><b className={totalBudget - spentTotal >= 0 ? "ok" : "over"}>{euro.format(totalBudget - spentTotal)}</b></div>
            <div><small>Cambio</small><label className="fx-input">1 € = <input type="number" min="0.01" step="0.01" value={cnyPerEuro} onChange={(event) => setCnyPerEuro(Math.max(0.01, Number(event.target.value) || 8))} /> ¥</label></div>
          </div>
        </div>

        <article className="card budget-compare">
          <div className="card-head"><div><p className="eyebrow">Previsionale vs consuntivo</p><h2>Scostamento per categoria</h2></div><span className="subtle">Voli, prenotazioni confermate e spese registrate entrano da soli nel consuntivo</span></div>
          <div className="compare-table">
            <div className="compare-row head"><span>Categoria</span><span>Previsionale</span><span>Consuntivo</span><span>Scostamento</span></div>
            {budgetComparison.map((row) => {
              const delta = row.spent - row.planned;
              return <div className="compare-row" key={row.key}>
                <span className="compare-label"><b>{row.label}</b><small>{row.note}</small></span>
                <span>{euro.format(row.planned)}</span>
                <span>{row.spent > 0 ? euro.format(row.spent) : "—"}</span>
                <span className={`compare-delta ${row.spent === 0 ? "muted" : delta > 0 ? "over" : "ok"}`}>{row.spent === 0 ? "—" : `${delta > 0 ? "+" : "−"} ${euro.format(Math.abs(delta))}`}</span>
              </div>;
            })}
            <div className="compare-row total">
              <span className="compare-label"><b>Totale viaggio</b></span>
              <span>{euro.format(totalBudget)}</span>
              <span>{euro.format(spentTotal)}</span>
              <span className={`compare-delta ${spentTotal === 0 ? "muted" : spentTotal - totalBudget > 0 ? "over" : "ok"}`}>{spentTotal === 0 ? "—" : `${spentTotal - totalBudget > 0 ? "+" : "−"} ${euro.format(Math.abs(spentTotal - totalBudget))}`}</span>
            </div>
          </div>
        </article>

        <article className="card split-card">
          <div className="card-head"><div><p className="eyebrow">Splitwise interno · tutto diviso a metà</p><h2>Bilancio Alberto & Sofia</h2></div><b>{euro.format(spentTotal)}</b></div>
          <div className="split-totals">
            <div className="split-person alberto"><span className="payer-badge alberto">A</span><div><b>Alberto</b><small>ha anticipato</small></div><strong>{euro.format(spentByPayer.alberto)}</strong></div>
            <div className={`split-balance ${splitBalance === 0 ? "even" : ""}`}>
              {splitBalance === 0 ? <b>Siete pari</b> : splitBalance > 0 ? <><small>Sofia deve ad Alberto</small><b>{euro.format(splitBalance)}</b></> : <><small>Alberto deve a Sofia</small><b>{euro.format(-splitBalance)}</b></>}
            </div>
            <div className="split-person sofia"><span className="payer-badge sofia">S</span><div><b>Sofia</b><small>ha anticipato</small></div><strong>{euro.format(spentByPayer.sofia)}</strong></div>
          </div>
          <div className="expense-register">
            <div className="expense-row auto" key="flights">
              <span className="payer-badge even">½</span>
              <div><b>Voli internazionali</b><small>Già pagati · divisi a metà, non spostano il bilancio</small></div>
              <strong>{euro.format(FLIGHTS_COST)}</strong>
              <em className="auto-tag">auto</em>
            </div>
            {[...confirmedEntries].sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`)).map((entry) => <div className="expense-row auto" key={entry.id}>
              <span className={`payer-badge ${entry.paidBy || "even"}`}>{entry.paidBy ? PAYER_LABELS[entry.paidBy].charAt(0) : "?"}</span>
              <div><b>{entry.label}</b><small>{shortDate.format(new Date(`${entry.date}T12:00:00`))} · {entry.detail}{entry.paidBy ? ` · ha pagato ${PAYER_LABELS[entry.paidBy]}` : " · chi ha pagato? Da assegnare"}</small></div>
              <strong>{formatCost(entry.amount, entry.currency)}{entry.currency === "CNY" && <small>≈ {euro.format(toEuro(entry.amount, entry.currency))}</small>}</strong>
              <em className="auto-tag">auto</em>
            </div>)}
            {[...expenses].sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`)).map((expense) => <div className="expense-row" key={expense.id}>
              <span className={`payer-badge ${expense.paidBy}`}>{PAYER_LABELS[expense.paidBy].charAt(0)}</span>
              <div><b>{expense.label}</b><small>{shortDate.format(new Date(`${expense.date}T12:00:00`))} · {EXPENSE_CATEGORIES.find((category) => category.value === expense.category)?.label || "Extra"}</small></div>
              <strong>{formatCost(expense.amount, expense.currency)}</strong>
              <button className="danger-text" onClick={() => removeExpense(expense.id)}>Togli</button>
            </div>)}
          </div>
        </article>

        <div className="budget-panels">
          <article className="card cost-manager">
            <div className="card-head"><div><p className="eyebrow">Pianificazione · cibo, extra e stime</p><h2>Voci di budget pianificate</h2></div><b>{euro.format(addedCostsTotal)}</b></div>
            <div className="cost-list">
              {costEntries.map((entry) => <div className="cost-row" key={entry.id}>
                <input aria-label="Descrizione costo" value={entry.label} onChange={(event) => updateCostEntry(entry.id, { label: event.target.value })} onBlur={(event) => recordChange("Costo modificato", `Descrizione: ${event.target.value}`)} />
                <input aria-label={`Importo ${entry.label}`} type="number" min="0" step="0.01" value={entry.amount} onChange={(event) => updateCostEntry(entry.id, { amount: Number(event.target.value) || 0 })} onBlur={(event) => recordChange("Costo modificato", `${entry.label}: ${formatCost(Number(event.target.value) || 0, entry.currency)}`)} />
                <select aria-label={`Valuta ${entry.label}`} value={entry.currency} onChange={(event) => { updateCostEntry(entry.id, { currency: event.target.value as Currency }); recordChange("Valuta costo modificata", `${entry.label}: ${event.target.value}`); }}><option value="EUR">EUR €</option><option value="CNY">CNY ¥</option></select>
                <strong>{entry.currency === "CNY" ? `≈ ${euro.format(toEuro(entry.amount, entry.currency))}` : formatCost(entry.amount, entry.currency)}</strong>
                <button className="danger-text" onClick={() => removeCostEntry(entry.id)}>Togli</button>
              </div>)}
            </div>
            <form className="add-cost" onSubmit={addCostEntry}>
              <input required aria-label="Nuovo costo" placeholder="Es. Treno per Suzhou" value={newCost.label} onChange={(event) => setNewCost((current) => ({ ...current, label: event.target.value }))} />
              <input required aria-label="Importo nuovo costo" type="number" min="0.01" step="0.01" placeholder="0" value={newCost.amount || ""} onChange={(event) => setNewCost((current) => ({ ...current, amount: Number(event.target.value) || 0 }))} />
              <select aria-label="Valuta nuovo costo" value={newCost.currency} onChange={(event) => setNewCost((current) => ({ ...current, currency: event.target.value as Currency }))}><option value="EUR">EUR €</option><option value="CNY">CNY ¥</option></select>
              <button className="primary" type="submit">+ Aggiungi</button>
            </form>
          </article>
          <article className="card budget-detail"><div className="card-head"><div><p className="eyebrow">Dall’agenda</p><h2>Blocchi nel budget</h2></div><b>{euro.format(activitiesCost)}</b></div><div>{budgetedActivities.length === 0 ? <p className="empty padded">Aggiungi un costo a un blocco dell’agenda per includerlo nel budget.</p> : budgetedActivities.map((activity) => <div className="budget-row" key={`${activity.city}-${activity.id}`}><span>{activity.city}<small>{activity.date} · {activity.startTime}</small></span><div><b>{activity.name}</b><small>{activity.notes}</small></div><strong>{formatCost(activity.price, activity.currency)}</strong></div>)}</div></article>
        </div>
      </section>}

      {section === "planner" && <section className="planner-grid simple">
        <div className="stack">
          <article className="card">
            <div className="card-head"><div><p className="eyebrow">Preparazione</p><h2>Checklist</h2></div><span>{checklist.filter(Boolean).length + extraChecklist.filter((item) => item.done).length} / {checklist.length + extraChecklist.length}</span></div>
            <div className="checklist">
              {defaultChecklist.map((item, index) => <label key={item}><input type="checkbox" checked={Boolean(checklist[index])} onChange={() => { const done = !Boolean(checklist[index]); setChecklist((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value)); recordChange(done ? "Checklist completata" : "Checklist riaperta", item); }} /><span>{item}</span></label>)}
              {extraChecklist.map((item) => <label key={item.id}><input type="checkbox" checked={item.done} onChange={() => toggleExtraChecklistItem(item.id)} /><span>{item.label}</span><button type="button" className="danger-text" onClick={(event) => { event.preventDefault(); removeExtraChecklistItem(item.id); }}>Togli</button></label>)}
            </div>
            <form className="add-checklist" onSubmit={addChecklistItem}>
              <input required aria-label="Nuovo punto della checklist" placeholder="Es. Comprare adattatore per le prese" value={newChecklistItem} onChange={(event) => setNewChecklistItem(event.target.value)} />
              <button className="primary" type="submit">+ Aggiungi</button>
            </form>
          </article>
          <article className="card links-card">
            <div className="card-head"><div><p className="eyebrow">Prenotazioni, biglietti e pagine da ricordare</p><h2>Link</h2></div><span>{sharedLinks.length} {sharedLinks.length === 1 ? "salvato" : "salvati"}</span></div>
            <div className="link-list">
              {sharedLinks.length === 0 && <p className="empty">Nessun link salvato. Aggiungi qui conferme di prenotazione, biglietti e pagine utili, città per città.</p>}
              {sharedLinks.map((link) => {
                const openUrl = safeExternalLink(link.url);
                return <div className="link-row" key={link.id}>
                  <select aria-label="Città del link" value={link.stopId} onChange={(event) => { updateSharedLink(link.id, { stopId: event.target.value }); recordChange("Link spostato", `${link.label || link.url} → ${stops.find((stop) => stop.id === event.target.value)?.name || "Tutto il viaggio"}`); }}>
                    <option value="">Tutto il viaggio</option>
                    {stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}
                  </select>
                  <input aria-label="Descrizione link" value={link.label} placeholder="Es. Conferma hotel, biglietti…" onChange={(event) => updateSharedLink(link.id, { label: event.target.value })} onBlur={(event) => { if (event.target.value.trim()) recordChange("Link rinominato", event.target.value.trim()); }} />
                  <input aria-label="Indirizzo del link" value={link.url} placeholder="https://…" onChange={(event) => updateSharedLink(link.id, { url: event.target.value })} onBlur={(event) => { const url = normalizeLinkUrl(event.target.value); if (url !== link.url) updateSharedLink(link.id, { url }); }} />
                  {openUrl ? <a href={openUrl} target="_blank" rel="noreferrer">Apri ↗</a> : <span className="link-invalid">Link?</span>}
                  <button className="danger-text" onClick={() => removeSharedLink(link.id)}>Togli</button>
                </div>;
              })}
            </div>
            <form className="add-link" onSubmit={addSharedLink}>
              <select aria-label="Città del nuovo link" value={newLink.stopId} onChange={(event) => setNewLink((current) => ({ ...current, stopId: event.target.value }))}>
                <option value="">Tutto il viaggio</option>
                {stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}
              </select>
              <input aria-label="Descrizione nuovo link" value={newLink.label} placeholder="Es. Conferma hotel Pechino" onChange={(event) => setNewLink((current) => ({ ...current, label: event.target.value }))} />
              <input required aria-label="Indirizzo nuovo link" value={newLink.url} placeholder="Incolla qui il link" onChange={(event) => setNewLink((current) => ({ ...current, url: event.target.value }))} />
              <button className="primary" type="submit">+ Aggiungi</button>
            </form>
            <details className="old-notes">
              <summary>Note condivise{notes.trim() ? " · c'è del testo salvato" : ""}</summary>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} onBlur={() => recordChange("Note condivise aggiornate", "Ha modificato le note generali del viaggio")} placeholder="Hotel preferiti, ristoranti, idee e cose da ricordare…" />
            </details>
          </article>
        </div>
      </section>}

      {section === "history" && <section className="history-section">
        <div className="section-title"><div><p className="eyebrow">Registro condiviso</p><h2>Chi ha modificato cosa</h2></div><span>Ultime {changeLog.length} modifiche</span></div>
        <article className="card history-card">
          {changeLog.length === 0 ? <div className="history-empty"><span>↻</span><b>Il registro parte da questo aggiornamento</b><p>Le nuove aggiunte, cancellazioni e modifiche importanti appariranno qui con autore e ora.</p></div> : <div className="history-list">
            {changeLog.map((entry) => <div className="history-row" key={entry.id}>
              <span className={`history-avatar ${entry.authorName === "Sofia" ? "sofia" : ""}`}>{entry.authorName?.charAt(0) || "?"}</span>
              <div><b>{entry.authorName || entry.authorEmail}</b><strong>{entry.action}</strong><p>{entry.detail}</p></div>
              <time>{entry.createdAt?.toDate ? entry.createdAt.toDate().toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "adesso"}</time>
            </div>)}
          </div>}
        </article>
      </section>}

      {taxiInfo && <div className="taxi-overlay" role="dialog" aria-modal="true" aria-label="Nome in cinese da mostrare" onClick={() => setTaxiInfo(null)}>
        <div className="taxi-card" onClick={(event) => event.stopPropagation()}>
          <p className="taxi-kicker">{taxiInfo.kind === "hotel" ? "请送我们到这家酒店，谢谢！" : "请问，这个地方怎么走？谢谢！"}</p>
          <small className="taxi-kicker-it">{taxiInfo.kind === "hotel" ? "«Per favore, ci porti a questo hotel. Grazie!»" : "«Scusi, come si arriva a questo posto? Grazie!»"}</small>
          <h2>{taxiInfo.titleZh?.trim() || taxiInfo.title}</h2>
          <p className="taxi-address">{taxiInfo.subtitleZh?.trim() || taxiInfo.subtitle || ""}</p>
          {!taxiInfo.titleZh?.trim() && <small className="taxi-hint">Consiglio: aggiungi il nome in cinese (c&apos;è il link «Traduci»), così chi legge non ha dubbi.</small>}
          {(taxiInfo.titleZh?.trim() || taxiInfo.subtitleZh?.trim()) && <div className="taxi-latin"><b>{taxiInfo.title}</b><span>{taxiInfo.subtitle}</span></div>}
          <button className="taxi-close" onClick={() => setTaxiInfo(null)}>Chiudi</button>
        </div>
      </div>}
    </main>
  );
}
