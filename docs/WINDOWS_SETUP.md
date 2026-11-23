# Windows troubleshooting

**AI engine error.** In development, install the locked CPython 3.11 dependencies using the README. For the portable build, keep the entire folder and run the executable at its top level. The engine badge shows model download, warm-up, readiness and failures. Choose Retry AI Engine after correcting the problem. Missing files download into %LOCALAPPDATA%\AceVoice\models. A damaged model can be moved aside with the app closed so the next launch downloads it again.

**Independent service.** Close AceVoice to free port 8766, then run:

```powershell
cd services/tts
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8766
```

From another PowerShell window, use `Invoke-RestMethod http://127.0.0.1:8766/health` and `Invoke-RestMethod http://127.0.0.1:8766/v1/voices`. The desktop starts its own authenticated child process. For a port conflict set `$env:ACEVOICE_PORT='18767'` before launching. The optional ACEVOICE_PYTHON and ACEVOICE_MODELS environment variables override the interpreter and model directory. No .env loader is needed.

**CPU and GPU.** The supplied runtime uses CPU ONNX Runtime, including on an RTX 3070 PC. The service prefers CUDA if its Python environment exposes CUDAExecutionProvider. A separate compatible GPU runtime, driver and CUDA/cuDNN libraries are required for that configuration. Check the actual device in the badge. Verify latency during gameplay before adjusting capture rate.

**No audio.** Use Test Dialogue, check the engine state, Windows output mixer, character gain and output volume. Rendered audio plays on the default device. Inspect Settings → Diagnostics for synthesis errors.

**Storage.** Configuration, calibration, the OCR worker cache and generated WAVs live in Electron's per-user application data directory. Settings → Clear cache removes generated audio. Models remain installed. Only first-run asset setup needs a network connection.

