# Frozen source catalogue audit

Audited source: `d594e1c1`, the read-only tabletop snapshot. Every file under that snapshot is accounted for below, including all GLB/WebP/KTX2 binaries. Paths are relative to `src/client/tabletop/`. “Extracted” means visual code or a required dependency exists in this library; it does not mean every original world integration policy was copied. “Other owner” preserves the separate rf-armies boundary.

## What can be explored

All ten castle styles, all 24 named seat recipes, all seven physical city recipes, both board-city recipes, six island seats, harbours, bridges, ten flora species, livestock, resources, camps, all 55 composer fallback modules, living/current dragons, water and ice, every included texture layer, screen-space tokens and particle presets have individual component studies. Explore adds 26 inhabited seat/city scenes and one landscape sampler. City sites use synthetic terrain and public layout inputs; their streets retain production metre dimensions (50 m/unit). Named labels are optional presets, never required public API identifiers.

## Intentional boundaries

Terrain streaming and world placement remain outside this library. The full terrain shader, sky/underwater/refraction policies and field masks depend on game-wide geography, preferences or global state. Their reusable texture arrays, water shader, adaptive ocean topology, flora and standalone prop/building art are included. The synthetic sampler demonstrates those building blocks without importing game regions or game state. Source order/power artwork outside this snapshot is not copied; the token API accepts host-provided faces. No additional runtime art pack is bundled under realism/assets.

Army-owned files are read-only and their optional scene integration was skipped. Existing army reference stories remain in the gallery. No game repository or other worktree was edited.

File inventory: 292 excluded, 118 extracted, 14 other owner; **424 files total**.

| Frozen source | Status | Destination or reason |
|---|---|---|
| `ASSETS.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `CASTLES.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `DeferredTabletopView.tsx` | Excluded | Application data, UI or build/runtime tooling; no standalone reusable art asset. |
| `ImmersiveIronBank.tsx` | Excluded | Application data, UI or build/runtime tooling; no standalone reusable art asset. |
| `README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `TabletopView.tsx` | Excluded | Application data, UI or build/runtime tooling; no standalone reusable art asset. |
| `camera/ActionCamera.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `camera/CameraNavigation.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `camera/CinematicRig.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `camera/FramingViewport.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `camera/GroundCamera.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `camera/OceanCamera.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `camera/framing.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `camera/landmarkInspection.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `camera/three-camera.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `check-follow.cjs` | Excluded | Application data, UI or build/runtime tooling; no standalone reusable art asset. |
| `events/BattleStage.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/CombatChoreography.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/EpicAccents.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/GameEventReader.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/LivingEvents.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/MarchPreview.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/MarchRouter.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/ReliefPath.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/RouteRibbon.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/SetPieces.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/TurnBeacons.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/setpieces/StagedCueGate.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/setpieces/placement.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `events/setpieces/script.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `frame/CameraBands.ts` | Extracted | src/core/CameraBands.ts |
| `frame/DepthPolicy.ts` | Excluded | Game camera/depth/local-origin coordination; physical coordinate frame and camera distance bands are extracted. |
| `frame/LocalOrigin.ts` | Excluded | Game camera/depth/local-origin coordination; physical coordinate frame and camera distance bands are extracted. |
| `frame/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `frame/SceneFrame.ts` | Extracted | src/core/SceneFrame.ts |
| `frame/tests/SceneFrame.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `frame/tests/WorldScale.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `frame/tests/WorldScaleQuality.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `frame/three-frame.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `loadView.js` | Excluded | Application data, UI or build/runtime tooling; no standalone reusable art asset. |
| `model.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `preference.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `realism/PerfProbe.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `realism/appearance/AppearancePanel.tsx` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/appearance/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `realism/appearance/appearance.scss` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `realism/appearance/apply.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/appearance/preferences.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/appearance/themes.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/assets/AssetRegistry.ts` | Excluded | Optional production asset-pack runtime/transport. No GLB/texture pack is stored here; library CC0 assets use the scene-owned AssetMaterials/SurfaceArrays loaders. |
| `realism/assets/AssetTransport.ts` | Excluded | Optional production asset-pack runtime/transport. No GLB/texture pack is stored here; library CC0 assets use the scene-owned AssetMaterials/SurfaceArrays loaders. |
| `realism/assets/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `realism/assets/check-runtime.cjs` | Excluded | Optional production asset-pack runtime/transport. No GLB/texture pack is stored here; library CC0 assets use the scene-owned AssetMaterials/SurfaceArrays loaders. |
| `realism/assets/loaders.js` | Excluded | Optional production asset-pack runtime/transport. No GLB/texture pack is stored here; library CC0 assets use the scene-owned AssetMaterials/SurfaceArrays loaders. |
| `realism/assets/resources.ts` | Excluded | Optional production asset-pack runtime/transport. No GLB/texture pack is stored here; library CC0 assets use the scene-owned AssetMaterials/SurfaceArrays loaders. |
| `realism/camps/CampPlanner.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/cities/City.ts` | Extracted | src/cities/settlements/City.ts |
| `realism/cities/CityKit.ts` | Extracted | src/cities/settlements/CityKit.ts |
| `realism/cities/CityLayout.ts` | Extracted | src/cities/settlements/CityLayout.ts |
| `realism/cities/CityMaterial.ts` | Extracted | src/cities/settlements/CityMaterial.ts |
| `realism/cities/CityParts.ts` | Extracted | src/cities/settlements/CityParts.ts |
| `realism/cities/PhysicalCity.ts` | Extracted | src/cities/settlements/PhysicalCity.ts |
| `realism/cities/PhysicalKit.ts` | Extracted | src/cities/settlements/PhysicalKit.ts |
| `realism/cities/PhysicalLayout.ts` | Extracted | src/cities/settlements/PhysicalLayout.ts |
| `realism/cities/PhysicalMaterial.ts` | Extracted | src/cities/settlements/PhysicalMaterial.ts |
| `realism/cities/PhysicalRecipes.ts` | Extracted | src/presets/physicalCities.ts |
| `realism/cities/PhysicalWorld.ts` | Excluded | Production entry/loader/PhysicalWorld adapter or README/types wrapper; standalone city geometry, materials, recipes and planners are extracted. |
| `realism/cities/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `realism/cities/cities-three.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `realism/cities/exclusions.ts` | Extracted | src/cities/settlements/exclusions.ts |
| `realism/cities/index.ts` | Excluded | Production entry/loader/PhysicalWorld adapter or README/types wrapper; standalone city geometry, materials, recipes and planners are extracted. |
| `realism/cities/layouts.ts` | Extracted | src/presets/cityLayouts.ts |
| `realism/cities/load.js` | Excluded | Production entry/loader/PhysicalWorld adapter or README/types wrapper; standalone city geometry, materials, recipes and planners are extracted. |
| `realism/cities/plane.ts` | Extracted | src/cities/settlements/plane.ts |
| `realism/cities/tests/PhysicalLayout.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `realism/cities/types.ts` | Extracted | src/cities/settlements/types.ts |
| `realism/crowds/ArmyLayer.ts` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/crowds/archetypes.ts` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/crowds/loadLivingUnits.js` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/crowds/vat.ts` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/dragons/DragonPresence.ts` | Excluded | Not copied: game unit identity, hidden/revealed region state and event orchestration. Standalone rig/material/flight/fire/patrol math are extracted. |
| `realism/dragons/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `realism/dragons/createDragon.ts` | Extracted | src/dragons/createDragon.ts |
| `realism/dragons/dragon-three.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `realism/dragons/fire.ts` | Extracted | src/dragons/fire.ts |
| `realism/dragons/index.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `realism/dragons/material.ts` | Extracted | src/dragons/material.ts |
| `realism/dragons/mesh.ts` | Extracted | src/dragons/mesh.ts |
| `realism/dragons/motion.ts` | Extracted | src/dragons/motion.ts |
| `realism/dragons/palette.ts` | Extracted | src/dragons/palette.ts + src/presets/dragonPalettes.ts |
| `realism/dragons/presence.ts` | Extracted | src/dragons/presence.ts |
| `realism/dragons/rig.ts` | Extracted | src/dragons/rig.ts |
| `realism/dragons/tests/presence.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `realism/dragons/types.ts` | Extracted | src/dragons/types.ts |
| `realism/heraldry/SigilAtlas.ts` | Excluded | Atlas loads protected HUD house artwork and its game substitution rules. Neutral injectable heraldry and token atlases replace that path. |
| `realism/hosts/GarrisonLayout.ts` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/hosts/HostLaw.ts` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/hosts/HostLayer.ts` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/hosts/HostLod.ts` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/hosts/HostPlanner.ts` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/hosts/LivingStress.ts` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/hosts/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `realism/hosts/geometry.ts` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/hosts/index.ts` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/hosts/load.js` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/hosts/loadHosts.js` | Other owner | Production army/host/VAT prototype: rf-armies owns the replacement API and stories; intentionally untouched by rf-kit. |
| `realism/integration/LivingUnits.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/integration/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `realism/integration/cities.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/integration/cityKeeps.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/kits/boats.ts` | Extracted | src/props/HarborProps.ts |
| `realism/kits/fields.ts` | Excluded | Not copied: canvas terrain mask keyed by game region polygons, world heightfield, composed zones and snapshot lifecycle. Farm-furrow CC0 layer and normalized vine/olive/haystack modules are extracted. |
| `realism/kits/life.ts` | Extracted | src/nature/livestock.ts (geometry only) |
| `realism/kits/pool.ts` | Extracted | src/core/KitPool.ts |
| `realism/lod/InstancedLodBatch.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/lod/LodManager.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/lod/ZoneStreamer.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/lod/budgets.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/lod/projection.ts` | Excluded | Game integration, preferences, event/visibility/LOD or camp placement policy; standalone visual builders use injected public inputs. |
| `realism/perf-overlay.scss` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `scene/BoardCameraTilt.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/BoardPieceSize.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/BoardReadability.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/BoardSlots.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/InactiveTable.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/PlacementGlow.ts` | Excluded | Not copied: global selection/placement uniforms and tone-mapping hooks are gameplay interaction policy, not a component asset. |
| `scene/QualityGovernor.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/RegionLabel.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/ScreenLayout.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/ShaderWarmup.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/TabletopAtmosphere.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/TabletopDressing.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/TabletopLandscape.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/TabletopScene.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/WorldCompanies.ts` | Extracted | src/pieces/WorldCompanies.ts |
| `scene/assets/AssetMaterials.ts` | Extracted | src/materials/AssetMaterials.ts |
| `scene/assets/files/castle-kit.glb` | Extracted | src/materials/assets/files/castle-kit.glb |
| `scene/assets/files/metal-normalgl.webp` | Extracted | src/materials/assets/files/metal-normalgl.webp |
| `scene/assets/files/metal-roughness.webp` | Extracted | src/materials/assets/files/metal-roughness.webp |
| `scene/assets/files/paper-normalgl.webp` | Extracted | src/materials/assets/files/paper-normalgl.webp |
| `scene/assets/files/paper-roughness.webp` | Extracted | src/materials/assets/files/paper-roughness.webp |
| `scene/assets/files/stone-normalgl.webp` | Extracted | src/materials/assets/files/stone-normalgl.webp |
| `scene/assets/files/stone-roughness.webp` | Extracted | src/materials/assets/files/stone-roughness.webp |
| `scene/assets/files/wood-color.webp` | Extracted | src/materials/assets/files/wood-color.webp |
| `scene/assets/files/wood-normalgl.webp` | Extracted | src/materials/assets/files/wood-normalgl.webp |
| `scene/assets/files/wood-roughness.webp` | Extracted | src/materials/assets/files/wood-roughness.webp |
| `scene/assets/inventory.json` | Excluded | Production asset inventory/build/lazy-loader wrapper; all bundled binary assets and license files are copied with library-native loading. |
| `scene/assets/licenses/CC0-1.0.txt` | Extracted | src/materials/assets/licenses/CC0-1.0.txt |
| `scene/assets/licenses/Kenney-Castle-Kit.txt` | Extracted | src/materials/assets/licenses/Kenney-Castle-Kit.txt |
| `scene/assets/licenses/ambientCG.txt` | Extracted | src/materials/assets/licenses/ambientCG.txt |
| `scene/assets/loaders.js` | Excluded | Production asset inventory/build/lazy-loader wrapper; all bundled binary assets and license files are copied with library-native loading. |
| `scene/assets/manifest.ts` | Extracted | src/materials/assets/manifest.ts |
| `scene/assets/prepare.py` | Excluded | Production asset inventory/build/lazy-loader wrapper; all bundled binary assets and license files are copied with library-native loading. |
| `scene/assets.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/forceLabel.ts` | Excluded | Not copied: game force-count labels and board presentation. No customer/game state enters the component gallery. |
| `scene/geometry/CastleArchitecture.ts` | Extracted | src/castles/CastleArchitecture.ts |
| `scene/geometry/CastleBank.ts` | Extracted | src/castles/CastleBank.ts |
| `scene/geometry/CastleBuilder.ts` | Extracted | src/castles/CastleBuilder.ts |
| `scene/geometry/CastleDetails.ts` | Extracted | src/castles/CastleDetails.ts |
| `scene/geometry/CastleGodswood.ts` | Extracted | src/castles/CastleGodswood.ts |
| `scene/geometry/CastleLife.ts` | Extracted | src/castles/CastleLife.ts |
| `scene/geometry/CastleMaterial.ts` | Extracted | src/materials/CastleMaterial.ts |
| `scene/geometry/CastleNeighborhood.ts` | Extracted | src/castles/CastleNeighborhood.ts |
| `scene/geometry/CastlePyke.ts` | Extracted | src/castles/CastlePyke.ts |
| `scene/geometry/CastleSettlement.ts` | Extracted | src/cities/CastleSettlement.ts |
| `scene/geometry/CastleSites.ts` | Extracted | src/castles/CastleSites.ts |
| `scene/geometry/CastleVale.ts` | Extracted | src/castles/CastleVale.ts |
| `scene/geometry/DragonSculpt.ts` | Extracted | src/pieces/geometry/DragonSculpt.ts |
| `scene/geometry/HarborGeometry.ts` | Extracted | src/cities/HarborGeometry.ts |
| `scene/geometry/IceWallMaterial.ts` | Extracted | src/materials/IceWallMaterial.ts |
| `scene/geometry/NaturalTrees.ts` | Extracted | src/nature/NaturalTrees.ts |
| `scene/geometry/ResourceProps.ts` | Extracted | src/props/ResourceProps.ts |
| `scene/geometry/ShipProfiles.ts` | Extracted | src/pieces/geometry/ShipProfiles.ts |
| `scene/geometry/castle-three.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `scene/geometry/castleBanner.ts` | Extracted | src/castles/castleBanner.ts |
| `scene/geometry/castleKit.ts` | Extracted | src/castles/castleKit.ts |
| `scene/geometry/castleStyles.ts` | Extracted | src/castles/castleStyles.ts |
| `scene/geometry/castles.ts` | Extracted | src/castles/castles.ts |
| `scene/geometry/complex/ComplexGeometry.ts` | Extracted | src/cities/ComplexGeometry.ts |
| `scene/geometry/complex/ComplexLayer.ts` | Extracted | src/cities/ComplexLayer.ts |
| `scene/geometry/complex/ComplexMaterial.ts` | Extracted | src/cities/ComplexMaterial.ts |
| `scene/geometry/complex/ComplexPlan.ts` | Extracted | src/cities/ComplexPlan.ts |
| `scene/geometry/complex/CrownSeatArt.ts` | Extracted | src/cities/CrownSeatArt.ts |
| `scene/geometry/complex/CrownSeatRecipes.ts` | Extracted | src/cities/CrownSeatRecipes.ts |
| `scene/geometry/complex/IronIslandDressing.ts` | Extracted | src/cities/IronIslandDressing.ts |
| `scene/geometry/complex/IronIslandSeats.ts` | Extracted | src/cities/IronIslandSeats.ts |
| `scene/geometry/complex/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `scene/geometry/complex/WallArt.ts` | Extracted | src/cities/WallArt.ts |
| `scene/geometry/complex/WallProfile.ts` | Extracted | src/cities/WallProfile.ts |
| `scene/geometry/complex/tests/complex.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `scene/geometry/complex/three-complex.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `scene/geometry/finish.ts` | Extracted | src/pieces/geometry/finish.ts |
| `scene/geometry/hboCastles.ts` | Extracted | src/castles/landmarkCastles.ts |
| `scene/geometry/nature.ts` | Extracted | src/nature/nature.ts |
| `scene/geometry/ships.ts` | Extracted | src/pieces/geometry/ships.ts |
| `scene/heraldry/SigilAtlas.ts` | Extracted | src/heraldry/SigilAtlas.ts |
| `scene/heraldry/simplify.ts` | Extracted | src/heraldry/simplify.ts |
| `scene/heraldry/sources.ts` | Extracted | src/heraldry/sources.ts |
| `scene/heraldry/svg-three.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `scene/heraldry/svgSourceLoader.cjs` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/heraldry.ts` | Excluded | Not copied: piece/game artwork orchestration; injectable neutral heraldry builders and original demo marks replace protected faces. |
| `scene/landmarks.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/miniatures.ts` | Extracted | src/pieces/miniatures.ts |
| `scene/resourceLabel.ts` | Excluded | Board placement, game scene/lights/camera/HUD/label/quality integration; unique procedural component builders are extracted separately. |
| `scene/sculpt.ts` | Extracted | src/core/sculpt.ts |
| `scene/tests/QualityGovernor.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `scene/tests/wallScale.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `scene/wallScale.ts` | Extracted | src/core/wallScale.ts |
| `strategic/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `strategic/RepresentationLod.ts` | Extracted | src/core/RepresentationLod.ts |
| `strategic/SizeLaw.ts` | Extracted | src/core/SizeLaw.ts |
| `strategic/StrategicLayer.ts` | Excluded | Game piece/model orchestration or legacy type declarations; neutral token drawing/atlas/picking math and size law are extracted. |
| `strategic/TokenAtlas.ts` | Extracted | src/tokens/TokenAtlas.ts |
| `strategic/TokenLayer.ts` | Extracted | src/tokens/TokenLayer.ts |
| `strategic/screenFixed.ts` | Extracted | src/tokens/screenFixed.ts |
| `strategic/tests/strategic.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `strategic/three-strategic.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `strategic/three-sun.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `strategic/tokenSeparation.ts` | Extracted | src/tokens/tokenSeparation.ts |
| `tabletop.scss` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `validation/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `validation/VERIFICATION.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `validation/playwright.config.cjs` | Excluded | Application data, UI or build/runtime tooling; no standalone reusable art asset. |
| `validation/world-polish.spec.cjs` | Excluded | Application data, UI or build/runtime tooling; no standalone reusable art asset. |
| `vfx/InstancedVfx.ts` | Extracted | src/effects/InstancedVfx.ts |
| `vfx/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `vfx/index.ts` | Extracted | src/effects/presets.ts |
| `water/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `water/ShipWakes.ts` | Extracted | src/effects/ShipWakes.ts (injected texture/frame contract) |
| `water/TabletopWater.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `water/WaterField.ts` | Excluded | Game model, public-event presentation orchestration, camera/input/audio/picking adapter or rule data; not standalone component geometry. |
| `water/environment.ts` | Extracted | src/materials/WaterEnvironment.ts |
| `water/material.ts` | Extracted | src/materials/WaterMaterial.ts |
| `water/three-water.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `water/waves.ts` | Extracted | src/materials/waves.ts |
| `weather/TabletopFinish.ts` | Extracted | src/materials/SurfaceFinish.ts |
| `weather/TabletopWeather.ts` | Excluded | Regional weather binds snapshot weather/wildling state, viewer visibility and region polygons to frost masks and particles; not standalone public component inputs. Reusable particle primitives and surface finish are extracted separately. |
| `world/BeyondTheWall.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/BridgeGeometry.ts` | Extracted | src/props/BridgeGeometry.ts |
| `world/CastleSettlementSite.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/CastleSettlements.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/CastleSite.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/EssosDressing.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/HarborApproach.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/InactiveCities.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/InactiveLands.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/InactiveNature.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/PrintedCastleSites.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `world/RiverLandscape.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/RiverNetwork.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/SettlementCandidates.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldContinents.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldControls.tsx` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldFauna.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldGeographyProfiles.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldHeightfield.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldMaterial.ts` | Excluded | Not copied: terrain shader binds TerrainSampler grids, shore pads, fields atlas, ocean geography, frame and placement lighting. Reusable look GLSL and all texture layers are extracted; synthetic terrain is gallery-owned. |
| `world/WorldNorth.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldNorthernRelief.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldOceanField.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldOceanGeometry.ts` | Extracted | src/materials/OceanGeometry.ts |
| `world/WorldRanges.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldRefraction.ts` | Excluded | Not copied: transitions two named production ocean passes under sampler-budget policy; standalone water optics are extracted. |
| `world/WorldRoads.ts` | Excluded | Not copied: generates ribbons from model region adjacency and terrain/river queries. Synthetic streets follow public city plans in gallery/cityStudy.ts; composer normalized bridge/wall modules are available. |
| `world/WorldSamplerBudget.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldScale.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldScene.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldScenery.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldSeabed.ts` | Excluded | Not copied as a layer: heightfield/ocean bathymetry and shoreline scheduler are production geography. Adaptive topology and caustic shader are extracted separately. |
| `world/WorldShadows.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldSky.ts` | Excluded | Not copied: phase lighting, appearance themes and global ShaderChunk fog mutation are application-wide policy. Gallery supplies day/dusk/overcast and optional fog without global shader changes. |
| `world/WorldTerrain.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldUnderwater.ts` | Excluded | Not copied: controls scene-wide fog/sky and game ocean elevation; no standalone geometry or asset. Host may own underwater presentation. |
| `world/WorldWater.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/WorldWildlingGeometry.ts` | Extracted | src/props/CampGeometry.ts |
| `world/WorldWildlings.ts` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/atlas/Overlay.ts` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/atlas/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `world/atlas/entry.js` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/atlas/loader.ts` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/atlas/schema.ts` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/atlas/tests/atlas.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `world/atlas/v1/biomes.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/atlas/v1/hydrology.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/atlas/v1/landmarks.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/atlas/v1/ranges.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/baked/Bootstrap.ts` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/baked/assets/catalog.js` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/baked/codec.ts` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/baked/decode.worker.ts` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/baked/entry.js` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/baked/sha256.ts` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/baked/tooling/bootstrap-dependencies.cjs` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/baked/tooling/bootstrap-format.cjs` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/baked/tooling/bootstrap-loader.cjs` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/baked/types.ts` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/check-world.cjs` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/compose/ComposerFlora.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/ComposerLayer.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/PublicCoastalSeats.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `world/compose/RegionComposer.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/generators/fields.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/generators/groves.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/generators/landmarks.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/generators/layout.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/generators/life.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/generators/ports.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/generators/protect.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/generators/roads.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/generators/settlements.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/generators/site.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/geometry.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/inputs.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/load.js` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/margins.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/palette.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/random.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/recipes.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/sinks/CellSlots.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/sinks/GroundSink.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/sinks/HouseSink.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/sinks/PropSink.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/sinks/kitGeometry.ts` | Excluded | Not copied: rescales the already-extracted dock/skiff/livestock geometry into the game composer sink convention; no unique visual asset. |
| `world/compose/sinks/shapes.ts` | Extracted | src/props/ComposedShapes.ts |
| `world/compose/sinks/variants.ts` | Extracted | src/props/ComposedVariants.ts |
| `world/compose/site.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/compose/tests/compose.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `world/compose/tests/fixture.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `world/compose/tests/fog.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `world/compose/types.ts` | Excluded | Map-region planning, placement, masks or instanced sinks tied to production world inputs. All standalone drawable fallback shapes and higher-detail prop geometry are extracted. |
| `world/flora/BuildBudget.ts` | Extracted | src/core/BuildBudget.ts |
| `world/flora/Clearance.ts` | Extracted | src/nature/Clearance.ts |
| `world/flora/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `world/flora/WorldFlora.ts` | Excluded | Production zone placement/composition and streaming wrapper; standalone species geometry, placement math and clearance dependencies are extracted. |
| `world/flora/composition.ts` | Excluded | Production zone placement/composition and streaming wrapper; standalone species geometry, placement math and clearance dependencies are extracted. |
| `world/flora/dorne.ts` | Excluded | Production zone placement/composition and streaming wrapper; standalone species geometry, placement math and clearance dependencies are extracted. |
| `world/flora/geometry.ts` | Extracted | src/nature/FloraGeometry.ts |
| `world/flora/index.ts` | Excluded | Production zone placement/composition and streaming wrapper; standalone species geometry, placement math and clearance dependencies are extracted. |
| `world/flora/placement.ts` | Extracted | src/nature/FloraPlacement.ts |
| `world/flora/three-flora.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `world/look/SurfaceShader.ts` | Extracted | src/materials/SurfaceShader.ts |
| `world/look/WorldDressing.ts` | Excluded | Production look/postprocessing entry or world dressing policy; all CC0 arrays and reusable surface GLSL are extracted. |
| `world/look/WorldPost.js` | Excluded | Production look/postprocessing entry or world dressing policy; all CC0 arrays and reusable surface GLSL are extracted. |
| `world/look/WorldSurfaceAssets.ts` | Extracted | src/materials/SurfaceArrays.ts (scene-owned loader adapter) |
| `world/look/assets/ATTRIBUTION.md` | Extracted | src/materials/assets/world/ATTRIBUTION.md |
| `world/look/assets/castle-albedo.ktx2` | Extracted | src/materials/assets/world/castle-albedo.ktx2 |
| `world/look/assets/castle-normal.ktx2` | Extracted | src/materials/assets/world/castle-normal.ktx2 |
| `world/look/assets/castle-roughness.ktx2` | Extracted | src/materials/assets/world/castle-roughness.ktx2 |
| `world/look/assets/terrain-albedo.ktx2` | Extracted | src/materials/assets/world/terrain-albedo.ktx2 |
| `world/look/assets/terrain-normal.ktx2` | Extracted | src/materials/assets/world/terrain-normal.ktx2 |
| `world/look/assets/terrain-roughness.ktx2` | Extracted | src/materials/assets/world/terrain-roughness.ktx2 |
| `world/look/entry.js` | Excluded | Production look/postprocessing entry or world dressing policy; all CC0 arrays and reusable surface GLSL are extracted. |
| `world/look/post-entry.js` | Excluded | Production look/postprocessing entry or world dressing policy; all CC0 arrays and reusable surface GLSL are extracted. |
| `world/northFlora.js` | Excluded | Production geography, terrain/water placement, visibility, scene lifecycle or world integration; standalone castle/city/harbour/flora/bridge/camp/water geometry is extracted. |
| `world/regions/README.md` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `world/regions/ReachDorneLandmarks.ts` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/beyond-crasters-keep.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/beyond-fist.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/beyond-frostfangs.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/beyond-hardhome.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/beyond-haunted-forest.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/blackwater.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/castle-black.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/crackclaw-point.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/dornish-marches.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/dragonstone.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/essos-braavos.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/essos-myr.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/essos-norvos.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/essos-pentos.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/essos-the-disputed-lands.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/essos-the-rhoyne.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/essos-volantis.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/flints-finger.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/greywater-watch.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/harrenhal.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/highgarden.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/karhold.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/kings-landing.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/kingswood.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/lannisport.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/moat-cailin.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/oldtown.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/princes-pass.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/pyke.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/riverrun.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/salt-shore.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/seagard.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/searoad-marches.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/starfall.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/stoney-sept.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/storms-end.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/sunspear.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/the-arbor.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/the-boneway.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/the-eyrie.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/the-fingers.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/the-mountains-of-the-moon.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/the-reach.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/the-stony-shore.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/the-twins.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/three-towers.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/white-harbor.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/widows-watch.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/winterfell.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/regions/yronwood.json` | Excluded | Production map/biome/hydrology coordinates, baked data/transport/tooling or loaders; synthetic QA sites avoid terrain streaming and game map placement. |
| `world/terrain/Cdlod.ts` | Excluded | Production terrain atlas, LOD, shoreline, worker or sampler orchestration; HillProfile is extracted and the sampler scene uses explicit synthetic terrain. |
| `world/terrain/Clock.ts` | Excluded | Production terrain atlas, LOD, shoreline, worker or sampler orchestration; HillProfile is extracted and the sampler scene uses explicit synthetic terrain. |
| `world/terrain/HeightAtlas.ts` | Excluded | Production terrain atlas, LOD, shoreline, worker or sampler orchestration; HillProfile is extracted and the sampler scene uses explicit synthetic terrain. |
| `world/terrain/HillProfile.ts` | Extracted | src/core/HillProfile.ts |
| `world/terrain/ResidentReveal.ts` | Excluded | Production terrain atlas, LOD, shoreline, worker or sampler orchestration; HillProfile is extracted and the sampler scene uses explicit synthetic terrain. |
| `world/terrain/Shore.ts` | Excluded | Production terrain atlas, LOD, shoreline, worker or sampler orchestration; HillProfile is extracted and the sampler scene uses explicit synthetic terrain. |
| `world/terrain/TerrainRaycast.ts` | Excluded | Production terrain atlas, LOD, shoreline, worker or sampler orchestration; HillProfile is extracted and the sampler scene uses explicit synthetic terrain. |
| `world/terrain/TerrainSampler.ts` | Excluded | Production terrain atlas, LOD, shoreline, worker or sampler orchestration; HillProfile is extracted and the sampler scene uses explicit synthetic terrain. |
| `world/terrain/bake.worker.ts` | Excluded | Production terrain atlas, LOD, shoreline, worker or sampler orchestration; HillProfile is extracted and the sampler scene uses explicit synthetic terrain. |
| `world/terrain/entry.js` | Excluded | Production terrain atlas, LOD, shoreline, worker or sampler orchestration; HillProfile is extracted and the sampler scene uses explicit synthetic terrain. |
| `world/terrain/tests/CdlodTransitions.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `world/terrain/tests/IslandCliffs.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `world/terrain/tests/still.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `world/tests/InactiveLands.test.ts` | Excluded | Source test/fixture, not a runtime visual asset; gallery validates extracted builders separately. |
| `world/three-world.d.ts` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |
| `world/world.scss` | Excluded | Source documentation, application styling or legacy type augmentation; native library docs/types replace it. |

## Binary provenance

All binary assets below are byte-for-byte copies of the frozen source; license/attribution files are retained beside the library assets. The Basis transcoder is supplied by the existing three.js dependency.

| Asset | SHA-256 |
|---|---|
| `scene/assets/files/castle-kit.glb` | `5d459c047614d78bdd04160d59bf787e475dad8bc6e4b4840aa947e752f4eaa5` |
| `scene/assets/files/metal-normalgl.webp` | `e4adf53110980cfc0767a897d0589f5729225160f2506c8010c5171fef277da9` |
| `scene/assets/files/metal-roughness.webp` | `52d51cf81e1a544072d8fd86d5d4915dcf5a3595becec3fb50c0b943ccb17390` |
| `scene/assets/files/paper-normalgl.webp` | `bb0c9a60ce46039018988668f564ee4e56fa0328c2903a21fd860fd5f21cadc4` |
| `scene/assets/files/paper-roughness.webp` | `47907db5f7a9a3f13cfd514b22d4e52e1d7b7cef14031979399c4697c1994bf6` |
| `scene/assets/files/stone-normalgl.webp` | `0ab5bf77fbcede60bf122f99a045f29d2bd98f6804475292efa3b55dc5451f4b` |
| `scene/assets/files/stone-roughness.webp` | `080a94c9f84c182d16b8751cc237b30c6aac3f39088f2543a833f85e30d8e648` |
| `scene/assets/files/wood-color.webp` | `b58b712f412242ebdfc5aca4cd53648ec399b7b7b9ca3d81e6e60e800ecf88b4` |
| `scene/assets/files/wood-normalgl.webp` | `38c61947f86fdc7dfd3280ee514f682602fc42a540430a26c60303f4cb756b19` |
| `scene/assets/files/wood-roughness.webp` | `aca6a45ad1be7c626a5eece32f85061bfced758df5d112a202b24dbb9d4ccb1d` |
| `world/look/assets/castle-albedo.ktx2` | `65267433c608a0a492012bba6769aa615e41446a11586e83157693b4a4fc7240` |
| `world/look/assets/castle-normal.ktx2` | `a67531da4b14b5a0a341e22d14d2b4fb31809420029ffdebb73047378909d1c3` |
| `world/look/assets/castle-roughness.ktx2` | `88cc1189e1b10cac90d010e724528a01ad5106c0cada1f438d7d23600e0af0cb` |
| `world/look/assets/terrain-albedo.ktx2` | `0031ee236c853d3cc778a42c49e4e0e9582ffb8444440dd0d874d42ed4ae9a24` |
| `world/look/assets/terrain-normal.ktx2` | `d7d64728182f251a4ffb4978246d00ca980d793055af1d1fdaacf465062efc4e` |
| `world/look/assets/terrain-roughness.ktx2` | `6fb4a4456830f17459349ec928b7a1cb6a3aaa518749184c18aedfd711e7c531` |
