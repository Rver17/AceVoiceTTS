# AceVoice — Codex Build Specification

> **Project:** AceVoice for *Phoenix Wright: Ace Attorney Trilogy* (Steam, Windows)  
> **Status:** Implementation-ready product and engineering brief  
> **Primary goal:** A companion Windows desktop application that automatically detects in-game dialogue and immediately voices it with natural-sounding, locally generated AI voices.  
> **Implementation order:** Ship a genuinely working OCR-to-Kokoro MVP first; design the interfaces so a higher-reliability game-mod text bridge can replace OCR later.

## 0. Instructions to Codex — start coding, not just planning

You are the implementing engineer. Build this application in the current repository.

1. Inspect the workspace and existing files. If empty, create the monorepo described below.
2. Work in small, verifiable increments. Implement **Milestones M0–M3** in order, with unit tests and a usable developer workflow. Continue into M4 if the environment permits.
3. Do not stop at wireframes, placeholder buttons, mock-only OCR, or fake TTS. Build a real end-to-end path: **window capture → OCR → dialogue stabilization → automatic character voice assignment → Kokoro neural synthesis → audio playback**.
4. Create and maintain `README.md`, `docs/ARCHITECTURE.md`, `.env.example`, and tests. Include exact Windows PowerShell setup/run instructions.
5. If the current machine lacks Windows, GPU, Python, the game, or an installed TTS model, implement the real integrations anyway, run all available non-hardware tests, and document what needs testing on a Windows gaming PC. Do not claim unperformed tests passed.
6. Make reasonable engineering choices without asking for approval. Preserve these nonnegotiables: offline-first; locally running **neural AI TTS only**; automatic voice assignment; automatic dialogue detection; no game file modification in MVP; no automatic gameplay advancement in MVP.
7. After a milestone, summarize changed files, commands run, test results, blockers, and the next milestone. Avoid large refactors unrelated to the task.
8. Search repository and upstream API docs before relying on undocumented game-engine internals or SDK behavior. Pin tested dependency ranges and record compatibility notes.

## 1. Product vision

AceVoice lets someone play the English-language Steam release of **Phoenix Wright: Ace Attorney Trilogy** while hearing character-specific speech for the normally silent dialogue.

The user opens AceVoice, selects the game window, calibrates the text and speaker-name areas once, presses **Start Listening**, and plays normally. Each new completed dialogue line is spoken automatically using a persistent character-specific AI voice. Players should not have to copy text, press a hotkey for each line, or manually assign every new character.

**Voice quality requirement:** Use a neural model **from the first release**. Windows SAPI, `speechSynthesis`, `pyttsx3`, and other traditional/robotic TTS must **never** be used as silent fallback. If Kokoro is unavailable, show an actionable error and a **Retry AI Engine** action; never quietly switch to a robotic voice.

Primary platform: Windows 10/11 x64, Steam PC version, English text, one local user. Target GPU: NVIDIA RTX 3070-class PC, but CPU operation must remain possible (slower).

### In scope for MVP

- Electron + React + TypeScript desktop companion app.
- Select target **window or display** and preview what is being captured.
- Guided calibration for dialogue box rectangle and speaker-name rectangle, saved per resolution/capture source.
- OCR via Tesseract.js with reusable workers and image preprocessing.
- Reliable stabilization so the typewriter animation does not trigger partial narration for each character.
- Recognize the speaker when possible, including aliases for known recurring characters.
- Assign distinct Kokoro voices automatically; save assignments; provide a voice editor and preview.
- Local Python Kokoro synthesis service, first-run model setup, startup readiness and prewarming.
- Ordered, interruptible audio playback; prevent duplicate repeats; disk audio cache.
- Dashboard with Start/Pause/Stop, engine status, detected speaker/text, selected voice, queue status, logs and settings.
- Fully local processing after initial dependency/model download.
- At least one automated end-to-end demonstration using simulated dialogue events and a real Kokoro synthesis service, where dependencies are available.

### Out of scope for MVP

- Automatic clicking/advancing of in-game text.
- AI character acting or reliable emotion recognition (future enhancement).
- Voice cloning of actors, copyrighted voice imitation, or downloading game dialogue/audio assets.
- Multiplayer/network services, cloud accounts, payments or remote API tokens.
- Reading arbitrary protected game memory, DLL injection by the Electron app, or bypassing game safeguards.
- Guaranteed correctness for every cutscene, flashback, transition, courtroom effect, or resolution.

## 2. Architecture

```text
Phoenix Wright game window
   │
   ▼
Electron capture adapter (user-selected screen or window)
   │  frames; optional preview
   ▼
ROI crop + scale + grayscale + contrast preprocessing
   │
   ▼
Tesseract.js OCR adapter ───────► speaker-name OCR
   │                                    │
   └──────────────┬─────────────────────┘
                  ▼
       Dialogue stabilization/deduplication
                  │  normalized DialogueEvent
                  ▼
       Speaker resolver + voice registry
                  │  stable voice assignment
                  ▼
       Synthesis queue/cache (skip stale events)
                  │  POST /v1/synthesize
                  ▼
       Python localhost Kokoro server
                  │  WAV/PCM audio
                  ▼
       Web Audio playback in Electron
                  │
                  ▼
       Speakers/headphones + status UI
```

**Future game bridge:** A MelonLoader C# adapter publishes the same `DialogueEvent` contract into a local transport. The app can select `source=game-bridge` instead of `source=ocr` while keeping voice assignment, TTS, caching, UI and audio unchanged.

### Recommended stack

| Layer | Initial choice | Notes |
|---|---|---|
| Desktop shell | Electron + Vite | Secure IPC; dev/build workflows |
| UI | React + TypeScript | No framework-specific backend assumptions |
| State | Lightweight React store or Zustand | Testable without Electron where possible |
| Runtime validation | Zod | Validate IPC and API payloads |
| Capture | Electron `desktopCapturer` / `getDisplayMedia` | Supported Windows APIs; do not assume legacy capture constraints |
| Image processing | `sharp` or canvas filters | Keep capture preview responsive |
| OCR | Tesseract.js | Reuse workers; never reinitialize on each frame |
| Local TTS | Python + FastAPI + `kokoro` + `soundfile` | Model from `hexgrad/Kokoro-82M`; use public, documented APIs |
| Audio | Web Audio API | Controlled queue and cancellation |
| Settings/persistence | SQLite or versioned JSON + cache directory | Prefer simple reliable persistence; document choice |
| Tests | Vitest + Python pytest | Mock capture/voice API in most tests |
| Packaging | electron-builder | Package companion app; define clean strategy for Python service |

Do **not** add Node.js HTTP backend unless justified. Electron main process is the trusted orchestration layer; Python is exclusively the local AI synthesis service.

## 3. Repo structure (guidance, adjust if needed)

```text
acevoice/
├─ AGENTS.md
├─ CODEX.md
├─ README.md
├─ package.json
├─ pnpm-workspace.yaml                  # optional; npm workspaces also fine
├─ .env.example
├─ .gitignore
├─ apps/
│  └─ desktop/
│     ├─ package.json
│     ├─ electron/
│     │  ├─ main.ts
│     │  ├─ preload.ts
│     │  ├─ capture.ts
│     │  ├─ tts-process.ts
│     │  └─ ipc.ts
│     ├─ src/
│     │  ├─ App.tsx
│     │  ├─ features/capture/
│     │  ├─ features/dialogue/
│     │  ├─ features/voices/
│     │  ├─ features/player/
│     │  ├─ features/settings/
│     │  └─ styles/
│     └─ tests/
├─ packages/
│  └─ core/
│     ├─ src/contracts.ts
│     ├─ src/dialogue-stabilizer.ts
│     ├─ src/speaker-resolver.ts
│     ├─ src/voice-allocator.ts
│     ├─ src/cache-key.ts
│     └─ tests/
├─ services/
│  └─ tts/
│     ├─ app.py
│     ├─ engine.py
│     ├─ requirements.txt or pyproject.toml
│     ├─ tests/
│     └─ README.md
├─ fixtures/
│  ├─ dialogue-events.json
│  └─ ocr/                              # handcrafted synthetic fixture images
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ WINDOWS_SETUP.md
│  ├─ OCR_CALIBRATION.md
│  └─ GAME_BRIDGE_PLAN.md
└─ scripts/
   ├─ setup-windows.ps1
   └─ dev-windows.ps1
```

## 4. Shared data contracts (implement and validate)

Use a single normalized event contract regardless of capture source. Examples are **representative**, not existing live-game events:

```ts
export type DialogueSource = 'ocr' | 'game-bridge' | 'simulation';
export interface DialogueEvent {
  eventId: string;
  source: DialogueSource;
  observedAt: number;             // Unix ms
  text: string;                   // completed dialogue text only
  speakerRaw: string | null;      // from nameplate or bridge
  speakerKey: string | null;      // normalized identity, if known
  sceneKey?: string | null;
  confidence: number;             // 0..1, aggregate confidence
  isComplete: true;
}
export interface SpeakerProfile {
  key: string;
  displayName: string;
  aliases: string[];
  voiceId: string;
  speed: number;
  source: 'curated' | 'auto' | 'user';
}
export interface SynthesisRequest {
  text: string;
  voiceId: string;
  speed: number;
  modelId: string;
  requestId: string;
}
```

Version any persisted configuration. Use Zod validation at IPC, settings and local server boundaries. Escape and validate all recognized text; never interpolate OCR content into shell commands.

## 5. Capture and OCR requirements

1. **User-selectable capture:** Enumerate windows and screens, show source title and preview, capture the Steam game in windowed/borderless mode when possible. Warn if the frame is black due to fullscreen/protected capture, and offer display-capture fallback. Handle DPI scaling, multi-monitor moves and resolution changes.
2. **ROI calibration:** Draw/edit two independent rectangles over the preview: `dialogueBox` and `speakerNameBox`. Save normalized coordinates 0..1 with the selected source/resolution. If the game has no visible nameplate, speaker may be unknown; do not fabricate attribution.
3. **Efficient capture:** Start around 3 captures/sec (configurable 2–6). Avoid OCR while capture is paused or a previous OCR job is still busy. Do not spin up one worker per frame. Skip low-change frames using a small region hash or cheap pixel difference where feasible.
4. **Preprocessing:** Crop, upscale ~2x where useful, grayscale, adjust contrast/threshold and optionally apply a light sharpen. Prefer a tuning UI rather than assuming one filter works for every brightness and resolution.
5. **Text cleaning:** Normalize newlines and whitespace, remove known OCR UI artifacts, retain punctuation/case where useful. Never silently invent missing words. Put OCR confidence and raw recognized text in diagnostic logs.
6. **Typewriter stabilization:** Consider the dialogue complete only after text stays unchanged for a configurable 250–500 ms across successive OCR reads, or a safe equivalent signal. Do not speak every partial typewriter step. Account for a line revealed instantaneously.
7. **Duplicate suppression:** Same recognized text should be voiced once per displayed dialogue instance; it may be voiced again if the text box clears/changes and a subsequent *new* instance appears. Do not use an unbounded global `seenTexts` set.
8. **Unknown/bad OCR:** If confidence is below threshold or OCR is clearly an intermediate fragment, wait/retry; expose an OCR diagnostic view. Do not narrate menu titles, choices, court evidence or banners as if they are character dialogue by default. Offer optional separate UI narration later.
9. **Transitions:** Detect clearing, new scene, hidden window, frame unavailable, alt-tab/capture loss, and speaker changes; reset stabilizer appropriately. Screen flashes and visual effects must not flood the queue.
10. **Testing:** Pure stabilizer tests must cover typewriter text, pauses in typing, same line revisited after clearing, duplicate frames, blank frames, speaker changes, OCR noise, low confidence and rapidly skipped lines.

OCR will be a **best-effort** initial source; reliable speaker attribution cannot be guaranteed if the nameplate is absent, occluded or OCR fails. Keep that visible in the app rather than claiming perfect detection.

## 6. Automatic speaker-to-voice assignment — required

Automatic assignment happens as soon as a valid speaker is discovered. There must be **zero required manual setup** to start hearing different characters.

### Rules

1. Use a small **curated alias registry** for known recurring characters (e.g. `Phoenix Wright`, `Phoenix`, `Maya Fey`, `Maya`, `Miles Edgeworth`, `Edgeworth`, `Judge`) with editor-friendly defaults.
2. Load the **actual installed voice list from the TTS service**, not a fabricated list. Known initial Kokoro US English IDs include `am_michael`, `am_adam`, `am_eric`, `am_liam`, `am_onyx`, `af_heart`, `af_bella`, `af_nova`, `af_sarah`; verify each available at runtime. British English voices can be offered where installed.
3. For an unrecognized **named** speaker: normalize their name, deterministically select a voice from the available pool (stable hash + collision-aware rotation), persist the assignment immediately, and use it on the next line. Do not randomize voice on every utterance.
4. Avoid assigning an existing character's voice when another compatible voice is available. Reuse is allowed if the voice pool is exhausted.
5. Never infer a character's gender, age, or identity from an unfamiliar name or noisy OCR with unwarranted certainty. Use curated profiles for known cast; for unknown speakers choose from a general mixed voice pool, and make editing easy.
6. `???`, `Unknown`, an absent nameplate, and placeholders are **not** one permanent person. Use a temporary scene-local identity, or a default narrator voice, until an actual character can be identified. Do not merge distinct mystery speakers permanently.
7. A user assignment overrides auto/curated defaults and survives restart. Support per-voice preview, speed and volume. Speed changes must be reflected in cache keys.
8. Do not attempt to replicate copyrighted actor performances or clone real people's voices. Assign readily licensed stock voices.

### Initial curated **suggestions** (not final enforced casting)

| Recognized speaker | Suggested Kokoro ID | Direction |
|---|---|---|
| Phoenix Wright | `am_michael` | Clear, earnest, energetic |
| Maya Fey | `af_heart` | Bright, playful |
| Miles Edgeworth | `am_onyx` | Calm, measured |
| The Judge / Judge | `am_adam` | Mature, authoritative |
| Mia Fey | `af_bella` | Confident, composed |
| Unknown speaker | dynamically allocated | Stable per known name, temporary otherwise |

These are **voice casting presets**, not assurances that the model produces accurate emotions. Validate model voice availability and let users audition or change every assignment.

## 7. Local neural voice engine — mandatory from MVP

**Default:** `hexgrad/Kokoro-82M` via Python `kokoro` library, FastAPI, and soundfile. Ensure the *neural* model loads and generates real audio; no mock sample files in the shipped path.

### Service behavior

- Start a **local-only** service on `127.0.0.1` using a dynamically selected available port or a documented configurable port. Never bind to `0.0.0.0` by default.
- API:
  - `GET /health`: engine status (`starting` | `downloading` | `ready` | `error`), device (`cuda` | `cpu`), model, and helpful message.
  - `GET /v1/voices`: voice IDs actually supported by the loaded model, language, and any known display labels.
  - `POST /v1/synthesize`: validated `SynthesisRequest`, return `audio/wav` stream or file bytes; clear structured error payloads.
- Startup: validate Python environment, ensure model and eSpeak/phonemizer dependencies, download approved model assets on first setup with status/progress if supported, load model **once**, run a short warm-up inference. Document offline use after model installation.
- Device: try CUDA when PyTorch CUDA support is available; otherwise CPU. Report actual device, never promise specific inference time.
- Engine: cache `KPipeline(lang_code='a')` (or documented alternative) and reuse it; concatenate generated chunks in correct order when a sentence yields multiple segments. Serialize or limit concurrent inference if required by the installed runtime; do not allow overlapping requests to corrupt outputs.
- Audio: return valid WAV (normally 24 kHz for Kokoro; use the actual sample rate from backend) with non-empty content. Handle punctuation and Unicode reasonably.
- Security: input-size limit, request timeout, loopback-only exposure, optional per-session token, safe filenames/cache keys, no unrestricted CORS, and no user content sent to third-party inference APIs.
- Failures: clear message and retry. **Do not downgrade to SAPI, Web Speech API, or pre-recorded generic voice.**

### Playback

- Speak complete lines in FIFO order; do not overlap two characters.
- Queue policy when player rapidly advances: configurable `Finish Current` vs `Stop Old and Speak Latest`, default **Stop Old and Speak Latest** to avoid lagging behind the screen. Cancel queued stale jobs by generation token; stop old audio on source/scene reset.
- A new line may be synthesized while one is playing to reduce dead time; limit look-ahead and prevent stale background synthesis from growing indefinitely.
- Use `AudioContext` / Web Audio for output gain, playback, stop, and optionally selected audio device where supported. Preserve the game's original music/effects; AceVoice adds only speech.
- Cache generated WAV by SHA-256 of normalized text + voice ID + speed + model/version + language. Cache hits must not run inference. Limit cache size and provide **Clear Cache** action.
- Optional voice text fixes: pronunciation dictionary for names like `Fey`, `Edgeworth`; prioritize exact speaker/text integrity over aggressive rewriting. Do not have an LLM rewrite dialogue without explicit opt-in.

## 8. UI design — clean Windows companion

Professional, compact, dark UI; minimal graphics. Build functional controls before polishing visuals.

**Dashboard:**

- Game detection badge: `Game captured`, `No source`, `Capture lost`.
- AI status: `Downloading`, `Loading`, `Ready (GPU/CPU)`, `Error`.
- Primary buttons: **Start Listening**, **Pause**, **Stop**.
- Latest speaker and live text; actual assigned voice; speech status (speaking, queued, idle).
- Small capture preview and OCR confidence indicator.
- Toggle: `Auto-assign voices` **ON** by default (user can still customize voices; turning off uses a selected default voice).

**Capture Setup:** window/display picker, calibration overlay for name/dialogue regions, OCR confidence and preprocessing controls, Save Profile, and a test recognition preview.

**Voice Library:** searchable character list, assigned voice, speed/volume adjustment, **Preview Voice** text box, Reset to Auto, add aliases, and persistent custom overrides.

**Settings/Diagnostics:** default queue behavior, OCR interval/stabilization, cache usage, output volume, engine installation/readiness, local-only/privacy explanation, logs, and a **Test Dialogue** button that synthesizes user-entered text even with the game closed.

First-run onboarding should have three actions: **Set Up AI Voices → Select Game Window → Calibrate & Start**. The app should never pretend the model is ready before successful load and test synthesis.

## 9. Electron security and system behavior

- `contextIsolation: true`, `nodeIntegration: false`, sandbox where possible, strict `preload` API.
- Validate every IPC payload; minimize accessible capture and file APIs. Configure Content Security Policy suitable for local packaged assets.
- Use native Electron screen/window capture only after the user selects the source. Do not covertly monitor other apps.
- Shut down capture streams, OCR workers, Python child process, HTTP requests and audio on exit. Avoid orphaned Python processes on Windows.
- Use `app.getPath('userData')` for config/cache, not project source paths or game directories.
- Don't commit model weights or audio caches. Don't collect analytics, upload screenshots, or transmit dialogue off-device.
- Store optional diagnostic screenshots **only** on user request, make deletion possible, and hide them from routine logs.
- If Python is a separately installed dependency during development, show onboarding that explains it. For a distributable installer, package a known working isolated Python runtime/service or clearly document first-run setup; don't ship a broken exe expecting arbitrary system Python.

## 10. Integration route: future direct game text

Relevant public reference: https://github.com/AccessMods/PhoenixWrightTrilogy

That MIT-licensed project supports the Steam trilogy, uses MelonLoader and emits dialogue with character names for screen readers. Its README identifies MelonLoader 0.7.1 and 32-bit/x86 game-related components. **Do not assume the project already exposes WebSocket/HTTP events or can send text to AceVoice unmodified.** Inspect its actual source and compatibility before implementing a bridge.

Potential second reference: https://github.com/KingBridgeSS/PWAAT_VOICE_MOD — an unofficial MelonLoader mod for locally stored voice clips, useful as a concept reference; it is **not** a working on-demand AI TTS source.

When designing/implementing `GameBridgeDialogueSource` in a later milestone:

1. Confirm actual supported Steam build, bitness and MelonLoader compatibility first.
2. Prefer a minimal authorized, user-installed mod using game dialogue callbacks and speaker metadata. If deriving from a third-party mod, respect its license and preserve notices.
3. Emit one completed text event per line, not each typewriter character, over a versioned local named pipe / loopback WebSocket / IPC transport.
4. Bridge must not depend on the Electron renderer being open or network access beyond localhost.
5. Implement feature detection and fallback to OCR, with user-visible active source.
6. Avoid conflicting audio output from an accessibility mod's own speech pathway; allow disabling that path **without impairing accessibility users' setup by default**.
7. Never package or redistribute Capcom game assets, extracted scripts, or audio without appropriate rights.

Create `docs/GAME_BRIDGE_PLAN.md` describing source files and patch points **only after actually inspecting the upstream repository**. Keep this as a subsequent enhancement, not a reason to delay a usable OCR MVP.

## 11. Milestones and build order

### M0 — Repository foundation

- [ ] App boots in Electron on Windows with React TypeScript and secure preload bridge.
- [ ] Python FastAPI service directory and reproducible environment instructions exist.
- [ ] Shared types/schemas, settings persistence, log viewer, app-level error boundary exist.
- [ ] `npm run dev`, `npm run build`, `npm run test`, `npm run lint` (or documented equivalent) work.
- [ ] Basic CI-friendly tests do not require game or GPU.

### M1 — Real local AI speech (highest priority)

- [ ] Python service initializes **Kokoro** and exposes `/health`, `/v1/voices`, `/v1/synthesize`.
- [ ] First-run model download/setup with visible progress or meaningful state changes.
- [ ] Electron can start/connect to local service and display actual readiness and errors.
- [ ] `Test Dialogue` speaks newly synthesized text using chosen Kokoro voice.
- [ ] Voice auto-allocation, persistence, preview and WAV cache are working.
- [ ] Confirm no Windows robotic TTS fallback code exists.

### M2 — OCR dialogue capture

- [ ] User selects game window/display, with permission flow, preview and error states.
- [ ] User calibrates dialogue/name regions; profile persists.
- [ ] OCR workers recognize and normalize text from actual screenshots or fixture images.
- [ ] Stabilizer only emits completed lines, deduplicates correctly and preserves new occurrences.
- [ ] Speaker name OCR feeds resolver; unknown speaker behavior is honest.
- [ ] Simulated fixture stream exercises the pipeline without the game.

### M3 — End-to-end playable MVP

- [ ] Capture → OCR → stabilized event → voice assignment → Kokoro → playable audio succeeds on Windows.
- [ ] Start/Pause/Stop and cancellation policies work during rapid game dialogue progression.
- [ ] Game audio is not replaced; AI voice adds a separate sound stream.
- [ ] App reports capture/TTS failures and recovers without restarting where practical.
- [ ] Settings, voice assignments and cache survive restart.
- [ ] Add install/run/troubleshooting instructions, including borderless display mode and RTX 3070 / CPU cases.

### M4 — Ship and quality (after M3)

- [ ] Installer or portable executable with reproducible local Python/TTS packaging.
- [ ] End-to-end smoke test on a clean Windows install.
- [ ] Calibrated performance notes (OCR, inference, first speech latency) measured, not guessed.
- [ ] Better speaker recognition, pronunciation fixes and voices adjusted after gameplay testing.
- [ ] Direct MelonLoader bridge investigation with compatibility/rollback documentation.

## 12. Mandatory tests and acceptance criteria

### Unit/integration tests

- `voice-allocator`: unknown new name → assigned real voice ID; same name after restart → same persisted voice; two names prefer different voices; exhausted pool → safe reuse; user override never overwritten.
- `speaker-resolver`: `Phoenix`, `Phoenix Wright`, whitespace and case aliases resolve; `???` remains provisional; failed name OCR does not create a false cast identity.
- `stabilizer`: growing typewriter line never speaks partial text; stable line emits once; clear/new display allows same exact text again; noise/low-confidence OCR does not spam.
- `player`: 2 voices never overlap; pause stops/pauses appropriately; fast-advance drops stale queued speech; stop cancels new playback and generation tokens.
- `cache`: exact repeat is a hit; changing voice/speed/model invalidates key; safe file paths.
- `service`: `/health` truthful; `/v1/voices` real list; invalid synthesis requests rejected; model errors reported; valid synthesized WAV can be decoded; no robot fallback.
- `capture`: nonexistent window, permission denied, black frame, DPI change and capture loss give user-visible actions, not crashes.

### Definition of done for first playable release

On a Windows PC with the Steam game running and the model installed:

1. Open AceVoice, choose the game window, calibrate dialogue and nameplate region.
2. Press **Start Listening**.
3. Advance normal in-game dialogue. **Completed** text is read automatically without further input.
4. Phoenix's and Maya's named lines use distinct Kokoro AI voices; another newly recognized named character is auto-assigned a persistent voice without manual configuration.
5. The same on-screen line is not spoken repeatedly while unchanged; it can be spoken if genuinely shown as a new dialogue instance.
6. When the player skips ahead, outdated narration does not continue indefinitely.
7. Quit and relaunch: speaker voice mappings and region settings are still present.
8. If the model fails to load, a clear neural-engine error appears; no Windows robotic speech occurs.

**Do not label the MVP complete if only synthetic test events work or the app has not been exercised on real game capture.** If game/Windows testing is unavailable, report it as an explicitly outstanding acceptance test.

## 13. Project commands and documentation expectations

Codex must provide the actual commands after choosing npm or pnpm. Desired scripts:

```powershell
# From the repository root (representative commands; implement matching scripts)
npm install
npm run dev
npm run test
npm run lint
npm run build

# The local TTS service should also run independently for troubleshooting:
cd services/tts
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8766
```

Never commit `.venv`, model weights, downloaded language data, screenshots, cache files or API credentials. The `README` should document PowerShell execution policy if `*.ps1` scripts are used, and include a manual fallback for users who cannot change execution policy.

## 14. Engineering guardrails

- Implement small, testable pure functions for stabilization, alias normalization, caching and allocation. Prefer explicit interfaces over tight coupling.
- Use trustworthy upstream packages and compatible versions, not unmaintained forks without need.
- Treat all OCR and in-game text as untrusted input.
- Avoid blocking the Electron renderer with OCR, file access or synchronous neural inference.
- Use accessible forms and status labels; don't rely on color alone.
- Do not assume names always appear on screen or that every line has a single speaker.
- Do not claim expression/emotion is understood unless a supported signal really exists. Emotion acting is a later feature.
- Avoid scraping or bundling the game's script; work only on the user's live display or optional user-installed game bridge.
- Keep offline local inference the default; no mandatory recurring cost.

## 15. Sources and implementation references

Use these as starting points and verify current APIs during implementation:

- Accessibility mod: https://github.com/AccessMods/PhoenixWrightTrilogy
- Accessibility mod releases/setup: https://github.com/AccessMods/PhoenixWrightTrilogy/releases
- Optional pre-recorded voice-mod reference: https://github.com/KingBridgeSS/PWAAT_VOICE_MOD
- Official Kokoro Python inference: https://github.com/hexgrad/kokoro
- Kokoro model / listed voices: https://huggingface.co/hexgrad/Kokoro-82M
- Electron desktop capture: https://www.electronjs.org/docs/latest/api/desktop-capturer
- Tesseract.js: https://github.com/naptha/tesseract.js

## 16. The very first task to perform now

**Begin with M0 and M1 immediately.** Generate the real Electron/React workspace and local Python/Kokoro service; implement engine readiness, `/v1/voices`, `/v1/synthesize`, a functioning **Test Dialogue** button, and automatic persistent speaker voice assignment. Confirm real neural speech works before spending time on advanced UI. Then implement calibrated capture/OCR and connect it end-to-end. Keep working on the actual application, not merely writing more plans.
