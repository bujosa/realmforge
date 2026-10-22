import { defineConfig } from "vite";

export default defineConfig({
  root: "gallery",
  base: "./",
  build: { outDir: "../dist-gallery", emptyOutDir: true },
  preview: { port: 5202, strictPort: true },
  server: { port: 5201, strictPort: true },
});
