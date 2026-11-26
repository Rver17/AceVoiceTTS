import { useEffect, useRef, useState, type PointerEvent } from "react";
import { api, type Source, type Regions } from "./api";
import { Recognition } from "./recognition";
import { Stabilizer } from "../core/dialogue";
import { readNameplate } from "../core/nameplate";
import {
  clean,
  type Config,
  type Dialogue,
  type Rect,
} from "../core/contracts";

const initial: Regions = {
  dialogueBox: { x: 0.1, y: 0.73, w: 0.8, h: 0.2 },
  speakerNameBox: { x: 0.08, y: 0.65, w: 0.26, h: 0.08 },
};
type Props = {
  config: Config;
  ready: boolean;
  save: (c: Config) => void;
  emit: (d: Dialogue) => void;
  stop: () => void;
  arm: () => Promise<void>;
  log: (s: string) => void;
};
export function CapturePanel(props: Props) {
  const [sources, setSources] = useState<Source[]>([]),
    [source, setSource] = useState(""),
    [key, setKey] = useState(""),
    [mode, setMode] = useState("No source");
  const [areas, setAreas] = useState(initial),
    [region, setRegion] = useState<keyof Regions>("dialogueBox"),
    [detail, setDetail] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    drag = useRef<{ x: number; y: number } | null>(null);
  const epoch = useRef(0),
    captureId = useRef(0),
    busy = useRef(false),
    latest = useRef(props);
  const retryAt = useRef(0),
    lastError = useRef("");
  latest.current = props;
  useEffect(
    () =>
      api.onHotkey((action) => {
        if (action !== "pause") return;
        if (mode === "Listening") {
          halt();
          setMode("Paused");
        } else if (mode === "Paused" && key && props.ready)
          props
            .arm()
            .then(() => setMode("Listening"))
            .catch(fail);
      }),
    [mode, key, props.ready],
  );
  const stabilizer = useRef(new Stabilizer()),
    recognizer = useRef(new Recognition());
  function halt() {
    epoch.current++;
    retryAt.current = 0;
    lastError.current = "";
    props.stop();
    stabilizer.current.reset();
    recognizer.current = new Recognition();
  }
  function disconnect() {
    captureId.current++;
    halt();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setKey("");
    setMode("No source");
  }
  function fail(e: unknown) {
    props.log(String(e));
    setDetail(String(e));
  }
  useEffect(
    () => () => {
      captureId.current++;
      epoch.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function select() {
    disconnect();
    const generation = captureId.current;
    try {
      await api.select(source);
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      if (generation !== captureId.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      let lastSize = "";
      const update = () => {
        if (stream.current !== s || !v.videoWidth) return;
        const size = v.videoWidth + "x" + v.videoHeight;
        if (size === lastSize) return;
        const firstSize = !lastSize;
        lastSize = size;
        halt();
        const selected = sources.find((i) => i.id === source)!;
        const profileKey = [
          selected.id.split(":")[0],
          selected.title,
          v.videoWidth,
          v.videoHeight,
        ].join("|");
        setKey(profileKey);
        setAreas(
          (old) =>
            latest.current.config.calibration[profileKey] ??
            (firstSize ? initial : old),
        );
        if (firstSize) setMode("Game captured");
        setDetail(firstSize ? "Ready to listen." : "Capture size updated.");
      };
      v.onresize = update;
      s.getVideoTracks()[0].onended = () => {
        if (stream.current === s) {
          disconnect();
          setMode("Capture lost");
          setDetail("Refresh sources and select the window again.");
        }
      };
      await v.play();
      update();
    } catch (e) {
      disconnect();
      setMode("Capture lost");
      fail(e);
    }
  }
  async function observe(test: boolean) {
    if (
      busy.current ||
      !video.current ||
      (!test && Date.now() < retryAt.current)
    )
      return;
    busy.current = true;
    const generation = epoch.current;
    try {
      const observation = await recognizer.current.read(
        video.current,
        props.config.manualRegions ? areas : initial,
        props.config.contrast,
        props.config.manualRegions,
      );
      if (generation !== epoch.current) return;
      lastError.current = "";
      retryAt.current = 0;
      if (!observation) {
        if (!test)
          stabilizer.current.observe(
            "",
            null,
            0,
            Date.now(),
            props.config.stableMs,
            props.config.confidence / 100,
          );
        setDetail(
          test
            ? "No dialogue visible in the capture regions."
            : "Waiting for dialogue · listening continues",
        );
        return;
      }
      const [line, ...names] = observation.reads;
      const name = readNameplate(names, props.config.cast);
      const speaker = name?.name ?? null;
      const info =
        "Text OCR " +
        Math.round(line.confidence * 100) +
        "% · " +
        (observation.kind === "scene-card"
          ? "Scene card · Narrator"
          : name
            ? speaker + " (name OCR " + Math.round(name.confidence * 100) + "%)"
            : "No clear nameplate") +
        " · " +
        clean(line.text);
      setDetail(
        !test && line.text.trim() && line.confidence < 0.4
          ? info + " · waiting for clearer text"
          : info,
      );
      if (test) {
        props.log(info);
        return;
      }
      const d = stabilizer.current.observe(
        line.text,
        speaker,
        line.confidence,
        Date.now(),
        props.config.stableMs,
        props.config.confidence / 100,
        observation.kind,
      );
      if (d) {
        props.log(info);
        props.emit(d);
      }
    } catch (e) {
      if (generation === epoch.current) {
        if (test) {
          fail(e);
          return;
        }
        const message = String(e);
        if (message !== lastError.current) props.log(message);
        lastError.current = message;
        retryAt.current = Date.now() + 1500;
        setDetail("Retrying recognition automatically · " + message);
      }
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    if (mode !== "Listening") return;
    const timer = setInterval(
      () => void observe(false),
      1000 / props.config.fps,
    );
    return () => clearInterval(timer);
  }, [mode, areas, props.config]);
  function point(e: PointerEvent<HTMLDivElement>) {
    const b = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
      y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)),
    };
  }
  function end(e: PointerEvent<HTMLDivElement>) {
    const a = drag.current;
    if (!a) return;
    drag.current = null;
    const b = point(e);
    const r = {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x),
      h: Math.abs(a.y - b.y),
    };
    if (r.w > 0.012 && r.h > 0.012) setAreas({ ...areas, [region]: r });
  }
  return (
    <section>
      <header>
        <h2>Capture setup</h2>
        <output>{mode}</output>
      </header>
      <div className="row">
        <button
          onClick={() =>
            api
              .sources()
              .then((items) => {
                setSources(items);
                if (!items.some((i) => i.id === source))
                  setSource(items[0]?.id ?? "");
              })
              .catch(fail)
          }
        >
          Refresh sources
        </button>
        <select
          aria-label="Window or display"
          value={source}
          onChange={(e) => {
            disconnect();
            setSource(e.target.value);
          }}
        >
          <option value="">Choose a window or display</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <button disabled={!source} onClick={select}>
          Select game window
        </button>
      </div>
      <div
        className="preview"
        onPointerDown={(e) => {
          if (!key || !props.config.manualRegions || mode === "Listening")
            return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = point(e);
        }}
        onPointerUp={end}
      >
        <video ref={video} muted playsInline hidden={!key} />
        {key &&
          props.config.manualRegions &&
          Object.entries(areas).map(([id, r]: [string, Rect]) => (
            <span
              className={"box " + id}
              key={id}
              style={{
                left: r.x * 100 + "%",
                top: r.y * 100 + "%",
                width: r.w * 100 + "%",
                height: r.h * 100 + "%",
              }}
            />
          ))}
      </div>
      {key && (
        <>
          <label>
            Dialogue detection
            <select
              value={props.config.manualRegions ? "manual" : "automatic"}
              onChange={(e) => {
                const manualRegions = e.target.value === "manual";
                api
                  .preferences({ manualRegions })
                  .then((c) => {
                    epoch.current++;
                    recognizer.current = new Recognition();
                    stabilizer.current.reset();
                    props.save(c);
                  })
                  .catch(fail);
              }}
            >
              <option value="automatic">Automatic</option>
              <option value="manual">Manual calibration</option>
            </select>
          </label>
          {props.config.manualRegions && (
            <label>
              Drag on preview to set{" "}
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as keyof Regions)}
              >
                <option value="dialogueBox">Dialogue (teal)</option>
                <option value="speakerNameBox">Nameplate (gold)</option>
              </select>
            </label>
          )}
          <div className="row">
            {props.config.manualRegions && (
              <button
                onClick={() =>
                  api
                    .calibrate({ key, regions: areas })
                    .then(props.save)
                    .catch(fail)
                }
              >
                Save profile
              </button>
            )}
            <button
              onClick={() => observe(true)}
              disabled={mode === "Listening"}
            >
              Test recognition
            </button>
          </div>
        </>
      )}
      <div className="row">
        <button
          className="primary"
          disabled={!key || !props.ready || mode === "Listening"}
          onClick={() =>
            props
              .arm()
              .then(() => setMode("Listening"))
              .catch(fail)
          }
        >
          Start listening
        </button>
        <button
          disabled={mode !== "Listening"}
          onClick={() => {
            halt();
            setMode("Paused");
          }}
        >
          Pause
        </button>
        <button onClick={disconnect}>Stop</button>
      </div>
      <small>{detail}</small>
    </section>
  );
}
