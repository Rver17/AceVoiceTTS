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
] as const;
contextBridge.exposeInMainWorld(
  "ace",
  Object.fromEntries(
    channels.map((channel) => [
      channel,
      (payload?: unknown) => ipcRenderer.invoke(channel, payload),
    ]),
  ),
);
