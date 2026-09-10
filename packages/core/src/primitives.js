export const GridUnitType = Object.freeze({ Auto: 'Auto', Pixel: 'Pixel', Star: 'Star' });
export const ListSortDirection = Object.freeze({ Ascending: 'Ascending', Descending: 'Descending' });
export const RowDropPosition = Object.freeze({ None: 'None', Before: 'Before', After: 'After', Inside: 'Inside' });
export const RowMoveEffects = Object.freeze({ None: 'None', Move: 'Move', Copy: 'Copy', Link: 'Link' });
export const TreeDataGridSelectionMode = Object.freeze({ Row: 0, Cell: 1, Multiple: 2 });
export class GridLength {
    constructor(value = 1, type = GridUnitType.Pixel) {
        if (!Object.values(GridUnitType).includes(type) || !Number.isFinite(value) || value < 0)
            throw new RangeError('Invalid grid length.');
        this.Value = value;
        this.GridUnitType = type;
        Object.freeze(this);
    }
    get IsAbsolute() { return this.GridUnitType === GridUnitType.Pixel; }
    get IsAuto() { return this.GridUnitType === GridUnitType.Auto; }
    get IsStar() { return this.GridUnitType === GridUnitType.Star; }
    Equals(other) { return other instanceof GridLength && this.Value === other.Value && this.GridUnitType === other.GridUnitType; }
    ToString() { return this.IsAuto ? 'Auto' : `${this.Value}${this.IsStar ? '*' : ''}`; }
    toString() { return this.ToString(); }
    static Parse(value) {
        if (value instanceof GridLength)
            return value;
        if (value == null || String(value).toLowerCase() === 'auto')
            return GridLength.Auto;
        if (typeof value === 'number')
            return new GridLength(value);
        const s = String(value).trim();
        if (s.endsWith('*'))
            return new GridLength(s === '*' ? 1 : Number(s.slice(0, -1)), GridUnitType.Star);
        if (!/^\d+(\.\d+)?(?:px)?$/i.test(s))
            throw new RangeError(`Invalid grid length: ${s}`);
        return new GridLength(parseFloat(s));
    }
    static Auto = new GridLength(1, GridUnitType.Auto);
}
export class IndexPath {
    constructor(...indexes) {
        let a = indexes.length === 1 ? indexes[0] : indexes;
        if (a instanceof IndexPath)
            a = a._path;
        if (a == null || a === -1)
            a = [];
        if (typeof a === 'string')
            a = a.replace(/[()]/g, '').split(/[.,/]/).filter(Boolean).map(Number);
        if (typeof a === 'number')
            a = [a];
        a = Array.from(a);
        if (a.some(i => !Number.isInteger(i) || i < 0))
            throw new RangeError('Index paths contain non-negative integers.');
        this._path = Object.freeze(a);
        this.Key = a.join('.');
        a.forEach((n, i) => Object.defineProperty(this, i, { value: n, enumerable: true }));
        Object.freeze(this);
    }
    static From(index) { return index instanceof IndexPath ? index : new IndexPath(index); }
    static Unselected = new IndexPath();
    get Count() { return this._path.length; }
    get length() { return this.Count; }
    Get(index) { if (index < 0 || index >= this.Count)
        throw new RangeError('Index out of range.'); return this._path[index]; }
    CompareTo(other) { other = IndexPath.From(other); for (let i = 0; i < Math.min(this.Count, other.Count); i++)
        if (this[i] !== other[i])
            return Math.sign(this[i] - other[i]); return Math.sign(this.Count - other.Count); }
    Equals(other) { return other != null && this.CompareTo(other) === 0; }
    Append(index) { return new IndexPath([...this, index]); }
    IsAncestorOf(other) { other = IndexPath.From(other); return this.Count < other.Count && this._path.every((x, i) => x === other[i]); }
    IsParentOf(other) { other = IndexPath.From(other); return other.Count === this.Count + 1 && this.IsAncestorOf(other); }
    Slice(start, length = this.Count - start) { if (start < 0 || length < 0 || start + length > this.Count)
        throw new RangeError('Invalid slice.'); return new IndexPath(this._path.slice(start, start + length)); }
    get Parent() { return this.Slice(0, Math.max(0, this.Count - 1)); }
    ToArray() { return this._path.slice(); }
    ToString() { return `(${this.Key})`; }
    toString() { return this.ToString(); }
    toJSON() { return this.ToArray(); }
    GetHashCode() { let h = -504981047; for (const i of this)
        h = Math.imul(h, -1521134295) + i | 0; return h; }
    [Symbol.iterator]() { return this._path[Symbol.iterator](); }
}
export class CellIndex {
    constructor(columnIndex = -1, rowIndex = IndexPath.Unselected) { this.ColumnIndex = columnIndex; this.RowIndex = IndexPath.From(rowIndex); Object.freeze(this); }
    Equals(other) { return other instanceof CellIndex && this.ColumnIndex === other.ColumnIndex && this.RowIndex.Equals(other.RowIndex); }
    ToString() { return `${this.ColumnIndex}:${this.RowIndex}`; }
}
export class IndexRange {
    constructor(begin, end = begin) { this.Begin = Math.min(begin, end); this.End = Math.max(begin, end); }
    get Count() { return this.End - this.Begin + 1; }
    Contains(index) { return index >= this.Begin && index <= this.End; }
    Intersects(other) { return this.Begin <= other.End && other.Begin <= this.End; }
    [Symbol.iterator]() { let i = this.Begin, e = this.End; return { next: () => i <= e ? { value: i++, done: false } : { done: true } }; }
}
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
