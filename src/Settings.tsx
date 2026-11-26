import { VoicePicker } from "./VoicePicker";
import { useState } from "react";
import { api } from "./api";
import type { Config } from "../core/contracts";
export function Settings({
  data,
  voices,
  save,
  fail,
}: {
  data: Config;
  voices: string[];
  save: (c: Config) => void;
  fail: (e: unknown) => void;
}) {
  const [size, setSize] = useState("");
  const patch = (p: Partial<Config>) =>
    api.preferences(p).then(save).catch(fail);
  return (
    <section>
      <h2>Listening settings</h2>
      <label>
        <input
          type="checkbox"
          checked={data.auto}
          onChange={(e) => patch({ auto: e.target.checked })}
        />{" "}
        Auto-assign character voices
      </label>
      <label>
        <input
          type="checkbox"
          checked={data.progressive}
          onChange={(e) => patch({ progressive: e.target.checked })}
        />{" "}
        Speak sentences while the text is still typing
      </label>
      <VoicePicker
        label="Default voice"
        voices={voices}
        value={data.defaultVoice ?? ""}
        onChange={(v) => patch({ defaultVoice: v || null })}
        automatic="First available"
      />
      <label>
        On new dialogue
        <select
          value={data.queue}
          onChange={(e) => patch({ queue: e.target.value as Config["queue"] })}
        >
          <option value="latest">Stop old and speak latest</option>
          <option value="finish">Finish current · FIFO</option>
        </select>
      </label>
      <label>
        Playback mode
        <select
          value={data.playback}
          onChange={(e) =>
            patch({ playback: e.target.value as Config["playback"] })
          }
        >
          <option value="stream">Play while generating (fastest)</option>
          <option value="complete">Wait for full speech (smoothest)</option>
        </select>
      </label>
      {(
        [
          ["volume", "Output volume", 0, 1, 0.05],
          ["fps", "Frames per second", 2, 6, 1],
          ["stableMs", "Stable text (ms)", 250, 500, 25],
          ["confidence", "Confidence for faster narration (%)", 40, 95, 1],
          ["contrast", "OCR contrast", 1, 3, 0.1],
        ] as const
      ).map(([k, label, min, max, step]) => (
        <label key={k}>
          {label} · {data[k]}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={data[k]}
            onChange={(e) => patch({ [k]: Number(e.target.value) })}
          />
        </label>
      ))}
      <div className="row">
        <button
          onClick={() =>
            api
              .cache()
              .then((n) => setSize((n / 1048576).toFixed(1) + " MB"))
              .catch(fail)
          }
        >
          Cache usage
        </button>
        <button
          onClick={() =>
            api
              .clear()
              .then(() => setSize("0 MB"))
              .catch(fail)
          }
        >
          Clear cache
        </button>
        {size}
      </div>
    </section>
  );
}
