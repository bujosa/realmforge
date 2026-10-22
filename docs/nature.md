# Nature

`natureGeometry(kind, foliage = '#40563d')` covers `tree-pine`, `tree-oak`, `tree-birch`, `cliff`, `mountain-rock` and `river-bank`. It retains the production tree support envelope. `naturalTree(kind, foliage, addPart)` exposes the lower-level procedural tree parts.

`livestockGeometry()` is the production neutral sheep-like quadruped extracted from `realism/kits/life.ts`. Only its geometry is copied; grazing-site selection, world sampling and hidden game state are excluded. All outputs use vertex colors; the host owns geometry/material disposal.

`floraGeometry(species, near)` adds physical pine, birch, oak, cypress, olive, palm, willow, orchard, weirwood and reed sculpts. They use normalized height; scale by the desired physical height divided by 50. `floraGrassGeometry`, `floraGroupGeometry` and `floraImpostorGeometry` add ground cover and distant forest representations. `floraCanopyTextures()` creates original procedural color and normal atlases; the caller owns texture disposal. Supporting placement interfaces accept public geography and clearance callbacks; no private game state is read.
