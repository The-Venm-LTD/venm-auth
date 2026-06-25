import { defineConfig } from "tsup";

export default defineConfig([
  {
    // Client build
    entry: {
      index: "src/index.ts",
      components: "src/components/index.ts",
      hooks: "src/hooks/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    external: ["react", "react-dom"],
    tsconfig: "./tsconfig.json",
    splitting: false,
    outDir: "dist",
    entryNames: "[name]",
    platform: "browser",
  },
  {
    // Server build
    entry: {
      "server/index": "src/server/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: false,
    treeshake: true,
    external: ["express"],
    tsconfig: "./tsconfig.json",
    splitting: false,
    outDir: "dist",
    entryNames: "[name]",
    platform: "node",
  },
]);
