// Jobs data layer.
import { api } from "@/shared/api/client";
import type { JobDetail } from "@/shared/api/types";

export const getJob = (id: string) => api.get<JobDetail>(`/api/jobs/${id}`);
export const cancelJob = (id: string) => api.post(`/api/jobs/${id}/cancel`);
