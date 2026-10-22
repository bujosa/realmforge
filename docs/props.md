# Props

`resourceGeometry('barrel' | 'crown')` returns the original ornament geometry. Use vertex colors; crown material benefits from modest metalness. The output keeps its authored scale, without the game's per-placement multiplier.

`new ResourceProps(group)` owns two bounded instanced batches. Call `update(resourceSnapshot, placements, detail)`, `setEnabled(enabled)` and `dispose()`. Its tiny `ResourceSnapshot`/`CastlePlacement` inputs are exported from the public index. It no longer imports the game model or landmark placement logic.

`new CastleLife(group)` owns the torch/smoke batches. `update(placements, full, dusk)` supplies absolute anchors/chimneys/torches and scale; `render(nowMs, reducedMotion, camera)` animates using the caller's clock. No per-building timers or lights are created. Always call `dispose()`.

`dockGeometry('pier-timber' | 'quay-stone')` returns normalized footprints; set physical width/depth at placement. `boatGeometry()` is the original physical fishing skiff, `bridgeGeometry(span, opening, ends, physical)` supplies the production arched bridge, and `campGeometry('hearth' | 'camp' | 'person')` exposes northern scenery. `composedPropGeometry(variant)` caches normalized composer fallback shapes; clone before modifying/disposal. `composedPropVariants` lists every supported module (ruins, walls, gardens, farms, harbours, houses and props); `disposeComposedProps()` clears that cache when the host is finished. Each variant has its own reference story.

## Refined composer modules

`ComposedShapes` owns the cache and merged geometry. `ComposedPrimitives` provides the common typed parts and endpoint-based beam helper; `ComposedDetails` contains ten refined builders: barn, inn, boat-small, cart, crane, well, watchtower, mine-head, mill and windmill. Their single-geometry budget is **1,500 triangles per module**, without extra material groups, textures or draws. Existing callers still use `composedPropGeometry(variant)`; the cache ownership contract is unchanged.

The refined shapes use open hulls, spokes, masonry well courses, bracing, hoist ropes, mullions and timber framing rather than solid boxes. They remain normalized scenery scaled by a host's width/height/depth; small functional protrusions (cart shafts, eaves and mill sails) may extend beyond the nominal footprint. Gallery Body tint/Roof tint controls demonstrate the existing `roofPart` attribute without changing the host shader contract.
