# Windows test results

## AceVoice 0.3.1

Verified the versioned portable Windows executable credited to Koro LTCM. All seven embedded icon images match the source badge. The packaged customization test imported an audio file, generated new speech, searched for the personal voice by partial name, selected it with Enter, saved a character assignment, exported and reimported a cast preset, saved a pronunciation, and synthesized another sentence after relaunch. The microphone test exercised recording with a synthetic input device. Physical microphone quality and global hotkeys during actual gameplay still require a player test.

The packaged capture regression test passed with a synthetic Windows game window, two successive dialogue lines, the narrator, cache and restored settings. Nine TypeScript tests and both Python service tests passed. Type checking and the release build passed.

## AceVoice 0.2.0

Developer: Koro LTCM. Tested November 24, 2026.

| Milestone | Implementation and observed result |
| --- | --- |
| M0 | Electron, React, validated preload, settings and diagnostics booted in the portable executable. Type checking, production compilation and seven TypeScript tests passed. |
| M1 | FastAPI and Kokoro-82M warmed up on CPU. Two Python tests passed, including decoding real 24 kHz WAV and generating a blended voice. The desktop played generated speech, replayed cached audio and retained custom casting. |
| M2 | The packaged app captured a dedicated Windows fixture window, recognized Maya and dialogue, then recognized a second line automatically. The nameless episode confirmation used the narrator. Resize, black regions and capture loss were exercised. |
| M3 | The packaged app also selected the running Phoenix Wright: Ace Attorney Trilogy window and reached actual Web Audio playback using the Isabella narrator. The test did not advance the game. Multi-character courtroom play, rapid user advancement, flashes, alternate resolutions/DPI, and subjective sound quality still need extended gameplay testing. |
| M4 | The versioned portable Windows x64 folder includes the Python runtime. Verified executable properties for Koro LTCM, product AceVoice and version 0.2.0.0. Tested the release from its executable with an isolated app profile. A clean Windows installation and CUDA performance remain unverified. The direct game bridge is a design investigation. |

Commands: `npm.cmd run build`, `npm.cmd run lint`, `npm.cmd test`, Python pytest with `ACEVOICE_REAL_TEST=1`, the Windows packaging script and `npm.cmd run smoke` with `ACEVOICE_SMOKE_EXE` pointing to the release. With the game open, `node scripts/game-check.mjs` uses the same executable override, selects only the Trilogy window, waits for speech and stops.

One packaged CPU fixture run with the model already installed measured 9.92 seconds from launch to ready, 2.06 seconds from an uncached Phoenix preview click to playback, and 3.62 seconds from starting capture to first fixture playback. These measurements include desktop/UI polling and are specific to this run.

Executable SHA-256: `2C8A858CDE3D8D31B8AD3E26535CB6CCCFC30AB79DD31CF97918004C9EE3B837`.


