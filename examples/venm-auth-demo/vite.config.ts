import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy auth API requests to the Express server
      "/api/auth": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
    // Warm up commonly used modules so initial page load is faster
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/App.tsx"],
    },
  },

});
