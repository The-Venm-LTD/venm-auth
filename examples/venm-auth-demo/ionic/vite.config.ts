import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Load .env from the shared vars/ folder (two levels up: ionic/ → demo/ → vars/)
  envDir: "../vars",
  server: {
    port: 3002,
    proxy: {
      "/api/auth": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/App.tsx"],
    },
  },
  build: {
    outDir: "dist",
  },
  optimizeDeps: {
    include: ["venm-auth", "capacitor-native-google-one-tap-signin"],
  },
});
