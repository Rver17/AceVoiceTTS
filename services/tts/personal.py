"""Local English reference-conditioned speech for imported recordings."""
import base64
import hashlib
import io
import os
import re
import shutil
import tarfile
import tempfile
import threading
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

PACK = "sherpa-onnx-pocket-tts-int8-2026-01-26"
DIGEST = "f4da7c7bd465f7b91e89191487fe90504396a51d6f0bcf94d0787633e2657293"
FILES = {"lm_flow": "lm_flow.int8.onnx", "lm_main": "lm_main.int8.onnx",
         "encoder": "encoder.onnx", "decoder": "decoder.int8.onnx",
         "text_conditioner": "text_conditioner.onnx", "vocab_json": "vocab.json",
         "token_scores_json": "token_scores.json"}
ID = re.compile(r"ref_[a-z0-9-]{1,32}_[0-9a-f]{24}")
lock = threading.Lock()
engine = None


def library():
    return Path(os.getenv("ACEVOICE_REFERENCES") or Path.home() / ".acevoice" / "voices")


def listed():
    return sorted(p.stem for p in library().glob("ref_*.wav") if ID.fullmatch(p.stem))


def load(models):
    global engine
    with lock:
        if engine is not None:
            return engine
        import sherpa_onnx as sherpa
        folder = models / PACK
        if not all((folder / f).is_file() for f in FILES.values()):
            models.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(dir=models) as stage:
                archive = Path(stage) / "model.tar.bz2"
                url = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/{PACK}.tar.bz2"
                with urllib.request.urlopen(url, timeout=60) as incoming, archive.open("wb") as output:
                    shutil.copyfileobj(incoming, output)
                with archive.open("rb") as source:
                    if hashlib.file_digest(source, "sha256").hexdigest() != DIGEST:
                        raise ValueError("Reference model download failed integrity check")
                folder.mkdir(exist_ok=True)
                with tarfile.open(archive) as tar:
                    for filename in [*FILES.values(), "LICENSE", "README.md"]:
                        member = tar.getmember(f"{PACK}/{filename}")
                        if not member.isfile():
                            raise ValueError("Unexpected model archive")
                        temp = Path(stage) / filename
                        with tar.extractfile(member) as incoming, temp.open("wb") as output:
                            shutil.copyfileobj(incoming, output)
                        temp.replace(folder / filename)
        pocket = sherpa.OfflineTtsPocketModelConfig(**{k: str(folder / f) for k, f in FILES.items()})
        config = sherpa.OfflineTtsConfig()
        config.model.pocket = pocket
        config.model.num_threads = 3
        engine = sherpa.OfflineTts(config)
        return engine


def add(name, encoded, models):
    raw = base64.b64decode(encoded, validate=True)
    with sf.SoundFile(io.BytesIO(raw)) as audio:
        if audio.format != "WAV" or audio.channels != 1 or audio.samplerate != 24000 or not 3 <= len(audio) / 24000 <= 30:
            raise ValueError("Use 3–30 seconds of mono speech at 24 kHz")
        samples = audio.read(dtype="float32")
        if not np.isfinite(samples).all() or np.max(np.abs(samples)) < .008:
            raise ValueError("The recording is silent or invalid")
    label = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:32] or "voice"
    key = "ref_" + label + "_" + hashlib.sha256(raw).hexdigest()[:24]
    load(models)
    folder = library()
    folder.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=folder, delete=False) as temp:
        temp.write(raw)
    Path(temp.name).replace(folder / (key + ".wav"))
    return key


def generate(key, text, speed, models):
    import sherpa_onnx as sherpa
    if not ID.fullmatch(key):
        raise ValueError("Invalid reference voice")
    audio, rate = sf.read(library() / (key + ".wav"), dtype="float32")
    config = sherpa.GenerationConfig()
    config.reference_audio = audio
    config.reference_sample_rate = rate
    config.speed = speed
    result = load(models).generate(text, config)
    return np.asarray(result.samples), result.sample_rate

