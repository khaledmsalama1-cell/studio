// Job runner: every long action (scrape, voice, build, render, Claude task) is a child process
// whose output streams to the UI over SSE. Jobs survive page reloads; history persists to .data/jobs.json.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DATA } from "./paths.mjs";

const HISTORY = path.join(DATA, "jobs.json");
const MAX_LINES = 4000;
const jobs = new Map();
const subscribers = new Map(); // id -> Set<fn(event)>

const strip = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/\r/g, "");

try {
  for (const j of JSON.parse(fs.readFileSync(HISTORY, "utf8"))) {
    if (j.status === "running") j.status = "interrupted";
    jobs.set(j.id, j);
  }
} catch {}

let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const list = [...jobs.values()].sort((a, b) => b.started - a.started).slice(0, 150);
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(HISTORY, JSON.stringify(list.map(({ proc, ...j }) => j)));
  }, 500);
}

function emit(id, event) {
  for (const fn of subscribers.get(id) || []) fn(event);
}

export function summary(j) {
  const { proc, log, events, ...rest } = j;
  return { ...rest, lastLine: log.at(-1) || "" };
}

/**
 * Start a job.
 * @param {object} o
 * @param {string} o.kind     voice | build | render | research | hooks | extract | claude | preview | snapshot …
 * @param {string} o.title    shown in the dock
 * @param {string} o.cmd      executable (never run through a shell)
 * @param {string[]} o.args
 * @param {string} o.cwd
 * @param {object} [o.meta]   { brand, project, research } — lets pages find their jobs
 * @param {(line:string, job:object)=>void} [o.onLine]  parse structured output (Claude stream-json)
 */
export function startJob({ kind, title, cmd, args, cwd, meta = {}, onLine, env }) {
  const id = randomUUID().slice(0, 8);
  const job = { id, kind, title, meta, status: "running", started: Date.now(), ended: null, exitCode: null, log: [], events: [], result: null };
  jobs.set(id, job);

  const proc = spawn(cmd, args, { cwd, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  job.proc = proc;
  const push = (raw) => {
    for (const line of strip(raw).split("\n")) {
      if (!line.trim()) continue;
      if (onLine) {
        try {
          if (onLine(line, job) === false) continue; // structured line consumed
        } catch {}
      }
      job.log.push(line);
      if (job.log.length > MAX_LINES) job.log.splice(0, job.log.length - MAX_LINES);
      emit(id, { type: "line", line });
    }
  };
  let buf = { out: "", err: "" };
  const reader = (key) => (chunk) => {
    buf[key] += chunk.toString();
    const parts = buf[key].split("\n");
    buf[key] = parts.pop();
    push(parts.join("\n"));
  };
  proc.stdout.on("data", reader("out"));
  proc.stderr.on("data", reader("err"));
  proc.on("error", (e) => push(`Could not start ${cmd}: ${e.message}`));
  proc.on("close", (code, signal) => {
    push(buf.out + "\n" + buf.err);
    job.exitCode = code;
    job.status = job.status === "cancelled" ? "cancelled" : code === 0 ? "done" : "failed";
    if (signal && job.status !== "cancelled") job.log.push(`Stopped by ${signal}`);
    job.ended = Date.now();
    delete job.proc;
    emit(id, { type: "end", job: summary(job) });
    persist();
  });
  persist();
  emit(id, { type: "start" });
  return job;
}

export function addEvent(job, ev) {
  job.events.push(ev);
  emit(job.id, { type: "event", event: ev });
}

export function cancelJob(id) {
  const j = jobs.get(id);
  if (!j?.proc) return false;
  j.status = "cancelled";
  j.proc.kill("SIGTERM");
  setTimeout(() => j.proc?.kill("SIGKILL"), 4000);
  return true;
}

export const getJob = (id) => jobs.get(id);
export const listJobs = (filter = {}) =>
  [...jobs.values()]
    .filter((j) => Object.entries(filter).every(([k, v]) => v === undefined || j.meta?.[k] === v || j[k] === v))
    .sort((a, b) => b.started - a.started);

export function subscribe(id, fn) {
  if (!subscribers.has(id)) subscribers.set(id, new Set());
  subscribers.get(id).add(fn);
  return () => subscribers.get(id)?.delete(fn);
}

/** Resolve when a job finishes (for chained steps like snapshot → list frames). */
export function waitFor(job) {
  return new Promise((resolve) => {
    if (job.status !== "running") return resolve(job);
    const off = subscribe(job.id, (e) => e.type === "end" && (off(), resolve(job)));
  });
}
