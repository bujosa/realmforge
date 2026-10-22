# Heraldry

`registerSigil(id, svg)` registers artwork supplied by the host. `setSigilResolver(resolver)` maps logical identities to registered IDs, and `sigilIdentity(id)` supplies neutral fallback. Install sources before the first geometry/atlas build; the geometry layer caches parsed shapes. The API's only built-in source is an original neutral circle.

`SigilAtlas` and relief geometry in `heraldry/index.ts` are retained for consumers of banners/companies. The source registry is injectable and imports no game artwork. The optional `presets/demoSigils.ts` installer registers nine newly authored abstract geometric marks associated with demo labels. They are intentionally not representations of official house emblems. The inherited raw SVG artwork was removed from the library and replaced with these original marks.
