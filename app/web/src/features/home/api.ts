// Home data layer: the overview of brands, recent projects, research and running jobs.
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import type { BrandSummary, JobSummary, ProjectSummary, ResearchSummary } from "@/shared/api/types";

export type Overview = { brands: BrandSummary[]; projects: ProjectSummary[]; research: ResearchSummary[]; running: JobSummary[] };

export const useOverview = () => useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/api/overview") });
