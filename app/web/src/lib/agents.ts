import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type AgentId = "claude" | "codex" | "gemini";
export type AgentStatus = {
  id: AgentId;
  name: string;
  maker: string;
  installed: boolean;
  version: string | null;
  mode: "account" | "key";
  signedIn: boolean;
  how: string | null;
  detail: string;
  signIn: string;
  signInNote: string | null;
  keyUrl: string;
  accountLabel: string;
  ready: boolean;
};
type Agents = { active: AgentId; agents: AgentStatus[] };

/** Short name for buttons and headings: "Ask Codex", "What should Gemini make today?" */
export const AGENT_SHORT: Record<AgentId, string> = { claude: "Claude", codex: "Codex", gemini: "Gemini" };

/** The agents the studio can use, which one is active, and a way to switch. `watch` re-checks every few seconds. */
export function useAgents({ watch = false }: { watch?: boolean } = {}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<Agents>(`/api/agents${watch ? "?fresh=1" : ""}`),
    staleTime: 30_000,
    refetchInterval: watch ? 4000 : false,
  });
  const setActive = async (id: AgentId) => {
    await api.put("/api/agents", { active: id });
    await qc.invalidateQueries({ queryKey: ["agents"] });
    qc.invalidateQueries({ queryKey: ["doctor"] });
  };
  const active = q.data?.agents.find((a) => a.id === q.data?.active);
  return { ...q, active, activeId: (q.data?.active || "claude") as AgentId, setActive };
}
