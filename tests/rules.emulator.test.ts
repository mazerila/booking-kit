/** Firestore security rules: only listed admins can read or edit booking data. */
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-rules",
    firestore: { rules: readFileSync("template/firestore.rules", "utf8"), host, port: Number(port) },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await db.doc("bookingConfig/admins").set({ emails: ["owner@studio.test"] });
    await db.doc("bookingConfig/business").set({ businessName: "Studio" });
    await db.doc("bookings/b1").set({ status: "confirmed", notes: "", client: { name: "Ana" }, updatedAt: "x" });
  });
});

afterAll(() => env.cleanup());

const admin = () => env.authenticatedContext("owner", { email: "Owner@studio.test", email_verified: true }).firestore();
const unverified = () => env.authenticatedContext("owner2", { email: "owner@studio.test", email_verified: false }).firestore();
const stranger = () => env.authenticatedContext("x", { email: "x@studio.test", email_verified: true }).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

describe("firestore rules", () => {
  it("lets admins read and edit settings, but not the admin list", async () => {
    await assertSucceeds(admin().doc("bookingConfig/business").get());
    await assertSucceeds(admin().doc("bookingConfig/business").set({ businessName: "New" }));
    await assertSucceeds(admin().doc("services/s1").set({ name: { fr: "X" } }));
    await assertFails(admin().doc("bookingConfig/admins").set({ emails: ["x@studio.test"] }));
  });

  it("keeps everyone else out", async () => {
    for (const db of [anonymous(), stranger(), unverified()]) {
      await assertFails(db.doc("bookingConfig/business").get());
      await assertFails(db.doc("bookings/b1").get());
      await assertFails(db.doc("clients/c1").get());
      await assertFails(db.doc("services/s1").set({ name: {} }));
    }
  });

  it("lets admins edit only the notes of a booking directly", async () => {
    await assertSucceeds(admin().doc("bookings/b1").update({ notes: "Allergic to X", updatedAt: "y" }));
    await assertFails(admin().doc("bookings/b1").update({ status: "cancelled" }));
    await assertFails(admin().doc("bookings/b2").set({ status: "confirmed" }));
    await assertFails(admin().doc("bookings/b1").delete());
  });
});
