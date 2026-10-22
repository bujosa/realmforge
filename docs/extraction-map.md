# Extraction map

Frozen game revision: `d594e1c1`. Paths on the left are relative to `src/client/tabletop/`.

| Game source | Library |
|---|---|
| `scene/geometry/CastlePyke.ts` | `src/castles/IslandFortress.ts` |
| `scene/geometry/nature.ts` | `src/nature/nature.ts` |
| `scene/geometry/CastleVale.ts` | `src/castles/HighlandCastle.ts` |
| `scene/geometry/ResourceProps.ts` | `src/props/ResourceProps.ts` |
| `scene/geometry/CastleSettlement.ts` | `src/cities/CastleSettlement.ts` |
| `scene/geometry/CastleLife.ts` | `src/castles/CastleLife.ts` |
| `scene/geometry/HarborGeometry.ts` | `src/cities/HarborGeometry.ts` |
| `scene/geometry/NaturalTrees.ts` | `src/nature/NaturalTrees.ts` |
| `scene/geometry/IceWallMaterial.ts` | `src/materials/IceWallMaterial.ts` |
| `scene/geometry/hboCastles.ts` | `src/castles/landmarkCastles.ts` |
| `scene/geometry/CastleGodswood.ts` | `src/castles/SacredGrove.ts` |
| `scene/geometry/castles.ts` | `src/castles/castles.ts` |
| `scene/geometry/CastleDetails.ts` | `src/castles/CastleDetails.ts` |
| `scene/geometry/castleBanner.ts` | `src/castles/castleBanner.ts` |
| `scene/geometry/CastleBuilder.ts` | `src/castles/CastleBuilder.ts` |
| `scene/geometry/CastleMaterial.ts` | `src/materials/CastleMaterial.ts` |
| `scene/geometry/CastleArchitecture.ts` | `src/castles/CastleArchitecture.ts` |
| `scene/geometry/castleStyles.ts` | `src/castles/castleStyles.ts` |
| `scene/geometry/castleKit.ts` | `src/castles/castleKit.ts` |
| `scene/geometry/CastleBank.ts` | `src/castles/CastleBank.ts` |
| `scene/geometry/CastleSites.ts` | `src/castles/CastleSites.ts` |
| `scene/geometry/CastleNeighborhood.ts` | `src/castles/CastleNeighborhood.ts` |
| `scene/geometry/complex/ComplexGeometry.ts` | `src/cities/ComplexGeometry.ts` |
| `scene/geometry/complex/CrownSeatRecipes.ts` | `src/cities/CrownSeatRecipes.ts` |
| `scene/geometry/complex/WallProfile.ts` | `src/cities/WallProfile.ts` |
| `scene/geometry/complex/ComplexPlan.ts` | `src/cities/ComplexPlan.ts` |
| `scene/geometry/complex/ComplexLayer.ts` | `src/cities/ComplexLayer.ts` |
| `scene/geometry/complex/IronIslandSeats.ts` | `src/cities/IslandSeats.ts` |
| `scene/geometry/complex/IronIslandDressing.ts` | `src/cities/IslandDressing.ts` |
| `scene/geometry/complex/ComplexMaterial.ts` | `src/cities/ComplexMaterial.ts` |
| `scene/geometry/complex/CrownSeatArt.ts` | `src/cities/CrownSeatArt.ts` |
| `scene/geometry/complex/WallArt.ts` | `src/cities/WallArt.ts` |
| `scene/sculpt.ts` | `src/core/sculpt.ts` |
| `scene/geometry/finish.ts` | `src/core/finish.ts` |
| `scene/wallScale.ts` | `src/core/wallScale.ts` |
| `scene/assets/AssetMaterials.ts` | `src/materials/AssetMaterials.ts` |
| `scene/assets/manifest.ts` | `src/materials/assets/manifest.ts` |
| `strategic/RepresentationLod.ts` | `src/core/RepresentationLod.ts` |
| `strategic/SizeLaw.ts` | `src/core/SizeLaw.ts` |
| `frame/SceneFrame.ts` | `src/core/SceneFrame.ts` |

Game model and placement types become the structural interfaces in `src/core/contracts.ts`. World surface subscriptions become `CastleMaterial.setSurfaces()`. The coordinate adapter excludes application preferences. Texture/model loading uses native imports. No board placement, terrain streaming, React, HUD or game state is extracted.

`realism/kits/life.ts::livestockGeometry` → `src/nature/livestock.ts` (geometry only; herd placement excluded).

## Complete city kit

| Game source | Library |
|---|---|
| `realism/cities/plane.ts` | `src/cities/settlements/plane.ts` |
| `realism/cities/PhysicalLayout.ts` | `src/cities/settlements/PhysicalLayout.ts` |
| `realism/cities/layouts.ts` | `src/presets/cityLayouts.ts` |
| `realism/cities/PhysicalMaterial.ts` | `src/cities/settlements/PhysicalMaterial.ts` |
| `realism/cities/PhysicalCity.ts` | `src/cities/settlements/PhysicalCity.ts` |
| `realism/cities/PhysicalRecipes.ts` | `src/presets/physicalCities.ts` |
| `realism/cities/CityLayout.ts` | `src/cities/settlements/CityLayout.ts` |
| `realism/cities/types.ts` | `src/cities/settlements/types.ts` |
| `realism/cities/CityKit.ts` | `src/cities/settlements/CityKit.ts` |
| `realism/cities/CityMaterial.ts` | `src/cities/settlements/CityMaterial.ts` |
| `realism/cities/PhysicalKit.ts` | `src/cities/settlements/PhysicalKit.ts` |
| `realism/cities/exclusions.ts` | `src/cities/settlements/exclusions.ts` |
| `realism/cities/CityParts.ts` | `src/cities/settlements/CityParts.ts` |
| `realism/cities/City.ts` | `src/cities/settlements/City.ts` |
| `realism/kits/pool.ts` | `src/core/KitPool.ts` |
| `world/terrain/HillProfile.ts` | `src/core/HillProfile.ts` |

`PhysicalWorld` remains in the game: polygon selection, terrain streaming, fog and camera orchestration are application concerns. `PhysicalCity` accepts explicit ground/water/boundary callbacks.

## Round 2 audit

The exhaustive [catalogue audit](catalogue.md) maps all 424 files in the frozen tabletop source, including the round-2 dragons/effects/tokens, full physical flora, bridge/camp/harbour/composer props, water/environment/wakes, adaptive ocean topology, procedural finish, surface GLSL and six CC0 KTX2 arrays. Every excluded world adapter has a reason; protected army sources remain assigned to rf-armies. Binary provenance hashes are recorded with the audit.
