import { useEffect, useState } from "react";
import { api } from "./api";
import type { Config } from "../core/contracts";
export function VoiceSettings({
  data,
  save,
  fail,
}: {
  data: Config;
  save: (c: Config) => void;
  fail: (e: unknown) => void;
}) {
  const [word, setWord] = useState(""),
    [spoken, setSpoken] = useState(""),
    [message, setMessage] = useState(""),
    [conflicts, setConflicts] = useState<string[]>([]);
  useEffect(() => {
    void api.shortcutConflicts().then(setConflicts).catch(fail);
  }, []);
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024)
        throw Error("Choose a cast preset under 1 MB.");
      const c = await api.importPreset(JSON.parse(await file.text()));
      save(c);
      setMessage("Cast preset imported.");
    } catch (e) {
      fail(e);
    }
  }
  return (
    <>
      <section>
        <h2>Pronunciation dictionary</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const rows = data.pronunciations.filter(
                (r) => r.word.toLowerCase() !== word.trim().toLowerCase(),
              );
              save(
                await api.preferences({
                  pronunciations: [
                    ...rows,
                    { word: word.trim(), spoken: spoken.trim() },
                  ],
                }),
              );
              setWord("");
              setSpoken("");
            } catch (e) {
              fail(e);
            }
          }}
        >
          <label>
            Written word or phrase
            <input
              maxLength={80}
              required
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
          </label>
          <label>
            Speak it as
            <input
              maxLength={120}
              required
              value={spoken}
              onChange={(e) => setSpoken(e.target.value)}
            />
          </label>
          <button>Save pronunciation</button>
        </form>
        {data.pronunciations.map((r) => (
          <div className="row" key={r.word}>
            <span>
              {r.word} → {r.spoken}
            </span>
            <button
              aria-label={"Remove " + r.word}
              onClick={() =>
                api
                  .preferences({
                    pronunciations: data.pronunciations.filter(
                      (p) => p.word !== r.word,
                    ),
                  })
                  .then(save)
                  .catch(fail)
              }
            >
              Remove
            </button>
          </div>
        ))}
      </section>
      <section>
        <h2>Cast presets</h2>
        <small>
          Export saved assignments, aliases, speeds and volumes. Import replaces
          matching characters. Personal recordings stay on this PC.
        </small>
        <button
          onClick={() =>
            api
              .exportPreset()
              .then((ok) => {
                if (ok) setMessage("Cast preset exported.");
              })
              .catch(fail)
          }
        >
          Export cast
        </button>
        <label>
          Import cast preset
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <small role="status">{message}</small>
      </section>
      <section>
        <h2>In-game shortcuts</h2>
        <p>
          Ctrl + Alt + P · Pause or resume listening
          <br />
          Ctrl + Alt + M · Mute or unmute
          <br />
          Ctrl + Alt + R · Replay the latest line
        </p>
        {conflicts.length > 0 && (
          <small>Already in use: {conflicts.join(", ")}</small>
        )}
      </section>
    </>
  );
}
