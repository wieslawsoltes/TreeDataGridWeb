# API parity and explicit boundaries

**Release:** TreeDataGrid Web 0.1.0  
**Reference:** `wieslawsoltes/TreeDataGrid@3ca47316d724e5e040ab0281a880e8df999b25fc`

This is a functional source-informed JavaScript port with a broad matching Core/control surface. **It is not an exhaustive, certified 100% port of every public Core, legacy Avalonia, inherited framework, sample and behavioral edge case.** The curated tests are evidence for the exercised contracts, not proof that untested APIs exist. No omitted member is represented by a success-returning placeholder.

## Contract map

| Upstream family | Web implementation | Status and adaptation |
| --- | --- | --- |
| Core source split | `FlatTreeDataGridSource`, `HierarchicalTreeDataGridSource`, `Model`, `TreeDataGridPresentation` | Implemented directly; shared Core row identity, view-owned layout/cells. |
| Index primitives | `IndexPath`, `CellIndex`, `GridLength`, enums | Explicit JS value methods and constructors replace C# operators/implicit conversions. Numeric indexing is supported. |
| Collections/notifiers | `ObservableList`, `NotifyingBase`, `Signal`, source views | Browser-neutral implementation. Proxies/functions replace expression trees and .NET notification infrastructure. |
| Value/text/check columns | Accessors, setters, readonly behavior, metadata, options, comparisons, visitors | Main contracts implemented. Nullable checkboxes use an explicit web option. Expression object metadata is not a compiled .NET expression tree. |
| Template/expander columns | Named keys, nested hierarchy selectors, view factories | Implemented with DOM template descriptors; no Avalonia `IDataTemplate` or XAML resource loader. |
| Row collections | Lazy flat rows, hierarchical rows, bidirectional source/display index mapping | Implemented. Projection internals differ; no claim of the exact upstream allocation profile or every low-level public helper. |
| Sorting | Stable flat/sibling sorting, custom comparisons, indicators, clear-sort | Implemented; JavaScript comparison/locale behavior and notification ordering are not every .NET comparer edge case. |
| Selection | Row/cell selection, anchors, batched reads, signed ranges, source-column identity and collection remapping | Main behavior implemented and tested. Arbitrary custom selection implementations and every nested reset/move/batch event-order permutation are not certified. Reset events include web old/new snapshots and may accompany deselection notifications unlike some .NET reset paths. |
| Expansion | Model-bound expansion, recursive operations, events, async-loader extension | Implemented; async expansion is a web extension, not automatic asynchronous `ExpandAll`. |
| Model notifications | Nested path reconnection, collection replacement and lifetime cleanup | Tested on observable plain objects/lists. Raw-object mutation, arbitrary C# expression observation and framework binding semantics are not reproduced. Prefer arrays/ObservableList for child collections. |
| Column layout | Pixel/auto/star, min/max, visibility, source order, per-view actual widths | Implemented web layout. Auto-fit samples content; .NET formatting/layout measurements are not exact. |
| Virtualization | Two axes, DOM recycling, height indexing, estimated/variable heights, logical huge scrollbar | Implemented and exercised. Visited Core row objects may accumulate; tree projection rebuild and large select-all are not constant-time. |
| Editing | Readonly checks, conversion, validation, text/checkbox/template editors, cancelable events | Implemented. Gesture-option and .NET formatting/binding-error surfaces are not exhaustive. Custom template commits are outside built-in undo transactions. |
| Input | Keyboard, type search, pointers, resize/reorder, native desktop drag/drop | Implemented tested subset. Physical touch/stylus, touch row dragging, complete RTL navigation and all platform gestures are not validated. |
| Drag model API | Validated same/cross-source Move; cycle/duplicate checks; source mapping | Move-only, mutable collections, unsorted/unfiltered data. Empty-folder inside-drop UI and every multi-anchor/cross-source edge case remain incomplete/unverified. |
| Events and realized-element lookup | Prepared/clearing/value/selection/drag/edit events; `TryGetRow`/`TryGetCell` | Signals plus composed DOM events. Native Avalonia routed event classes and presenters are not binary/runtime compatible. |
| Legacy `Source`, declarative columns | Compatibility property facade and Core-backed generation | Not a translation of every legacy source/column/presenter type. New samples use `Model` exclusively. |
| Accessibility | ARIA treegrid rows/cells, expanded/selected/index state, keyboard input, live announcements | Attributes/input tested. Actual screen-reader workflows and full accessibility conformance are not certified. |
| Styling/theme | Shadow DOM, CSS tokens, light/dark sample | Native web counterpart, not Avalonia styles/control themes/resources. |
| Extra web functions | Filtering, frozen columns, copy/paste/CSV, undo/redo, saved state, async children | Implemented extensions with documented limits; not evidence for omitted upstream APIs. |

## Native-only or unported surfaces

The package does **not** host Avalonia or .NET. It has no Avalonia property registration/reflection system, XAML loader, compiled expression trees, .NET assemblies, automation peers, renderer-specific control subclasses, exact routed-event argument class graph, or API-compatible full inherited `TemplatedControl` hierarchy. Those concepts are replaced by documented web idioms rather than empty classes that pretend to be equivalent.

Some low-level public helper types/members, generic-interface overloads and legacy extension points remain unported. `IndexRange` is a useful subset, not the complete upstream range-manipulation family. Source/row visitor dispatch is JavaScript dispatch rather than C# generic overload resolution. The included declarations describe the implemented public surface, not a generated completeness inventory of the entire upstream repository.

There is no exhaustive differential runner against the original C# xUnit suite and no claim that the upstream benchmark/sample resource set has been fully executed or imported. A future full-parity gate must enumerate every target member, map it to an implementation/test, and run the relevant upstream behavioral cases plus web-specific adaptations.

## Sample equivalence

Eight Core-demo scenarios are represented, plus virtualization and multi-view diagnostics. The web UI is redesigned rather than a pixel-for-pixel Avalonia window. Country values are marked synthetic. Local filesystem browsing is replaced with fixtures plus a user-initiated metadata picker. The Wikipedia-style template/feed scenario defaults to original offline text and has an optional live request. These are **scenario ports**, not a verbatim data/assets port or an assertion that live services were tested.

## Validation boundary

Read `docs/TESTING.md` and the machine-readable reports. Chromium layout/input tests ran against the real generated bundle loaded in memory. Firefox, WebKit, physical mobile/stylus hardware, actual screen readers, OS clipboard/file-picker permissions, live Wikimedia requests and normal URL navigation were not exercised. There has been no production security audit, leak soak across days of usage, packaged-registry publication, or broad target-device performance certification.

These are remaining engineering targets, not features counted as complete.
