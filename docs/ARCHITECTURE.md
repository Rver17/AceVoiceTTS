# Architecture

Electron main owns source selection, validated IPC, settings, the local speech child process and a reusable Tesseract worker. Its sandboxed renderer exposes a fixed preload API. Sources return titles without thumbnails until the user selects a window or display. The media request consumes that selection once. No game installation changes are made.

The renderer draws two normalized crops onto canvases. A single OCR operation runs at a time. An unchanged pair of region hashes reuses the last read for stabilization. Blank frames and low confidence are handled separately. Completed observations become validated Dialogue events. Named characters resolve through user aliases and casting presets, then deterministic allocation. Settings writes use a temporary file and rename. Unknown speakers remain provisional. Simulation and future bridge events use the same downstream contract.

The loopback FastAPI service loads the Kokoro-82M v1 ONNX release and packaged eSpeak dependency once, inspects installed English styles, and warms up before declaring readiness. Same-dialect pairs average two installed style tensors. A per-session bearer token protects Electron requests. Speech is serialized, returned as PCM WAV and decoded by Web Audio. Cache keys include normalized text, voice or blend identity, speed, language and model version. The renderer uses a serial queue and generation counter to discard superseded synthesis results and stop playing nodes. Native inference already in progress can finish before the latest line is synthesized.

The developer and portable distributions use the same application entry point. The portable copy includes a Python runtime and local OCR assets. Model weights download separately. The desktop and service monitor the owning process so the service exits when the parent disappears.

Primary references: [Kokoro ONNX](https://github.com/thewh1teagle/kokoro-onnx), [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), [Electron capture](https://www.electronjs.org/docs/latest/api/desktop-capturer), [Tesseract.js](https://github.com/naptha/tesseract.js).


