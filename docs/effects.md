# Presentation effects

`createInstancedVfx<P>(options, limits, emit)` builds one texture-free instanced quad family. The emitter receives the public cue and bounded particle capacity, returning positions, velocities, colors, timing and shapes. `VfxHandle<P>` exposes `object`, `play(cue)`, `update(dtMs)`, `setPaused`, `stats` and `dispose`. Low quality and reduced motion return `null`.

Production presets are `createChargeDust`, `createMeleeSparks`, `createArrowVolley`, `createBannerFall`, `createSiegeSmoke`, `createShipRam`, `createRetreatDust` and `createFireBurst`. The last is the generic resolved-action fire burst; `createDragonFire` is the richer standalone dragon breath controller. Point cues inject an origin and optional direction/color; path cues inject from/to/color. Burning/sinking flags are explicit public resolved inputs. All presets have individual animated gallery stories. Hosts schedule presentation only after their own public event resolution; these modules subscribe to nothing.

`ShipWakes(parent, { texture, frame }, mapWidth, mapHeight, surfaceHeight, frame?)` owns one bounded foam batch. The caller supplies the public water visibility/depth texture and height callback, calls `begin(nowMs, enabled)` then `ship(id,x,z,moving,nowMs)`, and `retain(ids)` when ships disappear. The water texture stays host-owned. Dispose removes only the owned batch.
