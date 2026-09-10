# Architecture and performance

## Data flow and ownership

```
Arrays / ObservableList / observable models
                 |
     Flat / Hierarchical source
     columns · sort · expansion · selection
                 |
          Core IRows / IRow
                 |
   TreeDataGridPresentation (one per view)
   column layout · cell columns · bindings
                 |
          <tree-data-grid>
     DOM pool · input · virtual geometry
```

`packages/core` contains no DOM imports. The web package consumes Core source and row objects directly. No per-row legacy-adapter layer is inserted. Two controls sharing one source have independent cell/presentation/measurement objects, but share sorting, expansion, selection and requested column metadata.

Detach suspends view/source subscriptions and unrealizes cells. Dispose releases the presentation and DOM pools; caller-owned sources remain usable. The source owns hierarchy observations and releases them on source disposal. Custom templates are responsible for resources they create outside their element tree.

## Vertical virtualization

`RowHeightIndex` uses a Fenwick prefix-sum tree over Float64 heights. A viewport range is found by pixel offset, then a bounded visible/overscan interval is realized. Height updates and offset queries are logarithmic in row count. Construction or a full geometry rebuild is linear. At one million rows the two typed arrays occupy **16,000,008 bytes**; model objects, selection and row caches are additional memory.

Unmeasured rows start at the configured estimate. `ResizeObserver` supplies real natural row sizes for realized content. Updating a height corrects prefix sums and preserves the scroll anchor; at the end of the list the bottom is held against changing measured height. A bounded 20,000-entry view height cache limits historical measurement bookkeeping. Estimates can change as new content is visited; exact height of never-rendered arbitrary HTML is not known in advance.

The physical vertical CSS extent is capped at 8,000,000 pixels. Logical positions map onto that extent for larger datasets. Wheel deltas and programmatic row navigation operate in logical coordinates. This enables reaching the last of a million 32-pixel rows without relying on a 32-million-pixel CSS element. It is not a browser-independent guarantee for every device/input/scrollbar implementation.

## Horizontal virtualization and layout

Each view maintains visible-column geometry. Pixel, auto and constrained star requests produce actual widths, which need not be the same across differently sized views. Frozen leading columns and viewport-intersecting columns are realized. Spacer elements preserve omitted-column geometry.

Auto width converges from measured visible content. Explicit autofit also samples up to 300 rows with a character-width estimate; it is not a maximum over every model and every rendered font. Natural width caches can be reset. Minimum/maximum constraints are resolved in layout; exact Avalonia measure/arrange behavior is not reproduced.

For variable heights, offscreen columns marked `AffectsRowHeight` stay realized. A wide grid that marks all 200 columns this way necessarily does more work than a grid realizing only 10 columns. Height stability and horizontal culling cannot both be free for arbitrary unseen HTML content.

## Recycling and bindings

Scrolling repositions retained rows and rebinds pooled outer row/cell elements. Built-in cell content is retained. Old subscriptions and cell models are released before a new model is bound. Custom template content is recreated on rebinding to prevent stale create-time event-handler closures from targeting a previously displayed model.

DOM work is coalesced into `requestAnimationFrame`. The renderer avoids a post-write scroll query that would force layout in its own measured pass. Row sizing is reported by observers after layout. The sample's event log and inspector are separate from the reported synchronous render timer.

The **DOM** population is viewport-bounded. The **Core row object cache** is lazy but retains visited row instances until refresh/disposal; it is not an LRU bounded to the viewport. `Rows.GetModel(index)` allows flat model-only reads without allocating a row wrapper. Search and full CSV export use that path where available. Selection ranges keep individual index paths, so selecting all million rows is a materially different workload from merely displaying a million models.

## Costs that are not logarithmic

| Operation | Implementation cost/qualification |
| --- | --- |
| Flat row access | O(1), lazy wrapper creation; optional sort/filter mapping. |
| Flat sort | O(n log n) comparison sorting plus O(n) inverse map. |
| Flat filter/search | Linear scan; synchronous on the calling thread. |
| Collection insert/remove | Array/list movement plus selection/projection updates. |
| Reset index mapping | O(n) occurrence mapping, reused for selected-path remapping. |
| Hierarchical expansion | Lazy child creation, then visible/materialized hierarchy projection rebuild; not an order-statistics tree with logarithmic subtree splicing. |
| Select-all/ranges | O(k) selected path storage and iteration. |
| Full height reset | O(n) typed-array work. |
| CSV export | O(rows × exported columns) and an in-memory output string. |

There is no Web Worker sort/filter engine, server-side virtual data provider, paging protocol, WebGPU renderer, or distributed data source in this release. Native DOM is used for editable/accessibility-aware cells and arbitrary reusable templates. Benchmark results should not be interpreted as measurements of capabilities that are absent.

## Measurement interpretation

`Stats.FrameMilliseconds` is elapsed JavaScript time inside one `_render` call. It excludes later browser style/layout/paint/compositing, asynchronous resize measurements, and some application event work. It is **not total frame time or FPS**.

The browser benchmark records a distribution over 90 teleported scroll positions. `jsRenderMedianMs` and `jsRenderP95Ms` summarize that timer. `twoRafMeanMs` includes two animation-frame waits per sample and must not be inverted into single-frame FPS. The million-row and 200-column snapshots are isolated final-state measurements, not latency distributions.

The Node microbenchmarks separately time model-object creation, lazy source setup, row access, geometry and sorting. In particular, sorting forces row-projection realization inside the timed section, so the sort number includes work that would otherwise be deferred until `Rows` is first requested.

Results in `verification/*.json` are **one local headless/CPU environment**, not an upstream comparison, production SLA, or universal 60/120-FPS guarantee. Run the scripts with your actual row templates, data size, font metrics and target browsers before setting performance budgets.
