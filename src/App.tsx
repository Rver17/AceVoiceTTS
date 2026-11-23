import { useEffect, useRef, useState } from "react";
import {
  defaults,
  modelId,
  type Config,
  type Profile,
  type Dialogue,
  type Health,
} from "../core/contracts";
import { api } from "./api";
import { CapturePanel } from "./CapturePanel";
import { Settings } from "./Settings";
import { Voices } from "./Voices";
import { PersonalVoices } from "./PersonalVoices";
import { PersonalVoiceNames } from "./VoicePicker";
import { VoiceSettings } from "./VoiceSettings";
import { Navigation, type Screen } from "./Navigation";
import { TestDialogue } from "./TestDialogue";
import "./court.css";
import { DialogueMonitor, type HistoryLine } from "./DialogueMonitor";
import { makePlayer } from "./player";
function simulation(text: string, speakerRaw: string | null): Dialogue {
  return {
    text,
    speakerRaw,
    source: "simulation",
    eventId: crypto.randomUUID(),
    observedAt: Date.now(),
    speakerKey: null,
    isComplete: true,
    confidence: 1,
  };
}
export function App() {
  const [data, save] = useState<Config>(defaults),
    [health, setHealth] = useState<Health>({
      status: "starting",
      model: modelId,
      device: null,
      message: "Connecting to Kokoro",
    }),
    [voices, setVoices] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]),
    [speech, setSpeech] = useState("Idle"),
    [count, setCount] = useState(0),
    [history, setHistory] = useState<HistoryLine[]>([]),
    [muted, setMuted] = useState(false);
  const [screen, open] = useState<Screen>("Listen"),
    [notice, setNotice] = useState("");
  const dataRef = useRef(data);
  dataRef.current = data;
  const log = (s: string) =>
    setLogs((list) =>
      [new Date().toLocaleTimeString() + "  " + s, ...list].slice(0, 80),
    );
  const fail = (e: unknown) => {
    log(String(e));
    setNotice(String(e));
  };
  const [player] = useState(() =>
    makePlayer(
      () => dataRef.current,
      setSpeech,
      (p, d) => {
        setHistory((list) =>
          [
            { line: d, profile: p },
            ...list.filter((h) => h.line.eventId !== d.eventId),
          ].slice(0, 40),
        );
        void api.settings().then(save).catch(fail);
      },
      fail,
      setCount,
    ),
  );
  useEffect(() => {
    let active = true,
      loaded = false,
      timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const h = await api.status();
        if (!active) return;
        setHealth(h);
        if (h.status === "ready" && !loaded) {
          const list = await api.voices();
          if (active) setVoices(list);
          loaded = true;
        }
        if (h.status !== "ready") {
          loaded = false;
          setVoices([]);
        }
      } catch (e) {
        if (active) fail(e);
      } finally {
        if (active) timer = setTimeout(poll, 1500);
      }
    }
    void poll();
    void api.settings().then(save).catch(fail);
    return () => {
      active = false;
      clearTimeout(timer);
      player.close();
    };
  }, [player]);
  function preview(p: Profile, t: string) {
    void player
      .arm()
      .then(() =>
        player.queue.add(
          { line: simulation(t, p.displayName), preview: p },
          true,
        ),
      )
      .catch(fail);
  }
  const ready = health.status === "ready";
  useEffect(
    () =>
      api.onHotkey((action) => {
        if (action === "mute") {
          player.mute(!muted);
          setMuted(!muted);
        }
        const h = history[0];
        if (action === "replay" && h)
          void player
            .arm()
            .then(() =>
              player.queue.add({ line: h.line, preview: h.profile }, true),
            )
            .catch(fail);
      }),
    [player, muted, history],
  );
  function test(text: string, speaker: string, voice: string) {
    if (voice)
      preview(
        {
          key: "preview",
          displayName: speaker || "Preview",
          voiceId: voice,
          speed: 1,
          volume: 1,
          aliases: [],
          source: "user",
        },
        text,
      );
    else
      void player
        .arm()
        .then(() =>
          player.queue.add(
            { line: simulation(text, speaker.trim() || null) },
            true,
          ),
        )
        .catch(fail);
  }
  return (
    <PersonalVoiceNames.Provider value={data.personalNames}>
      <main>
        <Navigation screen={screen} open={open} health={health} />
        {notice && (
          <p role="alert" className="notice">
            {notice} <button onClick={() => setNotice("")}>Dismiss</button>
          </p>
        )}
        {health.status !== "ready" && (
          <p role="status" className="notice">
            {health.message}{" "}
            {health.status === "error" && (
              <button onClick={() => api.retry().catch(fail)}>
                Retry AI Engine
              </button>
            )}
          </p>
        )}
        <div className="layout" hidden={screen !== "Listen"}>
          <div>
            <DialogueMonitor
              history={history}
              status={speech}
              queued={count}
              muted={muted}
              mute={() => {
                player.mute(!muted);
                setMuted(!muted);
              }}
              replay={(h) =>
                void player
                  .arm()
                  .then(() =>
                    player.queue.add(
                      { line: h.line, preview: h.profile },
                      true,
                    ),
                  )
                  .catch(fail)
              }
            />
            <CapturePanel
              config={data}
              ready={ready}
              save={save}
              emit={(d) =>
                player.queue.add({ line: d }, data.queue === "latest")
              }
              stop={() => player.queue.stop()}
              arm={player.arm}
              log={log}
            />
          </div>
          <aside>
            <TestDialogue
              voices={voices}
              ready={ready}
              play={test}
              stop={() => player.queue.stop()}
            />
          </aside>
        </div>
        {screen === "Voices" && (
          <>
            <PersonalVoices
              refresh={async () => {
                setVoices(await api.voices());
                save(await api.settings());
              }}
              tryVoice={(id) =>
                test(
                  "The court is ready to hear your testimony.",
                  "Personal voice",
                  id,
                )
              }
            />
            <Voices
              cast={data.cast}
              voices={voices}
              save={save}
              preview={preview}
              fail={fail}
            />
          </>
        )}
        {screen === "Settings" && (
          <div className="layout">
            <div>
              <Settings data={data} voices={voices} save={save} fail={fail} />
              <VoiceSettings data={data} save={save} fail={fail} />
            </div>
            <aside>
              <section>
                <h2>Local AI engine</h2>
                <p>{health.message}</p>
                <small>
                  First setup downloads the model. Capture and speech stay on
                  this PC.
                </small>
                <button
                  onClick={() => {
                    player.queue.stop();
                    void api.retry().catch(fail);
                  }}
                >
                  Retry AI Engine
                </button>
              </section>
              <section>
                <h2>Diagnostics</h2>
                <small role="log">
                  {logs.join("\n") || "No events recorded."}
                </small>
              </section>
            </aside>
          </div>
        )}
      </main>
    </PersonalVoiceNames.Provider>
  );
}
