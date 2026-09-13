# TreeDataGridWeb.Blazor

A self-contained .NET 8 / .NET 10 Razor Class Library for the native virtualized TreeDataGrid and its complete JavaScript Core API.

```sh
dotnet add package TreeDataGridWeb.Blazor --version 0.2.0
```

```razor
@using TreeDataGridWeb.Blazor
<TreeDataGrid TItem="Person" Items="people" Columns="columns" />
@code {
    public sealed record Person(string Name, bool Enabled);
    private Person[] people = [new("Ada", true), new("Grace", false)];
    private GridColumn[] columns = [new("Name", "name", "2*", true), new("Enabled", "enabled", "*", true, "checkbox")];
}
```

Use an interactive WebAssembly or Server render mode. There is no npm/CDN requirement for consumers and no global script registration. Static prerender emits an empty host and does not invoke JavaScript. The `Ready` callback signals that the real grid exists. Styles and modules are resolved through the application's base URI under `_content/TreeDataGridWeb.Blazor/`.

## Grid parameters and editing

`Items`, `Columns`, and optional `ChildrenProperty` create a native flat or hierarchical Core source. Column property strings refer to serialized JSON names (normally camelCase). Text and checkbox columns support native editing. `Model` accepts an existing `IJSObjectReference` for advanced Core models or presentation templates. External models are not disposed by the component; internally created sources are owned and disposed by it.

`RowHeight`, `EstimatedRowHeight`, `Overscan`, `FrozenColumns`, column-header visibility, resizing, sorting, reordering and gridlines are typed parameters. `Options` supplies other native properties, including `PresentationOptions`, `AutoDragDropRows` and `SelectionMode`. Mutating a nested options object requires incrementing `Revision`; replacing the options or data reference triggers an update. Internally generated models rebuild only when their serialized items/column definition changes, not after unrelated parent renders.

Blazor data is transferred to JavaScript by value. Native edits are delivered through `Changed` (`CellValueChanged`/`CellEditEnded`) and do not silently mutate the original C# collection. Apply those changes to the application's model explicitly. `Events` selects native Signal events; defaults include selection, edit and error events. Notifications are JSON snapshots, not live engine references. Use `Module.GetAsync<IJSObjectReference>` when identity matters.

Convenience methods cover editing, undo/redo, search, scrolling, paste, CSV export, column autosizing, and saving/restoring view state. All remaining native methods are available through `InvokeAsync<T>` / `InvokeVoidAsync`. Clipboard and drag operations retain browser security and user-activation requirements. See the repository's native Core and Web API documentation for signatures.

## Complete native engine access

`TreeDataGridModule` provides source-creation helpers and the shared `BrowserModule` operations: `GetExportsAsync`, `CreateAsync`, `InvokeAsync`, `CallAsync`, `GetAsync`, `SetAsync`, `SubscribeAsync` and `ReleaseAsync`. The exported namespaces `Core` and `Web` avoid collisions between similarly named exports. `BrowserProvider` is an optional lifecycle component with a `RenderFragment<BrowserModule>` child context for nonvisual model work.

`BrowserFunction.Property`, `Setter` and `Constant` are synchronous JavaScript callbacks. `BrowserFunction.Module("./templates.js", "createCell")` imports a browser callback without eval and supports native DOM factories, sort comparers, predicates and synchronous cancellation. `BrowserFunction.DotNet` returns a promise and can only be used by promise-aware native APIs. Blazor Server cannot synchronously service native JavaScript comparer/cancellation calls. Razor RenderFragment cell templates are not supplied; native templates use JS factories so virtualization retains browser-owned DOM and recycling.

Created objects and mounted controls are session-owned. Dispose subscriptions when no longer needed; disposing a component/provider removes all its listeners and .NET callback references. `IJSObjectReference.DisposeAsync` frees only the interop handle; `Module.ReleaseAsync` invokes native disposal too. Do not release an externally owned model while the grid still uses it. Never register browser sessions as application-wide singletons on Server.

## Source build and samples

The bridge and test harness are shared as a commit-pinned Git submodule, not downloaded dynamically by consumers. Each assembly has its own namespace and bundled static assets; installing this NuGet package does not depend on the Dockyard NuGet package or fetch anything from GitHub.

```sh
git submodule update --init --recursive
npm ci
npm run build
node blazor/build.mjs
dotnet run --project blazor/sample/Sample.csproj
dotnet run --project blazor/server/Server.csproj --urls http://localhost:5080
# Interactive Server sample: http://localhost:5080/probe/
```

`blazor/config.json` drives deterministic preparation of the common runtime, project files and test consumers from `blazor/runtime-source`. The project-specific component, adapter and sample remain ordinary reviewed source files here. Generated files are ignored and recreated before every CI package build. Published WebAssembly samples can be served as static files with the correct base URI and WASM MIME type.

The pinned reusable workflow compiles and packs both target frameworks, runs JavaScript bridge and managed lifecycle/prerender tests, inspects the actual nupkg, restores both samples from that package, and exercises native search/CSV and unmount/remount in Chromium. Packages, screenshots and published samples are retained as artifacts. This is browser qualification, not native desktop or all-browser certification.

## Releases

`blazor/Version.props` versions NuGet independently of npm. A version-changing PR merged to main publishes only after successful validation. The NuGet secret is `NUGET_API_KEY` (fallback `NUGET_TOKEN` or `NUGET_KEY`). Manual dispatch defaults to validation-only. Releases use `blazor-v<version>` and attach NuGet packages and a runnable WebAssembly sample; they do not alter the existing npm release stream. Update the source submodule and workflow SHA together through a reviewed PR.

The bridge exposes all bundled native exports, but is not an exhaustive generated strongly typed C# port of the Core library. Existing engine compatibility boundaries remain unchanged.
