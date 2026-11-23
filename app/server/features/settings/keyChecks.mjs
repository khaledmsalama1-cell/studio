// Checking service keys with the services themselves. Each key goes only to its own service.

/** Per key: resolve { ok, detail } with the account behind the key, or ok: false with what the service said */
const KEY_CHECKS = {
  async ELEVENLABS_API_KEY(v) {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": v }, signal: AbortSignal.timeout(15000) });
    if (r.status === 401) return { ok: false, detail: "ElevenLabs didn't accept this key" };
    if (!r.ok) return { ok: false, detail: `ElevenLabs answered ${r.status}` };
    const s = await r.json();
    const left = s.character_limit != null ? Math.max(0, s.character_limit - (s.character_count || 0)) : null;
    return { ok: true, detail: `${s.tier ? s.tier[0].toUpperCase() + s.tier.slice(1) : "Connected"} plan${left != null ? ` · ${left.toLocaleString("en-US")} characters left this month` : ""}` };
  },
  async APIFY_TOKEN(v) {
    const r = await fetch("https://api.apify.com/v2/users/me", { headers: { Authorization: `Bearer ${v}` }, signal: AbortSignal.timeout(15000) });
    if (r.status === 401) return { ok: false, detail: "Apify didn't accept this token" };
    if (!r.ok) return { ok: false, detail: `Apify answered ${r.status}` };
    const { data } = await r.json();
    return { ok: true, detail: `Signed in as ${data.username}${data.plan?.id ? ` · ${data.plan.id} plan` : ""}` };
  },
  async META_ACCESS_TOKEN(v) {
    const g = (p) => fetch(`https://graph.facebook.com/v21.0/${p}`, { headers: { Authorization: `Bearer ${v}` }, signal: AbortSignal.timeout(15000) });
    const r = await g("me?fields=id,name");
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return { ok: false, detail: e.error?.message || `Meta answered ${r.status}` };
    }
    const me = await r.json();
    // Instagram professional accounts linked to the person's Facebook Pages, so they can pick one instead of typing an ID
    const pages = await g("me/accounts?fields=name,instagram_business_account{id,username}&limit=50").then((x) => (x.ok ? x.json() : { data: [] }));
    const accounts = (pages.data || []).filter((p) => p.instagram_business_account).map((p) => ({ id: p.instagram_business_account.id, username: p.instagram_business_account.username, page: p.name }));
    return { ok: true, detail: `Signed in as ${me.name}`, accounts };
  },
};

export const canCheck = (envKey) => !!KEY_CHECKS[envKey];

/** Check a key; ok: null when the service couldn't be reached at all */
export async function checkKey(envKey, value) {
  try {
    return await KEY_CHECKS[envKey](value);
  } catch (e) {
    return { ok: null, detail: `Couldn't reach the service (${e.name === "TimeoutError" ? "timed out" : "offline?"})` };
  }
}
