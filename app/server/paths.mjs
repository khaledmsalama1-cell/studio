import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT = path.resolve(APP, "..");
export const DATA = path.join(APP, ".data");

// Only these top-level folders are ever served or written through the API.
const SERVABLE = ["brands", "projects", "research"];

/** Resolve a repo-relative path and refuse anything outside the servable folders. */
export function safePath(rel) {
  const abs = path.resolve(ROOT, rel);
  const top = path.relative(ROOT, abs).split(path.sep)[0];
  if (!SERVABLE.includes(top) || path.relative(ROOT, abs).startsWith("..")) throw Object.assign(new Error("Path not allowed"), { status: 403 });
  return abs;
}

export const slugOk = (s) => typeof s === "string" && /^[a-z0-9][a-z0-9-_]*$/i.test(s);

export function readJSON(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

export function readText(p, fallback = "") {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return fallback;
  }
}

export const fileUrl = (abs) => "/files/" + path.relative(ROOT, abs).split(path.sep).map(encodeURIComponent).join("/");
