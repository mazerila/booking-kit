/** Service-area check for home visits. */
import type { Address, ZoneSettings } from "./types.js";

/** Straight-line distance between two points, in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type ZoneResult = {
  /** null when the address can't be checked (no coordinates for a radius zone). */
  inZone: boolean | null;
  distanceKm?: number;
};

export const normalizePostcode = (p: string) => p.replace(/\s+/g, "").toUpperCase();

export function checkZone(zone: ZoneSettings, base: { lat?: number; lng?: number }, address: Address): ZoneResult {
  if (zone.mode === "none") return { inZone: true };
  if (zone.mode === "postcodes") {
    const pc = address.postcode ?? address.label.match(/\b\d{5}\b/)?.[0];
    if (!pc) return { inZone: null };
    const allowed = zone.postcodes.map(normalizePostcode);
    const p = normalizePostcode(pc);
    // An entry can be a prefix: "77" allows the whole département.
    return { inZone: allowed.some((a) => p === a || (a.length < p.length && p.startsWith(a))) };
  }
  if (address.lat == null || address.lng == null || base.lat == null || base.lng == null) return { inZone: null };
  const d = distanceKm({ lat: base.lat, lng: base.lng }, { lat: address.lat, lng: address.lng });
  return { inZone: d <= zone.radiusKm, distanceKm: Math.round(d * 10) / 10 };
}
