import { Signal, NotifyingBase, disposeAll } from './events.js';
import { IndexPath, CellIndex, clamp } from './primitives.js';
import { ReadOnlyListBase, indexable, mapChangedIndex } from './collections.js';
export class TreeSelectionModelSelectionChangedEventArgs {
    constructor(deselectedIndexes = [], selectedIndexes = [], deselectedItems = [], selectedItems = []) { Object.assign(this, { DeselectedIndexes: deselectedIndexes, SelectedIndexes: selectedIndexes, DeselectedItems: deselectedItems, SelectedItems: selectedItems }); }
}
export class TreeSelectionModelIndexesChangedEventArgs {
    constructor(parentIndex, startIndex, delta) { Object.assign(this, { ParentIndex: IndexPath.From(parentIndex), StartIndex: startIndex, Delta: delta }); }
}
export class TreeSelectionModelSourceResetEventArgs {
    constructor(parentIndex = IndexPath.Unselected) { this.ParentIndex = parentIndex; }
}
export class TreeDataGridCellSelectionChangedEventArgs {
}
export class TreeSelectionModelBase extends NotifyingBase {
    constructor(source) {
        super();
        this._grid = source?.Rows ? source : null;
        this._source = this._grid?.Items ?? source ?? null;
        this._selected = new Map();
        this._single = true;
        this._anchor = IndexPath.Unselected;
        this._rangeAnchor = IndexPath.Unselected;
        this._batch = 0;
        this._off = [];
        this.SelectionChanged = new Signal();
        this.IndexesChanged = new Signal();
        this.SourceReset = new Signal();
        this.StateChanged = new Signal();
        if (this._grid)
            this._off.push(this._grid.CollectionChanged.Subscribe((_, e) => this._collectionChanged(e.ParentIndex, e.Change)));
    }
    get Source() { return this._source; }
    set Source(v) { if (this._source === v)
        return; this.Clear(); this._source = v; this.SourceReset.Emit(this, new TreeSelectionModelSourceResetEventArgs()); }
    get SingleSelect() { return this._single; }
    set SingleSelect(v) { v = !!v; if (v === this._single)
        return; this._single = v; if (v && this._selected.size > 1) {
        const first = this._selected.values().next().value;
        this.SelectedIndex = first;
    } this.RaisePropertyChanged('SingleSelect'); }
    get _state() { return this._batch ? this._snapshot : this._selected; }
    get SelectedIndex() { return this._state.values().next().value ?? IndexPath.Unselected; }
    set SelectedIndex(index) { index = IndexPath.From(index); this.BeginBatchUpdate(); try {
        this._selected.clear();
        if (this._valid(index))
            this._selected.set(index.Key, index);
        this._anchor = index;
        this._rangeAnchor = index;
    }
    finally {
        this.EndBatchUpdate();
    } }
    get SelectedIndexes() { return Array.from(this._state.values()); }
    get SelectedItem() { return this._batch ? (this._itemSnapshot[0] ?? null) : this._model(this.SelectedIndex); }
    get SelectedItems() { return this._batch ? this._itemSnapshot.slice() : this.SelectedIndexes.map(p => this._model(p)); }
    get AnchorIndex() { return this._batch ? this._anchorSnapshot : this._anchor; }
    set AnchorIndex(v) { this._anchor = IndexPath.From(v); }
    get RangeAnchorIndex() { return this._batch ? this._rangeSnapshot : this._rangeAnchor; }
    set RangeAnchorIndex(v) { this._rangeAnchor = IndexPath.From(v); }
    get Count() { return this._state.size; }
    _valid(p) { return p.Count > 0 && this._model(p) != null; }
    _model(p) { if (!p?.Count)
        return null; if (this._grid)
        return this._grid.TryGetModelAt(p); return this._source?.Get?.(p[0]) ?? this._source?.[p[0]] ?? null; }
    BeginBatchUpdate() {
        if (this._disposed)
            throw new Error('Selection disposed.');
        if (!this._batch++) {
            this._snapshot = new Map(this._selected);
            this._snapshotCurrentPaths = new Map(this._selected);
            this._itemSnapshot = Array.from(this._selected.values(), p => this._model(p));
            this._anchorSnapshot = this._anchor;
            this._rangeSnapshot = this._rangeAnchor;
            this._pendingIndexes = [];
            this._pendingResets = [];
        }
    }
    EndBatchUpdate() {
        if (!this._batch)
            throw new Error('Unbalanced EndBatchUpdate.');
        if (--this._batch)
            return;
        const old = this._snapshot, added = [], removed = [], removedItems = [], survivingKeys = new Set();
        let i = 0;
        for (const [k, p] of old) {
            const mapped = this._snapshotCurrentPaths.get(k);
            if (!mapped?.Count || !this._selected.has(mapped.Key)) {
                removed.push(p);
                removedItems.push(this._itemSnapshot[i]);
            }
            else
                survivingKeys.add(mapped.Key);
            i++;
        }
        for (const [k, p] of this._selected)
            if (!survivingKeys.has(k))
                added.push(p);
        const primaryChanged = (old.values().next().value?.Key ?? '') !== (this._selected.values().next().value?.Key ?? '');
        const anchorsChanged = this._anchorSnapshot.Key !== this._anchor.Key || this._rangeSnapshot.Key !== this._rangeAnchor.Key;
        const indexEvents = this._pendingIndexes, resetEvents = this._pendingResets;
        this._snapshot = this._snapshotCurrentPaths = this._itemSnapshot = null;
        this._pendingIndexes = this._pendingResets = null;
        if (added.length || removed.length)
            this.SelectionChanged.Emit(this, new TreeSelectionModelSelectionChangedEventArgs(removed, added, removedItems, added.map(p => this._model(p))));
        for (const e of indexEvents)
            this.IndexesChanged.Emit(this, e);
        for (const e of resetEvents)
            this.SourceReset.Emit(this, e);
        if (added.length || removed.length || primaryChanged || indexEvents.length || resetEvents.length) {
            this.StateChanged.Emit(this);
            for (const name of ['SelectedIndex', 'SelectedIndexes', 'SelectedItem', 'SelectedItems', 'Count'])
                this.RaisePropertyChanged(name);
        }
        if (anchorsChanged) {
            this.RaisePropertyChanged('AnchorIndex');
            this.RaisePropertyChanged('RangeAnchorIndex');
        }
    }
    _mutate(action) { this.BeginBatchUpdate(); try {
        action();
    }
    finally {
        this.EndBatchUpdate();
    } }
    Select(index) { const p = IndexPath.From(index); if (!this._valid(p))
        return; this._mutate(() => { if (this._single)
        this._selected.clear(); this._selected.set(p.Key, p); this._anchor = p; }); }
    Deselect(index) { const p = IndexPath.From(index); this._mutate(() => this._selected.delete(p.Key)); }
    Clear() { this._mutate(() => { this._selected.clear(); this._anchor = this._rangeAnchor = IndexPath.Unselected; }); }
    IsSelected(index) { return this._state.has(IndexPath.From(index).Key); }
    SelectRange(start, end, add = false) {
        if (!this._grid)
            return;
        const a = this._grid.Rows.ModelIndexToRowIndex(IndexPath.From(start)), b = this._grid.Rows.ModelIndexToRowIndex(IndexPath.From(end));
        if (a < 0 || b < 0)
            return;
        this._mutate(() => { if (!add)
            this._selected.clear(); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
            const p = this._grid.Rows.RowIndexToModelIndex(i);
            this._selected.set(p.Key, p);
            if (this._single)
                break;
        } this._anchor = IndexPath.From(end); });
    }
    SelectAll() { if (!this._grid)
        return; this._mutate(() => { this._selected.clear(); for (let i = 0; i < this._grid.Rows.Count; i++) {
        const p = this._grid.Rows.RowIndexToModelIndex(i);
        this._selected.set(p.Key, p);
        if (this._single)
            break;
    } }); }
    _collectionChanged(parent, event) {
        parent = IndexPath.From(parent);
        const remap = p => {
            if (!parent.IsAncestorOf(p))
                return p;
            const n = mapChangedIndex(p[parent.Count], event);
            return n < 0 ? IndexPath.Unselected : new IndexPath([...p.Slice(0, parent.Count), n, ...p.Slice(parent.Count + 1)]);
        };
        // Collection notifications arrive after mutation. Recover removed models from
        // OldItems, rather than accidentally reading the item now occupying their slot.
        const oldModel = p => {
            if (!parent.IsAncestorOf(p))
                return this._model(p);
            const index = p[parent.Count], oi = event.OldStartingIndex ?? -1;
            let removed;
            if (event.Action === 'Reset')
                removed = event.OldItems?.[index];
            else if ((event.Action === 'Remove' || event.Action === 'Replace') && index >= oi && index < oi + (event.OldItems?.length ?? 0))
                removed = event.OldItems[index - oi];
            if (removed !== undefined) {
                for (let depth = parent.Count + 1; depth < p.Count && removed != null; depth++) {
                    const children = this._grid?.GetModelChildren(removed);
                    removed = children?.Get ? children.Get(p[depth]) : children?.[p[depth]];
                }
                return removed ?? null;
            }
            return this._model(remap(p));
        };
        const fresh = !this._batch, before = Array.from(this._selected.values());
        const previousItems = fresh ? before.map(oldModel) : null;
        this.BeginBatchUpdate();
        try {
            if (fresh)
                this._itemSnapshot = previousItems;
            this._selected = new Map(before.map(remap).filter(p => p.Count).map(p => [p.Key, p]));
            for (const [k, p] of this._snapshotCurrentPaths)
                this._snapshotCurrentPaths.set(k, remap(p));
            this._anchor = remap(this._anchor);
            this._rangeAnchor = remap(this._rangeAnchor);
            const moved = before.some(p => { const next = remap(p); return next.Count && next.Key !== p.Key; });
            if (moved) {
                const delta = event.Action === 'Add' ? (event.NewItems?.length ?? 0) : event.Action === 'Remove' ? -(event.OldItems?.length ?? 0) : 0;
                const args = new TreeSelectionModelIndexesChangedEventArgs(parent, event.NewStartingIndex >= 0 ? event.NewStartingIndex : event.OldStartingIndex, delta);
                args.Change = event;
                this._pendingIndexes.push(args);
            }
            if (event.Action === 'Reset')
                this._pendingResets.push(new TreeSelectionModelSourceResetEventArgs(parent));
        }
        finally {
            this.EndBatchUpdate();
        }
    }
    Dispose() { if (this._disposed)
        return; this.Clear(); disposeAll(this._off); this._disposed = true; this.SelectionChanged.Clear(); this.StateChanged.Clear(); this.IndexesChanged.Clear(); this.SourceReset.Clear(); this.PropertyChanged.Clear(); }
}
export class TreeDataGridRowSelectionModel extends TreeSelectionModelBase {
}
class CellIndexes extends ReadOnlyListBase {
    constructor(owner) { super(); this.Owner = owner; return indexable(this); }
    get Count() { return this.Owner.Count; }
    Get(index) { if (index < 0 || index >= this.Count)
        throw new RangeError('Invalid cell index.'); const o = this.Owner, cols = o._columnIndexes; return new CellIndex(cols[index % cols.length], o.RowSelection.SelectedIndexes[Math.floor(index / cols.length)]); }
}
export class TreeDataGridCellSelectionModel extends NotifyingBase {
    constructor(source) {
        super();
        this._grid = source;
        this.RowSelection = new TreeDataGridRowSelectionModel(source);
        this._columns = new Set();
        this._primary = null;
        this._anchorColumn = null;
        this._rangeColumn = null;
        this.SelectionChanged = new Signal();
        this.StateChanged = new Signal();
        this.SelectedIndexes = new CellIndexes(this);
        this._batch = 0;
        this._changed = false;
        this._off = [this.RowSelection.StateChanged.Subscribe(() => this._change()), source.Columns.CollectionChanged.Subscribe(() => { const valid = new Set(source.Columns); for (const c of this._columns)
                if (!valid.has(c))
                    this._columns.delete(c); if (!valid.has(this._primary))
                this._primary = this._columns.values().next().value ?? null; this._change(); })];
    }
    get Source() { return this.RowSelection.Source; }
    set Source(v) { this.RowSelection.Source = v; }
    get Count() { return this._columns.size * this.RowSelection.Count; }
    get _columnIndexes() { return Array.from(this._columns, c => this._grid.Columns.IndexOf(c)).filter(i => i >= 0); }
    get SingleSelect() { return this.RowSelection.SingleSelect; }
    set SingleSelect(v) { this._update(() => { this.RowSelection.SingleSelect = v; if (v && this._columns.size > 1)
        this._columns = new Set([this._primary]); }); }
    get SelectedIndex() { return new CellIndex(this._primary ? this._grid.Columns.IndexOf(this._primary) : -1, this.RowSelection.SelectedIndex); }
    set SelectedIndex(v) { this.SetSelectedRange(v, 1, 1); }
    get AnchorIndex() { return new CellIndex(this._grid.Columns.IndexOf(this._anchorColumn), this.RowSelection.AnchorIndex); }
    get RangeAnchorIndex() { return new CellIndex(this._grid.Columns.IndexOf(this._rangeColumn), this.RowSelection.RangeAnchorIndex); }
    IsSelected(column, row) { if (column instanceof CellIndex) {
        row = column.RowIndex;
        column = column.ColumnIndex;
    } return column >= 0 && column < this._grid.Columns.Count && this._columns.has(this._grid.Columns.Get(column)) && this.RowSelection.IsSelected(row); }
    _change() { this._changed = true; if (!this._batch) {
        this._changed = false;
        this.SelectionChanged.Emit(this, new TreeDataGridCellSelectionChangedEventArgs());
        this.StateChanged.Emit(this);
    } }
    _update(fn) { if (this._disposed)
        throw new Error('Selection disposed.'); this._batch++; this.RowSelection.BeginBatchUpdate(); try {
        fn();
        this._changed = true;
    }
    finally {
        this.RowSelection.EndBatchUpdate();
        if (!--this._batch && this._changed)
            this._change();
    } }
    Clear() { this._update(() => { this._columns.clear(); this._primary = this._anchorColumn = this._rangeColumn = null; this.RowSelection.Clear(); }); }
    SetSelectedRange(start, columnCount, rowCount) {
        const s = this._grid, row = s.Rows.ModelIndexToRowIndex(start.RowIndex);
        if (!columnCount || !rowCount || start.ColumnIndex < 0 || start.ColumnIndex >= s.Columns.Count || row < 0) {
            this.Clear();
            return;
        }
        const end = (a, n, size) => clamp(a + n - Math.sign(n), 0, size - 1);
        const ec = end(start.ColumnIndex, this.SingleSelect ? 1 : columnCount, s.Columns.Count), er = end(row, this.SingleSelect ? 1 : rowCount, s.Rows.Count);
        this._update(() => { this._columns.clear(); this._primary = s.Columns.Get(start.ColumnIndex); this._columns.add(this._primary); for (let i = Math.min(start.ColumnIndex, ec); i <= Math.max(start.ColumnIndex, ec); i++)
            this._columns.add(s.Columns.Get(i)); this.RowSelection.SelectedIndex = start.RowIndex; for (let i = Math.min(row, er); i <= Math.max(row, er); i++)
            this.RowSelection.Select(s.Rows.RowIndexToModelIndex(i)); this._anchorColumn = this._primary; this._rangeColumn = s.Columns.Get(ec); this.RowSelection.AnchorIndex = start.RowIndex; this.RowSelection.RangeAnchorIndex = s.Rows.RowIndexToModelIndex(er); });
    }
    SelectAll() { if (this._grid.Rows.Count)
        this.SetSelectedRange(new CellIndex(0, this._grid.Rows.RowIndexToModelIndex(0)), this._grid.Columns.Count, this._grid.Rows.Count); }
    Dispose() { if (this._disposed)
        return; this.Clear(); disposeAll(this._off); this.RowSelection.Dispose(); this._disposed = true; this.SelectionChanged.Clear(); this.StateChanged.Clear(); }
}
