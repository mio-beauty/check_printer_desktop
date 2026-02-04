import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // В production Electron загружает index.html через file://, поэтому base должен быть относительным.
  base: command === "build" ? "./" : "/",
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
  },
}));
