// Errors that become JSON responses, and the job envelope every "start a job" route returns.
import { summary } from "./jobs.mjs";

export const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
export const need = (cond, msg) => {
  if (!cond) throw bad(msg);
};
export const jobJSON = (j) => ({ job: summary(j) });
