import { clean, type Profile } from "./contracts";
import { casting } from "./cast";
import { resolve } from "./dialogue";

function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        row[j] + 1,
        next[j - 1] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}
// Small plate lettering is often misread by a character or two ("Phoentx").
// Snap such reads to the nearest known name or alias.
function nearest(label: string, cast: Profile[]) {
  const text = label.toLowerCase();
  if (text.length < 4 || /\s{2,}/.test(label)) return null;
  const names = [
    ...casting.flatMap((c) => [c.display, ...c.aliases]),
    ...cast.flatMap((p) => [p.displayName, ...p.aliases]),
  ];
  let best: { name: string; d: number } | null = null;
  for (const name of names) {
    const target = name.toLowerCase();
    const limit = target.length >= 7 ? 2 : target.length >= 5 ? 1 : 0;
    if (!limit || Math.abs(target.length - text.length) > limit) continue;
    const d = distance(text, target);
    if (d <= limit && (!best || d < best.d)) best = { name, d };
  }
  return best?.name ?? null;
}

export function readNameplate(
  reads: { text: string; confidence: number }[],
  cast: Profile[],
) {
  let best: { name: string; score: number; confidence: number } | null = null;
  for (const read of reads) {
    let label = clean(read.text)
      .replace(/^[\s|()[\]{}:;_«»]+|[\s|()[\]{}:;_«»]+$/g, "")
      .trim();
    let identity = resolve(label, cast);
    if (label.length < 2) continue;
    if (!identity?.preset && !identity?.existing) {
      const snapped = nearest(label.replace(/[^\p{L} .'’-]/gu, ""), cast);
      if (snapped && read.confidence >= 0.2) {
        label = snapped;
        identity = resolve(label, cast);
      }
    }
    if (!identity) continue;
    const known = Boolean(identity.preset || identity.existing);
    if (read.confidence < (known ? 0.2 : 0.65)) continue;
    const score = read.confidence + (known ? 1 : 0);
    if (!best || score > best.score)
      best = { name: label, score, confidence: read.confidence };
  }
  return best;
}
