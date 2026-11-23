// Studio — local API + UI server.  npm run app  →  http://127.0.0.1:4317
// Binds to loopback only and rejects foreign Host headers (DNS-rebinding guard): this server can run
// scripts and Claude on your machine, so it must never be reachable from the network.
// Feature-based layout: core/ holds shared plumbing, features/<name>/ holds each area's logic and routes.
import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { APP } from "./core/paths.mjs";
import { registerHome } from "./features/home/routes.mjs";
import { registerBrands } from "./features/brands/routes.mjs";
import { registerVoices } from "./features/voices/routes.mjs";
import { registerProjects } from "./features/projects/routes.mjs";
import { registerResearch } from "./features/research/routes.mjs";
import { registerAgents, registerChat } from "./features/agents/routes.mjs";
import { registerJobs } from "./features/jobs/routes.mjs";
import { registerSettings } from "./features/settings/routes.mjs";
import { registerFiles } from "./features/files/routes.mjs";
import { MIME } from "./core/stream.mjs";
import { registerLibrary } from "./features/library/routes.mjs";
import { registerRegistry } from "./features/registry/routes.mjs";
import { registerApps } from "./features/apps/routes.mjs";

const PORT = Number(process.env.PORT || 4317);
const DEV = process.argv.includes("--dev");
const app = new Hono();

const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, "127.0.0.1:5173", "localhost:5173"]);
app.use("*", async (c, next) => {
  if (!ALLOWED_HOSTS.has(c.req.header("host") || "")) return c.text("Forbidden host", 403);
  const origin = c.req.header("origin");
  if (c.req.method !== "GET" && origin && !ALLOWED_HOSTS.has(origin.replace(/^https?:\/\//, ""))) return c.text("Forbidden origin", 403);
  await next();
});
app.onError((e, c) => c.json({ error: e.message }, e.status || 500));

// ---------------------------------------------------------------- features
registerHome(app);
registerBrands(app);
registerVoices(app);
registerProjects(app);
registerResearch(app);
registerChat(app);
registerAgents(app);
registerJobs(app);
registerSettings(app);
registerFiles(app);
registerLibrary(app);
registerRegistry(app);
registerApps(app);

// ---------------------------------------------------------------- UI
const dist = path.join(APP, "dist");
app.get("*", (c) => {
  if (DEV) return c.text("Dev mode: open http://127.0.0.1:5173", 404);
  const p = path.join(dist, c.req.path);
  const file = p.startsWith(dist) && fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(dist, "index.html");
  if (!fs.existsSync(file)) return c.text("UI not built. Run: npm run app (it builds automatically)", 500);
  const type = MIME[path.extname(file)] || (file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".woff2") ? "font/woff2" : "text/html; charset=utf-8");
  return new Response(fs.createReadStream(file), { headers: { "content-type": type, "cache-control": file.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache" } });
});

serve({ fetch: app.fetch, hostname: "127.0.0.1", port: PORT }, () => {
  console.log(`Studio → http://127.0.0.1:${PORT}${DEV ? "  (API only; UI on :5173)" : ""}`);
});
