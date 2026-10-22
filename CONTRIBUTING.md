# Contributing

Use English for code, comments, UI and documentation. Keep changes focused and preserve public APIs. Requires Node.js 22.12+; start with `npm ci`.

Add original procedural builders to the matching `src/<domain>/` directory. Class files use PascalCase; functions/data use camelCase. Keep game-specific names in optional `src/presets/` data or compatibility keys. A library module must never import gallery code or hidden game state.

Add a kebab-case file under `gallery/stories/<domain>/`, import `registerStories` from `../../registry`, and self-register a unique, stable `domain/id`. Use a concise title, a useful description and the existing category taxonomy in `gallery/main.ts`. Return an object and any `update`, `ready` or `dispose` hooks; the gallery owns object geometry/material disposal. Keep external textures, listeners and pools under an explicit disposal hook. Update the domain documentation and `docs/catalogue.md`.

Run `npm run typecheck`, `npm run build`, `git diff --check`, and `npm run qa` after installing QA browsers with `npx playwright install chrome webkit`. Review desktop/phone contact sheets in both engines; report failing checks. `QA_FILTER` supports iteration; run the complete matrix before release. Evidence defaults to gitignored `qa-output`; never commit generated QA artifacts or private paths.

By submitting code, original assets or documentation, you license your contribution under GPL-3.0-only. Include provenance and bundled notices for any CC0 source asset. Do not contribute copied franchise artwork, credentials, customer data or assets with unclear redistribution rights.
