import { z } from "zod";
import { profile, type Config } from "./contracts";
export const preset = z
  .object({
    format: z.literal("AceVoice cast"),
    version: z.literal(1),
    cast: z.array(profile).max(2000),
  })
  .strict()
  .refine(
    (p) => new Set(p.cast.map((c) => c.key)).size === p.cast.length,
    "Duplicate character keys",
  );
export function exportCast(data: Config) {
  return preset.parse({ format: "AceVoice cast", version: 1, cast: data.cast });
}
export function mergeCast(
  data: Config,
  input: unknown,
  installed: string[],
): Config {
  const incoming = preset.parse(input);
  for (const p of incoming.cast)
    if (!installed.includes(p.voiceId))
      throw Error(
        "Missing voice for " +
          p.displayName +
          ". Import the same recording with its original name first.",
      );
  const merged = new Map(data.cast.map((p) => [p.key, p]));
  for (const p of incoming.cast) merged.set(p.key, p);
  return { ...data, cast: [...merged.values()] };
}
