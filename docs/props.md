# Props

`resourceGeometry('barrel' | 'crown')` returns the original ornament geometry. Use vertex colors; crown material benefits from modest metalness. The output keeps its authored scale, without the game's per-placement multiplier.

`new ResourceProps(group)` owns two bounded instanced batches. Call `update(resourceSnapshot, placements, detail)`, `setEnabled(enabled)` and `dispose()`. Its tiny `ResourceSnapshot`/`CastlePlacement` inputs are exported from the public index. It no longer imports the game model or landmark placement logic.

`new CastleLife(group)` owns the torch/smoke batches. `update(placements, full, dusk)` supplies absolute anchors/chimneys/torches and scale; `render(nowMs, reducedMotion, camera)` animates using the caller's clock. No per-building timers or lights are created. Always call `dispose()`.
