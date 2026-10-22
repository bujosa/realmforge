# Animated companies

`src/armies` is a procedural, game-independent company renderer. It sits alongside
`src/pieces`, which remains the current production reference. The gallery has ten
terrain/heraldry stories (five unit types, near/far), a state player, a ten-second
battle, High/Balanced 120-company boards, a before/after study, and a World camera
scale study. All geometry and the army gallery's demo emblems are original code.

```ts
import { ArmyBatch } from "./src/armies";
import { registerSigil } from "./src/heraldry/sources";

registerSigil("faction", hostOwnedSvg);
const batch = new ArmyBatch({ renderer, detail: "balanced", capacityPerType: 128 });
scene.add(batch.object);
const company = batch.add({
  type: "knight", house: "faction", color: "#1c1c1c",
  position: { x: 0, y: 0, z: 0 }, heading: 0, scale: 0.7,
  presentation: "world", lod: "auto", seed: 42,
});
await batch.warmup(renderer, camera, scene);
company.setState("march", {
  path: [{ x: 0, z: 0 }, { x: 0, z: -2 }], duration: 1.8, transition: 0.3,
});
batch.update(deltaSeconds, camera); // called by the host's existing frame loop
company.setState("defend");
company.setSelected(true);
company.setWounded(true);
batch.setMotionScale(0); // static final pose; path cues snap to destination
batch.setPaused(true); // freezes clock, transforms, poses and LOD updates
company.remove();
scene.remove(batch.object);
batch.dispose();
```

## Units and artwork

- Infantry: nine soldiers in three ranks, a captain, a standard-bearer, surcoats,
  heater shields, helmets, boots and spears. Human height is about seven heads.
- Cavalry: four mounted riders (three in far LOD), distinct horse coats, sloping
  necks, projecting muzzles, ears, manes, four legs, tails, caparisons, lances,
  pennons and a company standard. Caparisons include a top cloth visible overhead.
- Trebuchet: timber frame, axle, wheels, counterweight, swinging throwing arm,
  sling, projectile and three crew.
- Galley: pointed lofted hull, colored stripe, deck, oars on both sides, heraldic
  sail, three marines, raised bow/figurehead and stern lantern.
- Wyvern: two hind legs, arched neck, horned head, scalloped membrane wings and a
  tapered tail, with faction-colored wing membranes.

House color is on garments, shields, caparisons, standards and sails, rather than
only on a base. The linear-light luminance thresholds 0.08 and 0.65 select gold or
slate trim for black and very light palettes. A small shader rim contribution keeps
cloth edges visible; natural materials retain independent steel/leather/wood tints.
There is no World plinth: a single soft contact pass draws a shadow and a fine ring.
`presentation: "table"` or `plinth: true` enables a low solid plinth. An explicit
`plinth` setting takes precedence over `presentation`. `setSelected` brightens the
ring; hover can use the same host-managed flag.

The public API contains no house names, emblem assets or faction lookup table.
`registerSigil` and `setSigilResolver` remain host-owned. Register sources before
adding companies; the atlas captures the resolved SVG once per batch. Recreate a
batch after replacing a source. An unknown key uses the neutral marker. A batch
supports 64 sigils in a 1024² alpha atlas, shared across all types and LODs. Both
sides of flags and sails carry the source, with reverse-face UV correction. The
army gallery temporarily registers original wolf, kraken, stag, lion, rose and
sun/spear demo silhouettes, then restores the gallery's previous sources on dispose.
These are original interpretations, not official franchise or licensed artwork.

Per-soldier part roots/phases plus the company seed give deterministic height
variation (±4%), slightly varied poses and geometry-painted shade variation. The
same seed and options reproduce the same company. Seeds vary animation/height;
the baked soldier shade pattern is shared by a type/LOD pool.

## Animation and transitions

`idle`, `march`, `attack`, `charge`, `defend`, `rout`, `retreat`, `wounded`,
`destroyed` and `victory` are supported. Eight float weights encode the poses;
idle is all zeroes and rout/retreat share a running pose. Interruptions interpolate
from the current weights using smoothstep (default 0.3 seconds). Shader part IDs
and pivots animate limbs, weapon arms, raised shields, cloth, horse heads/tails,
throwing arms/projectiles, oars and wings. Per-company attributes carry selection,
heraldry, plinth and injury/death data. There are no skeletons or soldier scene nodes.

March/charge/run animate locomotion and dust. Path points are copied on the cue;
arc-length interpolation keeps speed constant across unequal segments. Heading
turns toward the segment tangent; a retreat with no path turns through 180°.
The path ends at its last point; the host sends `idle` to stop the gait. Wounded
poses lower/drop a deterministic subset of soldiers and tear/lower cloth. Destroyed
poses fall, dither-fade, sink into terrain, or roll/sink under water. Victory lifts
weapons; idle breath, pennon wind, head shake, tail swish and ship bob/roll are cheap
vertex motions. Motion is stylized miniature animation; it is not a collision,
bone animation, cloth physics, projectile damage or tactical simulation system.

Nothing schedules its own RAF or timer. `update` drives an explicit, finite clock;
negative/nonfinite delta is ignored and a delta is capped at 0.1 seconds to avoid
resume jumps. Motion scale 0–2 controls the complete clock, including paths and
transitions, without changing phase abruptly. Zero disables loop amplitudes and
sets cue weights/path/death to their final static poses. Pausing holds everything.
The battle story also freezes its narrative under reduced motion. The host should
wire its reduced-motion preference to `setMotionScale(0)`.

## Instancing, LOD and lifecycle

A batch owns two fixed-capacity pools per type, one lit material, one contact
material and one atlas. Draw count depends on occupied type/LOD pools, never on
company or house count. Each occupied pool costs two draws. High's maximum with
all ten pools occupied is 20 draws; Balanced's maximum is also 20. Low forces far
geometry. The far LOD uses octahedral forms, fewer cavalry/oars, simpler cloth and
fewer fittings while retaining ranks and heraldry.

Pass the perspective camera to `update` for automatic LOD. A projected formation
fraction below 7.5% enters far LOD; above 10.5% returns to near LOD. Hysteresis uses
the batch world transform and camera zoom. `lod: "near" | "far"` pins the chosen
representation. `unit.lod` can be changed at runtime. Pool migration keeps the
handle, state, path, seed and atlas tile. Unit coordinates and paths are batch-local;
the batch can be transformed as one object. Selection/raycast mapping and terrain
height sampling belong to the host. Raycasting uses the unsimulated geometry;
provide a separate stable hit proxy instead of relying on shader limb positions.

The update loop reuses matrices, vectors and weight arrays and creates no explicit
per-frame objects or arrays. Cue setup, adds/removes and the allocating `stats`
getter are outside that loop. CPU geometry is built once per batch/type/LOD;
there are no per-soldier CPU updates. Instanced attributes still upload per frame.
`warmup(renderer, camera, scene)` compiles all pool material variants, including
empty/far pools, with the actual scene's light layout. Await it before showing
motion. Changing host lighting/fog/shadow configuration requires another warmup.
All state changes are attributes/uniforms, not new shader variants.

Moving/removing companies invalidates both sculpt and contact-pass bounds, so
catalog reframing follows the current formations. Remove compacts pools and keeps
other handles valid. Dispose is idempotent,
invalidates handles, empties pools, releases merged/contact geometry, instancing
resources, both materials and the atlas. Remove `batch.object` from the host scene;
`dispose()` does not own the host's scene/camera/renderer. No external animation or
texture files are loaded by the renderer.

## World x1 scale proposal

Frozen game reference: d594e1c1, `src/client/tabletop/scene/TabletopScene.ts`:
vertical FOV 38° (line 206); `BoardCameraTilt.ts` sets `BOARD_PLAY_TILT` to 20° from
vertical. The production reset camera solves its distance against the visible
board (TabletopScene lines 2543–2586), so a single fixed distance is not universal.
`BoardPieceSize.ts` measures projected miniature bounds and `TabletopScene.ts`
lines 3290–3324 apply per-type screen targets and bounded growth. Production World
minimum references at normal density are footmen 45/35 px, knights 50/39 px,
siege 48/38 px, ships 60/48 px and dragons 76/58 px (desktop/phone). Those minima
shrink at Fit; they are not guarantees at every zoom. Current `WorldCompanies.ts`
uses six infantry or three horses, tiny cloth and a solid plinth.

Proposed new company footprint: **64 CSS px at 1440×900 and 56 CSS px at 390×844**,
measured on the XZ formation envelope, not the spear/banner height. Near inspection
may grow naturally. Keep a 44 px stable hit target independent of sculpt detail.
For a first approximation `scale = targetPx * (2*d*tan(fov/2)) / (height*footprint)`;
measure actual projected bounds afterward and honor region-slot collision limits.
Banners are taller than this footprint and individual faces/sigils are not expected
to resolve at strategic distance; company type, house silhouette and cloth color
must resolve. No claim is made that nine full soldier figures fit in 35 px.

`armies/world-scale` uses the 38°/20° lens and procedural `src/castles` stronghold
geometry. All displayed world dimensions are uniformly enlarged 5× for inspection;
the castle's authored dimensions are otherwise unchanged. Company strategic
scales are solved against the proposed pixel footprint. It exposes actual projected
bounds to QA. This synthetic study is not the production board or its size law.
Castles remain the larger landmarks. The broader physical city scale reference
remains `scale/production`; cities/castles were read only during this task.

## Validation and game integration

Run `npx tsc --noEmit`, `npm run build`, `git diff --check`, then run `node qa/armies.cjs`. The runner starts one built-gallery preview
on 5211, refuses occupied endpoints, and stops its exact child PID in `finally`,
including on failure or interruption. No server remains between runs. It uses the specified existing
Playwright install, Chrome with Metal/GPU flags and WebKit. `--quick` skips videos,
contact sheets and expanded per-house captures. Evidence defaults to
`~/.t3/userdata/project-handoffs/swords-v3-realism-20261018/evidence/rf-armies/r2`.
`ARMY_URL` and `ARMY_EVIDENCE` override the test endpoint/output. Screenshots use JPEG
quality 72. Full QA records all ten states in the player and the complete battle
loop at desktop/phone in both engines, houses on all terrain catalogs, five unit-type contact sheets
(six houses × ten states each), before/after and cavalry top/side views.

Run `node qa/armies-perf.cjs` after the main QA run for exact 1440×900 and
390×844 drawing-buffer benchmarks. The main gallery screenshots use those window
sizes, while the canvas pane also leaves room for navigation and controls. The
separate benchmark verifies the actual drawing-buffer dimensions, measures all
eight engine/size/detail cases and records an empty baseline for each. Both
runners own and stop their preview PID; run them sequentially.

The test records host uptime/load before every timed board run, geometry counts,
raw frame interval p50/p95, update CPU p95, actual scene totals, hardware identity,
programs added after warmup, console/WebGL errors and an empty-board baseline.
Frame interval uses the actual update timestamp, not the gallery's clamped delta.
Budgets are strict: High ≤40 draws/400k triangles, Balanced ≤20/160k, no late
programs, and frame p95 ≤16.7 ms. A 16.8 ms result is a failure even if an empty
browser baseline has the same refresh cadence. See the evidence report for measured
results and GO/NO-GO; successful typecheck/build alone is not a release decision.

The package root does not yet re-export armies; import the `src/armies` entry
directly. A one-line root-export proposal is supplied as `hooks.patch` in the
evidence directory for the owning worker/director; it has not been applied here.

For game integration: register host-owned heraldry, create one scene batch, map
unit snapshots to persistent handles, pass terrain/water-rooted positions, translate
movement/combat cues to states/paths, connect selection and reduced motion, await
warmup against the actual light/fog layout, update from the existing frame clock,
and remove/dispose on scene exit. Replace the current miniature draws instead of
keeping both renderers active. Validate the pixel sizing and region crowding in the
real board; include orders, castle/city shadows, ocean/post effects and touch hit
proxies in the total budget. The current library budgets exclude those game costs.

The gallery readiness contract is deliberately `ready(): true` because geometry is
synchronous and the gallery's QA sheet polls readiness without updates. Its separate
`warmed` promise begins on the first update; the army QA surface waits on that
promise's completion. This preserves the director's merged readiness correction.
