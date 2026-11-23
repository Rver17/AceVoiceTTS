import { useState } from "react";
import { casting } from "../core/cast";
import { allocate } from "../core/dialogue";
import { api } from "./api";
import { VoiceOptions } from "./VoiceOptions";
import type { Config, Profile } from "../core/contracts";

type Props = {
  cast: Profile[];
  voices: string[];
  save: (c: Config) => void;
  preview: (p: Profile, text: string) => void;
  fail: (e: unknown) => void;
};

function CharacterEditor({
  profile,
  voices,
  save,
  preview,
  fail,
}: { profile: Profile } & Omit<Props, "cast">) {
  const [draft, setDraft] = useState(profile),
    [aliases, setAliases] = useState(profile.aliases.join(", "));
  const [sample, setSample] = useState(
    profile.key === "narrator"
      ? 'Play "The First Turnabout"?'
      : "Your Honor, may I ask the witness one more question?",
  );
  const direction =
    profile.key === "narrator"
      ? "A mature female reading for prompts and dialogue without a named speaker."
      : casting.find((c) => c.display === profile.displayName)?.direction;
  return (
    <section>
      <header>
        <h2>{profile.displayName}</h2>
        <output>
          {profile.source === "user" ? "Custom voice" : "Automatic casting"}
        </output>
      </header>
      {direction && <p>{direction}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          api
            .edit({
              ...draft,
              aliases: aliases
                .split(",")
                .map((a) => a.trim())
                .filter(Boolean),
            })
            .then(save)
            .catch(fail);
        }}
      >
        <label>
          Assigned voice
          <select
            value={draft.voiceId}
            onChange={(e) => setDraft({ ...draft, voiceId: e.target.value })}
          >
            <VoiceOptions voices={voices} />
          </select>
        </label>
        <div className="row">
          <label>
            Speaking speed · {draft.speed.toFixed(2)}×
            <input
              type="range"
              min=".5"
              max="2"
              step=".01"
              value={draft.speed}
              onChange={(e) =>
                setDraft({ ...draft, speed: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Character volume · {Math.round(draft.volume * 100)}%
            <input
              type="range"
              min="0"
              max="1"
              step=".01"
              value={draft.volume}
              onChange={(e) =>
                setDraft({ ...draft, volume: Number(e.target.value) })
              }
            />
          </label>
        </div>
        {profile.key !== "narrator" && (
          <label>
            Recognized aliases, comma-separated
            <input
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
            />
          </label>
        )}
        <label>
          Preview text
          <textarea
            maxLength={1500}
            value={sample}
            onChange={(e) => setSample(e.target.value)}
          />
        </label>
        <div className="row">
          <button
            type="button"
            disabled={!sample.trim()}
            onClick={() => preview(draft, sample)}
          >
            Preview voice
          </button>
          <button className="primary">Save voice</button>
          <button
            type="button"
            onClick={() => api.reset(profile.key).then(save).catch(fail)}
          >
            Reset to auto
          </button>
        </div>
      </form>
    </section>
  );
}
export function Voices(props: Props) {
  const { cast, voices } = props;
  const [filter, search] = useState(""),
    [selected, select] = useState("Phoenix Wright");
  const names = [
    ...new Set([
      "Narrator",
      ...casting.map((c) => c.display),
      ...cast.map((p) => p.displayName),
    ]),
  ];
  const found = names.filter((n) =>
    n.toLowerCase().includes(filter.toLowerCase()),
  );
  const active = found.includes(selected) ? selected : found[0];
  const profile =
    active && voices.length ? allocate(active, cast, voices) : null;
  return (
    <div className="voice-layout">
      <section>
        <h2>Cast register</h2>
        <label>
          Find character
          <input
            type="search"
            value={filter}
            onChange={(e) => search(e.target.value)}
          />
        </label>
        <div className="cast-list">
          {found.map((n) => (
            <button
              key={n}
              aria-pressed={n === active}
              onClick={() => select(n)}
            >
              {n}
            </button>
          ))}
        </div>
        {!found.length && <p>No matching characters.</p>}
      </section>
      <div>
        {profile && (
          <CharacterEditor
            key={JSON.stringify(profile)}
            profile={profile}
            {...props}
          />
        )}
        <small>
          {voices.filter((v) => !v.includes("_mix_")).length} stock voices ·{" "}
          {voices.filter((v) => v.includes("_mix_")).length} two-voice blends.
          New named characters receive an unused voice while one is available.
        </small>
      </div>
    </div>
  );
}
