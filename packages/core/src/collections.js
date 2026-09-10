import { Signal, NotifyingBase } from './events.js';
export const NotifyCollectionChangedAction = Object.freeze({ Add: 'Add', Remove: 'Remove', Replace: 'Replace', Move: 'Move', Reset: 'Reset' });
const numeric = p => typeof p === 'string' && /^(0|[1-9]\d*)$/.test(p);
export function indexable(target) {
    return new Proxy(target, { get(t, p, r) { return numeric(p) ? t.Get(+p) : Reflect.get(t, p, r); }, set(t, p, v, r) { if (numeric(p)) {
            t.Set(+p, v);
            return true;
        } return Reflect.set(t, p, v, r); } });
}
export class ReadOnlyListBase {
    get Count() { return 0; }
    get length() { return this.Count; }
    Get(index) { throw new RangeError(`Index ${index} not found.`); }
    at(index) { return this.Get(index < 0 ? this.Count + index : index); }
    *[Symbol.iterator]() { for (let i = 0; i < this.Count; i++)
        yield this.Get(i); }
    ToArray() { return Array.from(this); }
    IndexOf(item) { for (let i = 0; i < this.Count; i++)
        if (this.Get(i) === item)
            return i; return -1; }
    Contains(item) { return this.IndexOf(item) >= 0; }
    map(fn) { return this.ToArray().map(fn); }
    forEach(fn) { for (let i = 0; i < this.Count; i++)
        fn(this.Get(i), i); }
}
export class ObservableList extends NotifyingBase {
    constructor(items = []) { super(); this._items = Array.from(items); this.CollectionChanged = new Signal(); this._batch = 0; this._pending = false; return indexable(this); }
    get Count() { return this._items.length; }
    get length() { return this.Count; }
    Get(i) { if (!Number.isInteger(i) || i < 0 || i >= this.Count)
        throw new RangeError('Index out of range.'); return this._items[i]; }
    at(i) { return this.Get(i < 0 ? this.Count + i : i); }
    Set(i, value) { const old = this.Get(i); this._validate([...this._items.slice(0, i), value, ...this._items.slice(i + 1)]); this._items[i] = value; this._emit('Replace', [value], [old], i, i); }
    _validate(_items) { }
    _emit(Action, NewItems = [], OldItems = [], NewStartingIndex = -1, OldStartingIndex = -1) {
        if (this._batch) {
            this._pending = true;
            return;
        }
        this.CollectionChanged.Emit(this, { Action, NewItems, OldItems, NewStartingIndex, OldStartingIndex });
        this.RaisePropertyChanged('Count');
    }
    Add(item) { this.Insert(this.Count, item); return this.Count - 1; }
    AddRange(items) { this.InsertRange(this.Count, items); }
    Insert(index, item) { this.InsertRange(index, [item]); }
    InsertRange(index, items) {
        if (index < 0 || index > this.Count)
            throw new RangeError('Index out of range.');
        if (typeof items === 'function') {
            const values = [];
            items(x => values.push(x));
            items = values;
        }
        const values = Array.from(items);
        if (!values.length)
            return;
        this._validate([...this._items.slice(0, index), ...values, ...this._items.slice(index)]);
        // Avoid argument-count limits when adding 100,000+ rows.
        this._items = this._items.slice(0, index).concat(values, this._items.slice(index));
        this._emit('Add', values, [], index, -1);
    }
    Remove(item) { const i = this.IndexOf(item); if (i < 0)
        return false; this.RemoveAt(i); return true; }
    RemoveAt(index) { this.RemoveRange(index, 1); }
    RemoveRange(index, count) { if (index < 0 || count < 0 || index + count > this.Count)
        throw new RangeError('Invalid range.'); if (!count)
        return; const old = this._items.splice(index, count); this._emit('Remove', [], old, -1, index); }
    Move(oldIndex, newIndex) { const item = this.Get(oldIndex); this.Get(newIndex); if (oldIndex === newIndex)
        return; this._items.splice(oldIndex, 1); this._items.splice(newIndex, 0, item); this._emit('Move', [item], [item], newIndex, oldIndex); }
    Clear() { if (!this.Count)
        return; const old = this._items; this._items = []; this._emit('Reset', [], old); }
    Reset(actionOrItems) {
        let next = this._items.slice();
        if (typeof actionOrItems === 'function') {
            const draft = new ObservableList(next);
            actionOrItems(draft);
            next = draft.ToArray();
        }
        else
            next = Array.from(actionOrItems ?? []);
        this._validate(next);
        const old = this._items;
        this._items = next;
        this._emit('Reset', next, old);
    }
    BeginUpdate() { if (!this._batch++)
        this._before = this._items.slice(); }
    EndUpdate() { if (!this._batch)
        throw new Error('Unbalanced EndUpdate.'); if (--this._batch === 0 && this._pending) {
        this._pending = false;
        this._emit('Reset', this._items.slice(), this._before);
    } if (!this._batch)
        this._before = null; }
    Batch(action) { this.BeginUpdate(); try {
        return action(this);
    }
    finally {
        this.EndUpdate();
    } }
    IndexOf(item) { return this._items.indexOf(item); }
    Contains(item) { return this.IndexOf(item) >= 0; }
    ToArray() { return this._items.slice(); }
    [Symbol.iterator]() { return this._items[Symbol.iterator](); }
    map(fn) { return this._items.map(fn); }
    forEach(fn) { this._items.forEach(fn); }
}
export class NotifyingListBase extends ObservableList {
}
export class TreeDataGridItemsSourceView extends ReadOnlyListBase {
    constructor(items = []) { super(); this.Items = items; this.CollectionChanged = new Signal(); this._list = Array.isArray(items) || items instanceof ObservableList ? items : Array.from(items); this._off = items.CollectionChanged?.Subscribe((s, e) => this.CollectionChanged.Emit(this, e)); return indexable(this); }
    get Count() { return this._list.Count ?? this._list.length; }
    Get(i) { if (i < 0 || i >= this.Count)
        throw new RangeError('Index out of range.'); return this._list.Get ? this._list.Get(i) : this._list[i]; }
    IndexOf(item) { return this._list.IndexOf ? this._list.IndexOf(item) : this._list.indexOf(item); }
    Dispose() { this._off?.(); this.CollectionChanged.Clear(); }
    static GetOrCreate(items) { return items instanceof TreeDataGridItemsSourceView ? items : new TreeDataGridItemsSourceView(items); }
}
export function listCount(list) { return list?.Count ?? list?.length ?? 0; }
export function listAt(list, index) { return list?.Get ? list.Get(index) : list?.[index]; }
export function listArray(list) { return Array.isArray(list) ? list : Array.from(list ?? []); }
/** Maps one collection index through an observable change, preserving occurrences, not just item identity. */
const resetMappings = new WeakMap();
export function mapChangedIndex(index, e) {
    const n = e.NewItems?.length ?? 0, o = e.OldItems?.length ?? 0, ni = e.NewStartingIndex, oi = e.OldStartingIndex;
    switch (e.Action) {
        case 'Add': return index >= ni ? index + n : index;
        case 'Remove': return index < oi ? index : index < oi + o ? -1 : index - o;
        case 'Replace': return index >= oi && index < oi + o ? -1 : index >= oi + o ? index + n - o : index;
        case 'Move':
            if (index >= oi && index < oi + o)
                return ni + index - oi;
            if (oi < ni && index >= oi + o && index < ni + o)
                return index - o;
            if (ni < oi && index >= ni && index < oi)
                return index + o;
            return index;
        case 'Reset': {
            let mapping = resetMappings.get(e);
            if (!mapping) {
                const positions = new Map();
                for (let i = 0; i < n; i++) {
                    const item = e.NewItems[i];
                    let q = positions.get(item);
                    if (!q)
                        positions.set(item, q = { list: [], next: 0 });
                    q.list.push(i);
                }
                mapping = new Int32Array(o);
                mapping.fill(-1);
                for (let i = 0; i < o; i++) {
                    const q = positions.get(e.OldItems[i]);
                    if (q && q.next < q.list.length)
                        mapping[i] = q.list[q.next++];
                }
                resetMappings.set(e, mapping);
            }
            return index >= 0 && index < mapping.length ? mapping[index] : -1;
        }
        default: return index;
    }
}
