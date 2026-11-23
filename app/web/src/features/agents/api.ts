// Agents data layer: which agents exist, their status, chats, and connecting them.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, startJob } from "@/shared/api/client";

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
export type AgentList = { active: AgentId; agents: AgentStatus[] };

/** Short name for buttons and headings: "Ask Codex", "What should Gemini make today?" */
export const AGENT_SHORT: Record<AgentId, string> = { claude: "Claude", codex: "Codex", gemini: "Gemini" };

/** The agents the studio can use, which one is active, and a way to switch. `watch` re-checks every few seconds. */
export function useAgents({ watch = false }: { watch?: boolean } = {}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<AgentList>(`/api/agents${watch ? "?fresh=1" : ""}`),
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

export type Thread = { id: string; title: string; started: number; updated: number; status: string; sessionId: string | null; jobs: string[]; agent?: AgentId };

export const useConversations = () => useQuery({ queryKey: ["conversations"], queryFn: () => api.get<Thread[]>("/api/conversations"), refetchInterval: 4000 });

export type AgentTask = { prompt: string; sessionId?: string; title?: string; meta?: Record<string, string | undefined> };
/** Hand a task to the active agent (or the conversation's own agent when sessionId is given) */
export const askAgent = (task: AgentTask) => startJob("/api/claude", task);
export const installAgent = (id: AgentId) => startJob(`/api/agents/${id}/install`, {});
export const testAgent = (id: AgentId) => api.post<{ ok: boolean; reply: string; seconds: number }>(`/api/agents/${id}/test`, {});
export const connectAgentKey = (id: AgentId, body: { value: string }) => api.post<{ ok: boolean; detail?: string }>(`/api/agents/${id}/key`, body);
export const removeAgentKey = (id: AgentId) => api.del(`/api/agents/${id}/key`);
