import { defineConfig } from "vitest/config";

// Run with `npm run test:emulator` (starts the Firestore and Auth emulators).
export default defineConfig({
  test: {
    include: ["tests/**/*.emulator.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
