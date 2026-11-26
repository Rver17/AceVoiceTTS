import { contextBridge, ipcRenderer } from "electron";
const channels = [
  "status",
  "retry",
  "voices",
  "settings",
  "preferences",
  "assign",
  "edit",
  "reset",
  "calibrate",
  "audio",
  "cache",
  "clear",
  "sources",
  "select",
  "ocr",
  "importVoice",
  "exportPreset",
  "importPreset",
  "shortcutConflicts",
  "audioStream",
  "audioCancel",
  "deleteVoice",
] as const;
contextBridge.exposeInMainWorld("ace", {
  onAudio: (fn: (m: unknown) => void) => {
    const listener = (_: unknown, m: unknown) => fn(m);
    ipcRenderer.on("audioChunk", listener);
    return () => ipcRenderer.removeListener("audioChunk", listener);
  },
  onHotkey: (fn: (s: string) => void) => {
    const listener = (_: unknown, s: string) => fn(s);
    ipcRenderer.on("hotkey", listener);
    return () => ipcRenderer.removeListener("hotkey", listener);
  },
  ...Object.fromEntries(
    channels.map((channel) => [
      channel,
      (payload?: unknown) => ipcRenderer.invoke(channel, payload),
    ]),
  ),
});
