# AceVoice — Codex repository instructions

**Read [`CODEX.md`](./CODEX.md) completely before editing project files.** It is the authoritative product specification, engineering requirements, implementation milestones and acceptance criteria for this repo.

This repository builds **AceVoice**, a local-first Windows companion for *Phoenix Wright: Ace Attorney Trilogy* that captures dialogue, automatically assigns persistent character voices, synthesizes **real Kokoro neural TTS** speech, and plays it while the game runs.

## Start immediately

- If this repository is empty, scaffold the project as specified in `CODEX.md`.
- Implement M0 then M1 first, followed by M2 and M3. Build working functionality rather than mock screens or plans.
- **Never** substitute Windows SAPI, Web Speech API or robotic voices when the AI service is offline. Show a useful error instead.
- Automatic voice assignment and automatic dialogue capture are mandatory.
- Keep interfaces designed for a later MelonLoader text bridge; OCR-first MVP must not depend on game mods.
- Create tests and document exact PowerShell install/run commands.
- Run checks available in the current environment and clearly distinguish verified results from untested Windows/game/GPU integration.
- Do not commit or redistribute downloaded game assets, scripts, screenshots, model weights, or local cache.

**Your first deliverable** is a runnable desktop UI with a real local Kokoro service, a working AI voice preview and persistent automatic character voice mapping. Proceed to OCR detection and automated playback after that.
