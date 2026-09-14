# TreeDataGridWeb

Core tree/grid models and virtualized native web components for JavaScript, TypeScript and Blazor.

[![npm](https://img.shields.io/npm/v/%40wieslawsoltes%2Ftreedatagridweb)](https://www.npmjs.com/package/@wieslawsoltes/treedatagridweb)
[![npm downloads](https://img.shields.io/npm/dm/%40wieslawsoltes%2Ftreedatagridweb)](https://www.npmjs.com/package/@wieslawsoltes/treedatagridweb)
[![TreeDataGridWeb.Blazor on NuGet](https://img.shields.io/nuget/v/TreeDataGridWeb.Blazor?label=TreeDataGridWeb.Blazor&logo=nuget)](https://www.nuget.org/packages/TreeDataGridWeb.Blazor)
[![NuGet downloads](https://img.shields.io/nuget/dt/TreeDataGridWeb.Blazor)](https://www.nuget.org/packages/TreeDataGridWeb.Blazor)
[![Blazor CI](https://github.com/wieslawsoltes/TreeDataGridWeb/actions/workflows/blazor.yml/badge.svg)](https://github.com/wieslawsoltes/TreeDataGridWeb/actions/workflows/blazor.yml)

## JavaScript

```sh
npm install @wieslawsoltes/treedatagridweb
```

The [complete JavaScript guide](README.web.md) retains API examples, Core/Web architecture, performance/testing instructions and compatibility/license notices. [Open the web demo](https://wieslawsoltes.github.io/TreeDataGridWeb/).

## Blazor

```sh
dotnet add package TreeDataGridWeb.Blazor --version 0.2.2
```

The .NET 8/.NET 10 Razor class library supports interactive WebAssembly and Server, with locally packaged JavaScript and styles. It includes `TreeDataGrid<TItem>`, editable flat/hierarchical sources, typed item/selection callbacks, virtualized Razor cell factories, CSV, search and view-state persistence. No consumer npm/CDN dependency is required.

See the [Blazor guide](blazor/README.md), [integration contract](blazor/INTEGRATION.md), [sample](blazor/sample/Demo.razor) and [release notes](blazor/RELEASE.md). Native object/function handles expose advanced APIs; this is not an exhaustive C# port of a desktop framework.

## Build and samples

```sh
git submodule update --init --recursive
npm ci
npm run build
node blazor/build.mjs
dotnet run --project blazor/sample/Sample.csproj
# Or: dotnet run --project blazor/server/Server.csproj
```

Source builds require the .NET 10 SDK with .NET 8 targeting support. The Server sample uses `/probe/`. CI tests the actual NuGet package in both hosts and target frameworks, including typed edits, native Razor callbacks, large payloads and remounting.

NuGet versions are independent of npm in `blazor/Version.props`. Version-changing main merges publish after validation using `NUGET_API_KEY` (`NUGET_TOKEN`/`NUGET_KEY` aliases), verify the public payload and create `blazor-v*` releases with packages, symbols, samples and checksums. Native compatibility and browser constraints remain applicable. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
