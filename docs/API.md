# API and integration

The complete declared JavaScript/TypeScript surface is in [`packages/core/index.d.ts`](../packages/core/index.d.ts) and [`packages/web/index.d.ts`](../packages/web/index.d.ts). This guide explains ownership, index semantics and usage. It is not a claim that every inherited Avalonia or low-level .NET member exists in JavaScript.

## 1. Model, presentation, view

```js
import * as Core from '../packages/core/index.js';
import * as Web from '../packages/web/index.js';

const model = new Core.FlatTreeDataGridSource(items);
model.Columns.Add(new Core.TextColumn('Name', x => x.Name,
  (x, value) => x.Name = value, '2*'));

const view = document.createElement('tree-data-grid');
view.style.height = '400px';
view.Model = model;
document.body.append(view);
```

The source owns items, requested columns, sort/expansion and selection. `TreeDataGridPresentation` owns actual widths, view column objects and cells. The custom element owns DOM, input, measurement, scroll state and realized row/cell bindings. Core row objects are passed directly to cell presentations; `view.Rows === model.Rows`.

Assign `PresentationOptions` **before** a model needing named templates. Replacing presentation options rebuilds view state. Detaching a view suspends its subscriptions; reattaching resynchronizes it. `view.Dispose()` does not dispose a caller-owned model. If several views share a source, dispose the source only after all consumers are finished. Explicitly created selection objects should also be disposed by their owner.

`Source` is a compatibility binding name and is mutually exclusive with `Model`. `view.RowSelection` and `view.ColumnSelection` are legacy `Source` conveniences; **with Core use `model.RowSelection` or `model.Selection`**. `ItemsSource` with `ColumnDefinitions` creates a Core-backed convenience source. These helpers do not instantiate the full legacy Avalonia model implementation.

## 2. Items and notifications

Use arrays for static items or `ObservableList` for mutation notifications:

```js
const items = new Core.ObservableList([
  Core.observable({Name: 'Alex', Expansion: {IsExpanded: false}})
]);
items.Add(Core.observable({Name: 'Maya', Expansion: {IsExpanded: false}}));
items.Batch(list => {
  list.Insert(0, Core.observable({Name: 'New', Expansion: {IsExpanded: false}}));
  list.Move(0, 1);
});
items.Get(0).Name = 'Renamed';
```

`Get`, numeric indexing, `Set`, `AddRange`, `InsertRange`, `Remove`, `RemoveAt`, `RemoveRange`, `Move`, `Reset`, and iteration are available. Batched list changes publish a Reset with old/new snapshots. Selection remapping distinguishes duplicate occurrences rather than treating duplicate model references as one selected row.

`observable` wraps plain objects with `PropertyChanged` signals and recursively observes nested plain objects on access. Always store and mutate the returned proxy; writing to the original unwrapped object bypasses notifications. Arrays and arbitrary class instances are not automatically made observable. Use `ObservableList`, custom `PropertyChanged` signals, or explicitly call `model.NotifyItemChanged(item)` / `model.Refresh()`.

Accessor observation tracks dependencies, including replacement of an intermediate object. It is not a parser/compiler for C# expression trees. Function accessors and string property paths are JavaScript equivalents. A string path plus `true` as the setter argument creates a path setter, for example `new TextColumn('Name', 'Person.Name', true)`.

For live resorting/filtering after a model value changes, call `NotifyItemChanged(item)` in addition to mutating observable data. Visible cell bindings update automatically; the source does not continuously observe every sortable property on every offscreen flat item.

## 3. Columns

| Type | Construction |
| --- | --- |
| `ValueColumn` | `(header, getter, setter?, width?, options?, id?)` |
| `TextColumn` | Same editable form, or `(header, getter, width?, options?, id?)` for read-only text. |
| `CheckBoxColumn` | `(header, getter, setter?, width?, options?, id?)`; `options.IsThreeState` enables nullable cycling. |
| `TemplateColumn` | `(header, presentationKey, width?, options?, id?)`; presentation belongs to the view. |
| `HierarchicalExpanderColumn` | `(inner, children, hasChildren?, isExpanded?, setIsExpanded?)`. |

`ValueColumn.FromDelegate(header, getter, propertyName?, setter?, width?, options?, id?)` preserves an existing accessor. `GetValue`, `SetValue`, `GetComparison` and `Accept({Visit})` operate without a DOM. Setting a read-only value throws.

Requested widths accept `GridLength`, a pixel number, `'Auto'`, `'*'` or `'2*'`. Set column `IsVisible`, `Width`, `PresentationKey`, `SortDirection`, and `Tag`; listen to `PropertyChanged`. A column instance may occur only once in one source's `ColumnList`. Use stable, unique `Id` values for saved view state.

`ColumnOptions` includes resize/sort permissions, min/max sizes and custom ascending/descending comparisons. The web options additionally support `Formatter(value, model)`, `ValueParser(text, oldValue)`, `Validate(value, model)`, `ClipboardValue(model)`, wrapping/alignment and `AffectsRowHeight`. A validation result of `false` or a string rejects the edit; a string becomes the error message. `StringFormat` supports a small text/number subset, not all .NET composite formatting. Use `Formatter`/`ValueParser` for precise locale or domain behavior.

Sort using `model.SortBy(column, Core.ListSortDirection.Ascending)`; `ClearSort()` restores source order. `Columns.Move(oldIndex, newIndex)` changes shared source order. Requested widths, visibility and sorting are source-owned; actual auto/star measurements are per-view. Shared views are not independently sorted copies of the source.

## 4. Hierarchy and index paths

```js
const roots = new Core.ObservableList([
  Core.observable({Name: 'Team', Expansion: {IsExpanded: false},
    Children: new Core.ObservableList([
      Core.observable({Name: 'Member', Expansion: {IsExpanded: false},
        Children: new Core.ObservableList()})
    ])})
]);
const model = new Core.HierarchicalTreeDataGridSource(roots);
model.Columns.Add(new Core.HierarchicalExpanderColumn(
  new Core.TextColumn('Name', x => x.Name, (x, value) => x.Name = value, '2*'),
  x => x.Children,
  x => x.Children.Count > 0,
  'Expansion.IsExpanded'
));
model.Expand(new Core.IndexPath(0));
```

A hierarchical source requires exactly one expander column before rows are requested. Expansion selectors may be functions with an explicit setter, or string paths with an inferred path setter. Selectors must be valid for every model on which they are evaluated; in a heterogeneous tree, use null-safe getters and explicit setters rather than a missing nested path on leaf nodes.

`Expand`, `Collapse`, `ExpandAll`, `CollapseAll`, and `ExpandCollapseRecursive(predicate)` manipulate model expansion. The recursive overload accepts a starting row. `RowExpanding`, `RowExpanded`, `RowCollapsing`, and `RowCollapsed` are Core events. The web extension `ChildrenLoader(model, AbortSignal)` plus `ExpandAsync(path)` supports asynchronous children, loading/error events and cancellation. `ExpandAll` traverses materialized/synchronous children; it is not an asynchronous recursive network crawler.

**An `IndexPath` is an index in the underlying model hierarchy, not the visible row number.** For example, `(2.4)` means child 4 of root 2 even after sorting changes the displayed order. Use:

```js
const path = new Core.IndexPath(2, 4);
const displayed = model.Rows.ModelIndexToRowIndex(path); // -1 when not displayed
const original = model.Rows.RowIndexToModelIndex(displayed);
const item = model.TryGetModelAt(path);                 // Model or null
view.BringIntoView(path);                              // Expand ancestors, scroll
```

Flat sources use a one-component path. `IndexPath.Unselected` is empty. `Equals`, `CompareTo`, `Append`, `Slice`, `IsAncestorOf`, `IsParentOf`, iteration, `ToArray` and `ToString` supply explicit value operations; JavaScript `===` does not implement C# value equality. `TryGetModelAt(path, {Value:null})` is also available as an out-parameter-style form returning a boolean.

## 5. Selection

```js
const rows = model.RowSelection;
rows.SingleSelect = false;
rows.SelectedIndex = new Core.IndexPath(0);
rows.Select(new Core.IndexPath(2));
const stop = rows.SelectionChanged.Subscribe((sender, event) => {
  console.log(event.SelectedItems, event.DeselectedItems);
});
// stop(); or stop.Dispose();
```

`SelectedIndex` is the primary selection; `AnchorIndex` and `RangeAnchorIndex` have separate navigation/range roles. Use `Clear`, `Select`, `Deselect`, `IsSelected`, `SelectRange` and `SelectAll`. Pair `BeginBatchUpdate`/`EndBatchUpdate` in `try/finally`; committed public selection values remain visible until the outer batch ends. Collection index shifts emit `IndexesChanged`, and resets emit `SourceReset`. Reset notification details are web-adapted; see the parity notes.

To use cells, assign a Core cell-selection model:

```js
const cells = new Core.TreeDataGridCellSelectionModel(model);
cells.SingleSelect = false;
model.Selection = cells;
cells.SetSelectedRange(new Core.CellIndex(1,
  model.Rows.RowIndexToModelIndex(0)), 2, 10);
```

`CellIndex.ColumnIndex` uses **source columns, including hidden columns**. Row and column counts can be negative; signed ranges include the start cell and are clamped to available data. Row counts follow current displayed order, including sorted/expanded rows. Column identity survives source-column reordering. The cell selection is a Cartesian row/column set, not an arbitrary disjoint cell-region editor.

`Selection = null` disables selection until another selection model is assigned. Explicitly setting `view.SelectionMode` creates/configures row or cell selection and may therefore reenable it. Flags are `Row = 0`, `Cell = 1`, `Multiple = 2`.

## 6. Named templates and lifecycle

```js
const options = new Web.TreeDataGridPresentationOptions();
options.Columns.Add('person-card', {
  create(person, context) {
    const label = context.document.createElement('strong');
    label.textContent = person.Name;
    return label;
  },
  update(label, person) { label.textContent = person.Name; },
  dispose(label) { /* Release external listeners/resources, when applicable. */ }
});
model.Columns.Add(new Core.TemplateColumn('Person', 'person-card', '2*'));
view.PresentationOptions = options;
view.Model = model;
```

A registry entry may also be a factory receiving the Core column and returning a `CellColumnBase` or template descriptor. Custom `CellColumnBase.CreateCell(coreRow)` implementations can use `ValueCell`, `TextCell`, `CheckBoxCell` or `TemplateCell`.

For custom editing, add `edit(model, context) -> Element`, optional `read(editor, model)`, and `commit(model, value, editor, context)`. Template context contains the grid, Core row and column, displayed row/source-column indexes, document, `notify()` and `setValue(value)`. Named template content is recreated on model rebinding, so callbacks created for one row cannot accidentally edit a different recycled row. Outer row and cell elements are still pooled.

Do not inject untrusted strings into `innerHTML`. Built-in cell values and the examples use `textContent`. Applications remain responsible for custom template safety, URL validation, cleanup and accessible labels. Built-in undo/redo is not a general transaction recorder for arbitrary template `commit` callbacks.

## 7. Rendering and control properties

Give the host an explicit height or a bounded flex/grid parent. `RowHeight = 32` uses fixed rows; `RowHeight = null` measures naturally varying content with `EstimatedRowHeight` for unseen rows. `Overscan` is measured in pixels. `InvalidateRowHeights()` clears cached measurements after application-level changes.

Set `Options.TextWrapping = true` on wrapping columns. With horizontal virtualization, mark any column whose offscreen content must determine row height as `AffectsRowHeight = true`; such columns remain materialized for measurement. This deliberately trades more DOM cells for stable cross-column row heights.

`ShowColumnHeaders`, `CanUserResizeColumns` (default false), `CanUserSortColumns`, `CanUserReorderColumns`, `FrozenColumns`, `ShowGridLines`, and `AutoDragDropRows` configure interaction. Frozen columns mean the first N visible columns. `Scroll.Offset` uses logical coordinates. `ScrollIntoView(displayRow, sourceColumn?, alignment?)` and `BringIntoView(modelPath)` are separate APIs. `TryGetRow`/`TryGetCell` only return realized elements.

The `Stats` and `Rendered` event expose bounded-DOM counts and **synchronous render-pass JS time**, not browser end-to-end frame duration. See the architecture document before interpreting these figures.

## 8. Editing, clipboard, dragging and events

Double-click/F2 begin text editing; Enter commits; Escape cancels; Tab commits and moves. Checkboxes edit directly. Arrow/Page/Home/End navigation, hierarchy left/right, Ctrl/Cmd+A and type-to-search are supported. Numeric/date conversion uses JavaScript rules; provide a `ValueParser` for localized numeric input. Invalid edits retain the editor and expose an error label.

`GetSelectionText()` and `Paste(text)` work without clipboard permissions. TSV parsing handles quotes, tabs and embedded newlines. Paste validates changes before applying them and rolls back recorded writes if a setter throws. `ExportCsv()` exports the current displayed projection; collapsed descendants are not included. Its default spreadsheet-formula guarding can be disabled explicitly with `{safe:false}` when raw output is required. Export builds a string in memory; it is not a streaming million-row export service.

`Copy()` and native paste interact with browser clipboard security rules. The user agent may require a user gesture, secure context or permission. This release's automated tests validate data conversion and editing, not OS permission dialogs.

`AutoDragDropRows` uses native browser drag/drop. `RowDragStarted`, `RowDragOver` and `RowDrop` are cancelable. Core `MoveRows(source, paths, targetPath, position, Move)` validates duplicates/cycles, supports before/after/inside hierarchy moves, and rejects sorted/filtered or immutable targets. Copy/link effects are not implemented. Touch row-drag and empty-folder inside-drop affordances are not equivalent to all desktop Avalonia behaviors.

Control events are available both as `.Subscribe((sender,args) => ...)` signals and bubbling/composed DOM events such as `cell-value-changed`, `row-prepared`, and `selection-changing`. On cancelable events, set `args.Cancel = true` or call DOM `event.preventDefault()`. These are web event semantics rather than a full Avalonia routed-event system.

## 9. Styling, state and frameworks

The component is isolated in an open Shadow DOM. Theme it through CSS custom properties:

```css
tree-data-grid {
  --tdg-bg: #151d25;
  --tdg-fg: #e0e9ee;
  --tdg-header: #1b2730;
  --tdg-line: #2b3a45;
  --tdg-muted: #94a7b3;
  --tdg-accent: #46c7b1;
  --tdg-selection: #173f3c;
  --tdg-hover: #20303b;
}
```

`SaveViewState()` returns versioned JSON for source-column order/visibility/requested widths, current sort, frozen count, row sizing and scroll. `RestoreViewState(state)` needs matching unique column IDs. Because order and width requests belong to the source, restoring them affects all presentations of that source.

In React/Vue/Svelte or another framework, register the element once and assign the **object property** `element.Model = source` after mounting. Do not stringify the source into an HTML attribute. Remove event subscriptions and dispose view/source owners on unmount as appropriate. This distribution does not bundle framework-specific wrappers.

`registerTreeDataGrid('my-tree-grid')` can register an additional custom-element tag. The default import registers `tree-data-grid` automatically.
