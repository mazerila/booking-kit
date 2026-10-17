/** Day / week / month calendar of bookings, opening hours and blocked time. */
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  dateRange,
  localDateOf,
  minutesOf,
  MINUTE,
  openingRanges,
  wallParts,
  weekdayOf,
  WEEKDAYS,
  zonedTime,
  type Booking,
  type DayException,
} from "../../core/index.js";
import { HelpLink } from "./HelpView.js";
import { useAdmin, useBlocks, useBookings, useExceptions } from "../data.js";
import { useFormat } from "../ui.js";

type View = "day" | "week" | "month";
const HOUR_PX = 52;

const isNarrow = () => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;

export function CalendarView({ initialDate }: { initialDate?: string }) {
  const { t, settings, weekly, locale } = useAdmin();
  const f = useFormat();
  const tz = settings.timezone;
  const today = localDateOf(Date.now(), tz);
  const [view, setView] = useState<View>(() => (isNarrow() ? "day" : "week"));
  const [anchor, setAnchor] = useState(initialDate ?? today);
  useEffect(() => {
    if (initialDate) setAnchor(initialDate);
  }, [initialDate]);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") {
      const monday = addDays(anchor, -WEEKDAYS.indexOf(weekdayOf(anchor)));
      return dateRange(monday, addDays(monday, 6));
    }
    const first = `${anchor.slice(0, 7)}-01`;
    const start = addDays(first, -WEEKDAYS.indexOf(weekdayOf(first)));
    return dateRange(start, addDays(start, 41));
  }, [view, anchor]);

  const from = new Date(zonedTime(days[0]!, "00:00", tz) ?? 0).toISOString();
  const to = new Date(zonedTime(addDays(days.at(-1)!, 1), "00:00", tz) ?? 0).toISOString();
  const bookings = useBookings(from, to);
  const blocks = useBlocks();
  const exceptionList = useExceptions();
  const exceptions = useMemo(() => Object.fromEntries((exceptionList ?? []).map((e) => [e.date, e as DayException])), [exceptionList]);

  const visible = (bookings ?? []).filter((b) => b.status !== "cancelled" && b.status !== "declined");
  const byDay = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of visible) {
      const d = localDateOf(Date.parse(b.start), tz);
      m.set(d, [...(m.get(d) ?? []), b]);
    }
    return m;
  }, [visible, tz]);

  function shift(dir: -1 | 1) {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "week") setAnchor(addDays(anchor, 7 * dir));
    else {
      const [y, m] = anchor.split("-").map(Number) as [number, number];
      const d = new Date(Date.UTC(y, m - 1 + dir, 1));
      setAnchor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
    }
  }

  const title =
    view === "month"
      ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${anchor.slice(0, 7)}-15T12:00:00Z`))
      : view === "day"
        ? f.date(new Date(zonedTime(anchor, "12:00", tz) ?? 0).toISOString(), { year: "numeric" })
        : `${f.date(new Date(zonedTime(days[0]!, "12:00", tz) ?? 0).toISOString(), { weekday: undefined })} – ${f.date(new Date(zonedTime(days[6]!, "12:00", tz) ?? 0).toISOString(), { weekday: undefined, year: "numeric" })}`;

  return (
    <div className="bka-view bka-view--wide">
      <div className="bka-view__head">
        <div className="bka-titlerow">
          <h1>{t.navCalendar}</h1>
          <HelpLink section="calendar" />
        </div>
        <div className="bka-seg" role="group">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button type="button" key={v} className={view === v ? "bka-seg--on" : ""} aria-pressed={view === v} onClick={() => setView(v)}>
              {t[v]}
            </button>
          ))}
        </div>
      </div>
      <div className="bka-calnav">
        <button type="button" className="bka-iconbtn" onClick={() => shift(-1)} aria-label={t.previous}>
          ‹
        </button>
        <button type="button" className="bka-btn bka-btn--sm" onClick={() => setAnchor(today)}>
          {t.todayBtn}
        </button>
        <button type="button" className="bka-iconbtn" onClick={() => shift(1)} aria-label={t.next}>
          ›
        </button>
        <h2 className="bka-calnav__title">{title}</h2>
      </div>

      {view === "month" ? (
        <MonthGrid
          days={days}
          month={anchor.slice(0, 7)}
          today={today}
          byDay={byDay}
          isClosed={(d) => !openingRanges(d, weekly, exceptions).length}
          onDay={(d) => {
            setAnchor(d);
            setView("day");
          }}
        />
      ) : (
        <TimeGrid days={days} today={today} byDay={byDay} exceptions={exceptions} blocks={blocks ?? []} />
      )}
    </div>
  );
}

function MonthGrid({
  days,
  month,
  today,
  byDay,
  isClosed,
  onDay,
}: {
  days: string[];
  month: string;
  today: string;
  byDay: Map<string, Booking[]>;
  isClosed: (d: string) => boolean;
  onDay: (d: string) => void;
}) {
  const { locale, t } = useAdmin();
  const f = useFormat();
  const wd = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return (
    <div className="bka-month">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="bka-month__wd">
          {wd.format(new Date(Date.UTC(2024, 0, 1 + i)))}
        </div>
      ))}
      {days.map((d) => {
        const list = byDay.get(d) ?? [];
        return (
          <button
            type="button"
            key={d}
            className={`bka-month__cell${d.slice(0, 7) !== month ? " bka-month__cell--out" : ""}${d === today ? " bka-month__cell--today" : ""}${isClosed(d) ? " bka-month__cell--closed" : ""}`}
            onClick={() => onDay(d)}
          >
            <span className="bka-month__num">{Number(d.slice(8))}</span>
            {list.slice(0, 3).map((b) => (
              <span key={b.id} className={`bka-chip bka-chip--${b.status}`}>
                {f.time(b.start)} {b.client.name.split(" ")[0]}
              </span>
            ))}
            {list.length > 3 && <span className="bka-muted bka-month__more">{t.more.replace("{n}", String(list.length - 3))}</span>}
          </button>
        );
      })}
    </div>
  );
}

function TimeGrid({
  days,
  today,
  byDay,
  exceptions,
  blocks,
}: {
  days: string[];
  today: string;
  byDay: Map<string, Booking[]>;
  exceptions: Record<string, DayException>;
  blocks: { id: string; start: string; end: string; reason?: string }[];
}) {
  const { settings, weekly, openBooking, newBooking, locale, t } = useAdmin();
  const f = useFormat();
  const tz = settings.timezone;

  // Hours shown: opening hours of the week, widened to fit every booking.
  const [startH, endH] = useMemo(() => {
    let lo = 24 * 60;
    let hi = 0;
    for (const d of days) {
      for (const r of openingRanges(d, weekly, exceptions)) {
        lo = Math.min(lo, minutesOf(r.start));
        hi = Math.max(hi, r.end === "00:00" ? 24 * 60 : minutesOf(r.end));
      }
      for (const b of byDay.get(d) ?? []) {
        const s = wallParts(Date.parse(b.start), tz);
        const e = wallParts(Date.parse(b.end), tz);
        lo = Math.min(lo, s.hour * 60 + s.minute);
        hi = Math.max(hi, e.hour * 60 + e.minute || 24 * 60);
      }
    }
    if (lo >= hi) return [8, 19];
    return [Math.max(0, Math.floor(lo / 60) - 1), Math.min(24, Math.ceil(hi / 60) + 1)];
  }, [days, weekly, exceptions, byDay, tz]);

  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const height = hours.length * HOUR_PX;
  const top = (iso: string, date: string) => {
    const dayStart = zonedTime(date, `${String(startH).padStart(2, "0")}:00`, tz) ?? 0;
    return ((Date.parse(iso) - dayStart) / (60 * MINUTE)) * HOUR_PX;
  };
  const now = Date.now();
  const wdFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", timeZone: "UTC" });

  function clickEmpty(e: React.MouseEvent<HTMLDivElement>, date: string) {
    if (e.target !== e.currentTarget) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const minutes = Math.floor(((y / HOUR_PX) * 60) / 15) * 15 + startH * 60;
    const ms = zonedTime(date, `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`, tz);
    if (ms !== null) newBooking({ start: new Date(ms).toISOString() });
  }

  return (
    <div className="bka-timegrid" style={{ ["--cols" as string]: days.length }}>
      <div className="bka-timegrid__head">
        <span />
        {days.map((d) => (
          <span key={d} className={d === today ? "bka-today" : ""}>
            {wdFmt.format(new Date(`${d}T12:00:00Z`))}
          </span>
        ))}
      </div>
      <div className="bka-timegrid__body" style={{ height }}>
        <div className="bka-timegrid__hours">
          {hours.map((h) => (
            <span key={h} style={{ height: HOUR_PX }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {days.map((d) => {
          const ranges = openingRanges(d, weekly, exceptions);
          const dayStartMs = zonedTime(d, "00:00", tz) ?? 0;
          const dayEndMs = zonedTime(addDays(d, 1), "00:00", tz) ?? 0;
          const dayBlocks = blocks.filter((b) => Date.parse(b.start) < dayEndMs && Date.parse(b.end) > dayStartMs);
          return (
            <div key={d} className="bka-timegrid__col" onClick={(e) => clickEmpty(e, d)}>
              <div className="bka-lines" style={{ backgroundSize: `100% ${HOUR_PX}px` }} />
              {ranges.map((r, i) => {
                const s = zonedTime(d, r.start, tz);
                const e = r.end === "00:00" ? dayEndMs : zonedTime(d, r.end, tz);
                if (s === null || e === null) return null;
                const y = top(new Date(s).toISOString(), d);
                return <div key={i} className="bka-open" style={{ top: y, height: ((e - s) / (60 * MINUTE)) * HOUR_PX }} />;
              })}
              {dayBlocks.map((b) => {
                const s = Math.max(Date.parse(b.start), dayStartMs);
                const e = Math.min(Date.parse(b.end), dayEndMs);
                const y = Math.max(0, top(new Date(s).toISOString(), d));
                return (
                  <div key={b.id} className="bka-blocked" style={{ top: y, height: Math.max(12, ((e - s) / (60 * MINUTE)) * HOUR_PX) }} title={b.reason}>
                    {t.blocked}
                    {b.reason ? ` · ${b.reason}` : ""}
                  </div>
                );
              })}
              {(byDay.get(d) ?? []).map((b) => {
                const y = top(b.start, d);
                const h = ((Date.parse(b.end) - Date.parse(b.start)) / (60 * MINUTE)) * HOUR_PX;
                return (
                  <button
                    type="button"
                    key={b.id}
                    className={`bka-event bka-event--${b.status}`}
                    style={{ top: y, height: Math.max(22, h - 2) }}
                    onClick={() => openBooking(b.id)}
                  >
                    <strong>
                      {f.time(b.start)} {b.client.name}
                    </strong>
                    <span>{f.name(b.service.name)}</span>
                  </button>
                );
              })}
              {d === today && now > dayStartMs && now < dayEndMs && <div className="bka-now" style={{ top: top(new Date(now).toISOString(), d) }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
