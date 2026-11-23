// Settings data layer: service keys, permissions, studio defaults, key checks, fixes and the system check.
import { useQuery } from "@tanstack/react-query";
import { api, startJob } from "@/shared/api/client";
import type { SettingsData } from "@/shared/api/types";
import type { Doctor } from "./types";

export type Test = { ok: boolean | null; detail: string; accounts?: { id: string; username: string; page: string }[] };

export const useSettings = (opts: { enabled?: boolean; staleTime?: number } = {}) => useQuery({ queryKey: ["settings"], queryFn: () => api.get<SettingsData>("/api/settings"), ...opts });
export const useDoctor = () => useQuery({ queryKey: ["doctor"], queryFn: () => api.get<Doctor>("/api/doctor"), staleTime: 60_000 });
/** A saved key, checked with its own service once per session */
export const useKeyCheck = (key: string, masked: string | null) =>
  useQuery({ queryKey: ["key-test", key, masked], queryFn: () => checkServiceKey({ key }), enabled: !!masked, staleTime: Infinity, retry: false });

export const saveSettings = (body: object) => api.put("/api/settings", body);
/** Check a key with its service; without a value, the saved key is checked */
export const checkServiceKey = (body: { key: string; value?: string }) => api.post<Test>("/api/settings/test", body);
export const runFix = (id: string) => startJob(`/api/settings/fix/${id}`, {});
