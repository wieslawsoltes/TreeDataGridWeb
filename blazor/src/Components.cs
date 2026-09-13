using System.Text.Json;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
namespace TreeDataGridWeb.Blazor;

/// <summary>Serializable native text or checkbox column. Property uses the JSON property name of TItem.</summary>
public sealed record GridColumn(string Header, string Property, string Width = "*", bool Editable = false, string Kind = "text", string? Id = null, object? Options = null);

/// <summary>A virtualized, editable native TreeDataGrid hosted in an independently owned DOM subtree.</summary>
public sealed class TreeDataGrid<TItem> : BrowserComponent
{
    [Parameter] public IEnumerable<TItem>? Items { get; set; }
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
    protected override IReadOnlyList<string> DefaultEvents => ["SelectionChanged", "CellValueChanged", "CellEditEnded", "Error"];
    protected override Dictionary<string, object?> BuildOptions()
    {
        var options = base.BuildOptions();
        options["items"] = Items; options["columns"] = Columns; options["childrenProperty"] = ChildrenProperty; options["model"] = Model;
        options["RowHeight"] = RowHeight; options["EstimatedRowHeight"] = EstimatedRowHeight; options["Overscan"] = Overscan;
        options["FrozenColumns"] = FrozenColumns; options["ShowColumnHeaders"] = ShowColumnHeaders; options["ShowGridLines"] = ShowGridLines;
        options["CanUserResizeColumns"] = CanUserResizeColumns; options["CanUserSortColumns"] = CanUserSortColumns; options["CanUserReorderColumns"] = CanUserReorderColumns;
        return options;
    }
    public ValueTask ScrollIntoViewAsync(int row, int column = 0, string alignment = "nearest") => InvokeVoidAsync("ScrollIntoView", row, column, alignment);
    public ValueTask<bool> BeginEditAsync(int column, int row) => InvokeAsync<bool>("BeginEdit", column, row);
    public ValueTask<bool> CommitEditAsync() => InvokeAsync<bool>("CommitEdit");
    public ValueTask CancelEditAsync() => InvokeVoidAsync("CancelEdit");
    public ValueTask<bool> UndoAsync() => InvokeAsync<bool>("Undo");
    public ValueTask<bool> RedoAsync() => InvokeAsync<bool>("Redo");
    public ValueTask<int> SearchAsync(string text) => InvokeAsync<int>("Search", text);
    public ValueTask<string> ExportCsvAsync(object? options = null) => InvokeAsync<string>("ExportCsv", options ?? new { headers = true, safe = true });
    public ValueTask<int> PasteAsync(string text) => InvokeAsync<int>("Paste", text);
    public ValueTask<JsonElement> SaveViewStateAsync() => InvokeAsync<JsonElement>("SaveViewState");
    public ValueTask RestoreViewStateAsync(JsonElement state) => InvokeVoidAsync("RestoreViewState", state);
    public ValueTask AutoSizeAllColumnsAsync() => InvokeVoidAsync("AutoSizeAllColumns");
}
public sealed class TreeDataGridModule(IJSRuntime js) : BrowserModule(js)
{
    public ValueTask<IJSObjectReference> CreateFlatSourceAsync<T>(IEnumerable<T> items) => CreateAsync("Core.FlatTreeDataGridSource", [items]);
    public ValueTask<IJSObjectReference> CreateHierarchicalSourceAsync<T>(IEnumerable<T> items) => CreateAsync("Core.HierarchicalTreeDataGridSource", [items]);
}
