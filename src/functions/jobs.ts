/** Scheduled job: reminder e-mails and closing past appointments. */
import * as logger from "firebase-functions/logger";
import { COL, MINUTE, type Booking } from "../core/index.js";
import { changeStatus, notify, type Ctx } from "./actions.js";
import { db, loadBusiness } from "./db.js";

/** Confirmed appointments that ended this long ago are marked completed. */
const AUTO_COMPLETE_AFTER_MIN = 6 * 60;

export async function runScheduledJobs(ctx: Ctx) {
  const { settings } = await loadBusiness(true);
  const now = ctx.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  let reminded = 0;
  let completed = 0;

  if (settings.reminders.enabled) {
    const window = settings.reminders.hoursBefore * 60 * MINUTE;
    const snap = await db()
      .collection(COL.bookings)
      .where("status", "==", "confirmed")
      .where("start", ">", iso(now))
      .where("start", "<=", iso(now + window))
      .get();
    for (const doc of snap.docs) {
      const b = doc.data() as Booking;
      if (b.reminderSentAt) continue;
      // Booked inside the reminder window: the confirmation was the reminder.
      const setAt = [...b.history].reverse().find((h) => h.action === "created" || h.action === "rescheduled")?.at ?? b.createdAt;
      const bookedLate = Date.parse(setAt) > Date.parse(b.start) - window;
      if (!bookedLate) {
        await notify(ctx, settings, b, ["reminder"]);
        reminded++;
      }
      await doc.ref.update({ reminderSentAt: bookedLate ? "skipped" : iso(ctx.now()) });
    }
  }

  const past = await db()
    .collection(COL.bookings)
    .where("status", "==", "confirmed")
    .where("end", "<", iso(now - AUTO_COMPLETE_AFTER_MIN * MINUTE))
    .limit(200)
    .get();
  for (const doc of past.docs) {
    await changeStatus(ctx, doc.id, "completed", { by: "system", notify: false });
    completed++;
  }

  logger.info("booking: scheduled jobs done", { reminded, completed });
  return { reminded, completed };
}
