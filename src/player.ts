import { api, type AudioMessage } from "./api";
import { PlaybackQueue } from "../core/queue";
import type { Config, Dialogue, Profile } from "../core/contracts";
export interface Job {
  line: Dialogue;
  preview?: Profile;
}
interface Prep {
  p: Profile;
  id: string;
  buffered: AudioMessage[];
  started?: Promise<Uint8Array | null>;
}
export function makePlayer(
  settings: () => Config,
  status: (s: string) => void,
  assigned: (p: Profile, line: Dialogue) => void,
  error: (e: unknown) => void,
  count: (n: number) => void,
) {
  let ctx: AudioContext | undefined;
  let master: GainNode | undefined,
    muted = false;
  const sources = new Set<AudioBufferSourceNode>(),
    streams = new Map<string, (m: AudioMessage) => void>(),
    prepared = new WeakMap<Job, Promise<Prep>>(),
    unused = new Set<string>();
  let release: (() => void) | undefined,
    activeId = "";
  const unlisten = api.onAudio((m) => streams.get(m.id)?.(m));
  // Assign the voice and start synthesizing as soon as a line is queued, so the
  // next sentence is ready (or nearly) when the current one finishes.
  async function prepare(job: Job): Promise<Prep> {
    const p = job.preview ?? (await api.assign(job.line));
    const prep: Prep = { p, id: crypto.randomUUID(), buffered: [] };
    if (settings().playback !== "complete") {
      streams.set(prep.id, (m) => prep.buffered.push(m));
      unused.add(prep.id);
      prep.started = api.audioStream({
        id: prep.id,
        speech: { text: job.line.text, voiceId: p.voiceId, speed: p.speed },
      });
      prep.started.catch(() => undefined);
    }
    return prep;
  }
  function discard() {
    for (const id of unused) {
      streams.delete(id);
      void api.audioCancel(id).catch(() => undefined);
    }
    unused.clear();
  }
  const queue = new PlaybackQueue<Job>(
    async (job, current) => {
      const { line } = job;
      let ready = prepared.get(job);
      if (!ready) ready = prepare(job);
      const prep = await ready;
      const { p, id } = prep;
      unused.delete(id);
      if (!current()) {
        streams.delete(id);
        void api.audioCancel(id).catch(() => undefined);
        return;
      }
      assigned(p, line);
      status("Synthesizing");
      const output = ctx!.createGain();
      output.gain.value = p.volume * settings().volume;
      output.connect(master!);
      let endAt = 0,
        scheduled = 0,
        ended = 0,
        finished = false,
        speaking = false;
      let finish!: () => void, fail!: (e: unknown) => void;
      const over = new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
      const check = () => {
        if (finished && ended === scheduled) finish();
      };
      const play = (audio: AudioBuffer) => {
        const node = ctx!.createBufferSource();
        node.buffer = audio;
        node.connect(output);
        sources.add(node);
        scheduled++;
        node.onended = () => {
          node.disconnect();
          sources.delete(node);
          ended++;
          check();
        };
        const at = Math.max(endAt, ctx!.currentTime + 0.03);
        node.start(at);
        endAt = at + audio.duration;
        if (!speaking) {
          speaking = true;
          status("Speaking");
        }
      };
      release = finish;
      activeId = id;
      const handle = (m: AudioMessage) => {
        if (!current()) return;
        if (m.error) return fail(Error(m.error));
        if (m.pcm && m.rate) {
          const pcm = new Int16Array(
            m.pcm.buffer.slice(
              m.pcm.byteOffset,
              m.pcm.byteOffset + m.pcm.byteLength - (m.pcm.byteLength % 2),
            ),
          );
          const audio = ctx!.createBuffer(1, pcm.length, m.rate);
          const data = audio.getChannelData(0);
          for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 32768;
          play(audio);
        }
        if (m.done) {
          finished = true;
          check();
        }
      };
      streams.set(id, handle);
      try {
        if (!prep.started) {
          const wav = await api.audio({
            text: line.text,
            voiceId: p.voiceId,
            speed: p.speed,
          });
          if (current())
            play(await ctx!.decodeAudioData(new Uint8Array(wav).buffer));
          finished = true;
          check();
          if (!current()) return;
          await over;
          if (current()) status("Idle");
          return;
        }
        prep.buffered.splice(0).forEach(handle);
        const cached = await prep.started;
        if (cached) {
          if (current())
            play(await ctx!.decodeAudioData(new Uint8Array(cached).buffer));
          finished = true;
          check();
        }
        if (!current()) {
          void api.audioCancel(id);
          return;
        }
        await over;
      } finally {
        streams.delete(id);
        output.disconnect();
        if (activeId === id) {
          activeId = "";
          release = undefined;
        }
      }
      if (current()) status("Idle");
    },
    () => {
      discard();
      if (activeId) void api.audioCancel(activeId).catch(() => undefined);
      release?.();
      sources.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      });
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
    queue: {
      add: (job: Job, latest: boolean) => {
        if (latest) queue.stop();
        const ready = prepare(job);
        ready.catch(() => undefined);
        prepared.set(job, ready);
        queue.add(job, false);
      },
      stop: () => queue.stop(),
    },
    close: () => {
      queue.stop();
      unlisten();
      void ctx?.close();
    },
  };
}
