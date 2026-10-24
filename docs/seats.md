# Seat studies

Two original procedural landscape and architecture variants for each of three iconic landscape seats, in the gallery's **Seat studies** category. Look B supplies the natural daylight palette, ACES filmic output and atmospheric perspective. No external art or new dependencies are used. These are design targets, not production replacements.

## API and ownership

`src/seats/index.ts` exports `createSeatStudy(kind, variant)`, `seatCamera`, the neutral kind/variant/pose types and `seatNotes`. The builder depends on three.js and the existing deterministic look-development noise helpers. It returns a group, a local terrain sampler and a close-camera focus. It never imports the gallery, game state or world singletons. The host disposes all geometry/materials and instanced buffers after unmounting; the gallery uses `releaseObject`. Geometry is batched by shape with shared mineral material and instance colours. Glazing, water, terrain and small bespoke branches/ribs are separate draws. No animation scheduler, DOM or network work enters the library builder.

`gallery/stories/seats/studies.ts` owns light, shadows, camera presets, live variant/reference controls, shader preparation a 20-second orbit and an explicit free-camera release. It restores scene lights, background, fog, camera projection, renderer shadow/exposure state and the render hook on disposal. Existing armies, wildlings and heraldry code and gallery stories are untouched. Public root exports remain unchanged while these studies await design approval; deep imports from `src/seats` are opt-in.

One scene unit is 50 physical metres. This is physical scale, **not** another multiplication by the game's x20 board magnification. FOV is 38 degrees. Overview uses the measured game inclination (134.50025 vertical / 38.67616 horizontal); regional and close use 2,000 m and 600 m optical target distance. Portrait preserves those optical distances and vertical FOV, so horizontal context is cropped. Overview is a local representative region, not the full production continent.

The reference toggle selects existing demo recipe data and renders the library's extracted production complex on flat ground. It uses exactly the proposed study's camera transform and projection. It is a controlled geometry comparison, not a screenshot of the current live game: surrounding cities, streamed terrain, weather and overlays are absent. Archived actual game screenshots belong in external evidence and must retain that distinction.

## Capital of the Three Hills

**A · Steep crown city** is the recommended silhouette: three separate elevations, warm red royal citadel nearest the bay, pale seven-spired religious dome, an open ruined dome and dense terracotta roof fields following the slope. Gates, river mouth, docks and quays anchor the inhabited scale. **B · Harbour metropolis** lowers and broadens all three hills, expands the housing footprint and wall polygon, and adds thirteen quays and a larger waterline warehouse district. A prioritises the steep three-crown silhouette; B prioritises a working port city.

Design dimensions: city about 1.4 × 1.2 km; hill crowns approximately 135–250 m above the surrounding plain; citadel towers approximately 115–165 m above their bases. These heights are deliberate readability exaggerations and need regional calibration. Houses remain approximately 10–20 m tall. Existing resource/formation slots must keep their current clearance and banner anchor.

Porting sequence:

1. The **game terrain owner** must approve and mount a continuous three-hill field through `world/WorldTerrain.ts`, `world/terrain/HillProfile.ts`, `world/terrain/TerrainSampler.ts` and the `WorldScene` terrain bridge. Do not import the study's square terrain mesh into the game. `WorldTerrain.mountHills` and mesh-height queries must agree with collision/walking, coast and river. The seat worker must not independently change the atlas, CDLOD or terrain sampler.
2. In `realism/cities/PhysicalRecipes.ts`, `PhysicalLayout.ts`, `PhysicalCity.ts` and `PhysicalWorld.ts`, add district reservations for the three crowns, slope-following housing/street placement and harbour access. Sample rendered mesh heights, rather than seating every roof on a flat district. Invalidate terrain seating after hill stamps settle.
3. In `scene/geometry/complex/CrownSeatRecipes.ts`, `ComplexPlan.ts`, `ComplexGeometry.ts` and `CrownSeatArt.ts`, retain public gameplay anchors while authoring red citadel, seven-spired dome and broken dome masses. Avoid duplicating the existing strategic miniature at the same anchor.
4. Convert physical metres through the existing `SceneFrame` once; reserve roofs and terrain as scenery and keep occupied unit/port/banner slots clear. Compare matched 2 km/600 m views before testing full-world x20.

Main risks: hills outside regional boundaries, a river displaced uphill, floating roofs after streaming, oversized scenic landmarks competing with tokens, dense house shadows and cliffs beneath walls. Round 2 replaces the broad royal plinth with individual embedded foundations and stepped wall segments. Green Gaussian hills, climbing roof rows and pale switchback street markers expose the relief. The street markers still need continuous production paving and slope-aware orientation. The existing whole-world batch/LOD system, not this entire gallery group, should own production draw submission.

## Dragon-carved Island Keep

**A · Dragon towers** is the recommended starting point: basalt cliffs descend to water, the drum and unequal spires remain visible, crouching winged sculptures cap the drum and gateways, and a black-sand cove breaks the outline. **B · Carved dragon ridge** embeds two much larger coiled beasts in the coastal rock below a taller rear ridge, instead of placing three beasts on the architecture. Original shapes imply carved beasts; they are not reproductions of screen art.

Port the neutral drum, unequal spires and winged-carving proportions into `scene/geometry/complex/CrownSeatRecipes.ts` and `CrownSeatArt.ts`, with fitted extents/volumes in `ComplexPlan.ts`. Keep cliffs and the volcanic ridge under the terrain owner's `world/WorldTerrain.ts`/`world/terrain/*` and island shoreline data. Never hide an entire island mountain inside a castle prop. The bridge, landing and climbing path need the same rendered-height source as walls. Retain water and foam under the world's existing water renderer. Risks: the repeated basalt columns and static foam remain a stylised geological study, rear relief can intersect walls, dark basalt can lose contrast in overcast weather, thin horns vanish at overview distance and the study's full-height stairs need collision refinement.

## Granite Seat of the North

**A · Winter enclosure** is recommended: compact double granite walls, a moat strip between them, short broken tower, snow on roofs and battlements, glass-garden ribs, dark conifers and a branching pale tree. **B · Long northern ward** stretches the southern enclosure for additional yard space. The exterior settlement has a road, cross-street, sixteen warm market awnings, frosted fields and four pine stands. B doubles the southern settlement depth as well as lengthening the ward.

Port wall spacing, broken-tower mass, glazed garden roofs and pale-tree silhouette into `scene/geometry/complex/ComplexPlan.ts`, `ComplexGeometry.ts` and the existing sacred-grove/garden geometry modules. Port exterior lots via `realism/cities/PhysicalRecipes.ts`/`PhysicalLayout.ts`; apply north climate through existing materials rather than a global snow override. The terrain owner must approve excavated moat and gate causeway heights; the study cuts a widened shallow schematic trench; production needs an excavated channel seated on streamed geometry. Risks: transparent roof ordering, keeping the outer/inner wall gap open, snow contrast under dusk, a tree too large for the grove and terrain covering the moat.

## Budgets and preparation

Target **per study at regional distance: ≤120 colour-pass draws and ≤600,000 rendered triangles**. Full-world production should omit the study terrain plane and lights. The external report records measured Chrome/WebKit desktop/phone costs for both variants. Materials are synchronous, shared and prewarmable; the adapter calls `compileAsync` before reporting ready. Motion QA additionally counts actual WebGL program creations, so lazy shadow variants cannot be hidden by net program counts. There are no sampled image textures; a 2048² shadow target is approximately 32 MiB including depth and colour (driver allocation may vary). All instances remain allocated during the orbit, so motion does not swap materials or introduce LOD shader variants.

No new runtime dependencies, network/event contracts, storage, migrations or deployment are involved. Production needs distance LOD, terrain collision, unit-clearance and aggregate world-budget validation; approval of these studies does not authorize a game port.

## Reproduce evidence

Run `nice -n 10 npx tsc --noEmit`, `nice -n 10 npm run build`, and `git diff --check`. Set `QA_OUTPUT_DIR` to the external handoff evidence location. Optionally set `PLAYWRIGHT_MODULE` to an existing Playwright installation. Then run `nice -n 10 node qa/seats.cjs full`, `nice -n 10 node qa/seats.cjs video` and `nice -n 10 node qa/seats-sheets.cjs`. Optionally set `SEAT_GAME_ARCHIVE` to a supplied archived capital screenshot when assembling sheets; that context comparison is explicitly not camera matched. The runner defaults to port 5260, rejects ports outside 5260–5269, records `uptime` before timings, launches fresh headless Chrome/WebKit sessions and closes its exact preview child PID in `finally`. It never attaches to a personal browser. Phone results are viewport/touch emulation on the host GPU, not real mobile-device timings. Captures are JPEG quality 72; motion is 20-second WebM. This is a bounded evidence tool requested by the design brief, not a new automated UI test suite.

## Round 2 review and port priorities

Recommend A for the capital (steeper, compact), A for the island (dragons belong to tower silhouettes), and A for the North (compact enclosure). B is deliberately a different composition rather than a height slider: broader port city, colossal carved coast, and elongated ward with deeper town. Review both at overview before choosing.

The capital hill field is a **terrain-owner proposal**. Its royal crown reaches roughly 360 m, second crown 260 m and third crown 220 m above sea level in A; B reduces these exaggerations. Do not port those amplitudes without full-world landmark clearance review. Wall segments now sample their own midpoints. Production must retain rendered-height sampling and use fitted foundations for wide domes/keeps, continuous streets, quays at water level and a cliff material driven by slope.

Island dragons are original instanced combinations of coiled tails, crouched torsos, necks, projecting jaws, horns, legs, dorsal spines and paired angular wings. B moves their visual mass into the rock; it is still a procedural assembly rather than a watertight carved mesh. Replace the static foam strips with the existing water renderer and fit a continuous stair/landing to actual cliff heights. Wet basalt needs production roughness calibration.

The North widens the visible blue moat, lowers the exterior wall, densifies the dark grove and adds emissive amber glazing, patchy frost, field strips and a road/market grid. Glass gardens and the pale tree remain small at regional distance; validate under overcast and dusk in the actual game before increasing their scale. No new textures; shadow estimate remains about 32 MiB per active study.

Use `qa/seats-parity.cjs` only with `QA_PORT` in 5260–5269 and an explicit external `QA_OUTPUT_DIR` to capture the protected stories with frozen clock/randomness. Compare PNG SHA-256 between reference and final builds; the external report records the result. Round-2 sheets include matched round-1/A versus round-2/A views.
