# Gallery contract

Registrar files under `gallery/stories/<domain>/*.ts` self-register through `registerStories`. A `Story` has an ID, title, category, optional description, optional `controls` schema, and `build(context)`. The context supplies scene/camera/renderer and parsed `values`; return `{ object, update?, ready?, dispose? }`. Existing stories that ignore context continue to work. IDs must be unique.

Controls support `select`, `number`, `boolean` and `colour`, with labels and defaults. Number controls include min/max/step; selects include options. Values are validated when reading the URL. Component values and `view.*` stage values are written into the hash query. Missing or invalid values use the defaults. A rebuild clears old resources and auto-frames the new object. The camera fits all eight world bounding-box corners against both horizontal and vertical perspective, with margin, on desktop and phone. City instances include the roof-height displacement performed by the shader, which ordinary three.js CPU bounds omit.

The gallery owns returned object geometry/material disposal. A story's `dispose` hook releases external assets/listeners/pools. Shared story resources are disposed once per object traversal. Animation uses the single gallery loop; reduced-motion preference suppresses turntable. The QA sheet uses one renderer and an offscreen target sequentially, releases each story, and creates JPEG q72 thumbnails; click a card to return to its study.

`window.__realmforge` is a deliberately small QA inspection surface: `stories()`, `stats()`, `ready()`, `values()` and projected `framing()`. It exposes no host secrets or game state.

## Story UI slots

`StoryContext.overlay` is the story's top-stage element and `StoryContext.hud` its lower-right diagnostics slot. Append story UI to these slots rather than `#stage` or `document.body`. The gallery clears both when disposing a story. The story must still remove external event listeners, styles and other resources in `dispose()`. Slots are detached during QA-sheet thumbnail builds, so UI does not leak into the gallery. Geometry must not depend on a slot being connected.

A populated overlay hides the shared R / nn badge; a populated HUD hides shared stats. Keep slot child panels in normal flow rather than positioning them relative to the whole stage. Army and threat studies use these same slots. Helpers such as `gallery/story-kit.ts` live outside the auto-glob registration tree.

Navigation metadata, input behavior and limits are described in [Exploration](exploration.md). `window.__realmforge.navigation()` returns mode, speed, eye height, position and direction. `resetMetrics()` clears the frame-interval sample window; `metrics()` returns p50/p95 wall-clock intervals and current renderer counts. Intervals include scheduling/load and are distinct from CPU submission time. Screen-space shader stories may supply `object.userData.visualBounds` as a local `THREE.Box3` of their physical anchors plus margin; shader quads do not supply useful CPU bounds.

Initial framing runs after the first story update as well as after asynchronous readiness. This gives the gallery the final framing decision when legacy stories initialize their own camera or animated bounds. Offscreen QA thumbnails apply the same rule. Subsequent user orbit/look input is preserved.

## Categories and portability

The canonical navigation order is Explore, Pieces, Armies, Wildlings, Castles, Cities & seats, Nature, Props, Dragons, Effects, Tokens, Materials, Heraldry and Scale. Study IDs are stable links even when the ID predates a category split. Titles use a subject followed by an optional ` · qualifier`. Descriptions explain scope, scale or injected inputs. Optional presets supply named demo labels.

Headless QA uses the local Playwright package and defaults to gitignored `qa-output`. `QA_OUTPUT_DIR`, `QA_PORT` and `QA_BASE_PATH` configure evidence, temporary preview port and built path. `QA_FILTER` selects IDs for iterative review. Every runner shares the preview lifecycle in `qa/server.cjs`; there is no required external checkout. See README for setup.
