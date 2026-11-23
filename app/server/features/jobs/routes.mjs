// Jobs: list, read, cancel, stream one job, and one event stream for the activity dock.
import { streamSSE } from "hono/streaming";
import { cancelJob, getJob, listJobs, subscribe, summary } from "../../core/jobs.mjs";
import { bad } from "../../core/http.mjs";

export function registerJobs(app) {
  app.get("/api/jobs", (c) => c.json(listJobs({ brand: c.req.query("brand"), project: c.req.query("project"), kind: c.req.query("kind") }).slice(0, 100).map(summary)));
  app.get("/api/jobs/:id", (c) => {
    const j = getJob(c.req.param("id"));
    if (!j) throw bad("Job not found", 404);
    return c.json({ ...summary(j), log: j.log, events: j.events });
  });
  app.post("/api/jobs/:id/cancel", (c) => c.json({ ok: cancelJob(c.req.param("id")) }));
  app.get("/api/jobs/:id/stream", (c) => {
    const j = getJob(c.req.param("id"));
    if (!j) throw bad("Job not found", 404);
    return streamSSE(c, async (stream) => {
      // Subscribe and take the snapshot in the same tick (no await between them), so every event
      // after the snapshot is buffered and replayed — a job that finishes mid-handshake can't be missed.
      const pending = [];
      let ready = false;
      let finish;
      const done = new Promise((r) => (finish = r));
      // Writes are chained so the stream only closes after the final "end" has actually been sent
      let queue = Promise.resolve();
      const off = subscribe(j.id, (e) => {
        if (!ready) return pending.push(e);
        queue = queue.then(() => stream.writeSSE({ event: e.type, data: JSON.stringify(e) }));
        if (e.type === "end") queue.then(finish);
      });
      stream.onAbort(() => finish());
      const snap = { ...summary(j), log: [...j.log], events: [...j.events] };
      await stream.writeSSE({ event: "snapshot", data: JSON.stringify(snap) });
      for (const e of pending) await stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
      ready = true;
      if (snap.status !== "running" || pending.some((e) => e.type === "end")) finish();
      await done;
      off();
    });
  });
  // One stream for the dock: start/end of every job
  app.get("/api/events", (c) =>
    streamSSE(c, async (stream) => {
      const seen = new Map();
      const tick = async () => {
        for (const j of listJobs().slice(0, 30)) {
          const sig = j.status + j.log.length + j.events.length;
          if (seen.get(j.id) !== sig) {
            seen.set(j.id, sig);
            await stream.writeSSE({ event: "job", data: JSON.stringify(summary(j)) });
          }
        }
      };
      let alive = true;
      stream.onAbort(() => (alive = false));
      while (alive) {
        await tick();
        await stream.sleep(700);
      }
    })
  );
}
