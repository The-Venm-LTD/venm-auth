import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The capacitor-native-google-one-tap-signin plugin is an optional peer
      // dependency. In tests, resolve to a mock to avoid resolution errors.
      "capacitor-native-google-one-tap-signin": path.resolve(
        __dirname,
        "./src/test/__mocks__/capacitor-plugin.ts"
      ),
    },
  },
});
