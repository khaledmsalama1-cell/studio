import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const api = "http://127.0.0.1:4317";

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  // @/ is web/src: app/, shared/ and features/<name>/
  resolve: { alias: { "@": fileURLToPath(new URL("./web/src", import.meta.url)) } },
  build: { outDir: "../dist", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5173, proxy: { "/api": api, "/files": api, "/media": api } },
});
