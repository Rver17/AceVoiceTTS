import type { Dialogue, Profile } from "./contracts";

export function episodePrompt(text: string) {
  return /^play\s+["“‘'][^"”’']{1,100}["”’']\s*\?$/i.test(text);
}
export function datedSceneCard(text: string) {
  return /^(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*[,·-]\s*|\s+)(?:\d{1,2}[:.]\d{2}\s*[ap]\.?\s*m\.?|district court|detention center|courtroom)|\d{1,2}:\d{2}\s*[ap]\.?\s*m\.?\s+(?:district court|detention center|courtroom))/i.test(
    text.trim(),
  );
}
export function isNarration(line: Dialogue) {
  return (
    line.kind === "scene-card" ||
    episodePrompt(line.text) ||
    datedSceneCard(line.text) ||
    line.speakerRaw?.toLowerCase() === "narrator"
  );
}
export class MysteryCasting {
  private exchange: string | null = null;
  private voice = "";
  end() {
    this.exchange = null;
  }
  pick(
    line: Dialogue,
    voices: string[],
    cast: Profile[],
    narrator: Profile,
  ): Profile {
    const exchange = line.source + "|" + (line.sceneKey ?? "");
    if (this.exchange !== exchange || !voices.includes(this.voice)) {
      const stock = voices.filter(
        (v) => /^[ab][mf]_/.test(v) && !v.includes("_mix_"),
      );
      const different = stock.filter(
        (v) => v !== this.voice && v !== narrator.voiceId,
      );
      const unused = different.filter(
        (v) => !cast.some((p) => p.voiceId === v),
      );
      const pool = unused.length
        ? unused
        : different.length
          ? different
          : stock;
      if (!pool.length) return narrator;
      this.voice = pool[Math.floor(Math.random() * pool.length)];
      this.exchange = exchange;
    }
    return {
      ...narrator,
      key: "mystery",
      displayName: "Mystery speaker",
      source: "auto",
      voiceId: this.voice,
      speed: 1,
      volume: 1,
      aliases: [],
    };
  }
}
