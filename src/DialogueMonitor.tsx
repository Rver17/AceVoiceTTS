import type { Dialogue, Profile } from "../core/contracts";
export interface HistoryLine {
  line: Dialogue;
  profile: Profile;
}
type Props = {
  history: HistoryLine[];
  status: string;
  queued: number;
  muted: boolean;
  mute: () => void;
  replay: (entry: HistoryLine) => void;
};
export function DialogueMonitor({
  history,
  status,
  queued,
  muted,
  mute,
  replay,
}: Props) {
  const latest = history[0];
  return (
    <section className="monitor">
      <header>
        <h2>Dialogue monitor</h2>
        <output>
          {status} · {queued} queued
        </output>
      </header>
      <strong>
        {latest
          ? (latest.profile.key === "narrator"
              ? "Narrator"
              : latest.line.speakerRaw || latest.profile.displayName) +
            " · " +
            latest.profile.voiceId
          : "Waiting for dialogue"}
      </strong>
      <blockquote>
        {latest?.line.text || "Select a game window or test a line to begin."}
      </blockquote>
      <div className="row">
        <button disabled={!latest} onClick={() => latest && replay(latest)}>
          Replay line
        </button>
        <button aria-pressed={muted} onClick={mute}>
          {muted ? "Unmute speech" : "Mute speech"}
        </button>
      </div>
      {history.length > 1 && (
        <details>
          <summary>Recent dialogue ({history.length})</summary>
          <ol className="history">
            {history.map((h) => (
              <li key={h.line.eventId}>
                <div>
                  <b>
                    {h.profile.key === "narrator"
                      ? "Narrator"
                      : h.line.speakerRaw || h.profile.displayName}
                  </b>
                  <p>{h.line.text}</p>
                </div>
                <button
                  onClick={() => replay(h)}
                  aria-label={"Replay " + h.line.text}
                >
                  Replay
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
