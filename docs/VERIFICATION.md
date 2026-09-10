# Release verification · 0.1.0

Reference source: `wieslawsoltes/TreeDataGrid@3ca47316d724e5e040ab0281a880e8df999b25fc`.

| Check | Final result |
| --- | --- |
| Node Core/selection/geometry tests | **34 passed; 0 failed** |
| Chromium browser test groups | **30 passed; 0 failed** |
| Uncaught browser exceptions | **0** |
| TypeScript declarations + typed consumer | Passed with TypeScript 5.8.3 |
| Local npm tarball installation | Both packages installed offline; Core runtime, Web resolution and typed consumer passed |
| HTTP smoke | Six HTML/JS/CSS routes passed; missing route 404; encoded traversal 403 |

## Browser workloads

Browser: Chromium 144.0.7559.96, headless, 1440 × 980 desktop viewport. A narrow 390 × 844 viewport was also checked. The generated standalone HTML was executed with Playwright `set_content`; managed URL navigation policy was not changed.

| Workload | Observed realized DOM |
| --- | --- |
| 100,000 rows × 5 columns | 20 rows, 100 cells |
| 1,000,000 rows, final row reached | 20 rows, 100 cells |
| 2,000 rows × 200 columns, horizontally scrolled | 25 rows, 275 cells |

The 100,000-row scroll workload sampled 90 positions. Its synchronous render-JS median was **9.0 ms**, with **16.8 ms** at the 95th percentile. These timers exclude later layout/paint and observer work; **they do not establish end-to-end FPS**. The separate 200-column final render snapshot was 58.3 ms in this environment and is not being counted as a 60-FPS result.

Variable-height tests checked distant rows, last-row reachability, contiguous positioned elements, live content growth/shrinkage, and bounded realized rows. Shared-view tests verified identical Core row objects and independent actual column measurements.

## Core timings

Runtime: v22.16.0, linux/x64, Intel(R) Xeon(R) CPU E5-2673 v4 @ 2.30GHz.

| Timed operation | One local run |
| --- | --- |
| Create 1,000,000 plain model objects | 833.51 ms |
| Initialize flat source, columns, row projection (1,000,000 items) | 2.83 ms |
| Read 100 dispersed row models without allocating rows | 0.61 ms |
| Realize 40 dispersed core rows | 0.65 ms |
| Initialize 1,000,000-row height index | 93.99 ms |
| 100,000 variable-height updates | 42.35 ms |
| 100,000 pixel-to-row + prefix-offset queries | 97.48 ms |
| Stable numeric sort + inverse mapping (100,000 rows) | 188.51 ms |
| Expand all 10,000 hierarchical rows | 303.25 ms |
| Collapse all 10,000 hierarchical rows | 109.63 ms |

These are synchronous single-run microbenchmarks, not cross-machine guarantees. Model creation and source/projection initialization are timed separately. The sort timer includes realization of the sorted projection and the result is checked for ascending order. Million-row height-index arrays occupy 16,000,008 bytes; this excludes model, selection, Core-row and DOM memory.

## Limits of this evidence

No Firefox/WebKit, physical mobile/stylus, actual screen-reader, native clipboard/file-picker permission, live Wikimedia, or browser HTTP/file navigation certification is implied. There is no production security audit or exhaustive differential upstream API test matrix. See `API-PARITY.md`, `ARCHITECTURE.md` and `TESTING.md`; the JSON/TAP/text files in `verification/` contain the actual final-run evidence.
