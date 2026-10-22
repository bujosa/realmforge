# Architecture and ownership

The public entry point is `src/index.ts`. It exposes geometry builders, materials, explicit scene-unit conversion and optional instance/animation lifecycle classes. `pieces/`, `castles/`, `cities/`, `nature/` and `props/` depend on three.js and `core/`; `heraldry/` obtains artwork through a source registry. `materials/` owns optional map/model loading. `presets/` holds game-specific labels, original city layouts and demo map coordinates. `gallery/` depends on the library; the library never imports the gallery.

The source contracts remain synchronous geometry builders or generators, matching the game. Complex planning receives `ComplexGround` callbacks. Complete physical cities receive `PhysicalCityOptions`: explicit boundary, terrain, water and reservations. `PhysicalWorld` was intentionally excluded because it binds these inputs to game fog, regions, terrain streaming and camera policy. `SceneFrame` keeps the exact coordinate formulas while dropping application appearance preferences. `ResourceSnapshot` and `CastlePlacement` contain only fields used by props and animation.

`CastleMaterial.setSurfaces()` replaces the world texture subscription. Hosts own injected array textures; materials do not dispose host textures. `AssetMaterials` owns its loaded CC0 maps/model modules, retains procedural fallback while loading, and releases owned resources on disposal. No world sampler scheduler or game singleton is imported.

The host owns geometry/material disposal and animation scheduling. `KitPool` owns its instanced buffers/materials and must be disposed after its cities. The gallery removes each story, calls its optional external-resource hook, and disposes the returned object's resources. Builders can share resources within an instance. Shader tags, vertex colors, dimensions and seeded planning algorithms are preserved; adaptations are import paths, structural contracts, injected surfaces and native Vite asset imports. Existing heraldry artwork was replaced by original abstract demo marks to avoid publishing inherited third-party artwork without a separate provenance trail.

No asynchronous network or event contract is changed. No application migration or deployment is required. Integration is opt-in through the neutral index or optional preset imports. Remaining limitations: synchronous gallery builds can block while a complete city is generated; city runtime APIs retain their sliced generation for host integration. Material array inputs and production terrain integration need host-side QA.

## Round 2 extension

The gallery owns free-flight/walking input, collision broad phase, authored walk entrances and story UI slots. `StoryInstance.navigation` is optional metadata; existing builders remain synchronous and continue to work without it. Physical city streets and terrain sites are synthetic gallery adapters. The library does not import gallery navigation or DOM overlays. The static walking index owns CPU proxy meshes only and borrows story geometry/materials; those remain under the existing story disposal boundary.

New `dragons/`, `effects/` and `tokens/` domains expose standalone procedural presentation APIs with injected palettes, source textures, public cues and water/ground callbacks. They import three.js and neutral core contracts. Original game identity palettes remain in presets. KTX2 arrays and the dependency's Basis transcoder are loaded per scene with explicit worker/texture disposal; no external URLs or global asset singleton is required.

The full source audit in catalogue.md distinguishes reusable visual assets from game-world terrain, sky, fog, weather and placement policy. This round adds no network/event subscriptions, persistent state, runtime dependencies, repository publishing or migrations. QA is the only temporary server owner and always stops its exact preview child process.

## Public source layout

`src/` is organized by asset domain. Shared contracts, frames, instancing and disposal helpers stay in `core/`; optional labels and authored named recipes stay in `presets/`. `materials/assets/` is the only bundled external art directory, with adjacent provenance and license texts. Class modules use PascalCase and builders/data use camelCase.

Gallery registrars live under `gallery/stories/<domain>/`; mixed legacy registrars were split by subject and the small castle-study helpers moved to `gallery/story-kit.ts`. Castle landmarks and physical seats share one preset traversal to avoid duplicating registration logic. Story IDs and the gallery contract remain stable. The unused frozen world adapter reference was removed; the maintained source audit records the original boundary.

QA runners share one bounded preview owner and use a local devDependency. Public metadata exports TypeScript source and optional subpaths for a bundler. No compiled npm distribution is implied; `private: true` prevents publishing. The optional Pages workflow builds a gallery with the repository-specific base, and deployment only runs when the owner enables Pages and invokes or pushes the workflow.

Neutral internal helpers replace named castle/yards/palette helpers. Deep imports of the old internal CastlePyke/CastleVale/CastleGodswood modules should use IslandFortress/HighlandCastle/SacredGrove; these were never root exports. Internal IronIslandSeats/IronIslandDressing modules similarly become IslandSeats/IslandDressing; the root `planIslandSeats` name stays unchanged. Public `src/armies`, `src/wildlings` and `src/heraldry` signatures and visual geometry are unchanged. Heraldry comment edits only remove named palette references.
