# TreeDataGridWeb.Blazor 0.2.1

Updates the pinned interop runtime to the tested Dockyard revision `1c895b7184451071e1c7131063249d2d9eb145b9`, without introducing a Dockyard runtime dependency.

- Preserve cyclic/deep native argument graphs and shared callback identity without mutating inputs.
- Await concurrent native/module/subscription cleanup and asynchronous unsubscribe; continue cleanup after individual failures.
- Preserve property, method and disposal access through native callable handles.
- Honor initialization-wait cancellation without cancelling other callers; prevent disposed owners from starting late native work.
- Add `CallFunctionJsonAsync<T>` for complete streamed callable results.
- Run the expanded shared JavaScript and managed regression suites against actual .NET 8/.NET 10 package consumers.

Typed flat/hierarchical grids, native virtualization, Razor display/edit cells, item/selection binding, CSV/search/view-state APIs and native compatibility contracts remain available. WebAssembly and Interactive Server samples are validated before NuGet publication, which verifies public package payloads before creating this release.
