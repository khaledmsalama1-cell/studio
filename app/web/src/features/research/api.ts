// Research data layer: scraped accounts, one report, new scrapes and hook extraction.
import { useQuery } from "@tanstack/react-query";
import { api, startJob } from "@/shared/api/client";
import type { ResearchDetail, ResearchSummary } from "@/shared/api/types";

/** All research, or one brand's */
export const useResearchList = (brand?: string, opts: { enabled?: boolean } = {}) =>
  useQuery({ queryKey: brand ? ["research", brand] : ["research"], queryFn: () => api.get<ResearchSummary[]>(brand ? `/api/research?brand=${brand}` : "/api/research"), ...opts });
export const useResearch = (brand: string, key: string) => useQuery({ queryKey: ["research", brand, key], queryFn: () => api.get<ResearchDetail>(`/api/research/${brand}/${key}`) });

export const startResearch = (body: { platform: string; target?: string | null; brand?: string; limit?: number; provider?: string; tab?: string }) => startJob("/api/research", body);
export const extractHooks = (brand: string, key: string, body: { top: number }) => startJob(`/api/research/${brand}/${key}/hooks`, body);

export const getResearchList = (brand?: string) => api.get<ResearchSummary[]>(brand ? `/api/research?brand=${brand}` : "/api/research");
