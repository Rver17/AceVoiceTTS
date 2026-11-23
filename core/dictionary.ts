import { z } from "zod";
export const dictionary = z
  .array(
    z.object({
      word: z.string().trim().min(1).max(80),
      spoken: z.string().trim().min(1).max(120),
    }),
  )
  .max(200)
  .refine(
    (rows) =>
      new Set(rows.map((r) => r.word.toLowerCase())).size === rows.length,
    "Duplicate pronunciation",
  );
export type Dictionary = z.infer<typeof dictionary>;
export function pronounce(text: string, entries: Dictionary) {
  if (!entries.length) return text;
  const lookup = new Map(entries.map((e) => [e.word.toLowerCase(), e.spoken]));
  const escaped = Array.from(lookup.keys())
    .sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return text.replace(
    new RegExp(
      "(?<![\\p{L}\\p{N}])(?:" + escaped.join("|") + ")(?![\\p{L}\\p{N}])",
      "giu",
    ),
    (match) => lookup.get(match.toLowerCase()) ?? match,
  );
}
