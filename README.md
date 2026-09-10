# TreeDataGrid Web · 0.1.0

A working JavaScript port of the TreeDataGrid model/control architecture: a DOM-independent **Core** package and a reusable **`<tree-data-grid>`** browser control. The showcase uses **`grid.Model` and Core sources throughout**, not a legacy-source adapter.

The inspected upstream snapshot is `wieslawsoltes/TreeDataGrid@3ca47316d724e5e040ab0281a880e8df999b25fc`. This release implements a substantial model API and interactive control, but **does not claim exhaustive public-API or behavioral parity with every Avalonia/.NET surface**. Read [API parity and boundaries](docs/API-PARITY.md) before treating it as a drop-in replacement.

## Run the showcase

From this directory, with Node 20 or newer:

```sh
npm start
```

Open `http://localhost:4173`. No package installation or build is needed to run the source demo. Alternatively, open **`dist/TreeDataGridWeb.html`** in a normal modern browser: the complete application, control, styles, and default datasets are embedded in one file. There are no CDN, font, image, framework, or runtime-library downloads. The optional live article feed requires a network connection and an explicit click.

The standalone file was executed through Playwright's in-memory HTML loading in the supplied environment, whose managed browser policy blocks URL navigation. Direct `file:`/HTTP browser navigation, live service calls, and permission prompts were not exercised here.

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

Keep the two package directories as siblings when copying them directly. For local npm consumption, create tarballs from `packages/core` and `packages/web` with `npm pack`, then install **both local tarballs** in the consuming application. The package names in this archive are not an assertion that these packages have been published to a registry.

For a non-module script, load `dist/treedatagrid.global.js`. Its globals are `TreeDataGridCore` and `TreeDataGridWeb`; it also registers the custom element. Core can be imported separately in Node without a DOM. The web package requires a browser DOM and is not an SSR module.

## Validate and rebuild

```sh
npm test                 # Node core/geometry/selection tests
npm run build            # Rebuild global library and standalone showcase
npm run bench            # Local core microbenchmarks + JSON report
npm run typecheck        # Requires TypeScript in the toolchain
npm run test:browser      # Requires Python Playwright + Chromium
```

The runtime and build scripts need no third-party packages. Browser testing uses the separate Python dependency in `tests/requirements.txt`. See [Testing](docs/TESTING.md) for setup, actual coverage, measurement definitions, and exclusions. Machine-readable evidence is in `verification/`.

## Documentation

[API and integration](docs/API.md) · [Architecture and performance](docs/ARCHITECTURE.md) · [Parity and boundaries](docs/API-PARITY.md) · [Testing](docs/TESTING.md) · [Recorded results](docs/VERIFICATION.md) · [Source provenance](THIRD_PARTY_NOTICES.md)

The upstream MIT copyright and permission notice are retained in `LICENSE`, both package directories, and the generated standalone/global distributions. No font files or proprietary upstream binary assets are included.
