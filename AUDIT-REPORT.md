# JARVIS v11 → v11.1 — Phase 1 audit

Scope: all 4,147 lines of index.html (4 inline scripts, 331 CSS rules, 105 element IDs), manifest.json, service-worker.js.

## Checks run
| Check | Result |
|---|---|
| `node --check` on all 4 script blocks | 0 syntax errors |
| ESLint (no-undef, redeclare, dupe keys, const-assign, unsafe-finally, unreachable …) | 0 hard errors after fixes |
| Every `$('id')` / getElementById target exists in the HTML | 77/77 resolve, 0 duplicate IDs |
| CSS brace balance | 331 / 331 |
| Secret scan (gsk_, AIza, sk_, xi-api) | none embedded |
| innerHTML scan | only static strings, no user-data injection |
| Device simulation (10 devices × 3 runs, boot + 20 commands + settings + wake + goggles + code blocks + 150-message stress) | 30/30 clean |

## Fixes applied (v11.1)
1. **Fragile promise chains** — `play()`, `requestFullscreen()`, `exitFullscreen()`, `wakeLock.release()`, `audioCtx.resume()` were chained with `.catch()` directly. Some WebViews/older WebKit return `undefined` from these, which throws "Cannot read properties of undefined (reading 'catch')" and aborts exitGoggles midway (camera left on). All now go through a `safeP()` wrapper.
2. **Bare `Persona.*` references** (4×) resolved only through an implicit window property set by a later script. Made explicit as `window.Persona.*`.
3. **Fake battery reading** — on devices without the Battery API (iPhone, Firefox) the power ring showed a random 92–97 %. Now shows `--%`.
4. **Metrics loop** — ran every 400 ms with DOM writes; now 1 s on low-tier devices (Snapdragon 680 class).
5. **Version drift** — UI said v10.5, manifest 10.5, SW cache v11-persona; unified to v11.1, new cache name so phones pick up the update.

## Findings carried into Phase 2 / 3
- THERMAL and NEURAL meters are synthetic random values → replace with real readouts (FPS, JS heap, main-thread lag, battery, network).
- Device tiering uses cores + RAM only: an 8 GB mid-range Mali phone is classed "high" with a 2 GB GPU budget. Add GPU-family awareness.
- Code-block **RUN** executes user code in a sandboxed iframe on the main process; an infinite loop can freeze the UI on low-memory Android (no site isolation). Move to a Worker with a hard timeout.
- Image generation depends on a single free host. Add fallback chain + an offline procedural renderer so it never returns nothing.
- `downloadLastImage` uses cross-origin fetch (CORS-dependent) with no fallback.

## Limits of the simulation (be aware)
The harness simulates each device's *capabilities and constraints* (UA, cores, RAM bucket, GPU string, WebGPU / SpeechRecognition / Battery availability, JS heap ceiling) and exercises every code path they trigger. It does **not** emulate Adreno 610 throughput or thermals, so real FPS must be confirmed on the phone — Phase 2 adds a live FPS/heap readout for that.
