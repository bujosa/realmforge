# Production scale and source citations

Frozen source revision: `d594e1c1`, paths relative to `src/client/tabletop/`.

| Component | Production rule / source | Library behavior |
|---|---|---|
| Frame | `frame/SceneFrame.ts:43`, `METRES_PER_UNIT = 50`; map k and object metres are independent | Exact conversion in `core/SceneFrame.ts`; no display-size normalization |
| Castle | `scene/geometry/castles.ts:13`, `CastleBuilder.ts`; authored scene-unit geometry | Castle sculpt at scale 1; no map placement/strategic size-law boost |
| Complete city | `realism/cities/PhysicalRecipes.ts` and `PhysicalKit.ts:74`; lot width/depth/height divide by 50 | King's Landing recipe, Balanced tier, fixed mid detail on explicit synthetic ground |
| Company | `scene/WorldCompanies.ts:14`, original formation/sculpt coordinates | `companyGeometry('footman', true)` at scale 1 |
| Ship | `scene/miniatures.ts:296`, original ship envelope/profile | `worldMiniatureGeometry('ship', 'neutral', …, true)` at scale 1 |
| Tree | `scene/geometry/nature.ts:42–55`, oak Y envelope 0.2935 u (14.675 m); pine 0.322 u; birch 0.312 u | Original final envelope fit; no extra scaling |
| Sheep | `realism/kits/life.ts:21–42`, body radius 0.014 u and leg height 0.013 u | Exact livestock geometry, about 0.026 u (1.3 m) tall |
| Physical wall | `scene/wallScale.ts:4–12`: 213 m / 50 = 4.26 u; authored crown 1.58; watch-castle scale 0.85 | Same constants and physical profile |

`scale/production` lines up a castle, a complete physical city, a current company, ship, oak and sheep. They share Y=0 and retain their original relative dimensions. Horizontal gaps and text labels are gallery-only. The city is genuinely much wider than a company: zoom to examine the small elements. Game map coordinates, coastline sampling, strategic screen-size floors and camera-distance presence boosts are separate policies and are not applied in this isolated physical reference.
