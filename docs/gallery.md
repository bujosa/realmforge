# Gallery contract

Every `gallery/stories/**/*.ts` file self-registers through `registerStories`. A `Story` has an ID, title, category, optional description, optional `controls` schema, and `build(context)`. The context supplies scene/camera/renderer and parsed `values`; return `{ object, update?, ready?, dispose? }`. Existing stories that ignore context continue to work. IDs must be unique.

Controls support `select`, `number`, `boolean` and `colour`, with labels and defaults. Number controls include min/max/step; selects include options. Values are validated when reading the URL. Component values and `view.*` stage values are written into the hash query. Missing or invalid values use the defaults. A rebuild clears old resources and auto-frames the new object. The camera fits all eight world bounding-box corners against both horizontal and vertical perspective, with margin, on desktop and phone. City instances include the roof-height displacement performed by the shader, which ordinary three.js CPU bounds omit.

The gallery owns returned object geometry/material disposal. A story's `dispose` hook releases external assets/listeners/pools. Shared story resources are disposed once per object traversal. Animation uses the single gallery loop; reduced-motion preference suppresses turntable. The QA sheet uses one renderer and an offscreen target sequentially, releases each story, and creates JPEG q72 thumbnails; click a card to return to its study.

`window.__realmforge` is a deliberately small QA inspection surface: `stories()`, `stats()`, `ready()`, `values()` and projected `framing()`. It exposes no host secrets or game state.
