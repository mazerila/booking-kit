// Same file a client site has in functions/src/index.ts, importing the module sources directly.
import { createBookingFunctions } from "../../../src/functions/index.js";

export const { bookingApi, bookingJobs } = createBookingFunctions({
  siteUrl: "http://localhost:5173",
  mailFrom: "Studio Lumière <rdv@example.com>",
  managePath: "/rdv/",
  brand: { color: "#2e2c2f" },
});
