import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  health,
  modelId,
  referenceModel,
  voice,
  voiceList,
  type Speech,
  type Health,
} from "../core/contracts";
const port = Number(process.env.ACEVOICE_PORT || 8766);
let child: ChildProcess | undefined;
let token = "";
let failure = "";
export function stopEngine() {
  const old = child;
  child = undefined;
  if (!old?.pid || old.exitCode !== null) return;
  if (process.platform === "win32")
    spawnSync("taskkill.exe", ["/PID", String(old.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
      timeout: 5000,
    });
  else old.kill();
}
export function startEngine(root: string, dir: string) {
  stopEngine();
  failure = "";
  token = randomBytes(24).toString("hex");
  const cwd = path.join(root, "services", "tts");
  const bundled = path.join(cwd, "runtime/python.exe");
  const python =
    process.env.ACEVOICE_PYTHON ||
    (existsSync(bundled)
      ? bundled
      : path.join(
          cwd,
          ".venv",
          process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
        ));
  const current = spawn(
    python,
    ["server.py", String(port), String(process.pid)],
    {
      cwd,
      env: {
        ...process.env,
        ACEVOICE_TOKEN: token,
        ACEVOICE_REFERENCES: path.join(dir, "personal-voices"),
      },
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  child = current;
  let stderr = "";
  current.stderr?.on("data", (b) => {
    stderr = (stderr + b).slice(-1200);
  });
  current.on("error", (e) => {
    if (current === child)
      failure =
        e.message +
        " · Install the Python environment in services/tts and retry.";
  });
  current.on("exit", () => {
    if (current === child)
      failure = stderr || "Kokoro stopped. Retry AI Engine.";
  });
}
async function api(route: string, body?: unknown) {
  const res = await fetch("http://127.0.0.1:" + port + route, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(
      route === "/v1/reference" ? 600000 : body ? 180000 : 3000,
    ),
  });
  if (!res.ok)
    throw Error(
      "Kokoro " + res.status + " " + (await res.text()).slice(0, 400),
    );
  return res;
}
export async function status(): Promise<Health> {
  const base = { model: modelId, device: null } as const;
  if (failure) return { ...base, status: "error", message: failure };
  try {
    return health.parse(await (await api("/health")).json());
  } catch (e) {
    return {
      ...base,
      status: "starting",
      message: "Connecting to local Kokoro",
    };
  }
}
export async function installed() {
  return voiceList
    .parse(await (await api("/v1/voices")).json())
    .map((v) => v.id);
}
export async function synthesize(s: Speech) {
  return Buffer.from(
    await (
      await api("/v1/synthesize", {
        ...s,
        modelId: s.voiceId.startsWith("ref_") ? referenceModel : modelId,
        requestId: crypto.randomUUID(),
      })
    ).arrayBuffer(),
  );
}
export async function importReference(name: string, bytes: Uint8Array) {
  const res = await api("/v1/reference", {
    name,
    wav: Buffer.from(bytes).toString("base64"),
  });
  return voice.parse((await res.json()).id);
}
export async function deleteReference(id: string) {
  const res = await fetch(
    "http://127.0.0.1:" + port + "/v1/reference/" + voice.parse(id),
    {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok && res.status !== 404)
    throw Error(
      "Kokoro " + res.status + " " + (await res.text()).slice(0, 400),
    );
}
/** Streams 16-bit mono PCM chunks as the engine produces them. */
export async function streamSynthesize(
  s: Speech,
  onChunk: (rate: number, pcm: Buffer) => void,
  signal: AbortSignal,
) {
  const res = await fetch("http://127.0.0.1:" + port + "/v1/synthesize/stream", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...s,
      modelId: s.voiceId.startsWith("ref_") ? referenceModel : modelId,
      requestId: crypto.randomUUID(),
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
  });
  if (!res.ok || !res.body)
    throw Error(
      "Kokoro " + res.status + " " + (await res.text()).slice(0, 400),
    );
  let rate = 0,
    carry = Buffer.alloc(0);
  for await (const part of res.body as unknown as AsyncIterable<Uint8Array>) {
    let buf = Buffer.concat([carry, part]);
    if (!rate) {
      if (buf.length < 4) {
        carry = buf;
        continue;
      }
      rate = buf.readUInt32LE(0);
      buf = buf.subarray(4);
    }
    const usable = buf.length - (buf.length % 2);
    carry = Buffer.from(buf.subarray(usable));
    if (usable) onChunk(rate, Buffer.from(buf.subarray(0, usable)));
  }
  if (!rate) throw Error("Kokoro returned no audio");
}
export function wavFile(rate: number, pcm: Buffer) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

