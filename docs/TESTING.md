# Testing and reproducibility

## Commands

```sh
npm test
npm run build
npm run bench
npm run typecheck
npm run test:http
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
npm run test:browser
```

The first three commands need only Node. The type check needs `tsc` in PATH; the supplied run used TypeScript **5.8.3**. Browser tests use Python Playwright **1.57.0**. `CHROMIUM_EXECUTABLE=/path/to/chromium` selects an existing browser; otherwise the harness uses a system Chromium if present or Playwright's installed browser. Chromium **144.0.7559.96** was exercised in this environment.

The root contains the actual source modules. `scripts/build.mjs` is a small deterministic packager for this project's static module syntax, not a general JavaScript compiler. Its output runs without `eval` or a `Function` constructor. It produces the global library and the one-file demo. The TypeScript declarations are maintained separately and checked with a typed consumer fixture; the runtime itself is JavaScript.

## Evidence

- `verification/core-tests.txt`: Node test-run output. Covers primitives, collections, observation, sorting/mapping, selection, hierarchy, moves, async loading, geometry, scaling and disposal.
- `verification/browser-tests.json` and `.txt`: actual browser test group results and uncaught exception list. A group contains several related assertions; group count is not assertion count.
- `verification/core-benchmark.json`: local measurements with runtime/CPU and explicit timed operations.
- `verification/types.txt`: declaration/typed-consumer check outcome.
- `verification/people-light.png`, `people-dark.png`, `variable-heights.png`, `mobile.png`: screenshots from the tested application.

The JSON result files are authoritative for the final run. The bundle is rebuilt at the start of browser tests. No mock replacement renderer is used; tests exercise actual DOM layout, ResizeObserver, keyboard, pointer dragging, editing and selection.

## Browser test coverage

The suite exercises the ten direct-Core sample views; hierarchy/ARIA; row/cell ranges; keyboard editing/navigation; conversion/validation; undo/redo; sorting; pointer resize; native header reorder; visibility and menus; template recycling/custom editing/nullable checkboxes; TSV round-trip and transactional paste; safe CSV output; data mutation/filter/empty state; variable-height distant scrolling and live resizing; 100,000 and 1,000,000 rows; 200-column horizontal culling/frozen alignment; shared model identity/layout; nested property replacement; detach/reattach cleanup; row drag/drop; auto widths; view-state restoration; text injection resistance; light/dark/narrow layouts; cancellation; and custom tag registration.

The Node selection regressions specifically verify that removing a selected parent reports the previously selected child as deselected, not the model now occupying the same path; index shifts do not spuriously deselect/reselect surviving items; and committed items remain stable until selection batches complete.

## Environment limitations

Managed Chromium policy in this environment blocks URL navigation. The test harness uses Playwright **`page.set_content` with the actual generated standalone HTML**, without changing browser policies or permissions. This validates executable code, real rendering and interactions, but does not validate HTTP/module transport or direct `file:` opening in that browser. The supplied Node HTTP smoke check validates HTML/module/CSS responses, a missing-resource response, and encoded path-traversal rejection independently; it is not a browser-navigation test. Its results are in `verification/http-tests.json`.

Not exercised: Firefox/WebKit, physical touch or stylus devices, actual screen readers, native clipboard permission dialogs, directory picker permissions, the optional live Wikimedia request, and long-duration production soak/security tests. Mobile screenshots are narrow desktop Chromium viewport checks, not physical-mobile certification.

## Benchmarks are not pass/fail FPS guarantees

The Node benchmark forces lazy row projection inside its sort timer, validates sorted order, and reports model allocation separately. The browser scrolling workload samples 90 positions and logs bounded realized DOM. It reports synchronous render JS separately from two-animation-frame waits. Later layout/paint and observer work are not all included in the JS timer. See `ARCHITECTURE.md` for complexity and timer definitions.

Only measured and asserted behavior is counted as verified. These tests do not certify complete upstream API/behavioral parity.
