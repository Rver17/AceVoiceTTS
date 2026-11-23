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
] as const;
contextBridge.exposeInMainWorld("ace", {
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
