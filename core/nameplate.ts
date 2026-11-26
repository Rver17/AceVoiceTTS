import { clean, type Profile } from "./contracts";
import { resolve } from "./dialogue";

export function readNameplate(
  reads: { text: string; confidence: number }[],
  cast: Profile[],
) {
  let best: { name: string; score: number; confidence: number } | null = null;
  for (const read of reads) {
    const label = clean(read.text)
      .replace(/^[\s|()[\]{}:;_«»]+|[\s|()[\]{}:;_«»]+$/g, "")
      .trim();
    const identity = resolve(label, cast);
    if (!identity || label.length < 2) continue;
    const known = Boolean(identity.preset || identity.existing);
    if (read.confidence < (known ? 0.35 : 0.65)) continue;
    const score = read.confidence + (known ? 1 : 0);
    if (!best || score > best.score)
      best = { name: label, score, confidence: read.confidence };
  }
  return best;
}
