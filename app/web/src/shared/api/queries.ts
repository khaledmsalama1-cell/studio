// App-wide data: formats, scene types and what's installed.
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Meta } from "./types";

export const useMeta = () => useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/api/meta") });
