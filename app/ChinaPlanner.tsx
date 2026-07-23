"use client";

import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

type Currency = "EUR" | "CNY";

type Activity = {
  id: string;
  name: string;
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
  category: "visita" | "trasporto" | "cibo" | "tempo-libero" | "hotel";
  location: string;
  notes: string;
  price: number;
  currency?: Currency;
  bookingStatus: "da-prenotare" | "prenotato" | "non-serve";
  sourceUrl?: string;
  sourceActivityId?: string;
};

type Stop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  nights: number;
  hotelNightly: number;
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

type PlanData = {
  stops: Stop[];
  legs: Leg[];
  scheduleItems: ScheduleItem[];
  checklist: boolean[];
  notes: string;
  cnyPerEuro: number;
  costEntries: CostEntry[];
};

type LeafletMap = {
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
const ALLOWED_EMAILS = new Set([
  "bebroggi@gmail.com",
  "sofiakovaleva1998@gmail.com",
]);

const initialStops: Stop[] = [
  {
    id: "beijing",
    name: "Pechino",
    lat: 39.9042,
    lng: 116.4074,
    nights: 3,
    hotelNightly: 95,
    activities: [
      { id: "forbidden-city", name: "Città Proibita + Jingshan", description: "Prenotazione obbligatoria", price: 24, selected: false },
      { id: "great-wall", name: "Grande Muraglia di Mutianyu", description: "Transfer e ingressi per due", price: 110, selected: false },
      { id: "temple-heaven", name: "Tempio del Cielo", description: "Biglietto online o sul posto", price: 10, selected: false },
    ],
  },
  { id: "xian", name: "Xi’an", lat: 34.3416, lng: 108.9398, nights: 2, hotelNightly: 85, activities: [{ id: "terracotta", name: "Esercito di Terracotta", description: "Ingresso e transfer per due", price: 60, selected: false }] },
  { id: "chengdu", name: "Chengdu", lat: 30.5728, lng: 104.0668, nights: 2, hotelNightly: 80, activities: [{ id: "pandas", name: "Chengdu Panda Base", description: "Fascia mattutina consigliata", price: 30, selected: false }] },
  { id: "kunming", name: "Kunming · Yunnan", lat: 25.0389, lng: 102.7183, nights: 3, hotelNightly: 75, activities: [{ id: "stone-forest", name: "Foresta di Pietra di Shilin", description: "Escursione di una giornata", price: 80, selected: false }] },
  { id: "zhangjiajie", name: "Zhangjiajie", lat: 29.347, lng: 110.4792, nights: 2, hotelNightly: 90, activities: [{ id: "forest-park", name: "National Forest Park", description: "Pass del parco per due", price: 90, selected: false }] },
  { id: "fenghuang", name: "Fenghuang", lat: 27.9483, lng: 109.5987, nights: 1, hotelNightly: 65, activities: [{ id: "tuojiang", name: "Barca sul fiume Tuojiang", description: "Biglietto sul posto", price: 15, selected: false }] },
  { id: "wuzhen", name: "Wuzhen", lat: 30.7462, lng: 120.4943, nights: 1, hotelNightly: 100, activities: [{ id: "xizha", name: "Xizha Scenic Area", description: "Biglietto consigliato online", price: 40, selected: false }] },
  { id: "suzhou", name: "Suzhou", lat: 31.2989, lng: 120.5853, nights: 1, hotelNightly: 75, activities: [{ id: "humble-garden", name: "Giardino dell’Umile Amministratore", description: "Prenotazione consigliata", price: 20, selected: false }] },
  { id: "shanghai", name: "Shanghai", lat: 31.2304, lng: 121.4737, nights: 2, hotelNightly: 120, activities: [{ id: "tower", name: "Shanghai Tower Observatory", description: "Prenotazione consigliata", price: 45, selected: false }] },
];

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
  { id: "d01-arrival", date: "2026-11-17", stopId: "beijing", startTime: "12:25", endTime: "15:30", name: "Arrivo a Pechino e transfer", category: "trasporto", location: "PEK → hotel", notes: "Ritiro bagagli, Alipay pronto e check-in. Non fissare attività impegnative.", price: 0, bookingStatus: "prenotato" },
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
  { id: "d11-checkin", date: "2026-11-27", stopId: "zhangjiajie", startTime: "18:00", endTime: "20:00", name: "Check-in a Wulingyuan e cena", category: "hotel", location: "Wulingyuan", notes: "Acquistare snack e acqua per il parco.", price: 25, bookingStatus: "non-serve" },
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
  "Installare Alipay e WeChat Pay",
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

  return {
    stops: data.stops,
    legs: data.legs,
    scheduleItems: data.scheduleItems,
    checklist: Array.isArray(data.checklist) ? data.checklist : defaultChecklist.map(() => false),
    notes: typeof data.notes === "string" ? data.notes : "",
    cnyPerEuro: typeof data.cnyPerEuro === "number" ? data.cnyPerEuro : 8,
    costEntries: Array.isArray(data.costEntries) ? data.costEntries : [],
  };
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
  onSelect,
}: {
  stops: Stop[];
  legs: Leg[];
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

      const initialZoom = containerRef.current.clientWidth < 640 ? 4 : 5;
      createdMap.setView([32.2, 111.7], initialZoom);
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
  }, [stops, legs, onSelect]);

  return (
    <div className="real-map-shell">
      <div ref={containerRef} className="real-map" aria-label="Mappa interattiva dell’itinerario in Cina" />
      {!mapReady && !mapError && <div className="map-loading">Caricamento mappa geografica…</div>}
      {mapError && <div className="map-error">{mapError}</div>}
      {mapReady && <div className="map-tools"><button onClick={() => mapRef.current?.setView([32.2, 111.7], (containerRef.current?.clientWidth || 800) < 640 ? 4 : 5)}>Rotta completa</button><button onClick={() => mapRef.current?.setView([31.1, 120.7], 8)}>Zoom Wuzhen–Shanghai</button></div>}
      <div className="map-legend"><span><i /> Tappa</span><span><i className="route" /> Trasporto incluso</span><span><i className="route off" /> Escluso</span></div>
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
  const [section, setSection] = useState("calendar");
  const [stops, setStops] = useState<Stop[]>(initialStops);
  const [legs, setLegs] = useState<Leg[]>(initialLegs);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(initialSchedule);
  const [selectedDate, setSelectedDate] = useState("2026-11-17");
  const [selectedStopId, setSelectedStopId] = useState("beijing");
  const [newStopName, setNewStopName] = useState("");
  const [newScheduleItem, setNewScheduleItem] = useState({
    startTime: "09:00",
    endTime: "11:00",
    name: "",
    category: "visita" as ScheduleItem["category"],
    location: "",
    notes: "",
    price: 0,
    currency: "EUR" as Currency,
    bookingStatus: "da-prenotare" as ScheduleItem["bookingStatus"],
  });
  const [checklist, setChecklist] = useState<boolean[]>(defaultChecklist.map(() => false));
  const [notes, setNotes] = useState("");
  const [cnyPerEuro, setCnyPerEuro] = useState(8);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([
    { id: "food", label: "Cibo e bevande", amount: 900, currency: "EUR" },
    { id: "local", label: "Trasporti locali", amount: 300, currency: "EUR" },
    { id: "extras", label: "Assicurazione, connettività ed extra", amount: 720, currency: "EUR" },
  ]);
  const [newCost, setNewCost] = useState({ label: "", amount: 0, currency: "EUR" as Currency });
  const [hydrated, setHydrated] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "synced" | "error">("loading");
  const lastCloudValueRef = useRef("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = normalizePlanData(JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) || "null"));
        if (saved) {
          setStops(saved.stops);
          setLegs(saved.legs);
          setScheduleItems(saved.scheduleItems);
          setChecklist(saved.checklist);
          setNotes(saved.notes);
          setCnyPerEuro(saved.cnyPerEuro);
          setCostEntries(saved.costEntries);
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
        const remotePlan = normalizePlanData(snapshot.data());
        if (!remotePlan) {
          setSyncStatus("error");
          return;
        }

        const serialized = JSON.stringify(remotePlan);
        lastCloudValueRef.current = serialized;
        setStops(remotePlan.stops);
        setLegs(remotePlan.legs);
        setScheduleItems(remotePlan.scheduleItems);
        setChecklist(remotePlan.checklist);
        setNotes(remotePlan.notes);
        setCnyPerEuro(remotePlan.cnyPerEuro);
        setCostEntries(remotePlan.costEntries);
        localStorage.setItem(PLAN_STORAGE_KEY, serialized);
        setCloudReady(true);
        setSyncStatus("synced");
        return;
      }

      let seedPlan: PlanData = {
        stops: initialStops,
        legs: initialLegs,
        scheduleItems: initialSchedule,
        checklist: defaultChecklist.map(() => false),
        notes: "",
        cnyPerEuro: 8,
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

      const serialized = JSON.stringify(seedPlan);
      lastCloudValueRef.current = serialized;
      try {
        await setDoc(planDocument, { ...seedPlan, updatedAt: serverTimestamp() });
        setCloudReady(true);
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
      }
    }, () => {
      setSyncStatus("error");
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const planData: PlanData = { stops, legs, scheduleItems, checklist, notes, cnyPerEuro, costEntries };
    const serialized = JSON.stringify(planData);
    localStorage.setItem(PLAN_STORAGE_KEY, serialized);

    if (!cloudReady || serialized === lastCloudValueRef.current) return;
    setSyncStatus("saving");
    const timer = window.setTimeout(async () => {
      try {
        await setDoc(doc(db, "travel-plans", "china-2026"), { ...planData, updatedAt: serverTimestamp() });
        lastCloudValueRef.current = serialized;
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [stops, legs, scheduleItems, checklist, notes, cnyPerEuro, costEntries, hydrated, cloudReady]);

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
  const budgetedActivities = plannedActivities.filter((item) => item.category === "visita" || item.category === "tempo-libero");
  const activitiesCost = budgetedActivities.reduce((sum, item) => sum + toEuro(item.price, item.currency), 0);
  const hotelCost = stops.reduce((sum, stop) => sum + stop.nights * stop.hotelNightly, 0);
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
    return entries;
  }, [timeline, normalizedLegs]);

  const selectedDay = calendarDays.find((entry) => entry.dateKey === selectedDate) ?? calendarDays[0];
  const selectedDayItems = scheduleItems
    .filter((item) => item.date === selectedDay?.dateKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const conflictingIds = new Set<string>();
  selectedDayItems.forEach((item, index) => {
    const previous = selectedDayItems[index - 1];
    if (previous && item.startTime < previous.endTime) {
      conflictingIds.add(previous.id);
      conflictingIds.add(item.id);
    }
  });
  const plannedDayCount = calendarDays.filter((day) => scheduleItems.some((item) => item.date === day.dateKey)).length;
  const dayCost = selectedDayItems.reduce((sum, item) => sum + toEuro(item.price, item.currency), 0);
  const bookingCount = scheduleItems.filter((item) => item.bookingStatus === "da-prenotare").length;

  function updateStop(id: string, patch: Partial<Stop>) {
    setStops((current) => current.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)));
  }

  function removeStop(id: string) {
    if (id === "beijing" || id === "shanghai") return;
    setStops((current) => current.filter((stop) => stop.id !== id));
    if (selectedStopId === id) setSelectedStopId("beijing");
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
    const stop: Stop = { id: uid("stop"), name, lat: 30, lng: 111, nights: 1, hotelNightly: 80, activities: [] };
    setStops((current) => [...current.slice(0, -1), stop, current[current.length - 1]]);
    setSelectedStopId(stop.id);
    setNewStopName("");
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
    setScheduleItems((current) => [...current, {
      id: uid("plan"),
      date: selectedDay.dateKey,
      stopId: selectedDay.stopId,
      ...newScheduleItem,
      name: newScheduleItem.name.trim(),
      location: newScheduleItem.location.trim(),
      notes: newScheduleItem.notes.trim(),
      price: Number(newScheduleItem.price) || 0,
      currency: newScheduleItem.currency,
    }]);
    setNewScheduleItem((current) => ({ ...current, name: "", location: "", notes: "", price: 0 }));
  }

  function updateScheduleItem(id: string, patch: Partial<ScheduleItem>) {
    setScheduleItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function removeScheduleItem(id: string) {
    setScheduleItems((current) => current.filter((item) => item.id !== id));
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
      category: "visita",
      location: stop.name,
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
  }

  function updateCostEntry(id: string, patch: Partial<CostEntry>) {
    setCostEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function removeCostEntry(id: string) {
    setCostEntries((current) => current.filter((entry) => entry.id !== id));
  }

  const navItems = [
    ["itinerary", "Itinerario"],
    ["calendar", "Agenda giorno per giorno"],
    ["transport", "Trasporti"],
    ["budget", "Budget"],
    ["planner", "Checklist & note"],
  ];
  const syncLabel = {
    loading: "Collegamento al database…",
    saving: "Salvataggio…",
    synced: "Tutto sincronizzato",
    error: "Sincronizzazione non disponibile",
  }[syncStatus];

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Alberto & Sofia · Cina 2026</p>
          <h1>Ogni giorno.<br />Ogni ora. Tutto qui.</h1>
          <p className="lead">Un’agenda reale per costruire il viaggio: attività, tempi, spostamenti, prenotazioni e costi restano collegati.</p>
        </div>
        <div className="anchor-card">
          <span>Piano operativo</span>
          <strong>{plannedDayCount} / {calendarDays.length} giorni</strong>
          <small>{scheduleItems.length} blocchi orari · {bookingCount} da prenotare</small>
        </div>
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
        <small>{currentUser.email}</small>
        <button onClick={() => signOut(auth)}>Esci</button>
      </div>

      {section === "itinerary" && (
        <section className="section-grid">
          <div className="stack">
            <article className="card map-card">
              <div className="card-head"><div><p className="eyebrow">Mappa viva</p><h2>La rotta</h2></div><span className="subtle">Seleziona una città</span></div>
              <InteractiveRouteMap stops={stops} legs={normalizedLegs} onSelect={setSelectedStopId} />
            </article>

            <article className="card">
              <div className="card-head"><div><p className="eyebrow">Recap modificabile</p><h2>Tappe e collegamenti</h2></div><span className={`fit-badge ${remainingNights === 0 ? "ok" : ""}`}>{remainingNights === 0 ? "Finestra completa" : remainingNights > 0 ? `${remainingNights} notti da assegnare` : `${Math.abs(remainingNights)} notti oltre il volo`}</span></div>
              <div className="route-editor">
                {timeline.map((item, index) => {
                  const leg = normalizedLegs[index];
                  const locked = item.stop.id === "beijing" || item.stop.id === "shanghai";
                  return <div key={item.stop.id}>
                    <div className={`stop-editor ${selectedStop.id === item.stop.id ? "selected" : ""}`} onClick={() => setSelectedStopId(item.stop.id)}>
                      <span className="stop-number">{index + 1}</span>
                      <div className="stop-main"><b>{item.stop.name}</b><small>{shortDate.format(item.arrival)} → {shortDate.format(item.departure)} · {item.stop.nights} {item.stop.nights === 1 ? "notte" : "notti"}</small></div>
                      <label>Notti<input type="number" min="1" max="8" value={item.stop.nights} onClick={(event) => event.stopPropagation()} onChange={(event) => updateStop(item.stop.id, { nights: Math.max(1, Number(event.target.value) || 1) })} /></label>
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
                <form className="add-stop" onSubmit={addStop}><input value={newStopName} onChange={(event) => setNewStopName(event.target.value)} placeholder="Aggiungi una città prima di Shanghai" /><button type="submit">+ Aggiungi tappa</button></form>
              </div>
            </article>
          </div>

          <aside className="card city-workspace">
            <div className="card-head sticky"><div><p className="eyebrow">City box</p><h2>{selectedStop.name}</h2></div><span className="city-dates">{shortDate.format(timeline.find((item) => item.stop.id === selectedStop.id)?.arrival || ARRIVAL_DATE)}</span></div>
            <div className="city-body">
              <div className="mini-budget"><span>Già in agenda</span><b>{scheduleItems.filter((item) => item.stopId === selectedStop.id).length}</b><small>{euro.format(scheduleItems.filter((item) => item.stopId === selectedStop.id).reduce((sum, item) => sum + toEuro(item.price, item.currency), 0))} nel budget</small></div>
              <label className="hotel-field">Hotel per notte <span><input type="number" min="0" value={selectedStop.hotelNightly} onChange={(event) => updateStop(selectedStop.id, { hotelNightly: Number(event.target.value) || 0 })} /> €</span></label>
              <h3>Idee da mettere in agenda</h3>
              <div className="activity-list">
                {selectedStop.activities.length === 0 && <p className="empty">Nessuna idea salvata per questa tappa.</p>}
                {selectedStop.activities.map((activity) => <div className={`activity-row ${scheduleItems.some((item) => item.sourceActivityId === activity.id) ? "selected" : ""}`} key={activity.id}>
                  <button className="check" title="Aggiungi alla prima giornata disponibile" onClick={() => scheduleActivity(selectedStop, activity)}>{scheduleItems.some((item) => item.sourceActivityId === activity.id) ? "✓" : "+"}</button>
                  <div><b>{activity.name}</b><small>{activity.description}</small>{activity.sourceUrl && <a href={activity.sourceUrl} target="_blank" rel="noreferrer">Fonte ↗</a>}</div>
                  <label className="money-input"><input type="number" min="0" value={activity.price} onChange={(event) => updateActivity(selectedStop.id, activity.id, { price: Number(event.target.value) || 0 })} /><select aria-label={`Valuta ${activity.name}`} value={activity.currency || "EUR"} onChange={(event) => updateActivity(selectedStop.id, activity.id, { currency: event.target.value as Currency })}><option value="EUR">€</option><option value="CNY">¥</option></select></label>
                </div>)}
              </div>
            </div>
          </aside>
        </section>
      )}

      {section === "calendar" && <section className="panel-section">
        <div className="section-title agenda-title">
          <div><p className="eyebrow">Agenda condivisa · sincronizzata tra i vostri dispositivi</p><h2>Giorno per giorno, ora per ora</h2></div>
          <div className="agenda-summary"><span><b>{scheduleItems.length}</b> attività</span><span><b>{bookingCount}</b> da prenotare</span><span><b>{euro.format(activitiesCost)}</b> pianificati</span><button onClick={() => window.print()}>Stampa piano</button></div>
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

        <div className="agenda-layout">
          <div className="agenda-main">
            <article className="card day-overview">
              <div>
                <p className="eyebrow">{selectedDay?.type === "travel" ? "Giornata di spostamento" : "Giornata in città"}</p>
                <h2>{selectedDay ? longDate.format(selectedDay.date) : ""}</h2>
                <strong>{selectedDay?.city}</strong>
              </div>
              <div className="day-kpis">
                <span><b>{selectedDayItems.length}</b> blocchi</span>
                <span><b>{selectedDayItems[0]?.startTime || "—"}</b> inizio</span>
                <span><b>{selectedDayItems.at(-1)?.endTime || "—"}</b> fine</span>
                <span><b>{euro.format(dayCost)}</b> giornata</span>
              </div>
            </article>
            {conflictingIds.size > 0 && <div className="agenda-warning"><b>Attenzione agli orari</b><span>Due o più attività si sovrappongono. Modifica inizio o fine nei blocchi evidenziati.</span></div>}

            <div className="time-plan">
              {selectedDayItems.length === 0 && <div className="empty-day"><span>+</span><b>Questa giornata è ancora libera</b><p>Aggiungi il primo blocco con il modulo qui sotto.</p></div>}
              {selectedDayItems.map((item) => <article className={`schedule-item category-${item.category} ${conflictingIds.has(item.id) ? "conflict" : ""}`} key={item.id}>
                <div className="schedule-time">
                  <label>Inizio<input type="time" value={item.startTime} onChange={(event) => updateScheduleItem(item.id, { startTime: event.target.value })} /></label>
                  <span>↓</span>
                  <label>Fine<input type="time" value={item.endTime} onChange={(event) => updateScheduleItem(item.id, { endTime: event.target.value })} /></label>
                </div>
                <div className="schedule-content">
                  <div className="schedule-topline">
                    <input className="schedule-name" aria-label="Nome attività" value={item.name} onChange={(event) => updateScheduleItem(item.id, { name: event.target.value })} />
                    <select aria-label="Categoria" value={item.category} onChange={(event) => updateScheduleItem(item.id, { category: event.target.value as ScheduleItem["category"] })}>
                      <option value="visita">Visita</option><option value="trasporto">Trasporto</option><option value="cibo">Cibo</option><option value="tempo-libero">Tempo libero</option><option value="hotel">Hotel</option>
                    </select>
                  </div>
                  <input className="schedule-location" aria-label="Luogo" value={item.location} placeholder="Luogo, indirizzo o stazione" onChange={(event) => updateScheduleItem(item.id, { location: event.target.value })} />
                  <textarea aria-label="Note attività" value={item.notes} placeholder="Biglietti, cosa portare, note pratiche…" onChange={(event) => updateScheduleItem(item.id, { notes: event.target.value })} />
                  <div className="schedule-meta">
                    <label>Costo per 2 <span className="money-input"><input type="number" min="0" value={item.price} onChange={(event) => updateScheduleItem(item.id, { price: Number(event.target.value) || 0 })} /><select aria-label={`Valuta ${item.name}`} value={item.currency || "EUR"} onChange={(event) => updateScheduleItem(item.id, { currency: event.target.value as Currency })}><option value="EUR">€</option><option value="CNY">¥</option></select></span></label>
                    <label>Stato <select value={item.bookingStatus} onChange={(event) => updateScheduleItem(item.id, { bookingStatus: event.target.value as ScheduleItem["bookingStatus"] })}><option value="da-prenotare">Da prenotare</option><option value="prenotato">Prenotato</option><option value="non-serve">Nessuna prenotazione</option></select></label>
                    {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Fonte ↗</a>}
                    <button className="danger-text" onClick={() => removeScheduleItem(item.id)}>Elimina</button>
                  </div>
                </div>
              </article>)}
            </div>

            <form className="card add-plan-card" onSubmit={addScheduleItem}>
              <div className="card-head"><div><p className="eyebrow">Inserimento rapido</p><h3>Nuova attività</h3></div><span>{selectedDay?.city}</span></div>
              <div className="add-plan-grid">
                <label>Inizio<input type="time" value={newScheduleItem.startTime} onChange={(event) => setNewScheduleItem((current) => ({ ...current, startTime: event.target.value }))} /></label>
                <label>Fine<input type="time" value={newScheduleItem.endTime} onChange={(event) => setNewScheduleItem((current) => ({ ...current, endTime: event.target.value }))} /></label>
                <label className="wide">Attività<input required value={newScheduleItem.name} placeholder="Es. Tempio del Cielo" onChange={(event) => setNewScheduleItem((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Categoria<select value={newScheduleItem.category} onChange={(event) => setNewScheduleItem((current) => ({ ...current, category: event.target.value as ScheduleItem["category"] }))}><option value="visita">Visita</option><option value="trasporto">Trasporto</option><option value="cibo">Cibo</option><option value="tempo-libero">Tempo libero</option><option value="hotel">Hotel</option></select></label>
                <label className="wide">Luogo<input value={newScheduleItem.location} placeholder="Indirizzo, quartiere o stazione" onChange={(event) => setNewScheduleItem((current) => ({ ...current, location: event.target.value }))} /></label>
                <label>Costo per 2<span className="money-input"><input type="number" min="0" value={newScheduleItem.price} onChange={(event) => setNewScheduleItem((current) => ({ ...current, price: Number(event.target.value) || 0 }))} /><select aria-label="Valuta nuova attività" value={newScheduleItem.currency} onChange={(event) => setNewScheduleItem((current) => ({ ...current, currency: event.target.value as Currency }))}><option value="EUR">€</option><option value="CNY">¥</option></select></span></label>
                <label>Stato<select value={newScheduleItem.bookingStatus} onChange={(event) => setNewScheduleItem((current) => ({ ...current, bookingStatus: event.target.value as ScheduleItem["bookingStatus"] }))}><option value="da-prenotare">Da prenotare</option><option value="prenotato">Prenotato</option><option value="non-serve">Nessuna prenotazione</option></select></label>
                <label className="full">Note<textarea value={newScheduleItem.notes} placeholder="Tempi di trasferimento, biglietti, promemoria…" onChange={(event) => setNewScheduleItem((current) => ({ ...current, notes: event.target.value }))} /></label>
              </div>
              <button className="primary" type="submit">+ Aggiungi alla giornata</button>
            </form>
          </div>

        </div>
      </section>}

      {section === "transport" && <section className="panel-section">
        <div className="section-title"><div><p className="eyebrow">Un collegamento tra ogni tappa</p><h2>Trasporti</h2></div><strong>{euro.format(transportCost)}</strong></div>
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
              <div className="transport-actions"><button onClick={() => updateLeg(leg.id, { included: !leg.included })}>{leg.included ? "Togli dal viaggio" : "Aggiungi al viaggio"}</button></div>
            </article>;
          })}
        </div>
      </section>}

      {section === "budget" && <section className="panel-section">
        <div className="budget-hero"><div><p className="eyebrow">Totale dinamico per due</p><strong>{euro.format(totalBudget)}</strong><span>{euro.format(totalBudget / 2)} a persona</span></div><p>Ogni attività selezionata e ogni trasporto incluso entra automaticamente nel totale.</p></div>
        <div className="budget-grid">
          <article className="budget-category locked"><span>Voli internazionali</span><b>{euro.format(FLIGHTS_COST)}</b><small>Costo confermato</small></article>
          <article className="budget-category"><span>Hotel</span><b>{euro.format(hotelCost)}</b><small>{usedNights} notti · modifica il prezzo nelle tappe</small></article>
          <article className="budget-category"><span>Trasporti tra tappe</span><b>{euro.format(transportCost)}</b><small>{normalizedLegs.filter((leg) => leg.included).length} collegamenti inclusi</small></article>
          <article className="budget-category highlight"><span>Attività in agenda</span><b>{euro.format(activitiesCost)}</b><small>{budgetedActivities.length} esperienze pianificate</small></article>
          <article className="budget-category"><span>Costi aggiunti</span><b>{euro.format(addedCostsTotal)}</b><small>{costEntries.length} voci libere</small></article>
          <article className="budget-category editable"><span>Cambio yuan</span><label>1 € = <input type="number" min="0.01" step="0.01" value={cnyPerEuro} onChange={(event) => setCnyPerEuro(Math.max(0.01, Number(event.target.value) || 8))} /> ¥</label><small>Modificabile quando vuoi</small></article>
        </div>
        <div className="budget-panels">
          <article className="card cost-manager">
            <div className="card-head"><div><p className="eyebrow">Euro o yuan</p><h2>Aggiungi e togli costi</h2></div><b>{euro.format(addedCostsTotal)}</b></div>
            <div className="cost-list">
              {costEntries.map((entry) => <div className="cost-row" key={entry.id}>
                <input aria-label="Descrizione costo" value={entry.label} onChange={(event) => updateCostEntry(entry.id, { label: event.target.value })} />
                <input aria-label={`Importo ${entry.label}`} type="number" min="0" value={entry.amount} onChange={(event) => updateCostEntry(entry.id, { amount: Number(event.target.value) || 0 })} />
                <select aria-label={`Valuta ${entry.label}`} value={entry.currency} onChange={(event) => updateCostEntry(entry.id, { currency: event.target.value as Currency })}><option value="EUR">EUR €</option><option value="CNY">CNY ¥</option></select>
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
          <article className="card budget-detail"><div className="card-head"><div><p className="eyebrow">Dall’agenda</p><h2>Attività nel budget</h2></div><b>{euro.format(activitiesCost)}</b></div><div>{budgetedActivities.length === 0 ? <p className="empty padded">Aggiungi attività all’agenda per includerle nel budget.</p> : budgetedActivities.map((activity) => <div className="budget-row" key={`${activity.city}-${activity.id}`}><span>{activity.city}<small>{activity.date} · {activity.startTime}</small></span><div><b>{activity.name}</b><small>{activity.notes}</small></div><strong>{formatCost(activity.price, activity.currency)}</strong></div>)}</div></article>
        </div>
      </section>}

      {section === "planner" && <section className="planner-grid simple">
        <div className="stack">
          <article className="card"><div className="card-head"><div><p className="eyebrow">Preparazione</p><h2>Checklist</h2></div><span>{checklist.filter(Boolean).length} / {checklist.length}</span></div><div className="checklist">{defaultChecklist.map((item, index) => <label key={item}><input type="checkbox" checked={Boolean(checklist[index])} onChange={() => setChecklist((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))} /><span>{item}</span></label>)}</div></article>
          <article className="card notes-card"><div className="card-head"><div><p className="eyebrow">Salvate nel database condiviso</p><h2>Note condivise</h2></div></div><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Hotel preferiti, ristoranti, idee e cose da ricordare…" /></article>
        </div>
      </section>}
    </main>
  );
}
