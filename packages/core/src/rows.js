import { Signal, NotifyingBase, observeSelector, disposeAll } from './events.js';
import { IndexPath } from './primitives.js';
import { ReadOnlyListBase, indexable, listCount, listAt, listArray, mapChangedIndex } from './collections.js';
export class AnonymousRow extends NotifyingBase {
    constructor(model, modelIndex) { super(); this.Model = model; this._index = modelIndex; }
    get ModelIndex() { if (this._cachedPathIndex !== this._index) {
        this._cachedPathIndex = this._index;
        this._cachedPath = new IndexPath(this._index);
    } return this._cachedPath; }
    get Indent() { return 0; }
    get IsExpanded() { return false; }
    get ShowExpander() { return false; }
    get Height() { return NaN; }
}
/** Flat sources never allocate row objects for unvisited rows. */
export class AnonymousSortableRows extends ReadOnlyListBase {
    constructor(source) { super(); this.Source = source; this.CollectionChanged = new Signal(); this._cache = new Map(); this._order = null; this._inverse = null; this._project(); return indexable(this); }
    get Count() { return this._order?.length ?? listCount(this.Source.Items); }
    Get(index) { if (index < 0 || index >= this.Count)
        throw new RangeError('Invalid row index.'); const mi = this._order ? this._order[index] : index; let row = this._cache.get(mi); if (!row) {
        row = new AnonymousRow(listAt(this.Source.Items, mi), mi);
        this._cache.set(mi, row);
    } return row; }
    GetModel(index) { if (index < 0 || index >= this.Count)
        throw new RangeError('Invalid row index.'); return listAt(this.Source.Items, this._order ? this._order[index] : index); }
    RowIndexToModelIndex(index) { if (index < 0 || index >= this.Count)
        return IndexPath.Unselected; return new IndexPath(this._order ? this._order[index] : index); }
    ModelIndexToRowIndex(path) { path = IndexPath.From(path); if (path.Count !== 1 || path[0] >= listCount(this.Source.Items))
        return -1; return this._inverse ? this._inverse[path[0]] : path[0]; }
    _project() {
        const source = this.Source, n = listCount(source.Items);
        if (!source._comparison && !source._filter) {
            this._order = null;
            this._inverse = null;
            return;
        }
        let indexes = Array.from({ length: n }, (_, i) => i);
        if (source._filter)
            indexes = indexes.filter(i => source._filter(listAt(source.Items, i)));
        if (source._comparison)
            indexes.sort((a, b) => source._comparison(listAt(source.Items, a), listAt(source.Items, b)) || a - b);
        this._order = Int32Array.from(indexes);
        this._inverse = new Int32Array(n);
        this._inverse.fill(-1);
        for (let i = 0; i < indexes.length; i++)
            this._inverse[indexes[i]] = i;
    }
    _changed(e) { const next = new Map(); for (const [i, row] of this._cache) {
        const ni = mapChangedIndex(i, e);
        if (ni >= 0) {
            row._index = ni;
            row.Model = listAt(this.Source.Items, ni);
            next.set(ni, row);
        }
    } this._cache = next; this._project(); this.CollectionChanged.Emit(this, e); }
    Sort() { this._project(); this.CollectionChanged.Emit(this, { Action: 'Reset', Reason: 'Sort' }); }
    Refresh() { this._cache.clear(); this._project(); this.CollectionChanged.Emit(this, { Action: 'Reset', Reason: 'Refresh' }); }
    get CachedRowCount() { return this._cache.size; }
    Dispose() { this._cache.clear(); this.CollectionChanged.Clear(); }
}
export class HierarchicalRow extends NotifyingBase {
    constructor(rows, model, parent, index) {
        super();
        this.Owner = rows;
        this.Model = model;
        this.Parent = parent;
        this._index = index;
        this._children = null;
        this._childrenItems = null;
        this._off = [];
        this._expanded = false;
        this.IsLoading = false;
        this.LoadError = null;
        this._loadedModels = undefined;
        this._alive = true;
        const exp = rows.Source.ExpanderColumn;
        if (exp?.IsExpandedSelector) {
            this._expanded = !!exp.GetModelIsExpanded(model);
            this._off.push(observeSelector(model, m => exp.GetModelIsExpanded(m), v => { if (this._alive && this._expanded !== !!v)
                rows.Source._setExpandedRow(this, !!v, false); }));
        }
        if (exp)
            this._off.push(observeSelector(model, m => exp.GetChildModels(m), value => { if (this._alive && this._children && value !== this._childrenItems) {
                rows._replaceChildren(this, value);
                rows._request();
            } }));
    }
    get ModelIndex() { return this.Parent ? this.Parent.ModelIndex.Append(this._index) : new IndexPath(this._index); }
    get Indent() { let d = 0; for (let p = this.Parent; p; p = p.Parent)
        d++; return d; }
    get IsExpanded() { return this._expanded; }
    set IsExpanded(value) { this.Owner.Source._setExpandedRow(this, !!value); }
    get ShowExpander() { return this.HasChildren; }
    get HasChildren() { if (this._loadedModels !== undefined)
        return listCount(this._loadedModels) > 0; return this.Owner.Source.ExpanderColumn?.HasChildren(this.Model) ?? false; }
    get Children() { return this.Owner._ensureChildren(this); }
    get Height() { return NaN; }
    Dispose() { if (!this._alive)
        return; this._alive = false; this._abort?.abort(); disposeAll(this._off); this._childOff?.(); this._children?.forEach(r => r.Dispose()); this.PropertyChanged.Clear(); }
}
export class HierarchicalRows extends ReadOnlyListBase {
    constructor(source) { super(); this.Source = source; this.CollectionChanged = new Signal(); this._visible = []; this._index = new Map(); this._roots = this._make(source.Items, null); this._rebuild(); return indexable(this); }
    GetModel(index) { return this.Get(index).Model; }
    get Count() { return this._visible.length; }
    Get(i) { if (i < 0 || i >= this.Count)
        throw new RangeError('Invalid row index.'); return this._visible[i]; }
    RowIndexToModelIndex(i) { return this._visible[i]?.ModelIndex ?? IndexPath.Unselected; }
    ModelIndexToRowIndex(p) { return this._index.get(IndexPath.From(p).Key) ?? -1; }
    _make(items, parent) { return listArray(items).map((m, i) => { for (let p = parent; p; p = p.Parent)
        if (p.Model === m)
            throw new Error('A hierarchy cannot contain a cycle.'); return new HierarchicalRow(this, m, parent, i); }); }
    _ensureChildren(row) { if (row._children)
        return row._children; const items = row._loadedModels ?? this.Source.ExpanderColumn?.GetChildModels(row.Model) ?? []; if (items?.then)
        throw new Error('Use ChildrenLoader and ExpandAsync for asynchronous children.'); this._replaceChildren(row, items); return row._children; }
    _replaceChildren(row, items) { row._children?.forEach(r => r.Dispose()); row._childOff?.(); row._childrenItems = items ?? []; row._children = this._make(items, row); row._childOff = items?.CollectionChanged?.Subscribe((_, e) => { const parent = row.ModelIndex; this.Source.CollectionChanged.Emit(this.Source, { ParentIndex: parent, Change: e }); row._children = this._reconcile(row._children, row._childrenItems, row, e); this._request(); }); }
    _reconcile(old, items, parent, e) { const next = Array(listCount(items)); for (let i = 0; i < old.length; i++) {
        const ni = mapChangedIndex(i, e);
        if (ni >= 0 && ni < next.length && old[i].Model === listAt(items, ni)) {
            old[i]._index = ni;
            next[ni] = old[i];
        }
        else
            old[i].Dispose();
    } for (let i = 0; i < next.length; i++)
        if (!next[i])
            next[i] = new HierarchicalRow(this, listAt(items, i), parent, i); return next; }
    _changed(e) { this._roots = this._reconcile(this._roots, this.Source.Items, null, e); this._request(); }
    _ordered(rows) { if (!this.Source._comparison)
        return rows; return rows.slice().sort((a, b) => this.Source._comparison(a.Model, b.Model) || a._index - b._index); }
    _rebuild() {
        const visible = [], map = new Map(), stack = [{ rows: this._ordered(this._roots), i: 0 }];
        const filter = this.Source._filter;
        while (stack.length) {
            const frame = stack.at(-1);
            if (frame.i >= frame.rows.length) {
                stack.pop();
                continue;
            }
            const row = frame.rows[frame.i++];
            // Hierarchical filtering includes matching ancestors and descendants in the projection.
            if (filter && !this._matches(row, filter, new Set()))
                continue;
            map.set(row.ModelIndex.Key, visible.length);
            visible.push(row);
            if (row._expanded && row.HasChildren)
                stack.push({ rows: this._ordered(this._ensureChildren(row)), i: 0 });
        }
        this._visible = visible;
        this._index = map;
        this.CollectionChanged.Emit(this, { Action: 'Reset' });
    }
    _matches(row, predicate, seen) { if (predicate(row.Model))
        return true; if (seen.has(row.Model))
        return false; seen.add(row.Model); if (!row.HasChildren)
        return false; for (const child of this._ensureChildren(row))
        if (this._matches(child, predicate, seen))
            return true; return false; }
    _request() { if (this.Source._batch) {
        this.Source._dirty = true;
        return;
    } this._rebuild(); this.Source.Changed.Emit(this.Source, { Kind: 'Rows' }); }
    GetRow(path, create = true) { path = IndexPath.From(path); let rows = this._roots, row = null; for (let d = 0; d < path.Count; d++) {
        row = rows[path[d]];
        if (!row)
            return null;
        if (d < path.Count - 1)
            rows = create ? this._ensureChildren(row) : (row._children ?? []);
    } return row; }
    Expand(index) { this.Source.Expand(index); }
    Collapse(index) { this.Source.Collapse(index); }
    ExpandCollapseRecursive(predicate, row = null) { this.Source.ExpandCollapseRecursive(row ?? predicate, row ? predicate : undefined); }
    Sort() { this._request(); }
    Refresh() { this._roots.forEach(r => r.Dispose()); this._roots = this._make(this.Source.Items, null); this._request(); }
    Dispose() { this._roots.forEach(r => r.Dispose()); this._roots = []; this._visible = []; this._index.clear(); this.CollectionChanged.Clear(); }
}
export class RowEventArgs {
    constructor(row) { this.Row = row; this.Model = row.Model; this.ModelIndex = row.ModelIndex; this.Cancel = false; }
}
