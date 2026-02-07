import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from 'path'


export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "./" : "/",
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
