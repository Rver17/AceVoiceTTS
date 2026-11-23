import { author } from "../package.json";
import type { Health } from "../core/contracts";
export const screens = ["Listen", "Voices", "Settings"] as const;
export type Screen = (typeof screens)[number];
export function Navigation({
  screen,
  open,
  health,
}: {
  screen: Screen;
  open: (s: Screen) => void;
  health: Health;
}) {
  return (
    <>
      <header className="masthead">
        <div className="brand">
          <img className="court-badge" alt="" src="./acevoice.svg" />
          <div>
            <h1>AceVoice</h1>
            <p>Phoenix Wright: Ace Attorney Trilogy · Developed by {author}</p>
          </div>
        </div>
        <button
          className="engine-state"
          onClick={() => open("Settings")}
          aria-label={"Engine settings, " + health.status}
        >
          <i data-ready={health.status === "ready"} />
          Kokoro · {health.status} {health.device?.toUpperCase()}
        </button>
      </header>
      <nav aria-label="Main navigation">
        {screens.map((s) => (
          <button
            key={s}
            aria-current={screen === s ? "page" : undefined}
            onClick={() => open(s)}
          >
            {s}
          </button>
        ))}
      </nav>
    </>
  );
}
