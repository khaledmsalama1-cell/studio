// Voices to pick from: the account's ElevenLabs voices and the local Kokoro set.
import { loadEnvInto } from "../../core/env.mjs";

export function registerVoices(app) {
  app.get("/api/voices", async (c) => {
    loadEnvInto(process.env);
    const kokoro = ["af_heart", "af_nova", "af_sky", "am_adam", "am_michael", "bf_emma", "bf_isabella", "bm_george", "bm_lewis"].map((id) => ({ voice_id: id, name: id, provider: "kokoro" }));
    if (!process.env.ELEVENLABS_API_KEY) return c.json({ elevenlabs: null, kokoro });
    const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } });
    if (!res.ok) return c.json({ elevenlabs: { error: `ElevenLabs ${res.status}` }, kokoro });
    const data = await res.json();
    return c.json({
      elevenlabs: data.voices.map((v) => ({ voice_id: v.voice_id, name: v.name, category: v.category, labels: v.labels, preview_url: v.preview_url, description: v.description })),
      kokoro,
    });
  });
}
