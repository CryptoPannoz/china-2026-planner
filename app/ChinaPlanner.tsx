"use client";

/* eslint-disable @next/next/no-img-element -- le anteprime provengono da file locali data: */

import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useRef, useState } from "react";

type Activity = {
  id: string;
  name: string;
  description: string;
  price: number;
  selected: boolean;
  sourceUrl?: string;
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
  included: boolean;
  note: string;
};

type AiSuggestion = {
  name: string;
  description: string;
  priceEstimate: number;
  currency?: string;
  bookingNote?: string;
};

type AiSource = { title: string; url: string };
type PhotoItem = {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  createdAt: number;
  translation?: string;
  chineseText?: string;
  pinyin?: string;
  notes?: string;
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
const shortDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "long" });

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

function openPhotoDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("china-photo-lab-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function photoStore(mode: "get" | "put" | "delete", value?: PhotoItem | string) {
  const db = await openPhotoDb();
  return new Promise<PhotoItem[]>((resolve, reject) => {
    const tx = db.transaction("photos", mode === "get" ? "readonly" : "readwrite");
    const store = tx.objectStore("photos");
    if (mode === "put") store.put(value as PhotoItem);
    if (mode === "delete") store.delete(value as string);
    if (mode === "get") {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as PhotoItem[]).sort((a, b) => b.createdAt - a.createdAt));
      request.onerror = () => reject(request.error);
    } else {
      tx.oncomplete = () => resolve([]);
      tx.onerror = () => reject(tx.error);
    }
  });
}

export function ChinaPlanner() {
  const [section, setSection] = useState("itinerary");
  const [stops, setStops] = useState<Stop[]>(initialStops);
  const [legs, setLegs] = useState<Leg[]>(initialLegs);
  const [selectedStopId, setSelectedStopId] = useState("beijing");
  const [newStopName, setNewStopName] = useState("");
  const [aiQuery, setAiQuery] = useState("Cerca esperienze autentiche e indicami prezzi e modalità di prenotazione");
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiSources, setAiSources] = useState<AiSource[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [transportSearchId, setTransportSearchId] = useState("");
  const [transportSuggestions, setTransportSuggestions] = useState<AiSuggestion[]>([]);
  const [checklist, setChecklist] = useState<boolean[]>(defaultChecklist.map(() => false));
  const [notes, setNotes] = useState("");
  const [foodBudget, setFoodBudget] = useState(900);
  const [localBudget, setLocalBudget] = useState(300);
  const [otherBudget, setOtherBudget] = useState(720);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoBusy, setPhotoBusy] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("china-planner-v2") || "null") as Record<string, unknown> | null;
        if (saved?.stops) setStops(saved.stops as Stop[]);
        if (saved?.legs) setLegs(saved.legs as Leg[]);
        if (saved?.checklist) setChecklist(saved.checklist as boolean[]);
        if (typeof saved?.notes === "string") setNotes(saved.notes);
        if (typeof saved?.foodBudget === "number") setFoodBudget(saved.foodBudget);
        if (typeof saved?.localBudget === "number") setLocalBudget(saved.localBudget);
        if (typeof saved?.otherBudget === "number") setOtherBudget(saved.otherBudget);
      } catch {
        // Mantiene i dati iniziali se il salvataggio locale non è leggibile.
      }
      setHydrated(true);
    });
    photoStore("get").then(setPhotos).catch(() => undefined);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("china-planner-v2", JSON.stringify({ stops, legs, checklist, notes, foodBudget, localBudget, otherBudget }));
  }, [stops, legs, checklist, notes, foodBudget, localBudget, otherBudget, hydrated]);

  const timeline = useMemo(() => {
    return stops.map((stop, index) => {
      const previousNights = stops.slice(0, index).reduce((sum, item) => sum + item.nights, 0);
      const arrival = addDays(ARRIVAL_DATE, previousNights);
      const departure = addDays(arrival, stop.nights);
      return { stop, arrival, departure };
    });
  }, [stops]);

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
        note: "Cerca con Gemini la soluzione migliore",
      };
    });
  }, [stops, legs]);

  const selectedStop = stops.find((stop) => stop.id === selectedStopId) ?? stops[0];
  const usedNights = stops.reduce((sum, stop) => sum + stop.nights, 0);
  const remainingNights = TRIP_NIGHTS - usedNights;
  const selectedActivities = stops.flatMap((stop) => stop.activities.filter((activity) => activity.selected).map((activity) => ({ ...activity, city: stop.name })));
  const activitiesCost = selectedActivities.reduce((sum, item) => sum + item.price, 0);
  const hotelCost = stops.reduce((sum, stop) => sum + stop.nights * stop.hotelNightly, 0);
  const transportCost = normalizedLegs.filter((leg) => leg.included).reduce((sum, leg) => sum + leg.cost, 0);
  const totalBudget = FLIGHTS_COST + hotelCost + transportCost + activitiesCost + foodBudget + localBudget + otherBudget;

  const calendarDays = useMemo(() => {
    const entries: Array<{ date: Date; city: string; type: string; detail: string }> = [];
    timeline.forEach((item, stopIndex) => {
      for (let night = 0; night < item.stop.nights; night++) {
        const date = addDays(item.arrival, night);
        const leg = stopIndex > 0 ? normalizedLegs[stopIndex - 1] : null;
        const selected = item.stop.activities.filter((activity) => activity.selected);
        entries.push({
          date,
          city: item.stop.name,
          type: night === 0 && stopIndex > 0 ? "travel" : "stay",
          detail: night === 0 && leg?.included ? `${leg.mode} · ${leg.duration}` : selected[night % Math.max(1, selected.length)]?.name || "Giornata da pianificare",
        });
      }
    });
    return entries;
  }, [timeline, normalizedLegs]);

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

  function toggleActivity(stopId: string, activityId: string) {
    setStops((current) => current.map((stop) => stop.id !== stopId ? stop : { ...stop, activities: stop.activities.map((activity) => activity.id === activityId ? { ...activity, selected: !activity.selected } : activity) }));
  }

  function updateActivityPrice(stopId: string, activityId: string, price: number) {
    setStops((current) => current.map((stop) => stop.id !== stopId ? stop : { ...stop, activities: stop.activities.map((activity) => activity.id === activityId ? { ...activity, price } : activity) }));
  }

  function addSuggestion(suggestion: AiSuggestion) {
    const activity: Activity = {
      id: uid("activity"),
      name: suggestion.name,
      description: [suggestion.description, suggestion.bookingNote].filter(Boolean).join(" · "),
      price: Number(suggestion.priceEstimate) || 0,
      selected: true,
      sourceUrl: aiSources[0]?.url,
    };
    updateStop(selectedStop.id, { activities: [...selectedStop.activities, activity] });
  }

  async function runActivitySearch() {
    setAiLoading(true);
    setAiError("");
    setAiSuggestions([]);
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activities", city: selectedStop.name, query: aiQuery, latitude: selectedStop.lat, longitude: selectedStop.lng }),
      });
      const payload = await response.json() as { error?: string; result?: { answer?: string; suggestions?: AiSuggestion[] }; sources?: AiSource[] };
      if (!response.ok) throw new Error(payload.error || "Ricerca non riuscita");
      setAiAnswer(payload.result?.answer || "Ricerca completata.");
      setAiSuggestions(payload.result?.suggestions || []);
      setAiSources(payload.sources || []);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Ricerca non riuscita");
    } finally {
      setAiLoading(false);
    }
  }

  async function runTransportSearch(leg: Leg) {
    setTransportSearchId(leg.id);
    setTransportSuggestions([]);
    setAiError("");
    const fromStop = stops.find((stop) => stop.id === leg.fromId);
    const toStop = stops.find((stop) => stop.id === leg.toId);
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transport", from: fromStop?.name, to: toStop?.name, query: "Trova opzioni concrete, durata porta a porta e costo per due persone" }),
      });
      const payload = await response.json() as { error?: string; result?: { suggestions?: AiSuggestion[] } };
      if (!response.ok) throw new Error(payload.error || "Ricerca non riuscita");
      setTransportSuggestions(payload.result?.suggestions || []);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Ricerca non riuscita");
    }
  }

  function applyTransportSuggestion(leg: Leg, suggestion: AiSuggestion) {
    const durationMatch = suggestion.description.match(/\b\d+(?:[.,]\d+)?\s*(?:h|ore|min)/i)?.[0];
    updateLeg(leg.id, { mode: suggestion.name, duration: durationMatch || leg.duration, cost: Number(suggestion.priceEstimate) || 0, note: suggestion.bookingNote || suggestion.description, included: true });
    setTransportSuggestions([]);
  }

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/") && file.size <= 8_000_000);
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const item: PhotoItem = { id: uid("photo"), name: file.name, type: file.type, dataUrl, createdAt: Date.now() };
      await photoStore("put", item);
      setPhotos((current) => [item, ...current]);
    }
    event.target.value = "";
  }

  async function analyzePhoto(photo: PhotoItem) {
    setPhotoBusy(photo.id);
    setAiError("");
    try {
      const imageData = photo.dataUrl.split(",")[1] || "";
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", imageData, mimeType: photo.type, query: "Traduci le scritte e spiegami cosa devo ricordare" }),
      });
      const payload = await response.json() as { error?: string; result?: Partial<PhotoItem> & { answer?: string } };
      if (!response.ok) throw new Error(payload.error || "Analisi non riuscita");
      const updated = { ...photo, translation: payload.result?.translation || payload.result?.answer || "", chineseText: payload.result?.chineseText || "", pinyin: payload.result?.pinyin || "", notes: payload.result?.notes || "" };
      await photoStore("put", updated);
      setPhotos((current) => current.map((item) => item.id === photo.id ? updated : item));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Analisi non riuscita");
    } finally {
      setPhotoBusy("");
    }
  }

  async function deletePhoto(id: string) {
    await photoStore("delete", id);
    setPhotos((current) => current.filter((photo) => photo.id !== id));
  }

  const navItems = [
    ["itinerary", "Itinerario"],
    ["calendar", "Calendario"],
    ["transport", "Trasporti"],
    ["budget", "Budget"],
    ["planner", "Planner & foto"],
  ];

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Alberto & Sofia · Cina 2026</p>
          <h1>Un viaggio che<br />si costruisce da sé.</h1>
          <p className="lead">Tappe, trasporti, attività e budget sono finalmente collegati. Ogni scelta aggiorna tutto il viaggio.</p>
        </div>
        <div className="anchor-card">
          <span>Finestra confermata</span>
          <strong>17 nov → 4 dic</strong>
          <small>17 notti in Cina</small>
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
                      <div><b>{leg.included ? leg.mode : "Trasporto escluso"}</b><small>{leg.included ? `${leg.duration} · ${euro.format(leg.cost)}` : "Il calendario segnala un collegamento mancante"}</small></div>
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
              <div className="mini-budget"><span>Selezionate</span><b>{euro.format(selectedStop.activities.filter((item) => item.selected).reduce((sum, item) => sum + item.price, 0))}</b><small>già riflesse nel budget</small></div>
              <label className="hotel-field">Hotel per notte <span><input type="number" min="0" value={selectedStop.hotelNightly} onChange={(event) => updateStop(selectedStop.id, { hotelNightly: Number(event.target.value) || 0 })} /> €</span></label>
              <h3>Cose da fare</h3>
              <div className="activity-list">
                {selectedStop.activities.length === 0 && <p className="empty">Nessuna attività: cercala con Gemini oppure aggiungi una nuova tappa alla ricerca.</p>}
                {selectedStop.activities.map((activity) => <div className={`activity-row ${activity.selected ? "selected" : ""}`} key={activity.id}>
                  <button className="check" onClick={() => toggleActivity(selectedStop.id, activity.id)}>{activity.selected ? "✓" : "+"}</button>
                  <div><b>{activity.name}</b><small>{activity.description}</small>{activity.sourceUrl && <a href={activity.sourceUrl} target="_blank" rel="noreferrer">Fonte ↗</a>}</div>
                  <label><input type="number" min="0" value={activity.price} onChange={(event) => updateActivityPrice(selectedStop.id, activity.id, Number(event.target.value) || 0)} /> €</label>
                </div>)}
              </div>
              <div className="gemini-box">
                <div className="gemini-title"><span>✦</span><div><b>Ricerca con Gemini</b><small>Google Maps · risultati e prezzi attuali</small></div></div>
                <textarea value={aiQuery} onChange={(event) => setAiQuery(event.target.value)} aria-label="Domanda per Gemini" />
                <button className="primary" onClick={runActivitySearch} disabled={aiLoading}>{aiLoading ? "Sto cercando…" : `Cerca a ${selectedStop.name}`}</button>
                {aiError && <p className="error">{aiError}</p>}
                {aiAnswer && <p className="ai-answer">{aiAnswer}</p>}
                <div className="suggestions">
                  {aiSuggestions.map((suggestion, index) => <div className="suggestion" key={`${suggestion.name}-${index}`}><div><b>{suggestion.name}</b><p>{suggestion.description}</p><small>{suggestion.bookingNote}</small></div><div className="suggestion-action"><strong>{euro.format(Number(suggestion.priceEstimate) || 0)}</strong><button onClick={() => addSuggestion(suggestion)}>Aggiungi al piano e budget</button></div></div>)}
                </div>
                {aiSources.length > 0 && <div className="sources">{aiSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div>}
              </div>
            </div>
          </aside>
        </section>
      )}

      {section === "calendar" && <section className="panel-section">
        <div className="section-title"><div><p className="eyebrow">Si aggiorna con le tappe</p><h2>Calendario del viaggio</h2></div><span>{calendarDays.length} giornate pianificate</span></div>
        <div className="calendar-grid">
          <article className="calendar-card flight"><small>Lun 16 novembre</small><b>Venezia → Pechino</b><p>VCE 16:55 · Monaco · volo notturno</p></article>
          {calendarDays.map((entry) => <article key={dateKey(entry.date)} className={`calendar-card ${entry.type}`}><small>{longDate.format(entry.date)}</small><b>{entry.city}</b><p>{entry.detail}</p></article>)}
          <article className="calendar-card flight"><small>Ven 4 dicembre</small><b>Shanghai → Venezia</b><p>PVG 09:40 · arrivo a Venezia 18:25</p></article>
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
                <label>Costo per 2<input type="number" min="0" value={leg.cost} onChange={(event) => updateLeg(leg.id, { cost: Number(event.target.value) || 0 })} /></label>
              </div>
              <p>{leg.note}</p>
              <div className="transport-actions"><button className="primary small" onClick={() => runTransportSearch(leg)}>{transportSearchId === leg.id && transportSuggestions.length === 0 ? "Ricerca in corso…" : "✦ Cerca opzioni"}</button><button onClick={() => updateLeg(leg.id, { included: !leg.included })}>{leg.included ? "Togli dal viaggio" : "Aggiungi al viaggio"}</button></div>
              {transportSearchId === leg.id && transportSuggestions.length > 0 && <div className="transport-suggestions">{transportSuggestions.map((suggestion, index) => <button key={`${suggestion.name}-${index}`} onClick={() => applyTransportSuggestion(leg, suggestion)}><b>{suggestion.name} · {euro.format(Number(suggestion.priceEstimate) || 0)}</b><span>{suggestion.description}</span></button>)}</div>}
            </article>;
          })}
        </div>
        {aiError && <p className="error wide">{aiError}</p>}
      </section>}

      {section === "budget" && <section className="panel-section">
        <div className="budget-hero"><div><p className="eyebrow">Totale dinamico per due</p><strong>{euro.format(totalBudget)}</strong><span>{euro.format(totalBudget / 2)} a persona</span></div><p>Ogni attività selezionata e ogni trasporto incluso entra automaticamente nel totale.</p></div>
        <div className="budget-grid">
          <article className="budget-category locked"><span>Voli internazionali</span><b>{euro.format(FLIGHTS_COST)}</b><small>Costo confermato</small></article>
          <article className="budget-category"><span>Hotel</span><b>{euro.format(hotelCost)}</b><small>{usedNights} notti · modifica il prezzo nelle tappe</small></article>
          <article className="budget-category"><span>Trasporti tra tappe</span><b>{euro.format(transportCost)}</b><small>{normalizedLegs.filter((leg) => leg.included).length} collegamenti inclusi</small></article>
          <article className="budget-category highlight"><span>Attività selezionate</span><b>{euro.format(activitiesCost)}</b><small>{selectedActivities.length} esperienze</small></article>
          <article className="budget-category editable"><span>Cibo e bevande</span><label><input type="number" min="0" value={foodBudget} onChange={(event) => setFoodBudget(Number(event.target.value) || 0)} /> €</label><small>Previsionale per due</small></article>
          <article className="budget-category editable"><span>Trasporti locali</span><label><input type="number" min="0" value={localBudget} onChange={(event) => setLocalBudget(Number(event.target.value) || 0)} /> €</label><small>Didi, metro e transfer aeroporti</small></article>
          <article className="budget-category editable"><span>Assicurazione, connettività, extra</span><label><input type="number" min="0" value={otherBudget} onChange={(event) => setOtherBudget(Number(event.target.value) || 0)} /> €</label><small>Margine di sicurezza</small></article>
        </div>
        <article className="card budget-detail"><div className="card-head"><div><p className="eyebrow">Dalla mappa</p><h2>Attività nel budget</h2></div><b>{euro.format(activitiesCost)}</b></div><div>{selectedActivities.length === 0 ? <p className="empty padded">Seleziona un’attività dalla mappa o aggiungila dai risultati Gemini.</p> : selectedActivities.map((activity) => <div className="budget-row" key={`${activity.city}-${activity.id}`}><span>{activity.city}</span><div><b>{activity.name}</b><small>{activity.description}</small></div><strong>{euro.format(activity.price)}</strong></div>)}</div></article>
      </section>}

      {section === "planner" && <section className="planner-grid">
        <div className="stack">
          <article className="card"><div className="card-head"><div><p className="eyebrow">Preparazione</p><h2>Checklist</h2></div><span>{checklist.filter(Boolean).length} / {checklist.length}</span></div><div className="checklist">{defaultChecklist.map((item, index) => <label key={item}><input type="checkbox" checked={Boolean(checklist[index])} onChange={() => setChecklist((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))} /><span>{item}</span></label>)}</div></article>
          <article className="card notes-card"><div className="card-head"><div><p className="eyebrow">Salvate sul dispositivo</p><h2>Note condivise</h2></div></div><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Hotel preferiti, ristoranti, idee e cose da ricordare…" /></article>
        </div>
        <article className="card photo-lab">
          <div className="card-head"><div><p className="eyebrow">Laboratorio in prova</p><h2>Foto & scritte cinesi</h2></div><label className="upload-button">+ Carica foto<input type="file" accept="image/*" multiple onChange={addPhotos} /></label></div>
          <div className="privacy-note">Le foto restano su questo dispositivo. Solo quando premi “Traduci con Gemini” l’immagine viene inviata a Google per l’analisi.</div>
          {aiError && <p className="error wide">{aiError}</p>}
          <div className="photo-grid">
            {photos.length === 0 && <div className="photo-empty"><span>相</span><b>Fotografa cartelli, menu e biglietti</b><p>Li ritroverai qui e potrai tradurli con Gemini.</p></div>}
            {photos.map((photo) => <article className="photo-item" key={photo.id}><img src={photo.dataUrl} alt={photo.name} /><div><b>{photo.name}</b>{photo.chineseText && <p className="chinese">{photo.chineseText}</p>}{photo.pinyin && <small>{photo.pinyin}</small>}{photo.translation && <p>{photo.translation}</p>}{photo.notes && <small>{photo.notes}</small>}<div className="photo-actions"><button className="primary small" disabled={photoBusy === photo.id} onClick={() => analyzePhoto(photo)}>{photoBusy === photo.id ? "Analisi…" : "✦ Traduci con Gemini"}</button><button className="danger-text" onClick={() => deletePhoto(photo.id)}>Elimina</button></div></div></article>)}
          </div>
        </article>
      </section>}
    </main>
  );
}
