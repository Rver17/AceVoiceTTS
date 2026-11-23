import type {
  Config,
  Dialogue,
  Profile,
  Speech,
  Health,
} from "../core/contracts";
export type Regions = Config["calibration"][string];
export interface Source {
  id: string;
  title: string;
}
export interface Readout {
  text: string;
  confidence: number;
}
interface API {
  importVoice(p: { name: string; bytes: Uint8Array }): Promise<string>;
  exportPreset(): Promise<boolean>;
  importPreset(p: unknown): Promise<Config>;
  shortcutConflicts(): Promise<string[]>;
  onHotkey(fn: (action: string) => void): () => void;
  settings(): Promise<Config>;
  preferences(
    p: Partial<Omit<Config, "cast" | "version" | "calibration">>,
  ): Promise<Config>;
  status(): Promise<Health>;
  retry(): Promise<void>;
  voices(): Promise<string[]>;
  assign(d: Dialogue): Promise<Profile>;
  edit(p: Profile): Promise<Config>;
  reset(key: string): Promise<Config>;
  calibrate(p: { key: string; regions: Regions }): Promise<Config>;
  cache(): Promise<number>;
  clear(): Promise<void>;
  audio(s: Speech): Promise<Uint8Array>;
  sources(): Promise<Source[]>;
  select(id: string): Promise<void>;
  ocr(images: Uint8Array[]): Promise<Readout[]>;
}
declare global {
  interface Window {
    ace: API;
  }
}
export const api = window.ace;
