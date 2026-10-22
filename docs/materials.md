# Materials

`CastleMaterial(assets?)` preserves masonry, wood, roof, glow and snow shader tags. `setSeason(dusk, winter, full)` sets the original seasonal treatment. `setSurfaces({ castle: { albedo, roughness, normal } })` optionally injects host-owned texture arrays; call without an argument to clear them. There is no world subscription or sampler scheduler.

`ComplexMaterial` adds per-instance dither coverage; apply `addFadeAttribute(geometry, count)`. `HeroMaterial` adds metre-space rock detail. `CityMaterial` adds the shared instance house/curtain attributes; `PhysicalMaterial` packs attributes and adds the physical city's fade clock. `IceWallMaterial` is the board ice shader; `WallIceMaterial` is the physical profile shader.

`AssetMaterials(changed, installKit)` owns optional CC0 textures/model modules. `register(material, surface)` accepts `wood`, `paper`, `stone`, `metal`. Enable with `setQuality(true)`, call `prepare()` for maps and `afterPaint()` for the model. `programsReady()` reports map preparation completion. Always dispose the owner; it retains procedural fallback on optional load failure. Asset notices and the complete CC0 legal text accompany the GLB/WebP files in `src/materials/assets/licenses/`.
