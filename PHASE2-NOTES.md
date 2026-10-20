# JARVIS v12 "Obsidian" — Phase 2 (interface redesign)

New interface, same brain: every element ID and all logic from v11.1 are kept, so wake word, goggles/hand tracking,
voice, memory, personas and easter eggs work as before.

## What changed
- Layout: single-column app with a bottom dock (Talk / Control / System); two-pane layout on screens >= 1000px.
- Look: obsidian surfaces, ember + violet accents, rounded cards, system fonts (no web-font download, works offline).
- A living presence orb replaces the arc reactor and spectrum line; it reacts to speaking / listening.
- Composer: one pill (attach, message, send, mic). Wake word, goggles and folder moved to the Control tab.
- Settings is a bottom sheet on phones.
- System tab shows REAL readings: main-thread load, JS heap, measured FPS, network RTT, battery, device profile.
  The old random THERMAL / NEURAL meters are gone. The header chip shows live FPS so you can judge speed on the phone.
- No backdrop-filter in the new shell; animation uses transform/opacity only.
- AR/goggles overlay kept and recoloured to the new palette.

## Verification
- node --check on 5 script blocks, ESLint: 0 hard errors; 0 missing / duplicate IDs; CSS braces balanced.
- 10-device functional simulation x3 (now including tab switching + live readouts): 30/30 clean.
- Real Chromium at 393x873 (realme 9 size): no page errors, no horizontal overflow.
- Real Chromium with CPU throttled 1x / 4x / 6x (approximating a Snapdragon 680): 59-60 fps idle and speaking
  (worst single frame 30 fps at 6x). Graphics were software-rendered, so confirm on the phone with the FPS chip.

## Coming in Phase 3
Image Studio (multi-provider + offline fallback), Code Studio (safe Worker runner), GPU-aware tiering, final 10-device run.
