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
