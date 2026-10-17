import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const src = (p: string) => fileURLToPath(new URL(`../src/${p}`, import.meta.url));

// The demo imports the module's sources directly, under the same names a client site uses.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // The module's sources live outside the demo: use the demo's single copy of these.
    dedupe: ["react", "react-dom", "firebase"],
    alias: [
      { find: "@mazerila/booking-kit/react", replacement: src("react/index.ts") },
      { find: "@mazerila/booking-kit/admin", replacement: src("admin/index.ts") },
      { find: "@mazerila/booking-kit/styles.css", replacement: src("styles/booking.css") },
      { find: "@mazerila/booking-kit/admin.css", replacement: src("styles/admin.css") },
    ],
  },
  server: {
    port: 5173,
    fs: { allow: [".."] },
    proxy: {
      // Same path as the Firebase Hosting rewrite in production.
      "/api/booking": {
        target: "http://127.0.0.1:5001",
        rewrite: (p) => p.replace(/^\/api\/booking/, "/demo-booking/europe-west1/bookingApi"),
      },
    },
  },
});
