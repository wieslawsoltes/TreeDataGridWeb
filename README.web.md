# TreeDataGrid Web · 0.1.0

[![CI](https://github.com/wieslawsoltes/TreeDataGridWeb/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/wieslawsoltes/TreeDataGridWeb/actions/workflows/pages.yml)
[![npm version](https://img.shields.io/npm/v/@wieslawsoltes/treedatagridweb)](https://www.npmjs.com/package/@wieslawsoltes/treedatagridweb)
[![npm downloads](https://img.shields.io/npm/dm/@wieslawsoltes/treedatagridweb)](https://www.npmjs.com/package/@wieslawsoltes/treedatagridweb)
[![Release](https://img.shields.io/github/v/release/wieslawsoltes/TreeDataGridWeb)](https://github.com/wieslawsoltes/TreeDataGridWeb/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/demo-GitHub%20Pages-087f78)](https://wieslawsoltes.github.io/TreeDataGridWeb/)

A working JavaScript port of the TreeDataGrid model/control architecture: a DOM-independent **Core** package and a reusable **`<tree-data-grid>`** browser control. The showcase uses **`grid.Model` and Core sources throughout**, not a legacy-source adapter.

The inspected upstream snapshot is `wieslawsoltes/TreeDataGrid@3ca47316d724e5e040ab0281a880e8df999b25fc`. This release implements a substantial model API and interactive control, but **does not claim exhaustive public-API or behavioral parity with every Avalonia/.NET surface**. Read [API parity and boundaries](docs/API-PARITY.md) before treating it as a drop-in replacement.

## Run the showcase

From this directory, with Node 22.12 or newer:

```sh
npm start
```

Open `http://localhost:4173`. No package installation or build is needed to run the source demo. Alternatively, open **`dist/TreeDataGridWeb.html`** in a normal modern browser: the complete application, control, styles, and default datasets are embedded in one file. There are no CDN, font, image, framework, or runtime-library downloads. The optional live article feed requires a network connection and an explicit click.

CI exercises the standalone showcase in Chromium, the HTTP transport, the installed npm component, and the deployed HTTPS demo. Live external services and native permission prompts remain outside those automated checks.

## What is included

| Area | Delivered functionality |
| --- | --- |
| Core models | Flat and hierarchical sources, index paths, observable lists/models, nested property observation, typed value/text/checkbox/template columns, custom comparisons, visitors, row mapping, expansion and source notifications. |
| Selection | Single/multiple row selection; rectangular cell ranges; source-column indexes including hidden columns; displayed-order row ranges; shift/control interaction; selection remapping on collection edits. |
| Rendering | Vertical and horizontal virtualization; retained/recycled DOM; fixed or naturally measured variable row heights; scroll anchoring; pixel-to-row height index; capped physical scrollbar with logical large-data positions. |
| Editing | Text/number/date conversion, checkboxes including nullable values, custom edit templates, validation, cancelable edit events, built-in undo/redo, TSV paste and CSV export. |
| Columns/input | Pixel/auto/star widths, min/max, resize, reorder, visibility, leading frozen columns, sort cycling, keyboard navigation, type search, context menus, row drag/drop. |
| Integration | Native ES modules, global-script distribution, TypeScript declarations, CSS custom properties, named view templates, shared model/multiple views, attach/detach and disposal. |

## Ten working sample scenarios

The first eight mirror the upstream Core demo's scenarios: **People & teams; Countries; Variable row heights; Files & folders; Article feed; Drag & drop; Cell templates; Find displayed row.** The additional **Virtualization lab** offers 10,000, 100,000 and 1,000,000 rows plus a 200-column dataset. **Shared model** attaches two independent presentations to the same source and row objects.

The samples deliberately use deterministic fixture data. Country statistics are synthetic, not a current geographic dataset. The article view contains original project-related fixture text until a user explicitly requests the Wikimedia feed. The file view starts with a fixture tree and can display user-selected local file metadata; it does not modify the filesystem.

A smaller independent integration is in [`samples/minimal/index.html`](samples/minimal/index.html).

## Reuse the control

```html
<tree-data-grid id="people" style="display:block;height:420px"
                aria-label="People"></tree-data-grid>
<script type="module">
  import {
    observable, ObservableList, FlatTreeDataGridSource,
    TextColumn, CheckBoxColumn
  } from './packages/core/index.js';
  import './packages/web/index.js';

  const items = new ObservableList([
    observable({ Name: 'Alex', Age: 36, Active: true }),
    observable({ Name: 'Maya', Age: 29, Active: false })
  ]);
  const source = new FlatTreeDataGridSource(items);
  source.Columns.Add(new TextColumn(
    'Name', p => p.Name, (p, value) => p.Name = value, '2*'));
  source.Columns.Add(new TextColumn(
    'Age', p => p.Age, (p, value) => p.Age = value, '*',
    { Validate: value => value >= 0 || 'Age must be non-negative.' }));
  source.Columns.Add(new CheckBoxColumn(
    'Active', p => p.Active, (p, value) => p.Active = value, 90));
  source.RowSelection.SingleSelect = false;

  const grid = document.getElementById('people');
  grid.Model = source;
  grid.CanUserResizeColumns = true;
  grid.RowHeight = null;          // Measure natural heights.
  grid.EstimatedRowHeight = 36;   // Estimate for unvisited rows.

  // Automatic visible-cell update through the observable proxy:
  items.Get(0).Name = 'Alex Morgan';

  // On teardown: grid.Dispose(); source.Dispose();
</script>
```

Install the published package:

```sh
npm install @wieslawsoltes/treedatagridweb
```

For a bundled application, import Core from `@wieslawsoltes/treedatagridweb/core`
and register the component with `import '@wieslawsoltes/treedatagridweb/web'`.
The package root also exports the DOM-independent Core API. Node 22.12 or newer supports both ESM imports and synchronous CommonJS `require`. Both entry points
share the same model constructors; `/web` requires a browser DOM. Styles are
embedded automatically in the component's shadow root. `/styles.css` exposes
those rules for custom presentation work; `/global` and `/standalone` expose the
prebuilt browser distributions.

The npm package keeps both source directories together, so no second package or
runtime dependency is needed. Keep those directories as siblings when copying
sources directly. The historical workspace tarballs in `releases/` are
retained as original artifacts; use the scoped npm package for new installations.

For a non-module script, load `dist/treedatagrid.global.js`. Its globals are `TreeDataGridCore` and `TreeDataGridWeb`; it also registers the custom element. Core can be imported separately in Node without a DOM. The web package requires a browser DOM and is not an SSR module.

## Validate and rebuild

```sh
npm test                 # Node core/geometry/selection tests
npm run build            # Rebuild global library and standalone showcase
npm run bench            # Local core microbenchmarks + JSON report
npm run typecheck        # Strict declaration checks after npm ci
npm run test:browser     # Requires Python Playwright + Chromium
npm run test:package     # Tests an isolated installed npm tarball
```

The runtime and build scripts need no third-party packages. Run `npm ci` to install the locked TypeScript and browser test tools. Browser testing uses the separate Python dependency in `tests/requirements.txt`. See [Testing](docs/TESTING.md) for setup, actual coverage, measurement definitions, and exclusions. Machine-readable evidence is in `verification/`.

## Documentation

[API and integration](docs/API.md) · [Architecture and performance](docs/ARCHITECTURE.md) · [Parity and boundaries](docs/API-PARITY.md) · [Testing](docs/TESTING.md) · [Recorded results](docs/VERIFICATION.md) · [Source provenance](THIRD_PARTY_NOTICES.md)

The upstream MIT copyright and permission notice are retained in `LICENSE`, both package directories, and the generated standalone/global distributions. No font files or proprietary upstream binary assets are included.

## Releases and npm publication

Changes are verified on Node 22 and Node 24 before release. The main workflow
creates a GitHub release containing the npm tarball, browser and showcase
archives, and SHA-256 checksums. It then invokes the reusable npm publishing
workflow with the release tag and verified commit.

Publishing uses the repository's `NPM_TOKEN` secret and npm provenance. Retries
verify an existing immutable npm version's integrity instead of replacing it.
The workflow verifies the release checksum, installed ESM/CommonJS and strict
TypeScript consumers, Core constructor identity, packaged styles and assets,
public registry metadata and provenance, a downloaded tarball, and a fresh
anonymous installation by package name. The browser package is also tested from
an isolated npm installation before release.

For another release, update `package.json`, the release notes and changelog in a
PR. Merge after CI passes. Existing release tags and assets remain unchanged.
The **Publish npm registry** workflow can also republish an existing release tag
idempotently without rebuilding its package.
