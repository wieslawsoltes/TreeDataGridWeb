# Hosting and native integration

Use interactive WebAssembly or Interactive Server, not static SSR for engine execution. Wait for `Ready` before using native handles. Package assets resolve under `_content/TreeDataGridWeb.Blazor/` relative to the application base URI; both sample hosts test non-root paths.

For Razor factories:

```csharp
using TreeDataGridWeb.Blazor;
builder.Services.AddTreeDataGridWebBlazor();
// WebAssembly:
builder.RootComponents.RegisterTreeDataGridWebBlazor();
// Or Server:
builder.Services.AddRazorComponents().AddInteractiveServerComponents(
    options => options.RootComponents.RegisterTreeDataGridWebBlazor());
```

```razor
<BrowserTemplate TItem="Row" Id="@cellId" Context="row">
    <button @onclick="() => Open(row)">@row.Name</button>
</BrowserTemplate>
```

Use a unique `cellId` per parent, and `new GridColumn("Details", "name", Template: BrowserFunction.RazorTemplate(cellId))`. Templates are independent JS-owned Blazor roots, not moved Blazor subtrees. Nested components and input binding are supported; outer cascading values do not automatically propagate, so declare required `CascadingValue` components inside the template. Virtualization can dispose roots; retain durable state in your model. Template DTOs are copies, so commit data through grid methods or explicit bindings.

`BrowserModule` exposes constructor/invoke/call/get/set and event APIs. Returned native functions use `InvokeReferenceAsync`, `CallReferenceAsync`, `GetReferenceAsync` and `CallFunctionAsync`; handles preserve identity. Synchronous native selectors/comparers execute as browser functions. `BrowserFunction.DotNet` is asynchronous and only suitable for APIs accepting promises. An interop cancellation does not terminate arbitrary synchronous native work.

Use `CallJsonAsync`/`InvokeJsonAsync`/`GetJsonAsync` and binary equivalents for complete results through bounded streams (64 MiB default). `SubscribeJsonAsync` is for DTO notifications; `SubscribeAsync` is a bounded diagnostic snapshot of live graphs, not complete serialization. `CallBatchAsync` preserves order but is not an atomic transaction. Wrap application values with `BrowserValue.Literal` in generic interop so `$fn` data cannot become executable descriptors. Never accept untrusted module URLs as callbacks.

Dispose owned modules/services asynchronously. Dispose borrowed object handles without releasing their native owners; `Module.ReleaseAsync` destroys an owned native resource. Do not use a cross-user singleton browser session on Server.

Source builds require recursive submodule initialization, npm ci/build and `node blazor/build.mjs`; consumers need neither Node nor Dockyard. Run the WebAssembly sample or the Server sample at `/probe/`. CI packs the RCL and restores that nupkg into net8.0/net10.0 consumers, then tests typed grid edits, templates, streamed Unicode/binary data, native operations and remounting in Chromium. Physical GPU, hybrid WebViews and every browser are not qualified by these tests.

`Version.props` independently versions NuGet. Main version changes publish after validation using `NUGET_API_KEY` (`NUGET_TOKEN`/`NUGET_KEY` aliases). Publication rejects conflicting immutable versions, downloads the public package to verify its payload, and creates `blazor-v*` releases with symbols, sample archives and checksums.
