"use client";

import { useEffect, useRef, useState } from "react";
import type { Leg, Stop, SuggestedStop } from "@/lib/planner/types";

type LatLng = [number, number];
type LeafletLayer = { addTo(target: LeafletMap | LeafletLayerGroup): LeafletLayer };
type LeafletMarker = LeafletLayer & {
  bindPopup(html: string): LeafletMarker;
  bindTooltip(text: string, options?: Record<string, unknown>): LeafletMarker;
  on(event: string, handler: () => void): LeafletMarker;
};
type LeafletPolyline = LeafletLayer & { bindTooltip(text: string): LeafletPolyline };
type LeafletLayerGroup = { addTo(map: LeafletMap): LeafletLayerGroup; clearLayers(): void };
type LeafletMap = {
  fitBounds(coords: LatLng[], options?: Record<string, unknown>): LeafletMap;
  invalidateSize(): void;
  remove(): void;
  setView(coords: LatLng, zoom: number): LeafletMap;
};
type LeafletNamespace = {
  map(element: HTMLElement, options?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, options?: Record<string, unknown>): { addTo(map: LeafletMap): unknown };
  layerGroup(): LeafletLayerGroup;
  divIcon(options: Record<string, unknown>): unknown;
  marker(coords: LatLng, options?: Record<string, unknown>): LeafletMarker;
  polyline(coords: LatLng[], options?: Record<string, unknown>): LeafletPolyline;
};
type LeafletWindow = Window & { L?: LeafletNamespace; __chinaLeafletPromise?: Promise<LeafletNamespace> };

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

function escapeMapText(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

/**
 * Mappa OpenStreetMap dell'itinerario. La mappa viene creata una volta sola; quando cambiano tappe o
 * tratte si ridisegnano solo i segnaposto, così zoom e posizione non saltano a ogni modifica.
 */
export function RouteMap({ stops, legs, suggestions, onSelect }: { stops: Stop[]; legs: Leg[]; suggestions: SuggestedStop[]; onSelect: (stopId: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LeafletLayerGroup | null>(null);
  const leafletRef = useRef<LeafletNamespace | null>(null);
  const onSelectRef = useRef(onSelect);
  const fittedRef = useRef(false);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((leaflet) => {
      if (cancelled || !containerRef.current) return;
      const map = leaflet.map(containerRef.current, { scrollWheelZoom: false, zoomControl: true });
      leaflet.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; CARTO',
      }).addTo(map);
      mapRef.current = map;
      layersRef.current = leaflet.layerGroup().addTo(map);
      leafletRef.current = leaflet;
      setMapReady(true);
    }).catch(() => {
      if (!cancelled) setMapError("La cartografia non è disponibile. Controlla la connessione e ricarica la pagina.");
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!mapReady || !leaflet || !map || !layers) return;
    layers.clearLayers();
    const byId = new Map(stops.map((stop) => [stop.id, stop]));
    legs.forEach((leg) => {
      const from = byId.get(leg.fromId);
      const to = byId.get(leg.toId);
      if (!from || !to) return;
      leaflet.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
        color: leg.included ? "#e96f3b" : "#8f9994",
        weight: leg.included ? 4 : 3,
        opacity: leg.included ? .9 : .55,
        dashArray: leg.included ? undefined : "7 8",
      }).bindTooltip(`${from.name} → ${to.name} · ${leg.mode}`).addTo(layers);
    });
    stops.forEach((stop, index) => {
      const edge = index === 0 || index === stops.length - 1;
      leaflet.marker([stop.lat, stop.lng], {
        icon: leaflet.divIcon({ className: "route-pin-wrap", html: `<span class="route-pin ${edge ? "edge" : ""}">${index + 1}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
        title: `${index + 1}. ${stop.name}`,
        alt: `${index + 1}. ${stop.name}`,
      })
        .bindTooltip(stop.name, { permanent: edge, direction: "top", offset: [0, -18], className: "route-tooltip" })
        .bindPopup(`<div class="route-popup"><b>${escapeMapText(stop.name)}</b><span>${stop.nights} ${stop.nights === 1 ? "notte" : "notti"}</span><small>Selezionata: attività e giornate a destra</small></div>`)
        .on("click", () => onSelectRef.current(stop.id))
        .addTo(layers);
    });
    suggestions.forEach((suggestion) => {
      leaflet.marker([suggestion.lat, suggestion.lng], {
        icon: leaflet.divIcon({ className: "route-pin-wrap", html: `<span class="route-pin suggested">?</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }),
        title: `${suggestion.name} (da valutare)`,
        alt: `${suggestion.name} (da valutare)`,
      })
        .bindTooltip(suggestion.name, { direction: "top", offset: [0, -15], className: "route-tooltip" })
        .bindPopup(`<div class="route-popup"><b>${escapeMapText(suggestion.name)}</b><span>Città da valutare · ${suggestion.nights} ${suggestion.nights === 1 ? "notte" : "notti"}</span><small>${escapeMapText(suggestion.transport)}</small></div>`)
        .addTo(layers);
    });
    if (!fittedRef.current && stops.length > 0) {
      fittedRef.current = true;
      const points: LatLng[] = [...stops, ...suggestions].map((place) => [place.lat, place.lng]);
      map.fitBounds(points, { padding: (containerRef.current?.clientWidth || 800) < 640 ? [18, 18] : [38, 38] });
      // Se nel frattempo si è cambiata sezione la mappa è già stata rimossa.
      requestAnimationFrame(() => {
        if (mapRef.current === map) map.invalidateSize();
      });
    }
  }, [mapReady, stops, legs, suggestions]);

  return (
    <div className="real-map-shell">
      <div ref={containerRef} className="real-map" aria-label="Mappa interattiva dell’itinerario in Cina" />
      {!mapReady && !mapError && <div className="map-loading">Caricamento mappa geografica…</div>}
      {mapError && <div className="map-error">{mapError}</div>}
      {mapReady && <div className="map-tools">
        <button onClick={() => mapRef.current?.fitBounds(stops.map((stop) => [stop.lat, stop.lng] as LatLng), { padding: [30, 30] })}>Rotta completa</button>
        <button onClick={() => mapRef.current?.setView([31.1, 120.7], 8)}>Zoom Wuzhen–Shanghai</button>
      </div>}
      <div className="map-legend"><span><i /> Tappa</span><span><i className="suggested" /> Da valutare</span><span><i className="route" /> Trasporto incluso</span><span><i className="route off" /> Escluso</span></div>
    </div>
  );
}
