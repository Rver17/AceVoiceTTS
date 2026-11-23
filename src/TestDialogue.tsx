import { VoicePicker } from "./VoicePicker";
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
      <VoicePicker
        label="Voice"
        voices={voices}
        value={voice}
        onChange={setVoice}
        automatic="Use character assignment"
      />
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
