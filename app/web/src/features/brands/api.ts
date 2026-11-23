// Brands data layer: every brand request goes through here. Components never call the server directly.
import { useQuery } from "@tanstack/react-query";
import { api, startJob } from "@/shared/api/client";
import type { BrandSummary } from "@/shared/api/types";
import { withNarrator } from "./model";

export type MediaFile = { path: string; url: string; size: number; kind: "image" | "video" | "audio" };
export type BrandResp = {
  brand: any;
  logos: { name: string; path: string; url: string }[];
  media: MediaFile[];
  site: null | { source: string; fetchedAt: string; colors: { brandCandidates: { hex: string; count: number }[]; neutrals: { hex: string }[] }; fonts: { google: string[]; cssFamilies: { family: string }[] }; pages: number; downloads: { path: string; url: string }[] };
  insights: string | null;
};
export type Voices = { elevenlabs: null | { error: string } | { voice_id: string; name: string; category?: string; labels?: Record<string, string>; preview_url?: string }[]; kokoro: { voice_id: string; name: string }[] };
export type Starter = { id: string; name: string; industry: string; industryLabel: string; tagline: string; colors: Record<string, string>; fonts: BrandSummary["fonts"]; logoSvg: string };
export type StarterList = { starters: Starter[]; status: { error: string | null } };

export const useBrands = (opts: { enabled?: boolean } = {}) => useQuery({ queryKey: ["brands"], queryFn: () => api.get<BrandSummary[]>("/api/brands"), ...opts });
export const useBrand = (slug: string) => useQuery({ queryKey: ["brand", slug], queryFn: () => api.get<BrandResp>(`/api/brands/${slug}`) });
export const useBrandStarters = () => useQuery({ queryKey: ["brand-starters"], queryFn: () => api.get<StarterList>("/api/brand-starters") });
/** Voices to pick from: the connected ElevenLabs account's and the local Kokoro set */
export const useVoices = () => useQuery({ queryKey: ["voices"], queryFn: () => api.get<Voices>("/api/voices") });

export const createBrand = (body: { name: string; url?: string }) => api.post<{ slug: string }>("/api/brands", body);
export const createBrandFromStarter = (body: { starter: string; name: string }) => api.post<{ slug: string }>("/api/brands/from-starter", body);
export const saveBrand = (slug: string, brand: unknown) => api.put(`/api/brands/${slug}`, brand);
export const uploadBrandLogo = (slug: string, form: FormData) => api.post<{ path: string }>(`/api/brands/${slug}/logo`, form);
export const uploadBrandAssets = (slug: string, form: FormData) => api.post(`/api/brands/${slug}/assets`, form);
export const extractBrandFromSite = (slug: string, body: { url: string }) => startJob(`/api/brands/${slug}/extract`, body);

export const getBrand = (slug: string) => api.get<BrandResp>(`/api/brands/${slug}`);
/** Make a voice the brand's narrator */
export async function setBrandNarrator(slug: string, voice: { provider: string; voice_id: string }) {
  const { brand } = await getBrand(slug);
  await saveBrand(slug, withNarrator(brand, voice));
}
