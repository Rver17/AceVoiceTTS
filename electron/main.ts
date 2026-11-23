import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  desktopCapturer,
  globalShortcut,
  dialog,
} from "electron";
import fs from "node:fs/promises";
import { exportCast, mergeCast, preset } from "../core/presets";
import { pronounce } from "../core/dictionary";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  config,
  regions,
  event,
  profile,
  speech,
  name,
} from "../core/contracts";
import { allocate, resolve } from "../core/dialogue";
import {
  startEngine,
  stopEngine,
  status,
  installed,
  synthesize,
  importReference,
} from "./engine";
import { AudioCache, readConfig, writeConfig } from "./store";
import { recognize, closeOCR } from "./ocr";

if (!app.requestSingleInstanceLock()) app.quit();
else
  app.whenReady().then(async () => {
    const root = app.getAppPath(),
      dir = app.getPath("userData");
    const page = pathToFileURL(path.join(root, "dist/index.html")).href;
    const win = new BrowserWindow({
      width: 1150,
      height: 850,
      icon: path.join(root, "dist/acevoice.ico"),
      backgroundColor: "#101820",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    const trusted = (url?: string) => url === page;
    let selected = "";
    const sources = () =>
      desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: { width: 0, height: 0 },
      });
    session.defaultSession.setDisplayMediaRequestHandler(async (req, cb) => {
      const id = selected;
      selected = "";
      try {
        const source =
          id &&
          req.frame === win.webContents.mainFrame &&
          trusted(req.frame.url) &&
          (await sources()).find((s) => s.id === id);
        cb(source ? { video: source } : {});
      } catch {
        cb({});
      }
    });
    session.defaultSession.setPermissionRequestHandler(
      (wc, permission, cb, details) =>
        cb(
          wc === win.webContents &&
            trusted(wc.getURL()) &&
            (permission === "display-capture" ||
              (permission === "media" &&
                "mediaTypes" in details &&
                details.mediaTypes?.length === 1 &&
                details.mediaTypes[0] === "audio")),
        ),
    );
    const cache = new AudioCache(path.join(dir, "audio"));
    function handle<T>(
      channel: string,
      schema: z.ZodType<T>,
      fn: (value: T) => unknown,
    ) {
      ipcMain.handle(channel, (e, payload) => {
        if (!trusted(e.senderFrame?.url) || e.sender !== win.webContents)
          throw Error("Invalid frame");
        return fn(schema.parse(payload));
      });
    }
    const empty = z.undefined();
    handle("status", empty, status);
    handle("retry", empty, () => startEngine(root, dir));
    handle(
      "importVoice",
      z.object({
        name: name.max(32),
        bytes: z.instanceof(Uint8Array).refine((b) => b.length <= 1440044),
      }),
      async (p) => {
        const id = await importReference(p.name, p.bytes);
        const data = readConfig(dir);
        data.personalNames[id] = p.name;
        writeConfig(dir, data);
        return id;
      },
    );
    handle("exportPreset", empty, async () => {
      const dest = await dialog.showSaveDialog(win, {
        defaultPath: "AceVoice cast.json",
        filters: [{ name: "Cast preset", extensions: ["json"] }],
      });
      if (dest.canceled || !dest.filePath) return false;
      await fs.writeFile(
        dest.filePath,
        JSON.stringify(exportCast(readConfig(dir)), null, 2),
      );
      return true;
    });
    handle("importPreset", preset, async (input) => {
      const list = await installed();
      const data = mergeCast(readConfig(dir), input, list);
      writeConfig(dir, data);
      return data;
    });
    const missing: string[] = [];
    for (const [action, key] of Object.entries({
      pause: "P",
      mute: "M",
      replay: "R",
    })) {
      const shortcut = "Control+Alt+" + key;
      if (
        !globalShortcut.register(shortcut, () => {
          if (!win.isDestroyed()) win.webContents.send("hotkey", action);
        })
      )
        missing.push(shortcut);
    }
    handle("shortcutConflicts", empty, () => missing);
    handle("voices", empty, installed);
    handle("settings", empty, () => readConfig(dir));
    handle(
      "preferences",
      config
        .omit({ version: true, calibration: true, cast: true })
        .partial()
        .strict(),
      (patch) => {
        const data = { ...readConfig(dir), ...patch };
        writeConfig(dir, data);
        return data;
      },
    );
    handle("assign", event, async (line) => {
      const voices = await installed(),
        data = readConfig(dir);
      const p = allocate(line.speakerRaw, data.cast, voices);
      if (!data.auto && resolve(line.speakerRaw, data.cast)) {
        return {
          ...p,
          voiceId:
            data.defaultVoice && voices.includes(data.defaultVoice)
              ? data.defaultVoice
              : voices[0],
          speed: 1,
          volume: 1,
        };
      }
      if (p.key !== "narrator" && !data.cast.some((c) => c.key === p.key)) {
        data.cast.push(p);
        writeConfig(dir, data);
      }
      return p;
    });
    handle("edit", profile, async (p) => {
      if (!(await installed()).includes(p.voiceId))
        throw Error("Voice unavailable");
      const data = readConfig(dir);
      data.cast = [
        ...data.cast.filter((c) => c.key !== p.key),
        { ...p, source: "user" },
      ];
      writeConfig(dir, data);
      return data;
    });
    handle("reset", name, (key) => {
      const data = readConfig(dir);
      data.cast = data.cast.filter((p) => p.key !== key);
      writeConfig(dir, data);
      return data;
    });
    handle(
      "calibrate",
      z.object({ key: z.string().max(800), regions }),
      (p) => {
        const data = readConfig(dir);
        data.calibration[p.key] = p.regions;
        writeConfig(dir, data);
        return data;
      },
    );
    handle("audio", speech, (s) =>
      cache.audio(
        speech.parse({
          ...s,
          text: pronounce(s.text, readConfig(dir).pronunciations),
        }),
        synthesize,
      ),
    );
    handle("cache", empty, async () =>
      (await cache.entries()).reduce((n, e) => n + e.size, 0),
    );
    handle("clear", empty, () => cache.clear());
    handle("sources", empty, async () =>
      (await sources()).map((s) => ({ id: s.id, title: s.name })),
    );
    handle(
      "select",
      z.string().regex(/^(window|screen):[\d:-]+$/),
      async (id) => {
        if (!(await sources()).some((s) => s.id === id))
          throw Error("Window closed. Refresh sources.");
        selected = id;
      },
    );
    let busy = false;
    handle(
      "ocr",
      z
        .array(
          z
            .instanceof(Uint8Array)
            .refine((b) => b.length > 0 && b.length <= 16_000_000),
        )
        .length(2),
      async (images) => {
        if (busy) throw Error("Recognition busy");
        busy = true;
        try {
          return await recognize(images, root, dir);
        } finally {
          busy = false;
        }
      },
    );
    startEngine(root, dir);
    await win.loadURL(page);
  });
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  globalShortcut.unregisterAll();
  stopEngine();
  closeOCR();
});
