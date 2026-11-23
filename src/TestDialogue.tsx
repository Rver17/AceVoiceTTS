import { VoiceOptions } from "./VoiceOptions";
import { useState } from "react";
export function TestDialogue({
  voices,
  ready,
  play,
  stop,
}: {
  voices: string[];
  ready: boolean;
  play: (text: string, name: string, voice: string) => void;
  stop: () => void;
}) {
  const [text, setText] = useState("The witness is ready."),
    [speaker, setSpeaker] = useState("Phoenix"),
    [voice, setVoice] = useState("");
  return (
    <section>
      <h2>Try a voice</h2>
      <label>
        Speaker
        <input
          maxLength={80}
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
        />
      </label>
      <label>
        Voice
        <select value={voice} onChange={(e) => setVoice(e.target.value)}>
          <option value="">Use character assignment</option>
          <VoiceOptions voices={voices} />
        </select>
      </label>
      <label>
        Dialogue
        <textarea
          maxLength={1500}
          value={text}
          rows={3}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="row">
        <button
          disabled={!ready || !text.trim()}
          onClick={() => play(text, speaker, voice)}
        >
          Test Dialogue
        </button>
        <button onClick={stop}>Stop speech</button>
      </div>
    </section>
  );
}
