import { NotifyingBase, pathAccessor } from './events.js';
import { ObservableList } from './collections.js';
import { GridLength, ListSortDirection } from './primitives.js';
export class ColumnOptions {
    constructor(options = {}) { Object.assign(this, { CanUserResizeColumn: null, CanUserSortColumn: null, MinWidth: new GridLength(30), MaxWidth: null, CompareAscending: null, CompareDescending: null }, options); }
}
export class TextColumnOptions extends ColumnOptions {
    constructor(options = {}) { super(); Object.assign(this, { TextWrapping: false, TextTrimming: 'CharacterEllipsis', StringFormat: null, TextAlignment: 'Left', BeginEditGestures: 'DoubleTap,F2', Culture: null }, options); }
}
export class CheckBoxColumnOptions extends ColumnOptions {
    constructor(options = {}) { super(options); this.IsThreeState = !!options.IsThreeState; }
}
export class ColumnBase extends NotifyingBase {
    constructor(header, width = null, options = null, id = null) {
        super();
        this.Id = id ?? String(header ?? '');
        this.Header = header;
        this.Options = options instanceof ColumnOptions ? options : new ColumnOptions(options ?? {});
        this._width = GridLength.Parse(width);
        this._visible = true;
        this._presentationKey = null;
        this._sortDirection = null;
        this.Tag = null;
    }
    get Width() { return this._width; }
    set Width(v) { v = GridLength.Parse(v); if (!this._width.Equals(v))
        this.RaiseAndSetIfChanged('_width', v, 'Width'); }
    get IsVisible() { return this._visible; }
    set IsVisible(v) { this.RaiseAndSetIfChanged('_visible', !!v, 'IsVisible'); }
    get PresentationKey() { return this._presentationKey; }
    set PresentationKey(v) { this.RaiseAndSetIfChanged('_presentationKey', v, 'PresentationKey'); }
    get SortDirection() { return this._sortDirection; }
    set SortDirection(v) { this.RaiseAndSetIfChanged('_sortDirection', v, 'SortDirection'); }
    GetComparison() { return null; }
    Accept(visitor) { return visitor.Visit(this); }
}
export function compareValues(a, b) { if (a == null)
    return b == null ? 0 : -1; if (b == null)
    return 1; if (a === b)
    return 0; if (typeof a === 'number' && typeof b === 'number')
    return (Number.isNaN(a) ? -1 : Number.isNaN(b) ? 1 : a - b); if (typeof a === 'string' && typeof b === 'string')
    return a.localeCompare(b); return a < b ? -1 : a > b ? 1 : 0; }
export class ValueColumn extends ColumnBase {
    constructor(header, getter, setter = null, width = null, options = null, id = null) {
        super(header, width, options, id);
        this.PropertyName = typeof getter === 'string' ? getter : null;
        this.Getter = typeof getter === 'string' ? pathAccessor(getter) : getter;
        if (typeof this.Getter !== 'function')
            throw new TypeError('A column requires an accessor.');
        this.Setter = setter === true && this.PropertyName ? this.Getter.Set : setter;
        if (this.Setter != null && typeof this.Setter !== 'function')
            throw new TypeError('Setter must be a function.');
        this.GetterExpression = null;
    }
    static FromDelegate(header, getter, propertyName = null, setter = null, width = null, options = null, id = null) { const c = new ValueColumn(header, getter, setter, width, options, id); c.PropertyName = propertyName; return c; }
    GetValue(model) { return this.Getter(model); }
    SetValue(model, value) { if (!this.Setter)
        throw new Error('Column is read-only.'); this.Setter(model, value); }
    GetComparison(direction) {
        if (this.Options.CanUserSortColumn === false)
            return null;
        const custom = direction === ListSortDirection.Ascending ? this.Options.CompareAscending : this.Options.CompareDescending;
        if (custom)
            return custom;
        const sign = direction === ListSortDirection.Ascending ? 1 : -1;
        return (a, b) => sign * compareValues(a == null ? null : this.GetValue(a), b == null ? null : this.GetValue(b));
    }
}
export class TextColumn extends ValueColumn {
    constructor(header, getter, setterOrWidth = null, widthOrOptions = null, optionsOrId = null, id = null) {
        if (typeof setterOrWidth === 'function' || setterOrWidth === true || setterOrWidth === null) {
            super(header, getter, setterOrWidth, widthOrOptions, optionsOrId, id);
        }
        else
            super(header, getter, null, setterOrWidth, widthOrOptions, optionsOrId);
    }
}
export class CheckBoxColumn extends ValueColumn {
    constructor(header, getter, setter = null, width = null, options = null, id = null) { super(header, getter, setter, width, options, id); this.PresentationKey = 'CheckBox'; this.IsThreeState = !!options?.IsThreeState; this.BooleanGetter = this.IsThreeState ? null : this.Getter; this.BooleanSetter = this.IsThreeState ? null : this.Setter; }
}
export class TemplateColumn extends ValueColumn {
    constructor(header, presentationKey, width = null, options = null, id = null) { if (presentationKey == null)
        throw new TypeError('Presentation key required.'); super(header, m => m, null, width, options, id); this.PresentationKey = presentationKey; }
    GetComparison(direction) { return this.Options.CanUserSortColumn === false ? null : (direction === ListSortDirection.Ascending ? this.Options.CompareAscending : this.Options.CompareDescending); }
}
export class HierarchicalExpanderColumn {
    constructor(inner, childSelector, hasChildrenSelector = null, isExpandedSelector = null, setIsExpanded = null) {
        if (!inner || !childSelector)
            throw new TypeError('Inner column and child accessor required.');
        this.Inner = inner;
        this.ChildSelector = typeof childSelector === 'string' ? pathAccessor(childSelector) : childSelector;
        this.HasChildrenSelector = typeof hasChildrenSelector === 'string' ? pathAccessor(hasChildrenSelector) : hasChildrenSelector;
        this.IsExpandedSelector = typeof isExpandedSelector === 'string' ? pathAccessor(isExpandedSelector) : isExpandedSelector;
        this.SetIsExpanded = setIsExpanded ?? (typeof isExpandedSelector === 'string' ? this.IsExpandedSelector.Set : null);
    }
    get Id() { return this.Inner.Id; }
    get Header() { return this.Inner.Header; }
    get Options() { return this.Inner.Options; }
    get PropertyChanged() { return this.Inner.PropertyChanged; }
    get Width() { return this.Inner.Width; }
    set Width(v) { this.Inner.Width = v; }
    get IsVisible() { return this.Inner.IsVisible; }
    set IsVisible(v) { this.Inner.IsVisible = v; }
    get PresentationKey() { return this.Inner.PresentationKey; }
    set PresentationKey(v) { this.Inner.PresentationKey = v; }
    get SortDirection() { return this.Inner.SortDirection; }
    set SortDirection(v) { this.Inner.SortDirection = v; }
    get Tag() { return this.Inner.Tag; }
    set Tag(v) { this.Inner.Tag = v; }
    GetModelIsExpanded(model) { return this.IsExpandedSelector?.(model) ?? null; }
    SetModelIsExpanded(row) { this.SetIsExpanded?.(row.Model, row.IsExpanded); }
    HasChildren(model) { if (this.HasChildrenSelector)
        return !!this.HasChildrenSelector(model); const c = this.GetChildModels(model); return !!(c?.Count ?? c?.length ?? (c && Array.from(c).length)); }
    GetChildModels(model) { return this.ChildSelector(model); }
    GetValue(model) { return this.Inner.GetValue?.(model); }
    SetValue(model, value) { return this.Inner.SetValue(model, value); }
    GetComparison(direction) { return this.Inner.GetComparison(direction); }
    Accept(visitor) { return visitor.Visit(this); }
}
export class ColumnList extends ObservableList {
    _validate(items) { if (new Set(items).size !== items.length)
        throw new Error('A column instance can only appear once.'); if (items.some(c => !c || typeof c.Accept !== 'function'))
        throw new TypeError('Invalid column.'); this.Validate?.(items); }
    SetColumnWidth(index, width) { this.Get(index).Width = width; }
}
export class FuncComparer {
    constructor(compare) { this._compare = compare; }
    Compare(a, b) { return this._compare(a, b); }
}
