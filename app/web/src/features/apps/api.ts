// Apps data layer: the app catalogue, registries, and installing or connecting apps.
import { useQuery } from "@tanstack/react-query";
import { api, startJob } from "@/shared/api/client";

export type App = {
  id: string;
  name: string;
  category: string;
  color: string;
  tagline?: string;
  description: string;
  use?: string;
  links?: Record<string, string>;
  builtin?: boolean;
  featured?: boolean;
  connector?: boolean;
  folder?: boolean;
  needs?: string[];
  keys?: string[];
  mcp?: { name: string; oauth?: boolean };
  install?: { type: string };
  installed: boolean;
  keysSet: Record<string, boolean>;
  mcpAdded: boolean;
  folderPath: string | null;
  skills?: string[];
  custom?: boolean;
  kind?: string; // custom: skills | mcp; registry: open-source | service | desktop | skill | mcp | cli
  pricing?: string;
  license?: string;
  registry?: boolean;
  linkOnly?: boolean;
  source?: string;
  url?: string;
};
export type AppsResp = { categories: [string, string][]; apps: App[]; custom: App[] };
export type Source = { repo: string; url: string; fetchedAt: string | null; count: number; error: string | null; syncing: boolean };
export type Registry = { apps: Source; templates: Source };

export const useApps = () => useQuery({ queryKey: ["apps"], queryFn: () => api.get<AppsResp>("/api/apps") });
/** Registry status; polls while a sync is running */
export const useRegistry = () =>
  useQuery({ queryKey: ["registry"], queryFn: () => api.get<Registry>("/api/registry"), refetchInterval: (q) => (q.state.data && (q.state.data.apps.syncing || q.state.data.templates.syncing) ? 1500 : false) });

export const refreshRegistry = () => api.post("/api/registry/refresh");
export const installApp = (id: string) => startJob(`/api/apps/${id}/install`);
export const connectApp = (id: string, body: { keys: Record<string, string>; mcp: boolean }) => api.post(`/api/apps/${id}/connect`, body);
export const setAppFolder = (id: string, body: { folder: string }) => api.post(`/api/apps/${id}/folder`, body);
export const removeApp = (id: string) => api.post(`/api/apps/${id}/remove`);
export const addAppFromLink = (body: { input: string; token?: string }) => api.post<{ added: { name: string }; job?: { id: string } }>("/api/apps/custom", body);
