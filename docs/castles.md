# Castles

`castleGeometry(kind, style, variant = 0, detailed = true, kit?, level = 2)` returns merged vertex-colored geometry with the original surface tags. `CastleStyle` and `castlePalettes` cover ten styles. Use `CastleMaterial` for the authored masonry, roof, seasonal snow and window treatment.

`CastleBuilder(style, detailed, kit?, palette?)` exposes the low-level procedural vocabulary. `castleModule(name, width, height, depth, kit?)` and `modularCastle(stronghold, variant, kit?)` support optional Kenney CC0 modules. `AssetMaterials` loads those modules into a `CastleKit` map; procedural fallbacks work without asynchronous loading.

`castleBanner(house, color)` obtains SVG relief through the injected heraldry registry. `CastleLife` adds bounded instanced torch/smoke draws, driven by a host clock and explicit placements. Dispose geometry, material and life resources when their owning scene is removed. Game-named board landmarks remain compatible via kind strings, with neutral exported builder names; `hboCastles` became `landmarkCastles`.
