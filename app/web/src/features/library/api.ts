// Library data layer: media, voices to audition, folders and imports.
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";

export type Voice = { voice_id: string; name: string; category: string; labels?: Record<string, string>; description?: string; preview_url?: string | null; provider: "elevenlabs" | "kokoro" };
export type VoicesResp = { elevenlabs: null | { error: string } | Voice[]; kokoro: Voice[]; usage: Record<string, { brand: string; name: string; role: string }[]> };
export type Media = { id: string; name: string; kind: "audio" | "video" | "image"; url: string; size: number; mtime: number; duration: number | null; source: "render" | "voiceover" | "project-audio" | "imported" | "folder"; brand?: string; project?: string; projectName?: string; poster?: string | null; folder?: string };

export const useLibrary = () => useQuery({ queryKey: ["library"], queryFn: () => api.get<{ items: Media[]; folders: string[] }>("/api/library") });
export const useLibraryVoices = () => useQuery({ queryKey: ["library-voices"], queryFn: () => api.get<VoicesResp>("/api/library/voices") });

/** Generate (or reuse) a short sample of a voice reading a line */
export const sampleVoice = (body: { provider?: string; voiceId?: string; text: string; modelId?: string; settings?: unknown }) => api.post<{ url: string }>("/api/library/sample", body);
export const setMediaFolders = (body: { folders: string[] }) => api.put("/api/library/folders", body);
export const importMedia = (form: FormData) => api.post("/api/library/upload", form);
