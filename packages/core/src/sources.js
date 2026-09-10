import { Signal, NotifyingBase, disposeAll } from './events.js';
import { IndexPath, RowDropPosition, RowMoveEffects, ListSortDirection } from './primitives.js';
import { ObservableList, listAt, listCount, listArray } from './collections.js';
import { ColumnList, HierarchicalExpanderColumn } from './columns.js';
import { AnonymousSortableRows, HierarchicalRows, RowEventArgs } from './rows.js';
import { TreeDataGridRowSelectionModel, TreeDataGridCellSelectionModel } from './selection.js';
function asItems(items) { if (items == null)
    return []; if (Array.isArray(items) || items instanceof ObservableList)
    return items; if (items[Symbol.iterator])
    return Array.from(items); return [items]; }
class SourceBase extends NotifyingBase {
    constructor(items) {
        super();
        this.Columns = new ColumnList();
        this.Sorted = new Signal();
        this.Changed = new Signal();
        this.CollectionChanged = new Signal();
        this.ItemChanged = new Signal();
        this._items = asItems(items);
        this._comparison = null;
        this._filter = null;
        this._rows = null;
        this._selection = undefined;
        this._ownsSelection = false;
        this._off = [];
        this._columnOff = [];
        this._batch = 0;
        this._dirty = false;
        this._disposed = false;
        this._watchRoot();
        this._off.push(this.Columns.CollectionChanged.Subscribe((_, e) => this._columnsChanged(e)));
    }
    get Items() { return this._items; }
    set Items(value) { value = asItems(value); if (this._items === value)
        return; const old = this._items; this._rootOff?.(); this._items = value; this._watchRoot(); if (this._selection)
        this._selection.Source = value; this._rows?.Refresh(); this.RaisePropertyChanged('Items', old, value); this.Changed.Emit(this, { Kind: 'Items' }); }
    get Rows() { if (this._disposed)
        throw new Error('Source is disposed.'); return this._rows ??= this._createRows(); }
    get Selection() { if (this._selection === undefined) {
        this._selection = new TreeDataGridRowSelectionModel(this);
        this._ownsSelection = true;
    } return this._selection; }
    set Selection(value) { if (value != null && value.Source !== this.Items)
        throw new Error('Selection source must be set to Items.'); if (this._selection === value)
        return; if (this._ownsSelection)
        this._selection?.Dispose(); this._ownsSelection = false; const old = this._selection; this._selection = value; this.RaisePropertyChanged('Selection', old, value); this.Changed.Emit(this, { Kind: 'Selection' }); }
    get RowSelection() { const s = this.Selection; return s instanceof TreeDataGridRowSelectionModel ? s : null; }
    get IsSorted() { return this._comparison !== null; }
    get IsHierarchical() { return false; }
    _watchRoot() { this._rootOff = this._items?.CollectionChanged?.Subscribe((_, e) => { this.CollectionChanged.Emit(this, { ParentIndex: IndexPath.Unselected, Change: e }); this._rows?._changed(e); if (!this.IsHierarchical)
        this._invalidate('Items'); }); }
    _columnsChanged() { disposeAll(this._columnOff); for (const c of this.Columns)
        this._columnOff.push(c.PropertyChanged.Subscribe((_, e) => { this.Changed.Emit(this, { Kind: 'Column', Column: c, PropertyName: e.PropertyName }); })); this.RaisePropertyChanged('Columns'); this.Changed.Emit(this, { Kind: 'Columns' }); }
    _invalidate(kind = 'Rows') { if (this._batch) {
        this._dirty = true;
        return;
    } this.Changed.Emit(this, { Kind: kind }); }
    Accept(visitor) { return visitor.Visit(this); }
    SortBy(column, direction = ListSortDirection.Ascending) { if (typeof column === 'number')
        column = this.Columns.Get(column); if (!this.Columns.Contains(column))
        return false; const compare = column.GetComparison(direction); if (!compare)
        return false; this._comparison = compare; this._rows?.Sort(compare); for (const c of this.Columns)
        c.SortDirection = c === column ? direction : null; this.Sorted.Emit(this); this._invalidate('Sort'); return true; }
    ClearSort() { if (!this.IsSorted)
        return; this._comparison = null; this._rows?.Sort(null); for (const c of this.Columns)
        c.SortDirection = null; this.Sorted.Emit(this); this._invalidate('Sort'); }
    /** Web extension: filter the displayed projection without rewriting the source Items. */
    SetFilter(predicate = null) { if (predicate != null && typeof predicate !== 'function')
        throw new TypeError('Filter must be a function.'); this._filter = predicate; this._rows?.Sort(); this._invalidate('Filter'); }
    Sort(comparison) { this._comparison = comparison; this._rows?.Sort(comparison); this.Sorted.Emit(this); this._invalidate('Sort'); }
    GetModelChildren() { return []; }
    TryGetModelAt(path, out = null) { path = IndexPath.From(path); let items = this.Items, model = null; for (let d = 0; d < path.Count; d++) {
        if (path[d] >= listCount(items)) {
            model = null;
            break;
        }
        model = listAt(items, path[d]);
        if (d < path.Count - 1)
            items = this.GetModelChildren(model) ?? [];
    } if (out) {
        out.Value = model;
        return model != null;
    } return model; }
    GetModelAt(path) { const model = this.TryGetModelAt(path); if (model == null)
        throw new RangeError('Model index not found.'); return model; }
    GetParentItems(path) { path = IndexPath.From(path); return path.Count ? this.GetModelChildren(this.GetModelAt(path)) : this.Items; }
    FindModelIndex(model) { const stack = [{ items: this.Items, path: IndexPath.Unselected }]; const visited = new Set(); while (stack.length) {
        const { items, path } = stack.pop();
        if (visited.has(items))
            continue;
        visited.add(items);
        for (let i = listCount(items) - 1; i >= 0; i--) {
            const m = listAt(items, i), p = path.Append(i);
            if (m === model)
                return p;
            if (this.IsHierarchical) {
                const children = this.GetModelChildren(m);
                if (children && !children.then)
                    stack.push({ items: children, path: p });
            }
        }
    } return IndexPath.Unselected; }
    NotifyItemChanged(model, propertyName = null) { this.ItemChanged.Emit(this, { Model: model, PropertyName: propertyName }); if (this.IsSorted || this._filter)
        this._rows?.Sort(); this._invalidate('Value'); }
    Refresh() { this._rows?.Refresh(); this._invalidate('Refresh'); }
    BeginUpdate() { this._batch++; }
    EndUpdate() { if (!this._batch)
        throw new Error('Unbalanced EndUpdate.'); if (!--this._batch && this._dirty) {
        this._dirty = false;
        if (this.IsHierarchical)
            this._rows?._rebuild();
        this.Changed.Emit(this, { Kind: 'Rows' });
    } }
    Batch(action) { this.BeginUpdate(); try {
        return action(this);
    }
    finally {
        this.EndUpdate();
    } }
    MoveRows(source, indexes, targetIndex, position, effects = RowMoveEffects.Move) { moveRows(this, source, indexes, targetIndex, position, effects); }
    Dispose() { if (this._disposed)
        return; this._rootOff?.(); disposeAll(this._columnOff); disposeAll(this._off); this._rows?.Dispose(); if (this._ownsSelection)
        this._selection?.Dispose(); this._disposed = true; for (const k of ['Sorted', 'Changed', 'CollectionChanged', 'ItemChanged', 'PropertyChanged'])
        this[k].Clear(); }
}
export class FlatTreeDataGridSource extends SourceBase {
    _createRows() { return new AnonymousSortableRows(this); }
}
export class HierarchicalTreeDataGridSource extends SourceBase {
    constructor(items) { super(items); this.Columns.Validate = items => { if (items.filter(c => c instanceof HierarchicalExpanderColumn).length > 1)
        throw new Error('Only one expander column is allowed.'); }; this.RowExpanding = new Signal(); this.RowExpanded = new Signal(); this.RowCollapsing = new Signal(); this.RowCollapsed = new Signal(); this.RowLoading = new Signal(); this.RowLoadFailed = new Signal(); this.ChildrenLoader = null; this._loadedChildren = new WeakMap(); }
    get IsHierarchical() { return true; }
    get ExpanderColumn() { return Array.from(this.Columns).find(c => c instanceof HierarchicalExpanderColumn) ?? null; }
    _createRows() { if (!this.ExpanderColumn)
        throw new Error('No expander column defined.'); return new HierarchicalRows(this); }
    _columnsChanged(e) { const previous = this._lastExpander; super._columnsChanged(e); this._lastExpander = this.ExpanderColumn; if (this._rows && previous !== this._lastExpander)
        this._rows.Refresh(); }
    GetModelChildren(model) { return this._loadedChildren.get(model) ?? this.ExpanderColumn?.GetChildModels(model) ?? []; }
    _setExpandedRow(row, value, write = true) {
        if (!row?._alive || row._expanded === value)
            return;
        const e = new RowEventArgs(row);
        (value ? this.RowExpanding : this.RowCollapsing).Emit(this, e);
        if (e.Cancel)
            return;
        row._expanded = value;
        if (write)
            this.ExpanderColumn?.SetModelIsExpanded(row);
        row.RaisePropertyChanged('IsExpanded');
        row.Owner._request();
        (value ? this.RowExpanded : this.RowCollapsed).Emit(this, e);
    }
    Expand(index) { const row = this.Rows.GetRow(index); if (!row)
        return false; if (this.ChildrenLoader && row._loadedModels === undefined && row.HasChildren)
        return this.ExpandAsync(index); this._setExpandedRow(row, true); return true; }
    Collapse(index) { const row = this.Rows.GetRow(index, false); if (!row)
        return false; row._wantExpand = false; row._abort?.abort(); row.IsLoading = false; this._setExpandedRow(row, false); return true; }
    ExpandAll() { this.ExpandCollapseRecursive(() => true); }
    CollapseAll() { this.ExpandCollapseRecursive(() => false); }
    ExpandCollapseRecursive(rowOrPredicate, maybePredicate) { const row = typeof rowOrPredicate === 'function' ? null : rowOrPredicate, predicate = maybePredicate ?? rowOrPredicate; if (typeof predicate !== 'function')
        throw new TypeError('Predicate required.'); this.Batch(() => { const stack = row ? [row] : this.Rows._roots.slice(); while (stack.length) {
        const r = stack.pop(), expanded = !!predicate(r.Model);
        this._setExpandedRow(r, expanded);
        if (r.HasChildren) {
            const children = r._children ?? (expanded ? this.Rows._ensureChildren(r) : []);
            for (const c of children)
                stack.push(c);
        }
    } }); }
    async ExpandAsync(index, loader = this.ChildrenLoader) {
        const row = this.Rows.GetRow(index);
        if (!row)
            return false;
        if (row._loadedModels !== undefined || !loader) {
            this._setExpandedRow(row, true);
            return true;
        }
        if (row.IsLoading)
            return row._loadPromise;
        const abort = new AbortController();
        row._abort = abort;
        row.IsLoading = true;
        row._wantExpand = true;
        row.LoadError = null;
        this.RowLoading.Emit(this, new RowEventArgs(row));
        this._invalidate('Value');
        row._loadPromise = (async () => { try {
            const children = await loader(row.Model, abort.signal);
            if (abort.signal.aborted || !row._alive || this._disposed)
                return false;
            row._loadedModels = asItems(children);
            this._loadedChildren.set(row.Model, row._loadedModels);
            this.Rows._replaceChildren(row, row._loadedModels);
            if (row._wantExpand)
                this._setExpandedRow(row, true);
            return true;
        }
        catch (error) {
            if (!abort.signal.aborted) {
                row.LoadError = error;
                this.RowLoadFailed.Emit(this, { ...new RowEventArgs(row), Error: error });
            }
            return false;
        }
        finally {
            if (row._abort === abort) {
                row.IsLoading = false;
                row._abort = null;
                this._invalidate('Value');
            }
        } })();
        return row._loadPromise;
    }
    Dispose() { if (this._disposed)
        return; super.Dispose(); for (const name of ['RowExpanding', 'RowExpanded', 'RowCollapsing', 'RowCollapsed', 'RowLoading', 'RowLoadFailed'])
        this[name].Clear(); }
}
function editable(list) { if (!(Array.isArray(list) || list instanceof ObservableList) || Object.isFrozen(list))
    throw new Error('Items must be a mutable array or ObservableList.'); }
function removeAt(list, i) { list instanceof ObservableList ? list.RemoveAt(i) : list.splice(i, 1); }
function insertAt(list, i, item) { list instanceof ObservableList ? list.Insert(i, item) : list.splice(i, 0, item); }
function rowSelection(source) { const s = source._selection; return s instanceof TreeDataGridCellSelectionModel ? s.RowSelection : s; }
function findCollectionPath(source, list) { if (source.Items === list)
    return IndexPath.Unselected; const stack = [{ items: source.Items, path: IndexPath.Unselected }], seen = new Set(); while (stack.length) {
    const { items, path } = stack.pop();
    if (seen.has(items))
        continue;
    seen.add(items);
    for (let i = 0; i < listCount(items); i++) {
        const children = source.GetModelChildren(listAt(items, i)), p = path.Append(i);
        if (children === list)
            return p;
        if (children && !children.then)
            stack.push({ items: children, path: p });
    }
} return null; }
function moveRows(dest, source, indexes, targetIndex, position, effects) {
    if (effects !== RowMoveEffects.Move)
        throw new Error('Only Move is supported.');
    if (dest.IsSorted || source.IsSorted || dest._filter || source._filter)
        throw new Error('Row movement requires unsorted, unfiltered sources.');
    if (!Object.values(RowDropPosition).includes(position))
        throw new RangeError('Invalid drop position.');
    if (position === RowDropPosition.None)
        return;
    if (!dest.IsHierarchical && position === RowDropPosition.Inside)
        throw new Error('A flat grid cannot receive an Inside drop.');
    let paths = Array.from(indexes, IndexPath.From).sort((a, b) => a.CompareTo(b));
    if (new Set(paths.map(p => p.Key)).size !== paths.length)
        throw new Error('Duplicate source index.');
    if (!paths.length)
        return;
    targetIndex = IndexPath.From(targetIndex);
    dest.GetModelAt(targetIndex);
    paths = paths.filter((p, i) => !paths.slice(0, i).some(parent => parent.IsAncestorOf(p)));
    if (source === dest && paths.some(p => p.IsAncestorOf(targetIndex) || (position === 'Inside' && p.Equals(targetIndex))))
        throw new Error('A row cannot move into itself or its descendants.');
    const descriptors = paths.map(path => { source.GetModelAt(path); const list = source.GetParentItems(path.Parent); editable(list); return { path, list, index: path[path.Count - 1], model: source.GetModelAt(path) }; });
    const targetList = dest.GetParentItems(position === 'Inside' ? targetIndex : targetIndex.Parent);
    editable(targetList);
    let ti = position === 'Inside' ? listCount(targetList) : targetIndex[targetIndex.Count - 1] + (position === 'After' ? 1 : 0);
    // Per-occurrence tokens retain selection even when a collection contains the same object twice.
    const tokens = new Map();
    const tokenList = list => { if (!tokens.has(list))
        tokens.set(list, Array.from({ length: listCount(list) }, () => ({}))); return tokens.get(list); };
    const selections = [];
    for (const s of new Set([source, dest])) {
        const selection = rowSelection(s);
        if (!selection)
            continue;
        const entries = selection.SelectedIndexes.map(p => { const list = s.GetParentItems(p.Parent); return { list, token: tokenList(list)[p[p.Count - 1]], primary: p.Equals(selection.SelectedIndex), anchor: p.Equals(selection.AnchorIndex), range: p.Equals(selection.RangeAnchorIndex) }; });
        selections.push({ source: s, selection, entries });
    }
    for (const d of descriptors)
        d.token = tokenList(d.list)[d.index];
    tokenList(targetList);
    source.BeginUpdate();
    if (dest !== source)
        dest.BeginUpdate();
    try {
        for (const d of descriptors.slice().reverse()) {
            removeAt(d.list, d.index);
            tokenList(d.list).splice(d.index, 1);
            if (d.list === targetList && d.index < ti)
                ti--;
        }
        for (const d of descriptors) {
            insertAt(targetList, ti, d.model);
            tokenList(targetList).splice(ti, 0, d.token);
            ti++;
        }
        if (!(source.Items instanceof ObservableList) || descriptors.some(d => !(d.list instanceof ObservableList)))
            source.Refresh();
        if (dest !== source && !(targetList instanceof ObservableList))
            dest.Refresh();
        for (const { source: s, selection, entries } of selections) {
            selection.BeginBatchUpdate();
            try {
                selection.Clear();
                for (const e of entries) {
                    let foundList = null, index = -1;
                    for (const [l, t] of tokens) {
                        const i = t.indexOf(e.token);
                        if (i >= 0) {
                            foundList = l;
                            index = i;
                            break;
                        }
                    }
                    if (!foundList)
                        continue;
                    const parent = findCollectionPath(s, foundList);
                    if (parent == null)
                        continue;
                    const path = parent.Append(index);
                    selection.Select(path);
                    if (e.anchor)
                        selection.AnchorIndex = path;
                    if (e.range)
                        selection.RangeAnchorIndex = path;
                }
            }
            finally {
                selection.EndBatchUpdate();
            }
        }
    }
    finally {
        source.EndUpdate();
        if (dest !== source)
            dest.EndUpdate();
    }
}
