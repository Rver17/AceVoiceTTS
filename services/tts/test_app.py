import io
import os
import time
import wave

import pytest
from fastapi.testclient import TestClient
import app as service


def test_error_and_validation(monkeypatch):
    monkeypatch.setattr(service, "state", {"status": "error", "message": "model missing"})
    client = TestClient(service.app)
    assert client.get("/health").json()["status"] == "error"
    assert client.post("/v1/synthesize", json={}).status_code == 422
    request = dict(text="Test", voiceId="af_heart", speed=1, modelId=service.MODEL, requestId="one")
    assert client.post("/v1/synthesize", json=request).status_code == 503
    monkeypatch.setenv("ACEVOICE_TOKEN", "session")
    assert client.get("/health").status_code == 403


@pytest.mark.skipif(os.getenv("ACEVOICE_REAL_TEST") != "1", reason="requires installed Kokoro assets")
def test_real_kokoro():
    with TestClient(service.app) as client:
        deadline = time.monotonic() + 120
        while client.get("/health").json()["status"] in ("starting", "downloading") and time.monotonic() < deadline:
            time.sleep(.25)
        assert client.get("/health").json()["status"] == "ready", service.state
        voices = client.get("/v1/voices").json()
        assert any(v["id"] == "af_heart" for v in voices)
        result = client.post("/v1/synthesize", json=dict(text="The trial will begin soon.", voiceId="af_heart", speed=1, modelId=service.MODEL, requestId="test"))
        blends = [v["id"] for v in voices if "_mix_" in v["id"]]
        assert len(voices) == 246 and len(blends) == 218
        blended = client.post("/v1/synthesize", json=dict(text="Hello there.", voiceId="af_nova_mix_af_sky", speed=1.08, modelId=service.MODEL, requestId="blend"))
        assert blended.status_code == 200 and blended.content[:4] == b"RIFF"
        assert result.status_code == 200
        with wave.open(io.BytesIO(result.content)) as audio:
            assert audio.getframerate() == 24000
            assert audio.getnframes() > 1000


