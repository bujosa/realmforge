# Landscape look development

Open **Look development → Three ways to a living world** (`#lookdev/landscape`).
Choose an art direction, High/Balanced and World x20/Regional/Close/Essos. All
controls are URL-addressable. **Play 30 s flight** visits the northern mountains,
castle, fields, strait and eastern harbor. **Release camera** enables gallery
flight (drag, WASD, Q/E); wheel reduces travel speed for close inspection.

## Direction and recommendation

B, Grounded realism, is the recommended material/lighting target. Its subdued
natural palette, photographic ground layers and cutout near foliage provide the
most useful path from the present tabletop to a believable landscape. A is the
clearest strategic-map alternative: luminous paint, softened contrast and solid
sculpted crowns. C retains B's near foliage but adds latitude-dependent snow,
colder northern vegetation, cloud shadow and a warmer southern grade. C should
be optional art direction until its darker forests are approved on a phone.

These are original synthetic landscapes, not a geographic reconstruction of
Westeros. Essos receives the same terrain sampling, materials, vegetation LOD,
sea, light and authored settlement detail. No locked-state desaturation or
quality reduction is applied. The eastern city is a neutral Free City study,
not a reconstruction of a copyrighted screen design. No HBO art or new external
assets are used.

## Boundaries and lifecycle

- `src/lookdev/directions.ts`: numeric art settings and deterministic analytic
  height, shore and river functions. The CPU and water shader share formulas.
- `src/lookdev/surfaces.ts`: continuous PBR terrain, slope/height/climate blending,
  triplanar rock sampling, fields/vineyards, analytic coastal shallows/foam,
  layered waves and procedural gradient/cloud sky.
- `src/lookdev/vegetation.ts`: seeded regional species, packed instanced batches,
  detailed near foliage, low geometry silhouettes and distant overhead impostors.
  The existing canopy atlas is reused; a tiny original procedural leaf texture
  supplies B/C cutouts. A uses solid crowns. No runtime image dependency.
- `src/lookdev/settlements.ts`: the sampler's production castle/home geometries,
  a neutral procedural harbor city and terrain-conforming roads. Flat sites blend
  into the heightfield rather than placing a separate display slab underneath.
- `src/lookdev/index.ts`: portable content factory, readiness, frame updates,
  texture accounting and disposal. No game singleton or gallery dependency.
- `gallery/stories/lookdev/landscape.ts`: gallery-only lights, UI and camera
  adapter. Restores scene state and disposes scene-owned sky, shadows and arrays.

No existing story, shared nature/material implementation, public barrel,
package dependency or army/heraldry/wildling file was changed. Import directly
from `src/lookdev` while this remains a prototype. Failures in CC0 preparation
remain visible and do not report false readiness.

The gallery lacks a camera-preset hook. The adapter switches its public camera
control to flight and temporarily owns `scene.onBeforeRender`, updating camera
matrices after gallery navigation and before render projection. This is kept
outside portable content. Free flight releases preset ownership. Downstream
code should use its own camera controller, not copy this adapter.

## Camera provenance and comparison limits

Vertical FOV is 38°, matching the game's `TabletopScene.ts`. World x20 uses the
saved r6-armies/r3 default **offset** `(0, 134.50025294, 38.67615919)`, translated to
the sampler. That preserves the 73.95° inclination and measured world distance.
Portrait expands distance to retain the subject. Regional uses the saved
regional direction `(0.25, 0.75, 0.66)` at a larger landscape-study distance;
Close deliberately frames a complete castle rather than a single soldier.

The contact sheets include the supplied production screenshots, with their UI,
and the synthetic sampler. They are art-direction comparisons, not pixel-matched
before/after claims, and the phone viewport is desktop browser emulation.

## Costs and quality controls

High uses a 384×320 terrain grid, up to 4,500 seeded tree candidates, packed near
cutouts within 18 units, low silhouettes elsewhere and overhead oak impostors
beyond 60 units. One 1024² directional shadow map is shared. Balanced uses a
224×190 grid, 2,800 candidates, low geometry trees/impostors and no shadow map.
Trees rejected by site/height/river rules never allocate per-tree draw calls.

Existing 512²×6 albedo/normal/roughness KTX2 arrays are loaded once per scene.
Texture memory includes their actual transcoded mip byte lengths, two 512²
RGBA canopy textures with estimated mip chains, and the 128² leaf texture.
High adds an 8 MiB shadow target (4 MiB RGBA color + 4 MiB depth); default framebuffer and browser-managed
render targets are not included. GPU compression differs by engine. No new
asset download or licensing work is necessary; source licenses remain under
`src/materials/assets/licenses` and `assets/world/ATTRIBUTION.md`.

All visible material variants are compiled asynchronously. A tiny offscreen
render with at least one instance per LOD prewarms the shadow/cutout variants.
Do this before exposing the game camera. Never introduce a material variant in
the motion loop. Browser instrumentation counts actual `createProgram` calls.
The evidence report contains measured frame intervals and budgets; CPU submission
time in the gallery HUD is not a GPU frame-time claim.

## Porting plan: game files, incremental cost and risks

Paths below are relative to `agot-bg-game-server/src/client/tabletop/` in the
existing game. They were inspected read-only. No game worktree was changed.

| Option | Game files to adapt | Expected incremental cost | Principal risks |
| --- | --- | --- | --- |
| A | `world/WorldMaterial.ts`, `WorldTerrain.ts`, `WorldScenery.ts`, `WorldSky.ts`, `WorldWater.ts`; lighting in `scene/TabletopScene.ts` | Primarily uniform/palette and light changes; add macro/slope blending, canopy edge variation and shared surf function. No postprocessing pass. | Bright foliage can compete with region markers; illustrative crowns remain visible close up. |
| B | A's files plus `world/WorldHeightfield.ts`, `WorldOceanField.ts`, material-array adapter and vegetation geometry/LOD owner | Reuse present CC0 arrays. Add two leaf material variants, one cutout depth variant and packed instance updates; optional shared 1024² shadow map. | Texture/normal scale must use game metres, LOD transitions need hysteresis, shader precision and mobile GPU fill rate need a game benchmark. |
| C | B's files plus `world/WorldNorth.ts` and climate values supplied to `WorldMaterial.ts`/`WorldSky.ts` | A few climate/cloud uniforms and terrain shader samples; no screen-space effect. | North can become too dark, winter overlays may double snow, fog can conceal tactical labels. |

Keep existing game surface heights, coast-distance/river fields, castle placement
and permission/visibility contracts authoritative. **Do not port this synthetic
heightfield, demo street layout or neutral city recipe as game geography.** Port
only the material weights, species/LOD strategy, shared shore response and
lighting settings. Derive snow and species from public climate, never ownership
or hidden game state. Reuse `scene/geometry/CastleMaterial.ts` and
`realism/cities/CityMaterial.ts` for equivalent stone grain; keep their semantic
attributes and exclusions intact.

Suggested sequence: (1) behind an opt-in art flag, add uniform-driven terrain and
sea settings with existing geographic inputs; (2) add instanced species/LOD and
prewarm; (3) test castle ground contact and city entrances against production
height data; (4) compare full game x20 in Chrome/WebKit, labels, locks and phone;
(5) let David choose A/B/C before changing the default. Rollback is the original
art flag; keep saves, rules, navigation and gameplay unchanged.

The prototype's low-detail castle crenellations, rounded mountain relief and
plain city blocks still need artistic refinement before promising film-like
closeups. A direction approval is separate from approval to ship the result.

## Reproduce evidence

From this worktree, run commands under `nice -n 10`:

```
npx tsc --noEmit
npm run build
node qa/lookdev.cjs full
node qa/lookdev.cjs video
node qa/lookdev-sheets.cjs
git diff --check
```

The capture runner owns a single headless preview on 5241 through `qa/server.cjs`
and stops its exact PID in `finally`, including failure. Chrome uses the required
Metal flags; WebKit uses Playwright's headless engine. All screenshots are JPEG
quality 72. Videos record the canvas for 30 seconds at 24 fps. No UI regression
test suite is added; this is the brief's bounded evidence capture.
