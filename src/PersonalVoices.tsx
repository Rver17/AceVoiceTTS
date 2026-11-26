import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { prepareAudio } from "./referenceAudio";
export function PersonalVoices({
  refresh,
  tryVoice,
  mine,
  names,
}: {
  refresh: () => Promise<void>;
  tryVoice: (id: string) => void;
  mine: string[];
  names: Record<string, string>;
}) {
  const [name, setName] = useState(""),
    [clip, setClip] = useState<Blob | null>(null),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [added, setAdded] = useState("");
  const recorder = useRef<MediaRecorder | null>(null),
    active = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    pending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function record() {
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
      return;
    }
    if (pending.current) return;
    pending.current = true;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      if (!active.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mic = new MediaRecorder(stream),
        chunks: BlobPart[] = [];
      recorder.current = mic;
      mic.ondataavailable = (e) => chunks.push(e.data);
      mic.onstop = () => {
        clearTimeout(timer.current);
        mic.stream.getTracks().forEach((t) => t.stop());
        if (active.current) {
          setRecording(false);
          setClip(new Blob(chunks, { type: mic.mimeType }));
          setInfo("Recording ready to import.");
        }
      };
      mic.start();
      setAdded("");
      setRecording(true);
      setInfo("Recording…");
      timer.current = setTimeout(() => {
        if (mic.state === "recording") mic.stop();
      }, 29500);
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      setInfo(String(e));
    } finally {
      pending.current = false;
    }
  }
  async function add() {
    if (!clip) return;
    setBusy(true);
    setInfo(
      "Preparing personal voice. First use downloads the English reference model…",
    );
    try {
      const bytes = await prepareAudio(clip);
      const id = await api.importVoice({ name: name.trim(), bytes });
      await refresh();
      setAdded(id);
      setInfo(
        "Voice saved. Choose it under Personal voices in a character’s Assigned voice menu.",
      );
    } catch (e) {
      setInfo(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Personal voices</h2>
      <p>
        Import 3–30 seconds of clear speech from one speaker, or record your
        own. Audio stays on this PC.
      </p>
      <label>
        Voice name
        <input
          maxLength={32}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
      </label>
      <label>
        Reference recording
        <input
          aria-label="Reference recording"
          type="file"
          accept="audio/*"
          disabled={busy || recording}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setClip(f ?? null);
            setAdded("");
            if (f && !name)
              setName(f.name.replace(/\.[^.]+$/, "").slice(0, 32));
            setInfo("");
          }}
        />
      </label>
      <div className="row">
        <button disabled={busy} onClick={record}>
          {recording ? "Stop recording" : "Record microphone"}
        </button>
        <button
          className="primary"
          disabled={busy || recording || !clip || !name.trim()}
          onClick={add}
        >
          Import voice
        </button>
        {added && (
          <button onClick={() => tryVoice(added)}>
            Preview imported voice
          </button>
        )}
      </div>
      {mine.length > 0 && (
        <div>
          <h3>Your custom voices</h3>
          {mine.map((id) => (
            <div className="row" key={id}>
              <span>{names[id] ?? id}</span>
              <button onClick={() => tryVoice(id)}>Preview</button>
              <button
                aria-label={"Delete " + (names[id] ?? id)}
                disabled={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Delete "${names[id] ?? id}"? Characters using it return to automatic voices.`,
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await api.deleteVoice(id);
                    await refresh();
                    if (added === id) setAdded("");
                    setInfo("Voice deleted.");
                  } catch (e) {
                    setInfo(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
      <small role="status">{info}</small>
    </section>
  );
}
