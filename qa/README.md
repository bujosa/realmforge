# Look-development evidence

Use the installed Playwright dependency and system Chrome plus WebKit. No extra
npm packages are needed. Run from the repository root, sequentially, after a
production gallery build. All browsers are headless. Each capture command owns
one preview, refuses occupied ports and stops its exact child PID in `finally`.

```sh
nice -n 10 npm run build
nice -n 10 env QA_PORT=5250 QA_OUTPUT_DIR=qa-output/lookdev node qa/lookdev.cjs full
nice -n 10 env QA_OUTPUT_DIR=qa-output/lookdev node qa/lookdev-sheets.cjs
nice -n 10 env QA_OUTPUT_DIR=qa-output/lookdev node qa/lookdev-report.cjs
```

- `QA_PORT`: 5250 by default; look-development runners accept only 5250–5259.
- `QA_OUTPUT_DIR`: relative or environment-supplied output path, default
  `qa-output/lookdev` (gitignored). No private reference files are required.
- `QA_BASE_PATH`: `/` by default; use `/realmforge/` for a Pages-path build.
- `LOOKDEV_ONLY=B`: restrict captures/measurements/contact sheets to chosen B.
- `LOOKDEV_REPEATS`: 1–5 samples per quality, default 1; compare medians and ranges
  under similar host load rather than treating sub-millisecond RAF jitter as GPU cost.
- `LOOKDEV_RESUME`: optional results JSON from the exact same unchanged build.
- Modes: `full` measures both qualities/engines/viewports; `inspect` captures B
  on desktop Chrome; `stills` captures without timings; `video` records 30 s
  flights on desktop Chrome. JPEG evidence uses quality 72.

`lookdev-parity.cjs` captures every armies/wildlings/heraldry story plus A and C
in desktop Chrome. Run it before and after changes with separate output folders.
It freezes the animation clock and seeded randomness, reloads each story to
isolate resources, and writes canvas PNGs plus SHA-256 hashes to `parity.json`.
Compare decoded pixels when hashes differ; never claim parity from source diff
alone. These bounded evidence runners are not an automated UI regression suite.

`lookdev-report.cjs` writes only `capture-report.md`: it reports measured budgets,
not publication approval or checks it did not run. Final delivery reports must
separately record before/after performance, visual review, parity, static gates,
privacy checks and listener cleanup. Browser RAF p95 is not GPU frame time;
phone viewports are emulation rather than physical-device validation.
