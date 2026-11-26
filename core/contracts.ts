import { z } from "zod";
import { dictionary } from "./dictionary";
export const referenceModel = "sherpa-onnx-pocket-tts-int8-2026-01-26";

export const modelId = "kokoro-82m-onnx-v1.0";
export const clean = (s: string) =>
  s.normalize("NFKC").replace(/\s+/gu, " ").trim();
export const textSchema = z
  .string()
  .transform(clean)
  .pipe(z.string().min(1).max(1500));
export const voice = z
  .string()
  .regex(/^(?:[ab][mf]_[a-z0-9_]+|ref_[a-z0-9-]{1,32}_[0-9a-f]{24})$/);
export const volume = z.number().min(0).max(1);
export const speed = z.number().min(0.5).max(2);
export const rect = z
  .object({ x: volume, y: volume, w: volume.gt(0), h: volume.gt(0) })
  .refine((r) => r.x + r.w <= 1.000001 && r.y + r.h <= 1.000001);
export type Rect = z.infer<typeof rect>;
export const regions = z.object({ dialogueBox: rect, speakerNameBox: rect });
export const name = z.string().trim().min(1).max(80);
export const profile = z.object({
  key: name,
  displayName: name,
  aliases: z.array(name).max(32),
  voiceId: voice,
  speed,
  volume,
  source: z.enum(["curated", "auto", "user"]),
});
export type Profile = z.infer<typeof profile>;
export const config = z.object({
  version: z.literal(1),
  manualRegions: z.boolean().default(false),
  pronunciations: dictionary.default([]),
  personalNames: z.record(z.string(), name.max(32)).default({}),
  cast: z.array(profile),
  calibration: z.record(z.string(), regions),
  auto: z.boolean(),
  defaultVoice: voice.nullable(),
  queue: z.enum(["latest", "finish"]),
  volume,
  fps: z.number().int().min(2).max(6),
  stableMs: z.number().min(250).max(500),
  confidence: z.number().min(40).max(95),
  contrast: z.number().min(1).max(3),
});
export type Config = z.infer<typeof config>;
export const defaults: Config = {
  version: 1,
  manualRegions: false,
  pronunciations: [],
  personalNames: {},
  cast: [],
  calibration: {},
  auto: true,
  defaultVoice: null,
  queue: "latest",
  volume: 0.85,
  fps: 3,
  stableMs: 450,
  confidence: 75,
  contrast: 1.5,
};
export const event = z.object({
  eventId: z.string().uuid(),
  source: z.enum(["ocr", "simulation", "game-bridge"]),
  observedAt: z.number().int().nonnegative(),
  text: textSchema,
  speakerRaw: name.nullable(),
  speakerKey: name.nullable(),
  sceneKey: z.string().nullable().optional(),
  kind: z.literal("scene-card").optional(),
  confidence: volume,
  isComplete: z.literal(true),
});
export type Dialogue = z.infer<typeof event>;
export const health = z.object({
  status: z.enum(["starting", "downloading", "ready", "error"]),
  device: z.enum(["cpu", "cuda"]).nullable(),
  message: z.string(),
  model: z.literal(modelId),
});
export type Health = z.infer<typeof health>;
export const voiceList = z.array(z.object({ id: voice, language: z.string() }));
export const speech = z.object({ text: textSchema, voiceId: voice, speed });
export type Speech = z.infer<typeof speech>;
