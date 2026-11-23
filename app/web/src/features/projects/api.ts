// Projects data layer: project lists, one project, edits, uploads and pipeline steps.
import { useQuery } from "@tanstack/react-query";
import { api, startJob } from "@/shared/api/client";
import type { Content, ProjectDetail, ProjectSummary } from "@/shared/api/types";

/** All projects, or one brand's */
export const useProjects = (brand?: string, opts: { enabled?: boolean } = {}) =>
  useQuery({ queryKey: ["projects", brand || ""], queryFn: () => api.get<ProjectSummary[]>(brand ? `/api/projects?brand=${brand}` : "/api/projects"), ...opts });
export const useProject = (brand: string, id: string) => useQuery({ queryKey: ["project", brand, id], queryFn: () => api.get<ProjectDetail>(`/api/projects/${brand}/${id}`) });

export type NewProject = { brand: string; format: string; name: string; engine?: string; width?: number; height?: number; template?: string; topic?: string };
export const createProject = (body: NewProject) => api.post<{ brand: string; id: string }>("/api/projects", body);
export const saveProjectContent = (brand: string, id: string, content: Content) => api.put(`/api/projects/${brand}/${id}/content`, content);
export const setProjectStatus = (brand: string, id: string, body: { status: string }) => api.put(`/api/projects/${brand}/${id}/status`, body);
/** brief.md or caption.md */
export const saveProjectText = (brand: string, id: string, file: string, body: { text: string }) => api.put(`/api/projects/${brand}/${id}/${file}`, body);
export const uploadProjectAssets = (brand: string, id: string, form: FormData) => api.post<{ saved: string[] }>(`/api/projects/${brand}/${id}/assets`, form);
/** voice | build | render | snapshot | preview | sync */
export const runProjectStep = (brand: string, id: string, step: string, body?: unknown) => startJob(`/api/projects/${brand}/${id}/run/${step}`, body);
