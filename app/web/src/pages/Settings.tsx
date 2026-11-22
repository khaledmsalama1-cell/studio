import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleDashed, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { Button, ErrorNote, Field, Input, PageHeader, Panel, Select, Textarea } from "../components/ui";

type Settings = { env: Record<string, string | null>; claude: { permissionMode: string; allowedTools: string[]; model: string }; defaultClaude: { allowedTools: string[] } };

const KEYS = [
  { key: "ELEVENLABS_API_KEY", label: "ElevenLabs API key", hint: "Voiceovers, voice casting, music. elevenlabs.io → Profile → API keys", group: "Voice" },
  { key: "ELEVENLABS_VOICE_ID", label: "Default ElevenLabs voice ID", hint: "Used when a brand has no voice chosen yet", group: "Voice" },
  { key: "APIFY_TOKEN", label: "Apify token", hint: "Instagram profiles and Facebook pages. apify.com → Settings → Integrations", group: "Research" },
  { key: "META_ACCESS_TOKEN", label: "Meta access token", hint: "Official Instagram/Facebook Graph API — setup in docs/social-research.md", group: "Research" },
  { key: "META_IG_USER_ID", label: "Your Instagram professional account ID", hint: "Needed for Instagram Business Discovery", group: "Research" },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api.get<Settings>("/api/settings") });
  const { data: doctor, refetch, isFetching } = useQuery({ queryKey: ["doctor"], queryFn: () => api.get<{ ok: boolean; label: string; detail: string }[]>("/api/doctor"), staleTime: 60_000 });
  const [env, setEnv] = useState<Record<string, string>>({});
  const [claude, setClaude] = useState<Settings["claude"] | null>(null);
  const [tools, setTools] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    if (data) {
      setClaude(data.claude);
      setTools(data.claude.allowedTools.join("\n"));
    }
  }, [data]);

  const save = async (body: object, done: string) => {
    setErr(null);
    setMsg(null);
    try {
      await api.put("/api/settings", body);
      setMsg(done);
      setEnv({});
      qc.invalidateQueries();
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Keys are stored in the repo's .env file on this computer only, and never committed." />
      {msg && <p className="mb-4 rounded-lg bg-ok-soft px-3 py-2 text-[14px] text-ok">{msg}</p>}
      <ErrorNote error={err} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Accounts & API keys">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save({ env }, "Keys saved.");
            }}
          >
            {KEYS.map((k) => (
              <Field key={k.key} label={k.label} hint={k.hint}>
                <div className="flex items-center gap-2">
                  <Input type="password" autoComplete="off" value={env[k.key] ?? ""} onChange={(e) => setEnv({ ...env, [k.key]: e.target.value })} placeholder={data?.env[k.key] ? `Saved (${data.env[k.key]}) — type to replace` : "Not set"} />
                  {data?.env[k.key] ? <Check className="size-5 flex-none text-ok" aria-label="Set" /> : <CircleDashed className="size-5 flex-none text-ink-3" aria-label="Not set" />}
                </div>
              </Field>
            ))}
            <Button type="submit" variant="primary" disabled={!Object.values(env).some((v) => v.trim())}>
              Save keys
            </Button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title="Claude permissions">
            {claude && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save({ claude: { ...claude, allowedTools: tools.split("\n").map((t) => t.trim()).filter(Boolean) } }, "Claude settings saved. They apply to the next task.");
                }}
              >
                <p className="text-[14px] text-ink-2">
                  Tasks from this UI run Claude Code in the background, where it can't stop to ask for approval. These rules decide what it may do on its own; anything else is refused and reported back to you.
                </p>
                <Field label="Mode">
                  <Select value={claude.permissionMode} onChange={(e) => setClaude({ ...claude, permissionMode: e.target.value })}>
                    <option value="acceptEdits">Edit files + the tools listed below (recommended)</option>
                    <option value="default">Only the tools listed below</option>
                    <option value="plan">Plan only — no changes</option>
                  </Select>
                </Field>
                <Field label="Allowed without asking" hint="One rule per line, Claude Code syntax, e.g. Bash(npm run:*)">
                  <Textarea rows={9} value={tools} onChange={(e) => setTools(e.target.value)} className="font-mono text-[12.5px]" spellCheck={false} />
                </Field>
                <Field label="Model" hint="Leave empty for your Claude Code default">
                  <Input value={claude.model} onChange={(e) => setClaude({ ...claude, model: e.target.value })} placeholder="e.g. claude-opus-5-5" />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary">
                    Save
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => data && setTools(data.defaultClaude.allowedTools.join("\n"))}>
                    Reset to defaults
                  </Button>
                </div>
              </form>
            )}
          </Panel>

          <Panel title="System check" actions={<Button size="sm" variant="ghost" icon={<RefreshCw className="size-4" />} busy={isFetching} onClick={() => refetch()}>Check again</Button>}>
            <ul className="space-y-2">
              {doctor?.map((r) => (
                <li key={r.label} className="flex gap-3 text-[14px]">
                  {r.ok ? <Check className="mt-0.5 size-4 flex-none text-ok" /> : <CircleDashed className="mt-0.5 size-4 flex-none text-ink-3" />}
                  <span>
                    <span className="font-medium">{r.label}</span>
                    {r.detail && <span className="block text-[13px] text-ink-3">{r.detail}</span>}
                  </span>
                </li>
              ))}
              {!doctor && <li className="text-ink-3">Checking…</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
