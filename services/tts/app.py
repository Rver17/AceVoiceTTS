"""Local Kokoro neural synthesis. All dialogue stays in this process."""
import hashlib
import io
from itertools import combinations
import os
import secrets
import threading
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, ConfigDict

MODEL = "kokoro-82m-onnx-v1.0"
BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
DIGESTS = {
    "kokoro-v1.0.onnx": "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5",
    "voices-v1.0.bin": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
}
directory = Path(os.getenv("ACEVOICE_MODELS") or Path(os.getenv("LOCALAPPDATA", Path.home())) / "AceVoice/models")
state = dict(status="starting", device=None, model=MODEL, message="Starting Kokoro")
engine = None
voices = []
inference = threading.Lock()


def initialize():
    global engine, voices
    try:
        import onnxruntime as ort
        from kokoro_onnx import Kokoro
        directory.mkdir(parents=True, exist_ok=True)
        paths = []
        for filename in ("kokoro-v1.0.onnx", "voices-v1.0.bin"):
            path = directory / filename
            if not path.exists():
                state.update(status="downloading", message=f"Downloading {filename}")
                temp = path.with_suffix(f".{os.getpid()}.part")
                try:
                    urllib.request.urlretrieve(BASE + filename, temp)
                    with temp.open("rb") as source:
                        if hashlib.file_digest(source, "sha256").hexdigest() != DIGESTS[filename]:
                            raise ValueError(f"Download integrity check failed for {filename}")
                    temp.replace(path)
                finally:
                    temp.unlink(missing_ok=True)
            paths.append(str(path))
        state.update(status="starting", message="Loading model and synthesizing warm-up")
        options = ort.SessionOptions()
        options.intra_op_num_threads = min(4, os.cpu_count() or 1)
        providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in ort.get_available_providers()]
        session = ort.InferenceSession(paths[0], sess_options=options, providers=providers)
        model = Kokoro.from_session(session, paths[1])
        installed = sorted(v for v in model.get_voices() if v.startswith(("am_", "af_", "bm_", "bf_")))
        samples, rate = model.create("Ready.", voice=installed[0], lang=language(installed[0]))
        if not samples.size or rate <= 0:
            raise ValueError("Empty warm-up audio")
        blends = [f"{a}_mix_{b}" for a, b in combinations(installed, 2) if language(a) == language(b)]
        engine, voices = model, installed + blends
        state.update(status="ready", device="cuda" if session.get_providers()[0] == "CUDAExecutionProvider" else "cpu", message="Kokoro ready")
    except Exception as exc:
        state.update(status="error", message=f"{exc}. Check Python dependencies and model files, then retry.")


def language(voice):
    return "en-gb" if voice.startswith("b") else "en-us"


@asynccontextmanager
async def lifespan(app):
    threading.Thread(target=initialize, daemon=True).start()
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)


@app.middleware("http")
async def authorize(request: Request, call_next):
    token = os.environ.get("ACEVOICE_TOKEN")
    if request.headers.get("origin") or (token and not secrets.compare_digest(request.headers.get("authorization", ""), "Bearer " + token)):
        return JSONResponse({"detail": "Forbidden"}, status_code=403)
    return await call_next(request)


class Synthesis(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    text: str = Field(min_length=1, max_length=1500)
    voiceId: str = Field(min_length=1, max_length=80)
    speed: float = Field(ge=0.5, le=2)
    modelId: str
    requestId: str = Field(min_length=1, max_length=100)


@app.get("/health")
def health():
    return state.copy()


@app.get("/v1/voices")
def list_voices():
    return [dict(id=v, language=language(v)) for v in voices]


@app.post("/v1/synthesize")
def synthesize(data: Synthesis):
    if state["status"] != "ready":
        raise HTTPException(503, state["message"])
    if data.voiceId not in voices or data.modelId != MODEL:
        raise HTTPException(422, "Unknown voice or model")
    if not inference.acquire(blocking=False):
        raise HTTPException(429, "Synthesis busy")
    try:
        import soundfile as sf
        style = data.voiceId
        if "_mix_" in style:
            first, second = style.split("_mix_")
            style = (engine.get_voice_style(first) + engine.get_voice_style(second)) * 0.5
        samples, rate = engine.create(data.text, voice=style, speed=data.speed, lang=language(data.voiceId))
        if not samples.size:
            raise ValueError("No pronounceable audio")
        output = io.BytesIO()
        sf.write(output, samples, rate, format="WAV", subtype="PCM_16")
        return Response(output.getvalue(), media_type="audio/wav")
    except Exception as exc:
        raise HTTPException(422, f"Synthesis failed: {exc}") from exc
    finally:
        inference.release()



