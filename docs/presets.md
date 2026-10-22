# Optional presets

Game-specific labels and colors live in `demo.ts`; the original abstract gallery marks are installed explicitly by `demoSigils.ts`. `styleRegions.ts` preserves the original region-to-style lookup. `cityLayouts.ts` contains the two board-city layouts and `physicalCities.ts` the seven complete physical-city recipes. `islandSites.ts` holds the frozen demo coordinates/pads for the original six island seats.

These modules preserve compatibility with named game demos without placing trademarked names in the neutral public API identifiers. Geometry internals still recognize their original recipe/kind strings so existing hosts can opt in. The library has no gameplay state, ownership, hidden information or region-selection policy. Preset imports are separate from the main neutral heraldry API.
