// Voices to pick from: the connected ElevenLabs account's voices and the local Kokoro set.
import { loadEnvInto } from "../../core/env.mjs";

export async function listVoices() {
  const kokoro = [
    ["af_heart", "Heart", "American, female, warm"],
    ["af_nova", "Nova", "American, female, bright"],
    ["af_sky", "Sky", "American, female, light"],
    ["am_adam", "Adam", "American, male, deep"],
    ["am_michael", "Michael", "American, male, even"],
    ["bf_emma", "Emma", "British, female"],
    ["bf_isabella", "Isabella", "British, female"],
    ["bm_george", "George", "British, male"],
    ["bm_lewis", "Lewis", "British, male"],
  ].map(([voice_id, name, description]) => ({ voice_id, name, description, provider: "kokoro", category: "local" }));
  const key = loadEnvInto({}).ELEVENLABS_API_KEY;
  if (!key) return { elevenlabs: null, kokoro };
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
  if (!res.ok) return { elevenlabs: { error: `ElevenLabs ${res.status}` }, kokoro };
  const data = await res.json();
  return {
    elevenlabs: data.voices.map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category, // premade | cloned | generated | professional
      labels: v.labels || {},
      description: v.description || "",
      preview_url: v.preview_url || null,
      provider: "elevenlabs",
    })),
    kokoro,
  };
}
