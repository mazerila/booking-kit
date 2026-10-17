/** Admin data layer: Firebase setup, live Firestore subscriptions, and the admin API. */
import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import {
  COL,
  CONFIG_DOC,
  normalizeService,
  normalizeSettings,
  normalizeWeekly,
  type Block,
  type Booking,
  type Category,
  type Client,
  type DayException,
  type Service,
  type Settings,
  type WeeklyHours,
} from "../core/index.js";
import type { AdminTexts } from "./texts.js";

export type EmulatorConfig = { auth?: string; firestore?: { host: string; port: number } };

const APP_NAME = "booking-admin";

export function initFirebase(options: FirebaseOptions, emulators?: EmulatorConfig): { auth: Auth; db: Firestore } {
  const existing = getApps().find((a) => a.name === APP_NAME);
  const app = existing ?? initializeApp(options, APP_NAME);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (!existing && emulators) {
    if (emulators.auth) connectAuthEmulator(auth, emulators.auth, { disableWarnings: true });
    if (emulators.firestore) connectFirestoreEmulator(db, emulators.firestore.host, emulators.firestore.port);
  }
  return { auth, db };
}

export type AdminContext = {
  db: Firestore;
  auth: Auth;
  api: AdminApi;
  t: AdminTexts;
  locale: string;
  settings: Settings;
  weekly: WeeklyHours;
  services: Service[];
  categories: Category[];
  /** For WhatsApp links from national numbers ("33" = France). */
  phoneCountryCode: string;
  /** Opens the booking panel. */
  openBooking: (id: string) => void;
  /** Opens the new-booking form, optionally prefilled. */
  newBooking: (prefill?: { start?: string; clientId?: string; serviceId?: string }) => void;
  toast: (message: string, kind?: "success" | "error") => void;
};

export const AdminCtx = createContext<AdminContext | null>(null);

export function useAdmin() {
  const c = useContext(AdminCtx);
  if (!c) throw new Error("useAdmin outside <AdminApp>");
  return c;
}

/** Live value of a query; `undefined` while loading. */
function useSnapshot<T>(subscribe: (set: (v: T) => void, fail: (e: Error) => void) => () => void, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    setValue(undefined);
    return subscribe(setValue, (e) => console.error("[booking-admin]", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export function useBusinessData(db: Firestore, enabled: boolean) {
  const settings = useSnapshot<Settings>(
    (set, fail) => (enabled ? onSnapshot(doc(db, COL.config, CONFIG_DOC.business), (s) => set(normalizeSettings(s.data())), fail) : () => {}),
    [db, enabled],
  );
  const weekly = useSnapshot<WeeklyHours>(
    (set, fail) => (enabled ? onSnapshot(doc(db, COL.config, CONFIG_DOC.weekly), (s) => set(normalizeWeekly(s.data())), fail) : () => {}),
    [db, enabled],
  );
  const services = useSnapshot<Service[]>(
    (set, fail) =>
      enabled
        ? onSnapshot(collection(db, COL.services), (s) => set(s.docs.map((d) => normalizeService(d.id, d.data())).sort((a, b) => a.order - b.order)), fail)
        : () => {},
    [db, enabled],
  );
  const categories = useSnapshot<Category[]>(
    (set, fail) =>
      enabled
        ? onSnapshot(
            collection(db, COL.categories),
            (s) => set(s.docs.map((d) => ({ order: 0, name: {}, ...d.data(), id: d.id }) as Category).sort((a, b) => a.order - b.order)),
            fail,
          )
        : () => {},
    [db, enabled],
  );
  return { settings, weekly, services, categories };
}

/** Bookings starting in [from, to) (ISO instants). */
export function useBookings(from: string, to: string) {
  const { db } = useAdmin();
  return (
    useSnapshot<Booking[]>(
      (set, fail) =>
        onSnapshot(
          query(collection(db, COL.bookings), where("start", ">=", from), where("start", "<", to), orderBy("start")),
          (s) => set(s.docs.map((d) => d.data() as Booking)),
          fail,
        ),
      [db, from, to],
    ) ?? null
  );
}

export function usePendingBookings() {
  const { db } = useAdmin();
  return useSnapshot<Booking[]>(
    (set, fail) =>
      onSnapshot(
        query(collection(db, COL.bookings), where("status", "==", "pending"), orderBy("start")),
        (s) => set(s.docs.map((d) => d.data() as Booking)),
        fail,
      ),
    [db],
  );
}

export function useBooking(id: string | null) {
  const { db } = useAdmin();
  return useSnapshot<Booking | null>(
    (set, fail) => (id ? onSnapshot(doc(db, COL.bookings, id), (s) => set(s.exists() ? (s.data() as Booking) : null), fail) : () => {}),
    [db, id],
  );
}

export function useClientBookings(clientId: string | null) {
  const { db } = useAdmin();
  return useSnapshot<Booking[]>(
    (set, fail) =>
      clientId
        ? onSnapshot(
            query(collection(db, COL.bookings), where("clientId", "==", clientId), orderBy("start", "desc")),
            (s) => set(s.docs.map((d) => d.data() as Booking)),
            fail,
          )
        : () => {},
    [db, clientId],
  );
}

export function useCollection<T>(name: string, ...constraints: QueryConstraint[]) {
  const { db } = useAdmin();
  return useSnapshot<T[]>(
    (set, fail) => onSnapshot(query(collection(db, name), ...constraints), (s) => set(s.docs.map((d) => ({ ...d.data(), id: d.id }) as T)), fail),
    // Constraints are static per call site.
    [db, name],
  );
}

export const useClients = () => useCollection<Client>(COL.clients);
export const useExceptions = () => useCollection<DayException & { id: string }>(COL.exceptions, orderBy("date"));
export const useBlocks = () => useCollection<Block>(COL.blocks, orderBy("start"));

// ---- Admin API (booking changes go through the functions) ----

export class AdminApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function createAdminApi(base: string, auth: Auth) {
  const root = base.replace(/\/$/, "");
  async function call<T>(method: "GET" | "POST", path: string, body?: unknown, q?: Record<string, string>): Promise<T> {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(`${root}${path}${q ? `?${new URLSearchParams(q)}` : ""}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => {
      throw new AdminApiError("network");
    });
    const json = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) throw new AdminApiError(json.error ?? "server");
    return json as T;
  }
  return {
    me: () => call<{ ok: true; email: string }>("GET", "/admin/me"),
    slots: (service: string, from: string, to: string, exclude?: string) =>
      call<{ timezone: string; slots: Record<string, string[]> }>("GET", "/admin/slots", undefined, {
        service,
        from,
        to,
        ...(exclude ? { exclude } : {}),
      }),
    create: (body: Record<string, unknown>) => call<{ booking: Booking }>("POST", "/admin/bookings", body),
    status: (id: string, status: string, notify: boolean) => call<{ booking: Booking }>("POST", `/admin/bookings/${id}/status`, { status, notify }),
    move: (id: string, start: string, notify: boolean, force = false) =>
      call<{ booking: Booking }>("POST", `/admin/bookings/${id}/move`, { start, notify, force }),
    geocode: (q: string) =>
      fetch(`${root}/geocode?${new URLSearchParams({ q })}`)
        .then((r) => r.json() as Promise<{ results: { label: string; lat: number; lng: number; postcode?: string; city?: string }[] }>)
        .catch(() => ({ results: [] })),
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;
