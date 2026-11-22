import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const api = "http://127.0.0.1:4317";

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5173, proxy: { "/api": api, "/files": api, "/media": api } },
});
