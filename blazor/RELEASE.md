# TreeDataGridWeb.Blazor 0.2.0

- Self-contained .NET 8/.NET 10 package with the actual Core/Web engine and styles.
- Editable flat/hierarchical grids, typed item and selection callbacks, native edit DTOs and full collection streaming.
- Razor display/edit cell factories integrated with native virtualization and explicit create/update/dispose lifetimes.
- Native object/function references, safe literal application data, streamed JSON/binary interop and deterministic disposal.
- Package-restored WebAssembly/Server samples validating native Razor callbacks, search/CSV, typed edits, non-root hosting and remounting.
- Root README integration, build instructions and validation-gated NuGet/public-payload/release verification.

Native engine limitations remain applicable. Generic interop complements typed convenience APIs; this is not an exhaustive generated C# desktop-control port. Synchronous native callbacks execute in the browser, and virtualized template state must live in application models.
