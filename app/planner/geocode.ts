// Geocoding leggero via OpenStreetMap (Nominatim): serve solo in fase di pianificazione, una richiesta per azione.

const NOMINATIM = "https://nominatim.openstreetmap.org";

export async function geocodeCity(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(`${NOMINATIM}/search?format=json&limit=1&countrycodes=cn&q=${encodeURIComponent(name)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const results = await response.json() as Array<{ lat: string; lon: string }>;
    const lat = Number(results[0]?.lat);
    const lng = Number(results[0]?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

export type ReversePlace = { name: string; nameZh?: string; lat: number; lng: number };

const reverseCache = new Map<string, ReversePlace | null>();

/** Nome (in italiano/inglese e in cinese) della città più vicina al punto toccato sulla mappa. */
export async function reverseGeocode(lat: number, lng: number): Promise<ReversePlace | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (reverseCache.has(key)) return reverseCache.get(key) ?? null;
  try {
    const response = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&namedetails=1&accept-language=it,en`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const data = await response.json() as {
      name?: string;
      lat?: string;
      lon?: string;
      address?: Record<string, string>;
      namedetails?: Record<string, string>;
    };
    const address = data.address || {};
    const name = data.name || address.city || address.town || address.county || address.state_district || address.state || "";
    const details = data.namedetails || {};
    const nameZh = details.short_name && /[一-鿿]/.test(details.short_name) ? details.short_name : details["name:zh"] || details["name:zh-Hans"] || (/[一-鿿]/.test(details.name || "") ? details.name : undefined);
    const placeLat = Number(data.lat);
    const placeLng = Number(data.lon);
    const place = name ? { name, ...(nameZh ? { nameZh } : {}), lat: Number.isFinite(placeLat) ? placeLat : lat, lng: Number.isFinite(placeLng) ? placeLng : lng } : null;
    reverseCache.set(key, place);
    return place;
  } catch {
    return null;
  }
}
