import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  config,
  defaults,
  modelId,
  type Config,
  type Speech,
} from "../core/contracts";
export function readConfig(dir: string): Config {
  const file = path.join(dir, "settings.json");
  if (!fs.existsSync(file)) return structuredClone(defaults);
  return config.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}
export function writeConfig(dir: string, data: Config) {
  const file = path.join(dir, "settings.json");
  fs.writeFileSync(file + ".tmp", JSON.stringify(config.parse(data), null, 2));
  fs.renameSync(file + ".tmp", file);
}
export function cacheKey(s: Speech, model: string = modelId) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        s.text,
        s.voiceId,
        s.speed,
        model,
        s.voiceId.startsWith("b") ? "en-gb" : "en-us",
      ]),
    )
    .digest("hex");
}
export class AudioCache {
  constructor(private dir: string) {}
  async entries() {
    await fsp.mkdir(this.dir, { recursive: true });
    const names = (await fsp.readdir(this.dir)).filter((n) =>
      /^[a-f0-9]{64}\.wav$/.test(n),
    );
    return Promise.all(
      names.map(async (n) => {
        const file = path.join(this.dir, n);
        return { file, ...(await fsp.stat(file)) };
      }),
    );
  }
  async clear() {
    for (const e of await this.entries()) await fsp.rm(e.file, { force: true });
  }
  async audio(s: Speech, create: (s: Speech) => Promise<Buffer>) {
    const file = path.join(this.dir, cacheKey(s) + ".wav");
    try {
      return await fsp.readFile(file);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const audio = await create(s);
    const entries = (await this.entries()).sort(
      (a, b) => a.mtimeMs - b.mtimeMs,
    );
    let bytes = entries.reduce((sum, e) => sum + e.size, audio.length);
    for (const entry of entries) {
      if (bytes <= 256 * 1024 * 1024) break;
      await fsp.rm(entry.file, { force: true });
      bytes -= entry.size;
    }
    const temp = file + "." + randomUUID() + ".tmp";
    try {
      await fsp.writeFile(temp, audio);
      await fsp.rename(temp, file);
    } finally {
      await fsp.rm(temp, { force: true });
    }
    return audio;
  }
}
