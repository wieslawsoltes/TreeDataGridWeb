using System.Text.Json;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
namespace TreeDataGridWeb.Blazor;

/// <summary>Property names use the serialized JSON casing. Templates are BrowserFunction factory descriptors.</summary>
public sealed record GridColumn(string Header, string Property, string Width = "*", bool Editable = false, string Kind = "text", string? Id = null, object? Options = null, object? Template = null, object? EditTemplate = null);
public sealed record GridCellChanged<TItem>(TItem Item, string Path, int ColumnIndex, string ColumnId, JsonElement OldValue, JsonElement Value);

/// <summary>A native virtualized grid with typed item/selection binding and retained Razor cell templates.</summary>
public sealed class TreeDataGrid<TItem> : BrowserComponent
{
    [Parameter] public IEnumerable<TItem>? Items { get; set; }
    [Parameter] public EventCallback<TItem[]> ItemsChanged { get; set; }
    [Parameter] public EventCallback<GridCellChanged<TItem>> CellChanged { get; set; }
    [Parameter] public IReadOnlyList<string>? SelectedPaths { get; set; }
    [Parameter] public EventCallback<IReadOnlyList<string>> SelectedPathsChanged { get; set; }
    [Parameter] public long ItemsRevision { get; set; }
    [Parameter] public IReadOnlyList<GridColumn> Columns { get; set; } = [];
    [Parameter] public string? ChildrenProperty { get; set; }
    [Parameter] public IJSObjectReference? Model { get; set; }
    [Parameter] public double? RowHeight { get; set; }
    [Parameter] public double EstimatedRowHeight { get; set; } = 32;
    [Parameter] public int Overscan { get; set; } = 5;
    [Parameter] public int FrozenColumns { get; set; }
    [Parameter] public bool ShowColumnHeaders { get; set; } = true;
    [Parameter] public bool CanUserResizeColumns { get; set; } = true;
    [Parameter] public bool CanUserSortColumns { get; set; } = true;
    [Parameter] public bool CanUserReorderColumns { get; set; } = true;
    [Parameter] public bool ShowGridLines { get; set; } = true;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    protected override IReadOnlyList<string> RequiredEvents => ["dom:blazor-cellchange", "dom:blazor-selectionchange"];
    protected override bool IsJsonEvent(string name) => name.StartsWith("dom:blazor-", StringComparison.Ordinal);
    protected override IReadOnlyList<string> DefaultEvents => ["CellEditEnded", "Error"];
    protected override async Task OnBrowserEventAsync(BrowserEvent notification)
    {
        if (notification.Name == "dom:blazor-cellchange")
        {
            if (ItemsChanged.HasDelegate) await ItemsChanged.InvokeAsync(await GetItemsAsync());
            await CellChanged.InvokeAsync(notification.Data.Deserialize<GridCellChanged<TItem>>(Json)!);
        }
        else if (notification.Name == "dom:blazor-selectionchange")
            await SelectedPathsChanged.InvokeAsync(notification.Data.GetProperty("paths").Deserialize<string[]>(Json) ?? []);
        await base.OnBrowserEventAsync(notification);
    }
    protected override Dictionary<string, object?> BuildOptions()
    {
        var options = base.BuildOptions();
        options["items"] = BrowserValue.Literal(Items); options["columns"] = Columns; options["childrenProperty"] = ChildrenProperty; options["model"] = Model;
        options["itemsRevision"] = ItemsRevision; options["selectedPaths"] = SelectedPaths;
        options["RowHeight"] = RowHeight; options["EstimatedRowHeight"] = EstimatedRowHeight; options["Overscan"] = Overscan;
        options["FrozenColumns"] = FrozenColumns; options["ShowColumnHeaders"] = ShowColumnHeaders; options["ShowGridLines"] = ShowGridLines;
        options["CanUserResizeColumns"] = CanUserResizeColumns; options["CanUserSortColumns"] = CanUserSortColumns; options["CanUserReorderColumns"] = CanUserReorderColumns;
        return options;
    }
    public ValueTask<TItem[]> GetItemsAsync() => InvokeJsonAsync<TItem[]>("ReadItems");
    public ValueTask SetCellValueAsync(string path, string columnId, object? value) => InvokeVoidAsync("SetCellValue", path, columnId, BrowserValue.Literal(value));
    public ValueTask SelectPathsAsync(IEnumerable<string> paths) => InvokeVoidAsync("SelectPaths", paths);
    public ValueTask ScrollIntoViewAsync(int row, int column = 0, string alignment = "nearest") => InvokeVoidAsync("ScrollIntoView", row, column, alignment);
    public ValueTask<bool> BeginEditAsync(int column, int row) => InvokeAsync<bool>("BeginEdit", column, row);
    public ValueTask<bool> CommitEditAsync() => InvokeAsync<bool>("CommitEdit");
    public ValueTask CancelEditAsync() => InvokeVoidAsync("CancelEdit");
    public ValueTask<bool> UndoAsync() => InvokeAsync<bool>("Undo");
    public ValueTask<bool> RedoAsync() => InvokeAsync<bool>("Redo");
    public ValueTask<int> SearchAsync(string text) => InvokeAsync<int>("Search", text);
    public ValueTask<string> ExportCsvAsync(object? options = null) => InvokeJsonAsync<string>("ExportCsv", options ?? new { headers = true, safe = true });
    public ValueTask<int> PasteAsync(string text) => InvokeAsync<int>("Paste", text);
    public ValueTask<JsonElement> SaveViewStateAsync() => InvokeJsonAsync<JsonElement>("SaveViewState");
    public ValueTask RestoreViewStateAsync(JsonElement state) => InvokeVoidAsync("RestoreViewState", BrowserValue.Literal(state));
    public ValueTask AutoSizeAllColumnsAsync() => InvokeVoidAsync("AutoSizeAllColumns");
}
public sealed class TreeDataGridModule(IJSRuntime js) : BrowserModule(js)
{
    public ValueTask<IJSObjectReference> CreateFlatSourceAsync<T>(IEnumerable<T> items) => CreateAsync("Core.FlatTreeDataGridSource", [BrowserValue.Literal(items)]);
    public ValueTask<IJSObjectReference> CreateHierarchicalSourceAsync<T>(IEnumerable<T> items) => CreateAsync("Core.HierarchicalTreeDataGridSource", [BrowserValue.Literal(items)]);
}
