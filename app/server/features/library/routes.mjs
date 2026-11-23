// Library routes: HTTP in and out only; the work happens in library.mjs.
import { fileResponse } from "../../core/stream.mjs";
import { listVoices } from "../voices/voices.mjs";
import { importMedia, listMedia, mediaFilePath, mediaFolders, setMediaFolders, voiceSample, voiceUsage } from "./library.mjs";

/** Uploaded files as plain { name, bytes } */
const uploads = async (value) => Promise.all([value].flat().filter((f) => f && typeof f !== "string").map(async (f) => ({ name: f.name, bytes: Buffer.from(await f.arrayBuffer()) })));

export function registerLibrary(app) {
  app.get("/api/library", (c) => c.json({ items: listMedia(), folders: mediaFolders() }));
  app.get("/api/library/voices", async (c) => c.json({ ...(await listVoices()), usage: voiceUsage() }));
  app.post("/api/library/sample", async (c) => c.json(await voiceSample(await c.req.json())));
  app.post("/api/library/upload", async (c) => c.json({ saved: importMedia(await uploads((await c.req.parseBody({ all: true })).file)) }));
  app.put("/api/library/folders", async (c) => c.json({ folders: setMediaFolders((await c.req.json()).folders) }));
  app.get("/media/:i/*", (c) => {
    const rel = decodeURIComponent(c.req.path.split("/").slice(3).join("/"));
    return fileResponse(mediaFilePath(Number(c.req.param("i")), rel), c.req.header("range"));
  });
}
