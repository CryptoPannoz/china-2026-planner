"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Leg, Stop, SuggestedStop } from "@/lib/planner/types";

type LatLng = [number, number];
type LeafletLayer = { addTo(target: LeafletMap | LeafletLayerGroup): LeafletLayer; remove(): void };
type LeafletMarker = LeafletLayer & {
  bindTooltip(text: string, options?: Record<string, unknown>): LeafletMarker;
  on(event: string, handler: () => void): LeafletMarker;
};
type LeafletPolyline = LeafletLayer & { bindTooltip(text: string, options?: Record<string, unknown>): LeafletPolyline };
type LeafletLayerGroup = { addTo(map: LeafletMap): LeafletLayerGroup; clearLayers(): void };
type LeafletMouseEvent = { latlng: { lat: number; lng: number } };
type LeafletMap = {
  fitBounds(coords: LatLng[], options?: Record<string, unknown>): LeafletMap;
  invalidateSize(): void;
  remove(): void;
  setView(coords: LatLng, zoom: number, options?: Record<string, unknown>): LeafletMap;
  getZoom(): number;
  getContainer(): HTMLElement;
  on(event: "click", handler: (event: LeafletMouseEvent) => void): LeafletMap;
  on(event: "zoomend", handler: () => void): LeafletMap;
};
type LeafletNamespace = {
  map(element: HTMLElement, options?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, options?: Record<string, unknown>): LeafletLayer & { addTo(map: LeafletMap): LeafletLayer };
  layerGroup(): LeafletLayerGroup;
  divIcon(options: Record<string, unknown>): unknown;
  marker(coords: LatLng, options?: Record<string, unknown>): LeafletMarker;
  polyline(coords: LatLng[], options?: Record<string, unknown>): LeafletPolyline;
};
type LeafletWindow = Window & { L?: LeafletNamespace; __chinaLeafletPromise?: Promise<LeafletNamespace> };

// Fondi mappa gratuiti e senza chiave (CARTO dal 2026 chiede una API key e mostrava una filigrana).
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const BASE_MAPS = {
  street: {
    label: "Strade",
    layers: [{ url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`, options: { maxZoom: 18, attribution: "Tiles &copy; Esri — Esri, HERE, Garmin, USGS, NGA" } }],
  },
  satellite: {
    label: "Satellite",
    layers: [
      { url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, options: { maxZoom: 18, attribution: "Tiles &copy; Esri — Esri, Maxar, Earthstar Geographics" } },
      { url: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, options: { maxZoom: 18 } },
    ],
  },
  topo: {
    label: "Rilievo",
    layers: [{ url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", options: { subdomains: "abc", maxZoom: 17, attribution: "&copy; OpenStreetMap · SRTM · &copy; OpenTopoMap (CC-BY-SA)" } }],
  },
} as const;
type BaseMap = keyof typeof BASE_MAPS;

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
    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.crossOrigin = "";
    script.onload = () => (leafletWindow.L ? resolve(leafletWindow.L) : reject(new Error("Leaflet non disponibile")));
    script.onerror = () => {
      leafletWindow.__chinaLeafletPromise = undefined;
      script.remove();
      reject(new Error("Impossibile caricare Leaflet"));
    };
    document.head.appendChild(script);
  });
  return leafletWindow.__chinaLeafletPromise;
}

/** Sotto questo zoom (Cina intera) i nomi delle tappe intermedie si nascondono per non sovrapporsi. */
const FAR_ZOOM = 6;

/**
 * Mappa dell'itinerario. Creata una volta sola: quando cambiano tappe o tratte si ridisegnano solo
 * i segnaposto, così zoom e posizione restano dove li hai lasciati.
 */
export function RouteMap({ stops, legs, suggestions, selectedStopId, pending, onStopClick, onSuggestionClick, onMapClick, children }: {
  stops: Stop[];
  legs: Leg[];
  suggestions: SuggestedStop[];
  selectedStopId: string;
  pending: { lat: number; lng: number } | null;
  onStopClick: (stopId: string) => void;
  onSuggestionClick: (suggestionId: string) => void;
  onMapClick: (lat: number, lng: number, zoom: number) => void;
  children?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const routeLayerRef = useRef<LeafletLayerGroup | null>(null);
  const extraLayerRef = useRef<LeafletLayerGroup | null>(null);
  const tilesRef = useRef<LeafletLayer[]>([]);
  const leafletRef = useRef<LeafletNamespace | null>(null);
  const handlersRef = useRef({ onStopClick, onSuggestionClick, onMapClick });
  const fittedRef = useRef(false);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [baseMap, setBaseMap] = useState<BaseMap>("street");

  useEffect(() => {
    handlersRef.current = { onStopClick, onSuggestionClick, onMapClick };
  }, [onStopClick, onSuggestionClick, onMapClick]);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((leaflet) => {
      if (cancelled || !containerRef.current) return;
      const map = leaflet.map(containerRef.current, { scrollWheelZoom: false, zoomControl: true, minZoom: 3 });
      map.on("click", (event) => handlersRef.current.onMapClick(event.latlng.lat, event.latlng.lng, map.getZoom()));
      map.on("zoomend", () => map.getContainer().classList.toggle("zoom-far", map.getZoom() < FAR_ZOOM));
      mapRef.current = map;
      routeLayerRef.current = leaflet.layerGroup().addTo(map);
      extraLayerRef.current = leaflet.layerGroup().addTo(map);
      leafletRef.current = leaflet;
      setMapReady(true);
    }).catch(() => {
      if (!cancelled) setMapError("La cartografia non è disponibile. Controlla la connessione e ricarica la pagina.");
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      extraLayerRef.current = null;
      tilesRef.current = [];
      fittedRef.current = false;
    };
  }, []);

  // Fondo mappa scelto.
  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!mapReady || !leaflet || !map) return;
    tilesRef.current.forEach((layer) => layer.remove());
    tilesRef.current = BASE_MAPS[baseMap].layers.map(({ url, options }) => leaflet.tileLayer(url, options).addTo(map));
  }, [mapReady, baseMap]);

  // Rotta: linee tra le tappe e segnaposto numerati con il nome.
  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const layer = routeLayerRef.current;
    if (!mapReady || !leaflet || !map || !layer) return;
    layer.clearLayers();
    const byId = new Map(stops.map((stop) => [stop.id, stop]));
    legs.forEach((leg) => {
      const from = byId.get(leg.fromId);
      const to = byId.get(leg.toId);
      if (!from || !to) return;
      // Bordo bianco sotto la linea: resta leggibile anche su satellite e rilievo.
      leaflet.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: "#ffffff", weight: leg.included ? 8 : 6, opacity: .8, interactive: false }).addTo(layer);
      leaflet.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
        color: leg.included ? "#e96f3b" : "#8f9994",
        weight: leg.included ? 4 : 3,
        opacity: leg.included ? .9 : .55,
        dashArray: leg.included ? undefined : "7 8",
        bubblingMouseEvents: false,
      }).bindTooltip(`${from.name} → ${to.name} · ${leg.mode}`, { sticky: true }).addTo(layer);
    });
    stops.forEach((stop, index) => {
      const edge = index === 0 || index === stops.length - 1;
      const selected = stop.id === selectedStopId;
      leaflet.marker([stop.lat, stop.lng], {
        icon: leaflet.divIcon({ className: "route-pin-wrap", html: `<span class="route-pin ${edge ? "edge" : ""} ${selected ? "selected" : ""}">${index + 1}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
        title: `${index + 1}. ${stop.name}`,
        alt: `${index + 1}. ${stop.name}`,
        zIndexOffset: selected ? 1000 : 0,
        bubblingMouseEvents: false,
      })
        .bindTooltip(stop.name, { permanent: true, direction: "right", offset: [16, 0], className: `route-tooltip stop-label ${edge ? "edge" : ""} ${selected ? "selected" : ""}` })
        .on("click", () => handlersRef.current.onStopClick(stop.id))
        .addTo(layer);
    });
    if (!fittedRef.current && stops.length > 0) {
      fittedRef.current = true;
      map.fitBounds(stops.map((stop) => [stop.lat, stop.lng] as LatLng), { padding: (containerRef.current?.clientWidth || 800) < 640 ? [24, 24] : [48, 48] });
      map.getContainer().classList.toggle("zoom-far", map.getZoom() < FAR_ZOOM);
      // Se nel frattempo si è cambiata sezione la mappa è già stata rimossa.
      requestAnimationFrame(() => {
        if (mapRef.current === map) map.invalidateSize();
      });
    }
  }, [mapReady, stops, legs, selectedStopId]);

  // Città da valutare e punto appena toccato.
  useEffect(() => {
    const leaflet = leafletRef.current;
    const layer = extraLayerRef.current;
    if (!mapReady || !leaflet || !layer) return;
    layer.clearLayers();
    suggestions.forEach((suggestion) => {
      leaflet.marker([suggestion.lat, suggestion.lng], {
        icon: leaflet.divIcon({ className: "route-pin-wrap", html: `<span class="route-pin suggested">?</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
        title: `${suggestion.name} (da valutare)`,
        alt: `${suggestion.name} (da valutare)`,
        bubblingMouseEvents: false,
      })
        .bindTooltip(`${suggestion.name} · da valutare`, { direction: "top", offset: [0, -14], className: "route-tooltip" })
        .on("click", () => handlersRef.current.onSuggestionClick(suggestion.id))
        .addTo(layer);
    });
    if (pending) {
      leaflet.marker([pending.lat, pending.lng], {
        icon: leaflet.divIcon({ className: "route-pin-wrap", html: `<span class="route-pin pending">+</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
        title: "Nuova tappa",
        zIndexOffset: 2000,
        bubblingMouseEvents: false,
      }).addTo(layer);
    }
  }, [mapReady, suggestions, pending]);

  const selected = stops.find((stop) => stop.id === selectedStopId);
  return (
    <div className="real-map-shell">
      <div ref={containerRef} className="real-map" aria-label="Mappa interattiva dell’itinerario in Cina: tocca un punto per aggiungere una tappa" />
      {!mapReady && !mapError && <div className="map-loading">Caricamento mappa geografica…</div>}
      {mapError && <div className="map-error">{mapError}</div>}
      {mapReady && <div className="map-tools">
        <div className="map-base" role="group" aria-label="Tipo di mappa">
          {(Object.keys(BASE_MAPS) as BaseMap[]).map((key) => <button key={key} className={baseMap === key ? "active" : ""} onClick={() => setBaseMap(key)}>{BASE_MAPS[key].label}</button>)}
        </div>
        <button onClick={() => mapRef.current?.fitBounds(stops.map((stop) => [stop.lat, stop.lng] as LatLng), { padding: [40, 40] })}>Rotta completa</button>
        {selected && <button onClick={() => mapRef.current?.setView([selected.lat, selected.lng], 9, { animate: true })}>Centra su {selected.name}</button>}
      </div>}
      {children}
    </div>
  );
}
