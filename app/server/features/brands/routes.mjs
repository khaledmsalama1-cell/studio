// Brand routes: HTTP in and out only; the work happens in brands.mjs.
import { jobJSON } from "../../core/http.mjs";
import { createBrand, createBrandFromStarter, getBrandDetail, listBrands, saveBrand, saveBrandAssets, saveBrandLogo, startSiteScan } from "./brands.mjs";

/** Uploaded files as plain { name, bytes } */
const uploads = async (value) => Promise.all([value].flat().filter((f) => f && typeof f !== "string").map(async (f) => ({ name: f.name, bytes: Buffer.from(await f.arrayBuffer()) })));

export function registerBrands(app) {
  app.get("/api/brands", (c) => c.json(listBrands()));
  app.post("/api/brands", async (c) => c.json({ slug: createBrand(await c.req.json()) }));
  app.post("/api/brands/from-starter", async (c) => c.json({ slug: createBrandFromStarter(await c.req.json()) }));
  app.get("/api/brands/:slug", (c) => c.json(getBrandDetail(c.req.param("slug"))));
  app.put("/api/brands/:slug", async (c) => (saveBrand(c.req.param("slug"), await c.req.json()), c.json({ ok: true })));
  app.post("/api/brands/:slug/logo", async (c) => {
    const body = await c.req.parseBody();
    const [file] = await uploads(body.file);
    return c.json({ ok: true, path: saveBrandLogo(c.req.param("slug"), file, body.role) });
  });
  app.post("/api/brands/:slug/assets", async (c) => {
    const body = await c.req.parseBody({ all: true });
    return c.json({ saved: saveBrandAssets(c.req.param("slug"), await uploads(body.file)) });
  });
  app.post("/api/brands/:slug/extract", async (c) => c.json(jobJSON(startSiteScan(c.req.param("slug"), await c.req.json()))));
}
