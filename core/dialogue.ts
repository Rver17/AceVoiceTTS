import { clean, type Profile, type Dialogue } from "./contracts";

import { casting } from "./cast";
const keyOf = (name: string) => clean(name).toLowerCase();
export function resolve(raw: string | null, cast: Profile[]) {
  const label = clean(raw ?? "");
  if (
    !label ||
    /^(unknown|unnamed|narrator|yes|no|confirm|cancel)$/i.test(label) ||
    !/^[\p{L}][\p{L}\p{M} .'’-]{0,79}$/u.test(label)
  )
    return null;
  const key = keyOf(label);
  const existing = cast.find((p) =>
    [p.displayName, p.key, ...p.aliases].some((a) => keyOf(a) === key),
  );
  const preset = casting.find(({ display, aliases }) =>
    [display, ...aliases].some((a) => keyOf(a) === key),
  );
  return {
    existing,
    preset,
    display: existing?.displayName ?? preset?.display ?? label,
  };
}
export function allocate(
  raw: string | null,
  cast: Profile[],
  voices: string[],
  fallback?: string | null,
): Profile {
  if (!voices.length) throw Error("Set up AI voices first.");
  const identity = resolve(raw, cast);
  const temporary: Profile = {
    key: "narrator",
    displayName: "Narrator",
    aliases: [],
    voiceId:
      [fallback, "bf_isabella", "af_sarah", "af_bella"].find(
        (v): v is string => !!v && voices.includes(v),
      ) ?? voices[0],
    speed: 0.94,
    volume: 1,
    source: "auto",
  };
  if (!identity)
    return (
      cast.find((p) => p.key === "narrator" && voices.includes(p.voiceId)) ??
      temporary
    );
  const { existing, preset, display } = identity;
  if (existing && voices.includes(existing.voiceId)) return existing;
  const key = keyOf(display);
  const unused = voices.filter((v) => !cast.some((p) => p.voiceId === v));
  const unreserved = unused.filter((v) => !casting.some((c) => c.voice === v));
  const eligible = unreserved.length
    ? unreserved
    : unused.length
      ? unused
      : voices;
  const stock = eligible.filter((v) => !v.includes("_mix_"));
  const pool = (stock.length ? stock : eligible).slice().sort();
  let hash = 0;
  for (const ch of key) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  const preferred = preset?.voice;
  const voiceId =
    preferred && unused.includes(preferred)
      ? preferred
      : pool[hash % pool.length];
  return {
    ...temporary,
    key,
    displayName: display,
    aliases: preset?.aliases ?? [],
    speed: preset?.speed ?? 1,
    voiceId,
    source: preset ? "curated" : "auto",
  };
}
export class Stabilizer {
  private candidate = "";
  private since = 0;
  private spoken = "";
  private blanks = 0;
  reset() {
    this.candidate = this.spoken = "";
    this.blanks = 0;
  }
  observe(
    raw: string,
    speaker: string | null,
    confidence: number,
    now: number,
    delay: number,
    threshold: number,
  ): Dialogue | null {
    const text = clean(raw);
    if (!text) {
      if (++this.blanks >= 2) this.reset();
      this.candidate = "";
      return null;
    }
    this.blanks = 0;
    if (
      confidence < threshold ||
      !/[a-z]{2}/i.test(text) ||
      /^(court record|options|save game|load game|present|profiles|evidence)$/i.test(
        text,
      )
    ) {
      this.candidate = "";
      return null;
    }
    // Episode prompts sometimes place a choice button inside the name crop.
    if (
      /^play\s+["“‘'][^"”’']{1,100}["”’']\s*\?$/i.test(text) ||
      !resolve(speaker, [])
    )
      speaker = null;
    const id = JSON.stringify([keyOf(speaker ?? ""), text]);
    if (id !== this.candidate) {
      this.candidate = id;
      this.since = now;
      return null;
    }
    if (now - this.since < delay || id === this.spoken) return null;
    this.spoken = id;
    return {
      eventId: crypto.randomUUID(),
      source: "ocr",
      observedAt: now,
      text,
      speakerRaw: speaker,
      speakerKey: resolve(speaker, [])?.display.toLowerCase() ?? null,
      confidence,
      isComplete: true,
    };
  }
}
