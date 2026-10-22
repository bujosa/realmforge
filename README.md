# Realmforge

A source-first TypeScript / three.js library of procedural medieval miniatures, castles, cities, nature and props, with a component atelier for visual QA. Extracted from Swords and Ravens production revision `d594e1c1`. Original geometry is GPL-3.0-only. This repository is private during development; it is not a published npm package yet.

```sh
npm ci
npm run dev             # http://localhost:5201
npm run typecheck
npm run build           # TypeScript + production gallery → dist-gallery/
npm run preview         # http://localhost:5202
npm run qa              # with the gallery running on 5201
```

The gallery and documentation are in English. Search the catalogue, orbit or zoom a component, and use its inspector to change architecture, house, color, variant, seed, quality or LOD. Stage controls include turntable, wireframe, bounds, grid, five ground swatches, three light presets and pixel ratio. `Copy QA link` records component and stage controls in the URL. Camera orbit/pan is reset by a shared link; manual camera pose is not serialized. `#qa` renders every registered story sequentially into a thumbnail sheet. On phones the catalogue is a drawer.

## Component catalogue

| Domain | Contents | API |
|---|---|---|
| Pieces | Current footman, knight, siege engine, ship, dragon; current companies; ten demo identities | [Pieces](docs/pieces.md) |
| Castles | Ten styles, 24 named board landmarks, modular castle kit, architecture and details | [Castles](docs/castles.md) |
| Cities & seats | Physical complexes, hero geography, six island seats, seven complete physical cities, two board cities, seven house families, settlements and harbor | [Cities](docs/cities.md) |
| Nature | Pine, oak, birch, cliffs, rocks, riverbank, production livestock | [Nature](docs/nature.md) |
| Props | Barrel, crown, animated castle torches and smoke | [Props](docs/props.md) |
| Materials | Castle/complex/city shaders, ice, ambientCG wood/stone/metal/paper | [Materials](docs/materials.md) |
| Heraldry | Injectable SVG geometry/atlas; neutral default; original abstract demo marks | [Heraldry](docs/heraldry.md) |
| Scale / core | Original 50 metres/unit frame, physical city/army/ship/tree/sheep lineup, lifecycle and instancing | [Scale](docs/scale.md), [Core](docs/core.md) |
| Presets | Separated game-specific names, city recipes and demo data | [Presets](docs/presets.md) |

Every file under `gallery/stories/**` self-registers via `import.meta.glob`. To add a component, add a file there and call `registerStories`. See [gallery contract](docs/gallery.md).

## Using the source API

```ts
import * as THREE from 'three';
import { castleGeometry, CastleMaterial, natureGeometry } from './src/index';

const castle = new THREE.Mesh(castleGeometry('stronghold', 'north'), new CastleMaterial());
const tree = new THREE.Mesh(natureGeometry('tree-oak'), new THREE.MeshStandardMaterial({ vertexColors: true }));
scene.add(castle, tree);
// The host owns geometry/material disposal and the animation clock.
```

Builders accept tiny structural interfaces and callbacks; they do not import the game's model, React, HUD, streamed world or board placement. Named seats and city recipes remain optional demo compatibility data. Some authored recipe geometry retains game-specific kind strings internally so the original builders produce the same geometry. The index exposes neutral API identifiers. See [extraction map](docs/extraction-map.md) and [architecture](docs/architecture.md).

## Visual QA

`npm run qa` uses the existing Playwright installation at `/Users/davidbujosa/Documents/Workspace/games/swords-and-ravens-v3-p3/e2e/node_modules/playwright`; it adds no dependencies. Chrome runs with `channel: "chrome"`, `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`; WebKit supplies the Safari-adjacent check. Each story is captured at desktop 1440×960 and phone 390×844, as JPEG quality 72, with a contact sheet per category/browser/viewport and `results.json`. It verifies full-object framing, URL control roundtrips, search/drawer navigation and the QA sheet. Console errors, WebGL/shader errors, failed network requests, HTTP errors or interaction failures cause a nonzero exit.

The runner expects an existing server and never starts or kills another worker's process. `QA_URL`, `QA_OUTPUT_DIR` and optional `QA_FILTER` override the URL, output path and story selection. By default outputs go to ignored `qa-output/`. In the rf-kit worktree that path is an ignored symlink into the assigned evidence directory. Runtime stats show draw calls, triangles, GPU resource counts, synchronous build time and CPU render submission time. They are not GPU timings or a frame-rate benchmark; host `uptime` is recorded before capture.

## Licenses and status

- Library code and original procedural geometry: **GPL-3.0-only**, [LICENSE](LICENSE).
- Kenney Castle Kit 2.0, the included optimized `castle-kit.glb`: **CC0**. [Asset notice](src/materials/assets/licenses/Kenney-Castle-Kit.txt).
- ambientCG Wood051, Paper001, Bricks052, Metal032, included WebP maps: **CC0**, by Lennart Demes. [Asset notice](src/materials/assets/licenses/ambientCG.txt), [CC0 legal text](src/materials/assets/licenses/CC0-1.0.txt).
- Gallery sigils are newly authored abstract geometric demo marks, GPL-3.0-only. They do not reproduce official house emblems. The reusable API includes only its neutral marker; hosts provide their own artwork and permissions. No HBO or Fantasy Flight artwork is included.

Status: extraction and local QA round 1. City studies use explicit synthetic flat regions and a straight shoreline; terrain callbacks in the real game yield different arrangements. This library does not recreate terrain streaming, game fog/state, production world placement or camera orchestration. New army work is a separate owned module (`src/armies/**`) and is outside this extraction. No commit, push, PR or deployment is part of this round.
