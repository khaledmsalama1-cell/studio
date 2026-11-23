// Create data layer: templates from the studio-templates registry.
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import type { Scene } from "@/shared/api/types";

export type Template = {
  kind: "studio" | "external";
  id: string;
  name: string;
  description: string;
  category: string;
  tags?: string[];
  format?: string;
  scenes?: Scene[];
  engine?: string;
  url?: string;
};

export const useTemplates = (opts: { enabled?: boolean } = {}) =>
  useQuery({ queryKey: ["templates"], queryFn: () => api.get<{ templates: Template[]; status: { count: number; error: string | null } }>("/api/templates"), ...opts });
