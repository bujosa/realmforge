# Living dragons

`createDragon({ house, palette?, tier, reducedMotion? })` creates an original procedural skeletal dragon, or `null` for the low tier. Inject a `DragonPalette`; the fallback is neutral and game-specific colors live only in `src/presets/dragonPalettes.ts`. The returned `LivingDragon` provides its `object`, flight commands (`patrol`, `flyTo`, `land`), presentation `update(dtMs)`, state/statistics and `dispose()`.

`dragonWingspan(strength?)` preserves the production physical envelope. Optional public geography patrol helpers live in `dragons/presence.ts`; the library excludes `DragonPresence`, which coordinates game units, fog and region state. The original current miniature remains separately available under Pieces.

`createDragonFire({ tier, reducedMotion })` owns the membrane-adjacent breath particle effect; `play({ from, to, width? })`, `follow(origin)`, `update(dtMs)`, pause and dispose it through the returned handle. `new DragonScorch(heightAt)` adds up to three ground-conforming scars with `add(from, to, width)`. The host owns the supplied height callback and resolved event timing. There is no audio, gameplay damage or secret state in these builders.
