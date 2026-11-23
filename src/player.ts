import { api } from "./api";
import { PlaybackQueue } from "../core/queue";
import type { Config, Dialogue, Profile } from "../core/contracts";
export interface Job {
  line: Dialogue;
  preview?: Profile;
}
export function makePlayer(
  settings: () => Config,
  status: (s: string) => void,
  assigned: (p: Profile, line: Dialogue) => void,
  error: (e: unknown) => void,
  count: (n: number) => void,
) {
  let ctx: AudioContext | undefined, source: AudioBufferSourceNode | undefined;
  let master: GainNode | undefined,
    muted = false;
  const queue = new PlaybackQueue<Job>(
    async ({ line, preview }, current) => {
      const p = preview ?? (await api.assign(line));
      if (!current()) return;
      assigned(p, line);
      status("Synthesizing");
      const wav = await api.audio({
        text: line.text,
        voiceId: p.voiceId,
        speed: p.speed,
      });
      if (!current()) return;
      const audio = await ctx!.decodeAudioData(new Uint8Array(wav).buffer);
      if (!current()) return;
      const output = ctx!.createGain();
      output.gain.value = p.volume * settings().volume;
      const node = ctx!.createBufferSource();
      source = node;
      node.buffer = audio;
      node.connect(output);
      output.connect(master!);
      status("Speaking");
      await new Promise<void>((resolve) => {
        node.onended = () => {
          node.disconnect();
          output.disconnect();
          resolve();
        };
        node.start();
      });
      source = undefined;
      if (current()) status("Idle");
    },
    () => {
      source?.stop();
      status("Idle");
    },
    (e) => {
      status("Idle");
      error(e);
    },
    count,
  );
  return {
    arm: async () => {
      if (!ctx) {
        ctx = new AudioContext();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 1;
        master.connect(ctx.destination);
      }
      await ctx.resume();
    },
    mute: (value: boolean) => {
      muted = value;
      if (master) master.gain.value = value ? 0 : 1;
    },
    queue,
    close: () => {
      queue.stop();
      void ctx?.close();
    },
  };
}
