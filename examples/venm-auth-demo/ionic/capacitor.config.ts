import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.venm.auth.ionic.demo",
  appName: "Venm Auth Ionic",
  webDir: "dist",
  server: {
    androidScheme: "http",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
