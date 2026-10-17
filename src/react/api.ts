/** Browser client of the booking API. */
import type { Address, ApiErrorCode, PublicBooking, PublicConfig } from "../core/index.js";

export class BookingApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | "network",
    readonly details?: { fields?: string[]; [k: string]: unknown },
  ) {
    super(code);
  }
}

export type Availability = { timezone: string; slots: Record<string, string[]> };
export type GeocodeResult = Address & { inZone: boolean | null; distanceKm?: number };

export type BookPayload = {
  serviceId: string;
  start: string;
  client: { name: string; email: string; phone: string };
  address?: Address;
  fields: Record<string, unknown>;
  message?: string;
  locale: string;
  website?: string;
  startedAt: number;
};

export function createApi(base: string) {
  const root = base.replace(/\/$/, "");

  async function request<T>(method: "GET" | "POST", path: string, data?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    const qs = query ? `?${new URLSearchParams(query)}` : "";
    let r: Response;
    try {
      r = await fetch(`${root}${path}${qs}`, {
        method,
        headers: data ? { "Content-Type": "application/json" } : undefined,
        body: data ? JSON.stringify(data) : undefined,
      });
    } catch {
      throw new BookingApiError("network");
    }
    const json = (await r.json().catch(() => ({}))) as { error?: ApiErrorCode; details?: BookingApiError["details"] };
    if (!r.ok) throw new BookingApiError(json.error ?? "server", json.details);
    return json as T;
  }

  return {
    config: () => request<PublicConfig>("GET", "/config"),
    availability: (service: string, from: string, to: string) => request<Availability>("GET", "/availability", undefined, { service, from, to }),
    geocode: (q: string) => request<{ results: GeocodeResult[] }>("GET", "/geocode", undefined, { q }),
    zone: (address: Address) => request<{ inZone: boolean | null; distanceKm?: number }>("POST", "/zone", address),
    book: (payload: BookPayload) => request<{ ok: true; booking: PublicBooking | null; token?: string }>("POST", "/bookings", payload),
    manage: (t: string) => request<{ booking: PublicBooking }>("GET", "/manage", undefined, { t }),
    manageAvailability: (t: string, from: string, to: string) => request<Availability>("GET", "/manage/availability", undefined, { t, from, to }),
    cancel: (token: string) => request<{ booking: PublicBooking }>("POST", "/manage/cancel", { token }),
    reschedule: (token: string, start: string) => request<{ booking: PublicBooking }>("POST", "/manage/reschedule", { token, start }),
  };
}

export type BookingApi = ReturnType<typeof createApi>;
