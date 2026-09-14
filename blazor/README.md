# TreeDataGridWeb.Blazor

Install `TreeDataGridWeb.Blazor` version `0.2.2`. The package targets .NET 8/.NET 10 and bundles the real Core/Web engine and styles as local static web assets for interactive WebAssembly and Server.

## Typed grid and binding

```razor
@using TreeDataGridWeb.Blazor
<TreeDataGrid TItem="Row" Items="rows" ItemsChanged="Changed" Columns="columns"
              SelectedPaths="selected" SelectedPathsChanged="SelectionChanged" />
@code {
    public sealed record Row(string Name, int Value);
    private Row[] rows = [new("First", 1), new("Second", 2)];
    private GridColumn[] columns = [new("Name", "name", "2*", true), new("Value", "value", "*", true)];
    private IReadOnlyList<string> selected = [];
    private void Changed(Row[] value) => rows = value;
    private void SelectionChanged(IReadOnlyList<string> value) => selected = value;
}
```

Column property names match serialized JSON casing. `ChildrenProperty` enables hierarchy. `CellChanged` exposes a typed item, model path, column and old/new values. `ItemsChanged` retrieves the full native DTO collection through streaming. `SelectedPaths` uses model paths such as `0` and `0.1`; paths are not visual row indexes. `ItemsRevision` explicitly signals in-place source updates. Parent acknowledgements of native edits do not replace an unchanged native source.

`GetItemsAsync`, `SetCellValueAsync`, `SelectPathsAsync`, `BeginEditAsync`, `CommitEditAsync`, search, scrolling, CSV and view-state methods are available after `Ready`. `Model` accepts a caller-owned Core source for advanced use. Native sources and callbacks remain accessible through `Module`.

## Razor cells

`GridColumn.Template` accepts `BrowserFunction.RazorTemplate(id)` backed by `BrowserTemplate<TItem>`. Register `AddTreeDataGridWebBlazor` and the host's `RegisterTreeDataGridWebBlazor` method first. The [sample](sample/Demo.razor) executes a Razor callback inside a native virtualized cell and verifies a native edit updates typed C# items.

An optional `EditTemplate` uses the same factory mechanism; its editor must provide an input marked `data-grid-value`. Keep durable edit state outside virtualized roots. Browser factories can also supply create/update/dispose hooks.

Read [INTEGRATION.md](INTEGRATION.md) for hosting, callback timing, reference ownership, streaming and releases. The wrapper preserves the underlying engine's compatibility boundaries and does not claim a generated C# replacement for every desktop API.

## Lifecycle in 0.2.2

`IsReady` and `IsDisposed` expose the grid lifecycle. Concurrent disposal awaits the same native cleanup and retains failures while releasing handles. Queued callbacks stop after removal. Razor factories now provide awaitable teardown, retain roots during synchronous movement, coalesce updates and clean up late creation/imports. Actual-package tests exercise movement, context updates and recreation in WebAssembly and Server.
