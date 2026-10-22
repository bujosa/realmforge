# Northern threat presentation

`WildlingThreat` is an opt-in, public-information-only presenter. It depends on three.js, a small scene-space region, landmark anchors, and a finite ground-height callback. It never reads game state, imports the gallery, starts a loop, moves a camera, plays audio, creates lights, loads assets, or subscribes to events. All artwork is procedural. Strength is a public **track**, never an army count, population, force composition, or attack timetable.

## Visual design

| Public strength | Northern presentation |
| --- | --- |
| 0–2 | Two small illustrative embers, blue dusk; the forest remains quiet. |
| 4–6 | More forest fires fade in, with charcoal smoke columns and a warming horizon. |
| 8–10 | A darker storm front, restrained green aurora, wind-driven snow, three public beacon glows, and tall beacon flames and warm pools on the blue ice crest. |
| 12 | The forest and distant horizon burn across their full width, snow reaches maximum density, and the public track reads **Imminent**. |

Fire positions are deterministic decoration. Their number is unrelated to units or people. No horde silhouettes are used. Decorative torch ribbons mass at the treeline and move toward the Wall only during the public attack; finishing or skipping clears them immediately. The host supplies a caption/track UI using `state.strength` and `state.imminent`; the presenter itself has no DOM. Changes crossfade over **1.6 seconds**, restarting from the current interpolated value when interrupted. `animate:false` is intended for initial snapshots, seeking, and explicit snaps. Strength inputs are clamped to 0–12 and rounded to an even public track value; nonfinite values normalize to zero.

The region uses host scene units, X along the Wall, negative Z toward the northern horizon. Supply `minX`, `maxX`, `northZ`, `wallZ`, `wallHeight`, and typically three `beacons` with X/Z and optional absolute Y. `groundHeight(x,z)` returns scene-space Y. Geometry is sampled once during construction; reconstruct after a terrain-origin/sampler change. Coordinates are local to the presenter group. Transform the group and returned camera-path data consistently when the host rotates/translates that frame. Beacon anchors and terrain are owned by the caller; copy/reconstruct if they change.

## API and lifecycle

```ts
import { WildlingThreat } from "realmforge";

const threat = new WildlingThreat({
  region: {
    minX: -12, maxX: 12, northZ: -24, wallZ: 0, wallHeight: 4.26,
    beacons: [{ x: -10, z: 0 }, { x: 0, z: 0 }, { x: 10, z: 0 }],
  },
  groundHeight: (x, z) => publicTerrain.heightAt(x, z),
  quality: "balanced",
  reducedMotion: prefersReducedMotion,
  onCue: cue => gameAudio.routePublicCue(cue),
  onCaption: text => director.setCaption(text),
  onCameraPath: keyframes => director.offerCameraPath(keyframes),
  onReveal: kind => director.offerPublicRevealSlot(kind),
  onHighlightRegions: () => director.highlightPublicOutcomeRegions(),
});
world.add(threat.object);
threat.setStrength(snapshot.wildlingStrength, { animate: false });
threat.warmup(renderer, renderCamera);
// Subsequent snapshots: threat.setStrength(snapshot.wildlingStrength).
// Render loop: threat.update(deltaSeconds), unless presentationPaused.
// Public triggers: threat.play("threshold"), threat.play("attack").
// Public resolution: threat.play("nights-watch-victory" | "wildling-victory").
// Skip current step: threat.skip(); cancel remaining slots: threat.skip("all").
// Teardown: threat.dispose(); // idempotent; removes its group and owns its resources.
```

This snippet uses illustrative host adapters; they are not additional library APIs. `quality` fixes capacity at construction (`high` or `balanced`); reconstruct to change it. `reducedMotion` is mutable. It freezes decorative particle/sky drift, emits an empty camera path, and keeps strength crossfades and captions. The wildling-victory wave becomes a static area crossfade. Toggling reduced motion off resumes decoration; call `play` again to offer a new path. An update with a negative/nonfinite delta is ignored. No internal clock runs between calls. Pause by withholding `update`; captions and current strengths remain available.

`state` exposes public target/visual strength, `imminent`, current beat/step, step/beat time, caption, and immutable-by-contract camera path. `budget` reports fixed allocated draw/triangle/particle counts. `threatSteps` and `threatCameraPath` expose the choreography as data for an existing director. Paths have scene-space position/target tuples and times; the host chooses whether to accept them, blends in/out, and restores user navigation. The gallery uses its own camera adapter as a demonstration. The library owns no camera.

## Choreography

| Beat / step | Active time | Hook |
| --- | --- | --- |
| Threshold | 0–2.5 s | One horn, `The wildlings gather: N/12`, gentle Wall push. |
| Attack: first horn | 0–0.45 s | `horn`, Wall framing. |
| Attack: second horn | 0.45–0.90 s | `horn`. |
| Attack: third horn | 0.90–1.35 s | `horn`, attack caption. |
| Attack: horizon | 1.35–3.00 s | `drums`, camera travels from Wall to burning horizon. |
| Attack: bids | 3.00–4.00 s | `onReveal("bids")` requests the public bid-reveal slot. |
| Attack: card | 4.00–5.00 s | `onReveal("card")` requests the public big-card slot. |
| Watch victory | 0–3 s after public outcome | Fires extinguish in track order with lingering smoke puffs; beacons/rim flare and settle; the sky clears, presentation track resets to zero. |
| Wildling victory | 0–3 s after public outcome | Cold front rolls south over the Wall, `onHighlightRegions` requests affected public regions. |

Attack plus one outcome has **8 seconds of active presentation**, below the 9-second budget. Waiting for authoritative bids/card/outcome belongs to the host and must not run a speculative outcome. The library never invents a card, bid, winning house, affected region, or victory. `onReveal` is an empty scheduling slot, not a command to expose unknown information. Queue the slot until its corresponding public event is available. If a network/game decision is pending, the director can end the opening at 5 seconds and resume only the public outcome later. Never stretch an animation to imply an attack countdown.

`skip()` advances one current step and enters the next; entering a new step emits its hook once. `skip("all")` cancels remaining steps without emitting their reveal hooks. Natural completion clears caption/path and emits `settle`. Skipping a Watch outcome settles its presentation reset immediately. Starting another beat replaces the prior choreography; hosts must deduplicate public event IDs and arbitrate interruptions. Skip/reset affects presentation only and must never change game rules or submit bids.

## Cues

| Cue | Host meaning / suggested routing |
| --- | --- |
| `horn` | Existing `evt.wall.horn` through `SfxManager`; three callbacks during attack. |
| `wind` | Northern storm / cold public outcome. |
| `drums` | Attack horizon tension. |
| `beacons` | Watch victory flare. |
| `settle` | End or cancel a beat; release sustained ambience. |

The 22 October worker brief deliberately extends the frozen bible’s attack-only horn policy with a public threshold horn, and replaces the older strength-dependent 1/2/3 attack calls with three calls for this set piece. It also extends the old 0–8-hearth vocabulary into abstract forest fires and a burning horizon. These are presentation changes requested by the newer brief; the gallery’s current reference retains the old hearth count. No decorative people are introduced. The game adapter should adopt these policies explicitly when integrating.

There are no audio files, synthesized audio, audio contexts, or direct `SfxManager` imports. The host may ignore a cue. Strength updates alone never emit horns. The host triggers threshold warnings only for a newly observed public crossing, suppressing replay/initial-snapshot spam.

## Fixed rendering budgets and warmup

| Quality | Draws | Triangles | Instanced quads | Limit |
| --- | ---: | ---: | ---: | --- |
| High | 6 | 9,120 | 1,680 | ≤12 draws / 60,000 triangles |
| Balanced | 6 | 6,984 | 612 | ≤6 draws / 25,000 triangles |

Counts apply to the **whole presenter** at every strength and beat, including dormant effects. They exclude the gallery's forest, terrain, Wall, forts, DOM and core render output. No strength change allocates geometry, textures, materials, lights, or shader variants. Six fixed draws cover the procedural horizon/pall, alpha smoke/snow/blizzard batch, additive flame/core/glow/sparks/torch batch (including horizontal ground-glow quads), terrain-conforming northern dusk grade, local beacon rim, and terrain-conforming southern frost plane. Layered wind-sheared smoke puffs, flame tongues and warm projected light pools use no textures, lights or extra passes. All use fixed material configurations and remain submitted during warmup, including transparent/dormant effects. Balanced reduces decorative density; it conveys the same public state.

Call synchronous `warmup(renderer,camera)` after renderer tone mapping, color space and shader-related configuration are set. It clones the group structure while sharing presenter resources, compiles and renders every fixed material to a temporary 8×8 target, then restores the previous render target, viewport and scissor. It neither reparents the live object nor emits cues. Warmup does not compile the host's terrain, atmosphere, UI or postprocessing. A host changing render configuration/context must warm up again. The QA script measures actual draws/triangles in an isolated scene and counts `renderer.info.programs` across all seven strengths and all four beats, including reduced motion. Expected new programs after warmup: **0**.

## Game integration (production d594e1c1)

| Existing owner | Integration change | Public driver |
| --- | --- | --- |
| `WorldWildlings` | Replace its active fire/smoke presentation with one presenter; retain terrain clearings/label anchoring as host adapters if needed. Do not render the old camp fires twice. Inject the existing public northern region/ground sampler and three Wall landmarks. | `TabletopSnapshot.wildlingStrength` only. |
| `WorldNorth` | Retain scenery and public terrain reservations. Do not interpret decorative fire density as camps, people, or gameplay occupancy. | Public terrain and authored anchors. |
| `TabletopAtmosphere` | Coordinate its existing winter transition with this local northern storm layer. Suppress duplicate northern snow if appropriate; preserve weather-driven snow elsewhere. | `snapshot.weather?.winter` and public strength ≥8, respecting the current weather override. |
| `TabletopWeather`, `WorldWater` | Keep their weather/ice ownership; this presenter does not freeze water or modify global weather. | Existing `snapshot.weather` / public strength fallback. |
| Cinema `wildling-attack` beat | Offer the camera data to `director/policy.ts` set-piece arbitration. Call `play("attack")` only on the public trigger, once per attack; route subsequent reveals into the same attack context. Respect paused, replay, reduced motion, skip and user-camera policy. | Public `wildling-strength-trigger-wildlings-attack` or `preemptive-raid-wildlings-attack` log event. |
| `BidReveal` | Mount the existing UI in the `onReveal("bids")` slot only after bids are public. Never animate live sealed selections. | Public `wildling-bidding`: `results` (bid/house groups), `wildlingStrength`, `nightsWatchVictory`. |
| `wildlingFace` / wildling attack panel | Use the big-card slot for the existing revealed face and printed outcome; no prediction or substitute card artwork. | Public `wildling-card-revealed.wildlingCard`. |
| Outcome / region emphasis | Play Watch or wildling victory only after the public result; resolve affected regions using the public card effect and final result. The callback has no hidden region payload. | Revealed bidding victory, revealed card, resolved public effects. |

Important ordering: the frozen renderer maps all four trigger/reveal event types to `wildling-attack`. Do **not** restart three horns on `wildling-bidding` or `wildling-card-revealed`. Use an attack-context key anchored to the public trigger and deduplicate replayed log IDs. Queue separately arriving reveal events, and wait for both the revealed card and resolved effect before emphasizing affected regions. The `results` array already contains the public bid groups; total aid is `sum(bid * houses.length)`. A card-reveal callback alone is insufficient to infer affected houses.

A Watch victory starts a local zero-strength visual reset to satisfy the presentation beat. The game remains authoritative: reconcile the actual resulting public `snapshot.wildlingStrength` after resolution, and do not feed an old pre-resolution snapshot back during the reset. Wildling victory keeps the supplied public strength until the next authoritative snapshot; card rules may determine a different resulting track. This library never mutates `Game`, sends actions, or changes a track server-side.

Migration is opt-in: adapt coordinates and lifecycle in the game, warm up before enabling, visually compare against the existing implementation, then remove overlapping effects. Rollback is to restore the original `WorldWildlings` render path. No backend/schema change, migration, network dependency or production deploy is part of this work.

## Gallery and QA

Stories self-register under **Wildlings**: `wildlings/track`, `wildlings/threshold`, `wildlings/attack`, and `wildlings/current`. The live slider changes public strength in steps of two without rebuilding the presenter. Story controls expose quality, reduced motion and World / Wall / free-orbit camera presets. The World preset reuses the production renderer's **38° lens** and is fitted to a synthetic northern patch; it is not a full frozen production map or an exact production camera pose. The patch reuses natural trees and mountain-rock terrain, `wallPath`/`wallGeometry`/`WallIceMaterial` from `cities/WallArt`, the physical 213 m constant from `wallScale`, and detailed `watchFortGeometry` (Castle Black stairs/winch, Shadow Tower and Eastwatch). The existing northern palette comes from the library castle builder. The gallery adapter smoothly grades its existing lights from blue dusk to night and restores them on disposal; the ice shader retains blue base strata and adds emissive warm pools near the beacon anchors. No lights are allocated by either threat level or beat. Game integration must coordinate the existing atmosphere/exposure with this local grade; the presenter does not mutate host materials or scene lighting. The current reference copies production geometry and the turf-shelter method into the story folder; placement is synthetic, while x20 hearth count (0–8), hut sizes, smoke timing and geometry are preserved. A full raw reference of `WorldWildlings.ts` is retained as `.ts.reference` to avoid importing game dependencies.

Run `nice -n 10 node qa/wildlings.cjs` after `nice -n 10 npm run build`. It uses the existing external Playwright install, headless Chrome/Metal and WebKit, 1440×900 and 390×844 viewports, and a temporary preview on **5221**. It owns and stops only its exact child PID in `finally`, including failures. No persistent gallery server is required. Evidence is written only under `~/.t3/userdata/project-handoffs/swords-v3-realism-20261018/evidence/rf-wild/r2/`.

The runner captures the seven strengths from both camera presets, per-engine/per-viewport contact sheets, the current comparison, reduced motion, six WebM clips (threshold and both outcomes in both engines), actual isolated budgets, shader sweeps and API-contract checks. It records `uptime` before timings. Frame timings use the gallery renderer’s RAF timestamp intervals over 125 samples per level (callback wall-clock p95 is retained separately), excluding screenshot/video capture and construction; the physical 60 Hz target is 16.667 ms. Each engine/viewport/quality also measures a matched empty-gallery control (same UI and render loop, story geometry hidden). The round-2 director gate requires p95 ≤ the matched control p95 + 1.5 ms in both engines. Control and raw p50/p95 remain visible; no control subtraction is hidden in the reported numbers. WebKit RAF timestamps have integer-millisecond resolution in this environment. Both the control and raw presenter timings are retained. It reports raw p50/p95, rather than calling a slower frame rate a pass. Current performance results and limitations belong in the evidence report, not a hardcoded promise in the API.

Round-2 evidence adds side-by-side round-1/round-2 contact sheets at 0/6/12 for every engine, viewport and camera, and outcome stills at 800/1450 ms. The public API, 1.6 s transitions, 2.5 s threshold, 5 s attack opening and 3 s outcome timings are unchanged. Reduced motion retains a static blizzard/frost crossfade and freezes torch translation. The blue-white frost follows the sampled ground south of the Wall; it is an ephemeral public-outcome effect, not persistent game-terrain state.
