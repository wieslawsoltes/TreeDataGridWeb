/** Browser-independent TreeDataGrid Core API. PascalCase mirrors the inspected .NET model surface. */
export type Disposable = (() => void) & {
    Dispose: () => void;
};
export interface PropertyChangedEventArgs {
    PropertyName: string;
    OldValue?: unknown;
    NewValue?: unknown;
}
export class Signal<A = any> {
    readonly Count: number;
    Subscribe(handler: (sender: any, args: A) => void): Disposable;
    Add(handler: (sender: any, args: A) => void): Disposable;
    Remove(handler: (sender: any, args: A) => void): void;
    Emit(sender: any, args: A): void;
    Clear(): void;
}
export class NotifyingBase {
    readonly PropertyChanged: Signal<PropertyChangedEventArgs>;
    RaisePropertyChanged(name: string, oldValue?: unknown, newValue?: unknown): void;
    RaiseAndSetIfChanged(field: string, value: unknown, name?: string): boolean;
}
export function observable<T extends object>(model: T): T & {
    readonly PropertyChanged: Signal<PropertyChangedEventArgs>;
    readonly $raw: T;
};
export function observeSelector<T, V>(model: T, getter: (model: T) => V, changed: (value: V, previous?: V) => void, options?: {
    immediate?: boolean;
}): Disposable;
export function pathAccessor<T = any, V = any>(path: string | string[]): ((model: T) => V) & {
    Set: (model: T, value: V) => void;
};
export function disposeAll(items: Array<(() => void) | {
    Dispose(): void;
}>): void;
export const GridUnitType: {
    readonly Auto: 'Auto';
    readonly Pixel: 'Pixel';
    readonly Star: 'Star';
};
export type GridUnitTypeValue = typeof GridUnitType[keyof typeof GridUnitType];
export const ListSortDirection: {
    readonly Ascending: 'Ascending';
    readonly Descending: 'Descending';
};
export type SortDirection = typeof ListSortDirection[keyof typeof ListSortDirection];
export const RowDropPosition: {
    readonly None: 'None';
    readonly Before: 'Before';
    readonly After: 'After';
    readonly Inside: 'Inside';
};
export type DropPosition = typeof RowDropPosition[keyof typeof RowDropPosition];
export const RowMoveEffects: {
    readonly None: 'None';
    readonly Move: 'Move';
    readonly Copy: 'Copy';
    readonly Link: 'Link';
};
export type MoveEffects = typeof RowMoveEffects[keyof typeof RowMoveEffects];
export const TreeDataGridSelectionMode: {
    readonly Row: 0;
    readonly Cell: 1;
    readonly Multiple: 2;
};
export type GridLengthLike = GridLength | number | string | null;
export class GridLength {
    constructor(value?: number, type?: GridUnitTypeValue);
    readonly Value: number;
    readonly GridUnitType: GridUnitTypeValue;
    readonly IsAbsolute: boolean;
    readonly IsAuto: boolean;
    readonly IsStar: boolean;
    static readonly Auto: GridLength;
    static Parse(value?: GridLengthLike): GridLength;
    Equals(other: GridLengthLike): boolean;
    ToString(): string;
    toString(): string;
}
export type IndexPathLike = IndexPath | number | Iterable<number> | null;
export class IndexPath implements Iterable<number> {
    constructor(...indexes: Array<number | Iterable<number> | null>);
    readonly [index: number]: number;
    readonly Count: number;
    readonly length: number;
    readonly Key: string;
    readonly Parent: IndexPath;
    static readonly Unselected: IndexPath;
    static From(value: IndexPathLike): IndexPath;
    Get(index: number): number;
    CompareTo(other: IndexPathLike): number;
    Equals(other: IndexPathLike): boolean;
    Append(index: number): IndexPath;
    IsAncestorOf(other: IndexPathLike): boolean;
    IsParentOf(other: IndexPathLike): boolean;
    Slice(start: number, length?: number): IndexPath;
    ToArray(): number[];
    ToString(): string;
    toString(): string;
    toJSON(): number[];
    GetHashCode(): number;
    [Symbol.iterator](): Iterator<number>;
}
export class CellIndex {
    constructor(columnIndex?: number, rowIndex?: IndexPathLike);
    readonly ColumnIndex: number;
    readonly RowIndex: IndexPath;
    Equals(other: CellIndex): boolean;
    ToString(): string;
}
export class IndexRange implements Iterable<number> {
    constructor(begin: number, end: number);
    readonly Begin: number;
    readonly End: number;
    readonly Count: number;
    Contains(index: number): boolean;
    Intersects(other: IndexRange): boolean;
    [Symbol.iterator](): Iterator<number>;
}
export const NotifyCollectionChangedAction: Readonly<Record<'Add' | 'Remove' | 'Replace' | 'Move' | 'Reset', string>>;
export interface CollectionChangedEventArgs<T = any> {
    Action: string;
    NewItems: T[];
    OldItems: T[];
    NewStartingIndex: number;
    OldStartingIndex: number;
}
export class ReadOnlyListBase<T = any> implements Iterable<T> {
    readonly [index: number]: T;
    readonly Count: number;
    readonly length: number;
    Get(index: number): T;
    at(index: number): T | undefined;
    ToArray(): T[];
    IndexOf(item: T): number;
    Contains(item: T): boolean;
    map<R>(fn: (item: T, index: number) => R): R[];
    forEach(fn: (item: T, index: number) => void): void;
    [Symbol.iterator](): Iterator<T>;
}
export class ObservableList<T = any> extends NotifyingBase implements Iterable<T> {
    constructor(items?: Iterable<T>);
    [index: number]: T;
    readonly Count: number;
    readonly length: number;
    readonly CollectionChanged: Signal<CollectionChangedEventArgs<T>>;
    Get(index: number): T;
    Set(index: number, item: T): void;
    Add(item: T): number;
    AddRange(items: Iterable<T>): void;
    Insert(index: number, item: T): void;
    InsertRange(index: number, items: Iterable<T> | ((add: (item: T) => void) => void)): void;
    Remove(item: T): boolean;
    RemoveAt(index: number): void;
    RemoveRange(index: number, count: number): void;
    Move(oldIndex: number, newIndex: number): void;
    Clear(): void;
    Reset(items: Iterable<T> | ((draft: ObservableList<T>) => void)): void;
    BeginUpdate(): void;
    EndUpdate(): void;
    Batch<R>(action: (list: this) => R): R;
    IndexOf(item: T): number;
    Contains(item: T): boolean;
    ToArray(): T[];
    map<R>(fn: (item: T, index: number) => R): R[];
    forEach(fn: (item: T, index: number) => void): void;
    [Symbol.iterator](): Iterator<T>;
}
export class NotifyingListBase<T = any> extends ObservableList<T> {
}
export class TreeDataGridItemsSourceView<T = any> extends ReadOnlyListBase<T> {
    constructor(items?: Iterable<T>);
    readonly Items: Iterable<T>;
    readonly CollectionChanged: Signal<CollectionChangedEventArgs<T>>;
    static GetOrCreate<T>(items: Iterable<T> | TreeDataGridItemsSourceView<T>): TreeDataGridItemsSourceView<T>;
    Dispose(): void;
}
export function indexable<T>(target: T): T;
export function listCount(items: any): number;
export function listAt<T>(items: Iterable<T> | ArrayLike<T>, index: number): T;
export function listArray<T>(items: Iterable<T>): T[];
export function mapChangedIndex(index: number, event: CollectionChangedEventArgs): number;
export type Comparison<T> = (a: T, b: T) => number;
export interface ColumnOptionsInit<T = any, V = any> {
    CanUserResizeColumn?: boolean | null;
    CanUserSortColumn?: boolean | null;
    MinWidth?: GridLengthLike;
    MaxWidth?: GridLengthLike;
    CompareAscending?: Comparison<T> | null;
    CompareDescending?: Comparison<T> | null;
    TextWrapping?: boolean;
    TextTrimming?: string;
    StringFormat?: string | ((value: V) => string) | null;
    TextAlignment?: 'Left' | 'Center' | 'Right';
    BeginEditGestures?: string;
    Culture?: string | null;
    Formatter?: (value: V, model: T) => string;
    ValueParser?: (text: string, previous: V) => V;
    Validate?: (value: V, model: T) => boolean | string | void;
    ClipboardValue?: (model: T) => unknown;
    AffectsRowHeight?: boolean;
    IsThreeState?: boolean;
}
export class ColumnOptions<T = any, V = any> implements ColumnOptionsInit<T, V> {
    constructor(options?: ColumnOptionsInit<T, V>);
    CanUserResizeColumn: boolean | null;
    CanUserSortColumn: boolean | null;
    MinWidth: GridLengthLike;
    MaxWidth: GridLengthLike;
    CompareAscending: Comparison<T> | null;
    CompareDescending: Comparison<T> | null;
    TextWrapping?: boolean;
    AffectsRowHeight?: boolean;
    Formatter?: (value: V, model: T) => string;
    ValueParser?: (text: string, previous: V) => V;
    Validate?: (value: V, model: T) => boolean | string | void;
    ClipboardValue?: (model: T) => unknown;
    StringFormat?: string | ((value: V) => string) | null;
    TextAlignment?: 'Left' | 'Center' | 'Right';
    BeginEditGestures?: string;
    Culture?: string | null;
}
export class TextColumnOptions<T = any, V = any> extends ColumnOptions<T, V> {
    constructor(options?: ColumnOptionsInit<T, V>);
}
export class CheckBoxColumnOptions<T = any> extends ColumnOptions<T, boolean | null> {
    constructor(options?: ColumnOptionsInit<T, boolean | null>);
    IsThreeState: boolean;
}
export interface IColumn<T = any> {
    readonly Id: string;
    readonly Header: unknown;
    Width: GridLength;
    IsVisible: boolean;
    PresentationKey: string | null;
    SortDirection: SortDirection | null;
    Tag: any;
    readonly Options: ColumnOptions<T, any>;
    readonly PropertyChanged: Signal<PropertyChangedEventArgs>;
    GetComparison(direction: SortDirection): Comparison<T> | null;
    Accept<R>(visitor: IColumnVisitor<T, R>): R;
}
export interface IColumnVisitor<T, R> {
    Visit(column: IColumn<T>): R;
}
export class ColumnList<T = any> extends ObservableList<IColumn<T>> {
    SetColumnWidth(index: number, width: GridLengthLike): void;
}
export class ColumnBase<T = any, V = any> extends NotifyingBase implements IColumn<T> {
    constructor(header: unknown, width?: GridLengthLike, options?: ColumnOptionsInit<T, V> | null, id?: string | null);
    readonly Id: string;
    readonly Header: unknown;
    readonly Options: ColumnOptions<T, V>;
    Width: GridLength;
    IsVisible: boolean;
    PresentationKey: string | null;
    SortDirection: SortDirection | null;
    Tag: any;
    GetComparison(direction: SortDirection): Comparison<T> | null;
    Accept<R>(visitor: IColumnVisitor<T, R>): R;
}
export class ValueColumn<T = any, V = any> extends ColumnBase<T, V> {
    constructor(header: unknown, getter: ((model: T) => V) | string, setter?: ((model: T, value: V) => void) | true | null, width?: GridLengthLike, options?: ColumnOptionsInit<T, V> | null, id?: string | null);
    readonly PropertyName: string | null;
    readonly Getter: (model: T) => V;
    readonly GetterExpression: null;
    readonly Setter: ((model: T, value: V) => void) | null;
    GetValue(model: T): V;
    SetValue(model: T, value: V): void;
    static FromDelegate<T, V>(header: unknown, getter: (model: T) => V, propertyName?: string | null, setter?: ((model: T, value: V) => void) | null, width?: GridLengthLike, options?: ColumnOptionsInit<T, V> | null, id?: string | null): ValueColumn<T, V>;
}
export class TextColumn<T = any, V = any> extends ValueColumn<T, V> {
    constructor(header: unknown, getter: ((model: T) => V) | string, setter?: ((model: T, value: V) => void) | true | null, width?: GridLengthLike, options?: ColumnOptionsInit<T, V> | null, id?: string | null);
    constructor(header: unknown, getter: ((model: T) => V) | string, width: GridLengthLike, options?: ColumnOptionsInit<T, V> | null, id?: string | null);
}
export class CheckBoxColumn<T = any> extends ValueColumn<T, boolean | null> {
    constructor(header: unknown, getter: ((model: T) => boolean | null) | string, setter?: ((model: T, value: boolean | null) => void) | true | null, width?: GridLengthLike, options?: ColumnOptionsInit<T, boolean | null> | null, id?: string | null);
    readonly IsThreeState: boolean;
    readonly BooleanGetter: ((model: T) => boolean | null) | null;
    readonly BooleanSetter: ((model: T, value: boolean | null) => void) | null;
}
export class TemplateColumn<T = any> extends ValueColumn<T, T> {
    constructor(header: unknown, presentationKey: string, width?: GridLengthLike, options?: ColumnOptionsInit<T, T> | null, id?: string | null);
}
export class HierarchicalExpanderColumn<T = any> implements IColumn<T> {
    constructor(inner: IColumn<T>, childSelector: ((model: T) => Iterable<T> | null) | string, hasChildrenSelector?: ((model: T) => boolean) | string | null, isExpandedSelector?: ((model: T) => boolean) | string | null, setIsExpanded?: ((model: T, value: boolean) => void) | null);
    readonly Inner: IColumn<T>;
    readonly Id: string;
    readonly Header: unknown;
    readonly Options: ColumnOptions<T>;
    readonly PropertyChanged: Signal<PropertyChangedEventArgs>;
    Width: GridLength;
    IsVisible: boolean;
    PresentationKey: string | null;
    SortDirection: SortDirection | null;
    Tag: any;
    GetModelIsExpanded(model: T): boolean | null;
    SetModelIsExpanded(row: IExpanderRow<T>): void;
    HasChildren(model: T): boolean;
    GetChildModels(model: T): Iterable<T> | null;
    GetValue(model: T): any;
    SetValue(model: T, value: any): void;
    GetComparison(direction: SortDirection): Comparison<T> | null;
    Accept<R>(visitor: IColumnVisitor<T, R>): R;
}
export class FuncComparer<T> {
    constructor(compare: Comparison<T>);
    Compare(a: T, b: T): number;
}
export function compareValues(a: unknown, b: unknown): number;
export interface IRow<T = any> {
    readonly Model: T;
    readonly ModelIndex: IndexPath;
    readonly Indent: number;
    readonly IsExpanded: boolean;
    readonly ShowExpander: boolean;
    readonly HasChildren: boolean;
    readonly Height: number;
}
export interface IExpanderRow<T = any> extends IRow<T> {
    IsExpanded: boolean;
    readonly Children: HierarchicalRow<T>[] | null;
}
export interface IRows<T = any> extends ReadOnlyListBase<IRow<T>> {
    readonly CollectionChanged: Signal;
    ModelIndexToRowIndex(index: IndexPathLike): number;
    RowIndexToModelIndex(index: number): IndexPath;
}
export class AnonymousRow<T = any> extends NotifyingBase implements IRow<T> {
    readonly Model: T;
    readonly ModelIndex: IndexPath;
    readonly Indent: number;
    readonly IsExpanded: boolean;
    readonly ShowExpander: boolean;
    readonly HasChildren: boolean;
    readonly Height: number;
}
export class AnonymousSortableRows<T = any> extends ReadOnlyListBase<AnonymousRow<T>> implements IRows<T> {
    constructor(source: ITreeDataGridSource<T>);
    readonly CollectionChanged: Signal;
    readonly CachedRowCount: number;
    GetModel(index: number): T;
    ModelIndexToRowIndex(index: IndexPathLike): number;
    RowIndexToModelIndex(index: number): IndexPath;
    Refresh(): void;
    Sort(): void;
    Dispose(): void;
}
export class HierarchicalRow<T = any> extends NotifyingBase implements IExpanderRow<T> {
    readonly Model: T;
    readonly ModelIndex: IndexPath;
    readonly Parent: HierarchicalRow<T> | null;
    readonly Indent: number;
    IsExpanded: boolean;
    readonly ShowExpander: boolean;
    readonly HasChildren: boolean;
    readonly Children: HierarchicalRow<T>[] | null;
    IsLoading: boolean;
    LoadError: Error | null;
    readonly Height: number;
    Dispose(): void;
}
export class HierarchicalRows<T = any> extends ReadOnlyListBase<HierarchicalRow<T>> implements IRows<T> {
    constructor(source: HierarchicalTreeDataGridSource<T>);
    readonly CollectionChanged: Signal;
    GetModel(index: number): T;
    GetRow(index: IndexPathLike, create?: boolean): HierarchicalRow<T> | null;
    ModelIndexToRowIndex(index: IndexPathLike): number;
    RowIndexToModelIndex(index: number): IndexPath;
    Expand(index: IndexPathLike): boolean | Promise<boolean>;
    Collapse(index: IndexPathLike): boolean;
    ExpandCollapseRecursive(predicate: (model: T) => boolean, row?: HierarchicalRow<T> | null): void;
    Refresh(): void;
    Dispose(): void;
}
export class RowEventArgs<T = any> {
    constructor(row: HierarchicalRow<T>);
    readonly Row: HierarchicalRow<T>;
    readonly Model: T;
    readonly ModelIndex: IndexPath;
    Cancel: boolean;
}
export interface ITreeDataGridSelection<T = any> {
    Source: Iterable<T> | null;
    SingleSelect: boolean;
    readonly Count: number;
    Clear(): void;
    Dispose(): void;
}
export interface ITreeSelectionModel<T = any> extends ITreeDataGridSelection<T> {
    SelectedIndex: IndexPath;
    readonly SelectedIndexes: IndexPath[];
    readonly SelectedItem: T | null;
    readonly SelectedItems: T[];
    AnchorIndex: IndexPath;
    RangeAnchorIndex: IndexPath;
    readonly SelectionChanged: Signal<TreeSelectionModelSelectionChangedEventArgs<T>>;
    readonly IndexesChanged: Signal<TreeSelectionModelIndexesChangedEventArgs>;
    readonly SourceReset: Signal<TreeSelectionModelSourceResetEventArgs>;
    Select(index: IndexPathLike): void;
    Deselect(index: IndexPathLike): void;
    IsSelected(index: IndexPathLike): boolean;
    BeginBatchUpdate(): void;
    EndBatchUpdate(): void;
}
export class TreeSelectionModelSelectionChangedEventArgs<T = any> {
    SelectedIndexes: IndexPath[];
    DeselectedIndexes: IndexPath[];
    SelectedItems: T[];
    DeselectedItems: T[];
}
export class TreeSelectionModelIndexesChangedEventArgs {
    ParentIndex: IndexPath;
    StartIndex: number;
    Delta: number;
}
export class TreeSelectionModelSourceResetEventArgs {
    ParentIndex: IndexPath;
}
export class TreeDataGridCellSelectionChangedEventArgs {
}
export class TreeSelectionModelBase<T = any> extends NotifyingBase implements ITreeSelectionModel<T> {
    constructor(source: ITreeDataGridSource<T> | Iterable<T>);
    Source: Iterable<T> | null;
    SingleSelect: boolean;
    SelectedIndex: IndexPath;
    readonly SelectedIndexes: IndexPath[];
    readonly SelectedItem: T | null;
    readonly SelectedItems: T[];
    AnchorIndex: IndexPath;
    RangeAnchorIndex: IndexPath;
    readonly Count: number;
    readonly SelectionChanged: Signal<TreeSelectionModelSelectionChangedEventArgs<T>>;
    readonly IndexesChanged: Signal<TreeSelectionModelIndexesChangedEventArgs>;
    readonly SourceReset: Signal<TreeSelectionModelSourceResetEventArgs>;
    readonly StateChanged: Signal;
    Clear(): void;
    Select(index: IndexPathLike): void;
    Deselect(index: IndexPathLike): void;
    IsSelected(index: IndexPathLike): boolean;
    SelectRange(start: IndexPathLike, end: IndexPathLike, additive?: boolean): void;
    SelectAll(): void;
    BeginBatchUpdate(): void;
    EndBatchUpdate(): void;
    Dispose(): void;
}
export class TreeDataGridRowSelectionModel<T = any> extends TreeSelectionModelBase<T> {
}
export class TreeDataGridCellSelectionModel<T = any> extends NotifyingBase implements ITreeDataGridSelection<T> {
    constructor(source: ITreeDataGridSource<T>);
    Source: Iterable<T> | null;
    SingleSelect: boolean;
    SelectedIndex: CellIndex;
    readonly SelectedIndexes: ReadOnlyListBase<CellIndex>;
    readonly AnchorIndex: CellIndex;
    readonly RangeAnchorIndex: CellIndex;
    readonly Count: number;
    readonly RowSelection: TreeDataGridRowSelectionModel<T>;
    readonly SelectionChanged: Signal<TreeDataGridCellSelectionChangedEventArgs>;
    readonly StateChanged: Signal;
    IsSelected(index: CellIndex): boolean;
    IsSelected(columnIndex: number, rowIndex: IndexPathLike): boolean;
    SetSelectedRange(start: CellIndex, columnCount: number, rowCount: number): void;
    Clear(): void;
    SelectAll(): void;
    Dispose(): void;
}
export interface ITreeDataGridSourceVisitor<T, R> {
    Visit(source: ITreeDataGridSource<T>): R;
}
export interface ITreeDataGridSource<T = any> {
    Items: Iterable<T>;
    readonly Columns: ColumnList<T>;
    readonly Rows: IRows<T>;
    Selection: TreeDataGridRowSelectionModel<T> | TreeDataGridCellSelectionModel<T> | null;
    readonly RowSelection: TreeDataGridRowSelectionModel<T> | null;
    readonly IsHierarchical: boolean;
    readonly IsSorted: boolean;
    readonly Sorted: Signal;
    readonly Changed: Signal;
    SortBy(column: IColumn<T>, direction: SortDirection): boolean;
    ClearSort(): void;
    MoveRows(source: ITreeDataGridSource<T>, indexes: Iterable<IndexPathLike>, targetIndex: IndexPathLike, position: DropPosition, effects: MoveEffects): void;
    Dispose(): void;
}
declare class SourceBase<T = any> extends NotifyingBase implements ITreeDataGridSource<T> {
    constructor(items: Iterable<T> | T);
    Items: Iterable<T>;
    readonly Columns: ColumnList<T>;
    readonly Rows: IRows<T>;
    Selection: TreeDataGridRowSelectionModel<T> | TreeDataGridCellSelectionModel<T> | null;
    readonly RowSelection: TreeDataGridRowSelectionModel<T> | null;
    readonly IsHierarchical: boolean;
    readonly IsSorted: boolean;
    readonly Sorted: Signal;
    readonly Changed: Signal;
    readonly CollectionChanged: Signal;
    readonly ItemChanged: Signal;
    SortBy(column: IColumn<T>, direction: SortDirection): boolean;
    Sort(comparison: Comparison<T> | null): void;
    ClearSort(): void;
    SetFilter(predicate: ((model: T) => boolean) | null): void;
    GetModelChildren(model: T): Iterable<T>;
    TryGetModelAt(index: IndexPathLike): T | null;
    TryGetModelAt(index: IndexPathLike, result: {
        Value: T | null;
    }): boolean;
    GetModelAt(index: IndexPathLike): T;
    GetParentItems(parent: IndexPathLike): Iterable<T>;
    FindModelIndex(model: T): IndexPath;
    NotifyItemChanged(model: T, propertyName?: string): void;
    Refresh(): void;
    BeginUpdate(): void;
    EndUpdate(): void;
    Batch<R>(action: () => R): R;
    Accept<R>(visitor: ITreeDataGridSourceVisitor<T, R>): R;
    MoveRows(source: ITreeDataGridSource<T>, indexes: Iterable<IndexPathLike>, targetIndex: IndexPathLike, position: DropPosition, effects: MoveEffects): void;
    Dispose(): void;
}
export class FlatTreeDataGridSource<T = any> extends SourceBase<T> {
    readonly Rows: AnonymousSortableRows<T>;
}
export class HierarchicalTreeDataGridSource<T = any> extends SourceBase<T> {
    readonly Rows: HierarchicalRows<T>;
    readonly ExpanderColumn: HierarchicalExpanderColumn<T> | null;
    readonly RowExpanding: Signal<RowEventArgs<T>>;
    readonly RowExpanded: Signal<RowEventArgs<T>>;
    readonly RowCollapsing: Signal<RowEventArgs<T>>;
    readonly RowCollapsed: Signal<RowEventArgs<T>>;
    readonly RowLoading: Signal<RowEventArgs<T>>;
    readonly RowLoadFailed: Signal<RowEventArgs<T> & {
        Error: Error;
    }>;
    ChildrenLoader: ((model: T, signal: AbortSignal) => Promise<Iterable<T>>) | null;
    Expand(index: IndexPathLike): boolean | Promise<boolean>;
    Collapse(index: IndexPathLike): boolean;
    ExpandAll(): void;
    CollapseAll(): void;
    ExpandCollapseRecursive(predicate: (model: T) => boolean): void;
    ExpandCollapseRecursive(row: HierarchicalRow<T>, predicate: (model: T) => boolean): void;
    ExpandAsync(index: IndexPathLike, loader?: (model: T, signal: AbortSignal) => Promise<Iterable<T>>): Promise<boolean>;
}
export class RowHeightIndex {
    constructor(count?: number, estimate?: number);
    readonly Count: number;
    readonly Estimate: number;
    readonly Values: Float64Array;
    readonly Tree: Float64Array;
    readonly Total: number;
    Reset(count: number, estimate?: number): void;
    Get(index: number): number;
    Set(index: number, height: number): number;
    Offset(index: number): number;
    IndexAt(offset: number): number;
    Range(offset: number, viewport: number, overscan?: number): {
        start: number;
        end: number;
    };
}
export class ColumnGeometry {
    readonly Items: number[];
    readonly Offsets: Float64Array;
    readonly Total: number;
    Reset(widths: Iterable<number>): void;
    IndexAt(offset: number): number;
    Range(offset: number, width: number, overscan?: number): {
        start: number;
        end: number;
    };
}
export class ColumnLayout {
    readonly Measured: Map<IColumn, number>;
    readonly Columns: IColumn[];
    readonly Widths: number[];
    readonly Geometry: ColumnGeometry;
    Measure(column: IColumn, width: number): boolean;
    ResetMeasurements(): void;
    Calculate(columns: Iterable<IColumn>, available: number): number[];
}
export function clamp(value: number, min: number, max: number): number;
