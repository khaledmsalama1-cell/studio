// HTTP client for the studio server: JSON in and out, errors carry the server's message.
import type { JobSummary } from "./types";
async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["content-type"] = "application/json";
  }
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data as T;
}

export const api = {
  get: <T,>(url: string) => req<T>("GET", url),
  post: <T,>(url: string, body?: unknown) => req<T>("POST", url, body ?? {}),
  put: <T,>(url: string, body: unknown) => req<T>("PUT", url, body),
  del: <T,>(url: string) => req<T>("DELETE", url),
};

/** POST to a route that starts a background job; resolves with the job (open it in the activity dock). */
export const startJob = (url: string, body?: unknown) => api.post<{ job: JobSummary }>(url, body);
