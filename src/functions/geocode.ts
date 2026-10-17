/**
 * Address search for home visits. The default geocoder is the French national
 * address base (Géoplateforme, free, no key). Other countries can plug their own.
 */
import type { Address } from "../core/index.js";

export type Geocoder = (query: string, opts?: { limit?: number; near?: { lat?: number; lng?: number } }) => Promise<Address[]>;

const FR_URL = process.env.GEOCODER_URL || "https://data.geopf.fr/geocodage/search";

type GeoJson = {
  features?: {
    geometry?: { coordinates?: [number, number] };
    properties?: { label?: string; postcode?: string; city?: string };
  }[];
};

export const frenchGeocoder: Geocoder = async (query, { limit = 5, near } = {}) => {
  const params = new URLSearchParams({ q: query, limit: String(limit), index: "address" });
  // Favours addresses close to the business.
  if (near?.lat != null && near.lng != null) {
    params.set("lat", String(near.lat));
    params.set("lon", String(near.lng));
  }
  const url = `${FR_URL}?${params}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error(`geocoder ${r.status}`);
  const json = (await r.json()) as GeoJson;
  return (json.features ?? []).flatMap((f) => {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    const p = f.properties ?? {};
    if (!p.label || lat === undefined || lng === undefined) return [];
    return [{ label: p.label, postcode: p.postcode, city: p.city, lat, lng }];
  });
};
