# Core

`METRES_PER_UNIT = 50`. `tableFrame(width, height)` uses land factor 1; `worldFrame(width, height, k = 20)` uses the requested factor. `frame.m(metres)` always divides by 50, while map-space `len`, `point` and inverse functions scale with `k`. The pure wall-scale API preserves 213 m physical height, 1.58 authored crown reference and 0.85 watch-castle scale.

`KitPool(variants, shadows, assets?, material?)` owns reusable geometry, instanced materials and a group. Publish place lists with `setPlace`, then `flush`. Dispose the pool after its cities. `houseLotInstance` converts physical dimensions into kit instances. `CastlePlacement` and `ResourceSnapshot` are structural input types, with no game model dependency.

`core/sculpt.ts` and `core/finish.ts` contain the extracted geometry paint/bevel/UV utilities. Existing pieces keep their original private sculpt/finish modules so that the separate army work does not conflict. `RepresentationLod`, physical size-law helpers and `HillProfile` are pure extraction dependencies, with no world/camera module imports.
