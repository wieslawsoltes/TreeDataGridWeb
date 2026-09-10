import { Signal, IRow, IRows, IColumn, ITreeDataGridSource, ColumnList, ColumnLayout, GridLength, IndexPath, IndexPathLike, SortDirection, TreeDataGridRowSelectionModel, TreeDataGridCellSelectionModel } from '../core/index.js';
export interface TemplateContext<T = any> {
    grid: TreeDataGrid<T>;
    row: IRow<T>;
    column: IColumn<T>;
    rowIndex: number;
    columnIndex: number;
    document: Document;
    notify(): void;
    setValue(value: unknown): void;
}
export interface CellTemplate<T = any> {
    create(model: T, context: TemplateContext<T>): Node | string | number | null | undefined;
    update?(element: Node, model: T, context: TemplateContext<T>): void;
    dispose?(element: Node | null): void;
    edit?(model: T, context: TemplateContext<T>): Element;
    read?(editor: Element, model: T): unknown;
    commit?(model: T, value: any, editor: Element, context: TemplateContext<T>): void;
}
export type ColumnPresentation<T = any> = CellTemplate<T> | ((column: IColumn<T>) => CellColumnBase<T> | CellTemplate<T>);
export class PresentationRegistry<T = any> extends Map<string, ColumnPresentation<T>> {
    Add(key: string, presentation: ColumnPresentation<T>): void;
    Set(key: string, presentation: ColumnPresentation<T>): void;
}
export class TreeDataGridPresentationOptions<T = any> {
    readonly Columns: PresentationRegistry<T>;
    Register(key: string, presentation: ColumnPresentation<T>): this;
}
export class ValueCell<T = any, V = any> {
    constructor(column: IColumn<T>, row: IRow<T>);
    readonly Column: IColumn<T>;
    readonly Row: IRow<T>;
    readonly Model: T;
    Value: V;
    EditValue: V;
    IsEditing: boolean;
    readonly CanEdit: boolean;
    readonly PropertyChanged: Signal;
    BeginEdit(): boolean;
    CancelEdit(): void;
    EndEdit(): void;
    Dispose(): void;
}
export class TextCell<T = any, V = any> extends ValueCell<T, V> {
}
export class CheckBoxCell<T = any> extends ValueCell<T, boolean | null> {
    readonly IsThreeState: boolean;
}
export class TemplateCell<T = any> extends ValueCell<T, T> {
    constructor(column: IColumn<T>, row: IRow<T>, template: CellTemplate<T>);
    readonly Template: CellTemplate<T>;
}
export class ExpanderCell<T = any> {
    constructor(inner: ValueCell<T>, row: IRow<T>);
    readonly Inner: ValueCell<T>;
    readonly Row: IRow<T>;
    readonly Model: T;
    IsExpanded: boolean;
    readonly ShowExpander: boolean;
    readonly Indent: number;
    Value: any;
    readonly CanEdit: boolean;
    Dispose(): void;
}
export class CellColumnOptions {
    constructor(options?: {
        MinWidth?: number;
        MaxWidth?: number;
    });
    MinWidth: number;
    MaxWidth: number;
}
export class CellColumnBase<T = any> {
    constructor(column: IColumn<T>, options?: {
        MinWidth?: number;
        MaxWidth?: number;
    });
    readonly CoreColumn: IColumn<T>;
    readonly Options: CellColumnOptions;
    readonly Header: unknown;
    Width: GridLength;
    ActualWidth: number;
    NeedsNaturalWidth: boolean;
    CreateCell(row: IRow<T>): ValueCell<T> | ExpanderCell<T>;
    Dispose(): void;
}
export class TemplateCellColumn<T = any> extends CellColumnBase<T> {
    constructor(column: IColumn<T>, template: CellTemplate<T> | CellTemplate<T>['create'], editTemplate?: CellTemplate<T>['edit'] | null, options?: {
        MinWidth?: number;
        MaxWidth?: number;
    });
    readonly Template: CellTemplate<T>;
    CreateCell(row: IRow<T>): TemplateCell<T>;
}
export class TreeDataGridPresentation<T = any> {
    constructor(model: ITreeDataGridSource<T>, options?: TreeDataGridPresentationOptions<T>);
    static Create<T>(model: ITreeDataGridSource<T>, options?: TreeDataGridPresentationOptions<T>): TreeDataGridPresentation<T>;
    readonly Model: ITreeDataGridSource<T>;
    readonly Options: TreeDataGridPresentationOptions<T>;
    readonly Rows: IRows<T>;
    readonly Columns: CellColumnBase<T>[];
    readonly Layout: ColumnLayout;
    readonly Changed: Signal;
    readonly Sorted: Signal;
    Resume(): void;
    Suspend(): void;
    Dispose(): void;
}
export class TreeDataGridElementFactory {
    Created: number;
    Reused: number;
    MaxPoolSize: number;
    GetElement<E extends Element>(key: string, create: () => E): E;
    RecycleElement(key: string, element: Element): void;
    Clear(): void;
}
export interface GridStats {
    Rows: number;
    RealizedRows: number;
    RealizedCells: number;
    FrameMilliseconds: number;
    MeasuredRows: number;
    TotalHeight: number;
    CreatedElements: number;
    ReusedElements: number;
    FirstRow?: number;
    LastRow?: number;
}
export interface CellEventArgs<T = any> {
    Cell: HTMLElement;
    ColumnIndex: number;
    RowIndex: number;
    Model: T;
    Column?: IColumn<T>;
    CellModel?: ValueCell<T> | ExpanderCell<T>;
    OldValue?: unknown;
    Value?: any;
    Cancel?: boolean;
    Canceled?: boolean;
}
export interface RowEventArgs<T = any> {
    Row: HTMLElement;
    RowIndex: number;
    Model: T;
    CoreRow: IRow<T>;
}
export interface GridViewState {
    version: 1;
    columns: Array<{
        id: string;
        width: string;
        visible: boolean;
    }>;
    sort: Array<{
        id: string;
        direction: SortDirection;
    }>;
    frozen: number;
    rowHeight: number | null;
    estimatedHeight: number;
    scroll: {
        x: number;
        y: number;
    };
}
export interface ScrollState {
    Offset: {
        X: number;
        Y: number;
    };
    readonly Extent: {
        Width: number;
        Height: number;
    };
    readonly Viewport: {
        Width: number;
        Height: number;
    };
}
export class TreeDataGrid<T = any> extends HTMLElement {
    Model: ITreeDataGridSource<T> | null;
    Source: ITreeDataGridSource<T> | null;
    readonly ActiveModel: ITreeDataGridSource<T> | null;
    PresentationOptions: TreeDataGridPresentationOptions<T>;
    readonly Presentation: TreeDataGridPresentation<T> | null;
    readonly Rows: IRows<T> | null;
    readonly Columns: CellColumnBase<T>[];
    /** Legacy Source convenience. For Core Model use grid.Model.RowSelection. */
    readonly RowSelection: TreeDataGridRowSelectionModel<T> | null;
    /** Legacy Source convenience. For Core Model use grid.Model.Selection. */
    readonly ColumnSelection: TreeDataGridCellSelectionModel<T> | null;
    readonly Scroll: ScrollState;
    readonly RowsPresenter: HTMLElement;
    readonly ColumnHeadersPresenter: HTMLElement;
    ElementFactory: TreeDataGridElementFactory;
    RowHeight: number | null;
    EstimatedRowHeight: number;
    Overscan: number;
    FrozenColumns: number;
    ShowColumnHeaders: boolean;
    CanUserResizeColumns: boolean;
    CanUserSortColumns: boolean;
    CanUserReorderColumns: boolean;
    AutoDragDropRows: boolean;
    ShowGridLines: boolean;
    SelectionMode: number;
    ItemsSource: Iterable<T> | null;
    readonly ColumnDefinitions: ColumnList<T>;
    readonly Stats: GridStats;
    readonly CellClearing: Signal<CellEventArgs<T>>;
    readonly CellPrepared: Signal<CellEventArgs<T>>;
    readonly CellValueChanged: Signal<CellEventArgs<T>>;
    readonly RowClearing: Signal<RowEventArgs<T>>;
    readonly RowPrepared: Signal<RowEventArgs<T>>;
    readonly CellEditStarting: Signal<CellEventArgs<T>>;
    readonly CellEditEnding: Signal<CellEventArgs<T>>;
    readonly CellEditEnded: Signal<Partial<CellEventArgs<T>>>;
    readonly RowDragStarted: Signal<{
        Model: ITreeDataGridSource<T>;
        Source: ITreeDataGridSource<T> | null;
        Indexes: IndexPath[];
        Rows: T[];
        Cancel: boolean;
    }>;
    readonly RowDragOver: Signal<{
        Model: ITreeDataGridSource<T>;
        TargetIndex: IndexPath;
        Position: string;
        DragEvent: DragEvent;
        Cancel: boolean;
    }>;
    readonly RowDrop: Signal<{
        DragInfo: any;
        Model: ITreeDataGridSource<T>;
        TargetIndex: IndexPath;
        Position: string;
        Cancel: boolean;
    }>;
    readonly SelectionChanging: Signal<{
        Cancel: boolean;
    }>;
    readonly SelectionChanged: Signal<{
        Selection: TreeDataGridRowSelectionModel<T> | TreeDataGridCellSelectionModel<T>;
    }>;
    readonly Rendered: Signal<{
        Stats: GridStats;
    }>;
    readonly Error: Signal<{
        Error: Error;
    }>;
    readonly RowDoubleTapped: Signal<{
        RowIndex: number;
        Model: T;
        Row: IRow<T>;
    }>;
    TryGetCell(columnIndex: number, rowIndex: number): HTMLElement | null;
    TryGetCell(element: Element): HTMLElement | null;
    TryGetRow(rowIndex: number): HTMLElement | null;
    TryGetRow(element: Element): HTMLElement | null;
    TryGetRowModel(element: Element): T | null;
    QueryCancelSelection(): boolean;
    ScrollIntoView(rowIndex: number, columnIndex?: number, alignment?: 'nearest' | 'start' | 'center'): void;
    BringIntoView(index: IndexPathLike, columnIndex?: number): number;
    FindDisplayedRowIndex(modelOrPath: T | IndexPath): number;
    AutoSizeColumn(columnIndex: number): void;
    AutoSizeAllColumns(): void;
    BeginEdit(columnIndex?: number, rowIndex?: number): boolean;
    CommitEdit(): boolean;
    CancelEdit(): void;
    Undo(): boolean;
    Redo(): boolean;
    Search(text: string, options?: {
        prefix?: boolean;
        start?: number;
        columnIndex?: number | null;
    }): number;
    GetSelectionText(options?: {
        headers?: boolean;
        separator?: string;
        safe?: boolean;
    }): string;
    Copy(options?: {
        headers?: boolean;
        separator?: string;
        safe?: boolean;
    }): Promise<string>;
    Paste(text: string): number;
    ExportCsv(options?: {
        selectedOnly?: boolean;
        headers?: boolean;
        safe?: boolean;
    }): string;
    SaveViewState(): GridViewState;
    RestoreViewState(state: GridViewState): void;
    InvalidateVisual(): void;
    InvalidateRowHeights(): void;
    Dispose(): void;
}
export function registerTreeDataGrid(name?: string): void;
export function formatValue(column: IColumn, value: unknown, model: any): string;
export function parseValue(column: IColumn, text: string, previous: any): any;
export function quoteField(value: unknown, separator?: string, safe?: boolean): string;
export function parseDelimited(text: string, separator?: string): string[][];
declare global {
    interface HTMLElementTagNameMap {
        'tree-data-grid': TreeDataGrid;
    }
}
