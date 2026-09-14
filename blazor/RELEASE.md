# TreeDataGridWeb.Blazor 0.2.2

Adopts the validated shared runtime from Dockyard commit c833be49d472583b6f56225862e0aa7d201c1da7, merged through Dockyard PR #5.

Fixes visual disposal concurrency, late template import/creation cleanup, queued callbacks after removal and repeated failed cleanup. Adds IsReady/IsDisposed, awaitable Razor factory teardown and coalesced template updates. Preserves typed grid editing, item/selection binding, virtualized Razor display/edit cells, native Core APIs, streams and all existing operations.

Both net8.0/net10.0 package consumers run managed lifecycle regressions and real WebAssembly/Interactive Server browser tests, including template movement/update/recreation. Eight new shared JavaScript lifecycle cases accompany existing native checks. Publication verifies the public NuGet payload before creating package, symbol and runnable-sample release artifacts. No runtime Dockyard/npm/CDN dependency is introduced; engine compatibility boundaries remain unchanged.
