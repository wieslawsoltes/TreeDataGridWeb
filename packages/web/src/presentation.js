import { Signal, ColumnLayout, GridLength, ValueColumn, CheckBoxColumn, TemplateColumn, HierarchicalExpanderColumn, disposeAll } from '../../core/index.js';
export class PresentationRegistry extends Map {
    Add(key, value) { if (this.has(key))
        throw new Error(`Presentation '${key}' already exists.`); this.set(key, value); }
    Set(key, value) { this.set(key, value); }
}
export class TreeDataGridPresentationOptions {
    constructor() { this.Columns = new PresentationRegistry(); }
    Register(key, presentation) { this.Columns.set(key, presentation); return this; }
}
export class ValueCell {
    constructor(column, row) { this.Column = column; this.Row = row; this.Model = row.Model; this.IsEditing = false; this.PropertyChanged = new Signal(); }
    get Value() { return this.Column.GetValue(this.Model); }
    set Value(value) { this.Column.SetValue(this.Model, value); this.PropertyChanged.Emit(this, { PropertyName: 'Value' }); }
    get CanEdit() { return typeof this.Column.Setter === 'function'; }
    BeginEdit() { if (!this.CanEdit)
        return false; this._original = this.Value; this.EditValue = this._original; this.IsEditing = true; return true; }
    CancelEdit() { this.IsEditing = false; this.EditValue = this._original; }
    EndEdit() { if (!this.IsEditing)
        return; this.Value = this.EditValue; this.IsEditing = false; }
    Dispose() { this.PropertyChanged.Clear(); }
}
export class TextCell extends ValueCell {
}
export class CheckBoxCell extends ValueCell {
    get IsThreeState() { return this.Column.IsThreeState; }
}
export class TemplateCell extends ValueCell {
    constructor(column, row, template) { super(column, row); this.Template = template; }
    get CanEdit() { return !!this.Template?.edit || super.CanEdit; }
}
export class ExpanderCell {
    constructor(inner, row) { this.Inner = inner; this.Row = row; this.Model = row.Model; }
    get IsExpanded() { return this.Row.IsExpanded; }
    set IsExpanded(v) { this.Row.IsExpanded = v; }
    get ShowExpander() { return this.Row.ShowExpander; }
    get Indent() { return this.Row.Indent; }
    get Value() { return this.Inner.Value; }
    set Value(v) { this.Inner.Value = v; }
    get CanEdit() { return this.Inner.CanEdit; }
    Dispose() { this.Inner.Dispose(); }
}
export class CellColumnOptions {
    constructor(options = {}) { Object.assign(this, { MinWidth: 30, MaxWidth: Infinity }, options); }
}
export class CellColumnBase {
    constructor(column, options = {}) { this.CoreColumn = column; this.Options = new CellColumnOptions(options); this.ActualWidth = 0; this.NeedsNaturalWidth = true; }
    get Header() { return this.CoreColumn.Header; }
    get Width() { return this.CoreColumn.Width; }
    set Width(v) { this.CoreColumn.Width = GridLength.Parse(v); }
    CreateCell(row) { return new ValueCell(this.CoreColumn, row); }
    Dispose() { }
}
export class TemplateCellColumn extends CellColumnBase {
    constructor(column, template, editTemplate = null, options = {}) { super(column, options); this.Template = typeof template === 'function' ? { create: template } : template; if (editTemplate)
        this.Template = { ...this.Template, edit: editTemplate }; }
    CreateCell(row) { return new TemplateCell(this.CoreColumn, row, this.Template); }
}
class BuiltInCellColumn extends CellColumnBase {
    CreateCell(row) { const c = this.CoreColumn; return c instanceof CheckBoxColumn ? new CheckBoxCell(c, row) : new TextCell(c, row); }
}
class ExpanderCellColumn extends CellColumnBase {
    constructor(core, inner) { super(core); this.Inner = inner; }
    CreateCell(row) { return new ExpanderCell(this.Inner.CreateCell(row), row); }
    Dispose() { this.Inner.Dispose(); }
}
function createColumn(column, options) {
    if (column instanceof HierarchicalExpanderColumn)
        return new ExpanderCellColumn(column, createColumn(column.Inner, options));
    const registration = options?.Columns?.get(column.PresentationKey);
    if (registration) {
        const custom = typeof registration === 'function' ? registration(column) : registration;
        if (custom?.CreateCell)
            return custom;
        if (custom?.create)
            return new TemplateCellColumn(column, custom);
        throw new Error(`Invalid presentation '${column.PresentationKey}'.`);
    }
    if (column instanceof TemplateColumn)
        throw new Error(`Register presentation '${column.PresentationKey}' before assigning Model.`);
    return new BuiltInCellColumn(column);
}
export class TreeDataGridPresentation {
    static Create(model, options = new TreeDataGridPresentationOptions()) { return new TreeDataGridPresentation(model, options); }
    constructor(model, options) { this.Model = model; this.Options = options; this.Layout = new ColumnLayout(); this.Columns = []; this.Changed = new Signal(); this.Sorted = new Signal(); this._off = []; this._columnMap = new Map(); this._syncColumns(); }
    get Rows() { return this.Model.Rows; }
    _syncColumns() {
        const keep = new Set(this.Model.Columns);
        for (const [c, v] of this._columnMap)
            if (!keep.has(c)) {
                v.Dispose();
                this._columnMap.delete(c);
                this.Layout.Measured.delete(c);
            }
        this.Columns = Array.from(this.Model.Columns, c => { let view = this._columnMap.get(c); if (!view) {
            view = createColumn(c, this.Options);
            this._columnMap.set(c, view);
        } return view; });
    }
    Resume() { if (this._disposed)
        throw new Error('Presentation disposed.'); if (this._off.length)
        return; this._syncColumns(); this._off.push(this.Model.Changed.Subscribe((_, e) => { if (e.Kind === 'Columns')
        this._syncColumns(); if (e.Kind === 'Column' && e.PropertyName === 'PresentationKey') {
        this._columnMap.get(e.Column)?.Dispose();
        this._columnMap.delete(e.Column);
        this._syncColumns();
    } this.Changed.Emit(this, e); }), this.Model.Sorted.Subscribe(() => this.Sorted.Emit(this))); }
    Suspend() { disposeAll(this._off); }
    Dispose() { if (this._disposed)
        return; this.Suspend(); for (const c of this._columnMap.values())
        c.Dispose(); this._columnMap.clear(); this.Columns = []; this.Changed.Clear(); this.Sorted.Clear(); this._disposed = true; }
}
export class TreeDataGridElementFactory {
    constructor() { this._pools = new Map(); this.Created = 0; this.Reused = 0; this.MaxPoolSize = 128; }
    GetElement(key, create) { const pool = this._pools.get(key); if (pool?.length) {
        this.Reused++;
        return pool.pop();
    } this.Created++; return create(); }
    RecycleElement(key, element) { let pool = this._pools.get(key); if (!pool)
        this._pools.set(key, pool = []); if (pool.length < this.MaxPoolSize)
        pool.push(element); }
    Clear() { this._pools.clear(); }
}
const numberFormats = new Map();
export function formatValue(column, value, model) {
    const o = column.Options ?? {};
    if (o.Formatter)
        return String(o.Formatter(value, model) ?? '');
    if (value == null)
        return '';
    if (o.StringFormat) {
        const fmt = o.StringFormat;
        if (typeof fmt === 'function')
            return String(fmt(value));
        if (typeof value === 'number' && /[nN]\d/.test(fmt)) {
            const digits = Number(fmt.match(/[nN](\d)/)[1]);
            const key = (o.Culture ?? '') + ':' + digits;
            let formatter = numberFormats.get(key);
            if (!formatter) {
                formatter = new Intl.NumberFormat(o.Culture ?? undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
                numberFormats.set(key, formatter);
            }
            return formatter.format(value);
        }
        return String(fmt).replace(/\{0(?::[^}]+)?\}/g, String(value));
    }
    return value instanceof Date ? value.toLocaleDateString(o.Culture ?? undefined) : String(value);
}
export function parseValue(column, text, old) { const o = column.Options ?? {}; if (o.ValueParser)
    return o.ValueParser(text, old); if (typeof old === 'number') {
    const n = Number(text);
    if (!text.trim() || !Number.isFinite(n))
        throw new Error('Enter a valid number.');
    return n;
} if (typeof old === 'boolean') {
    if (!/^(true|false|0|1)$/i.test(text))
        throw new Error('Enter true or false.');
    return /^(true|1)$/i.test(text);
} if (old instanceof Date) {
    const d = new Date(text);
    if (Number.isNaN(+d))
        throw new Error('Enter a valid date.');
    return d;
} return text; }
