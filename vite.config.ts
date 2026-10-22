import { defineConfig } from "vite";

export default defineConfig({
  root: "gallery",
  // Relative by default; Pages supplies /<repository>/ at build time.
  base: "./",
  build: { outDir: "../dist-gallery", emptyOutDir: true },
  preview: { port: 5232, strictPort: true },
  server: { port: 5231, strictPort: true },
});
