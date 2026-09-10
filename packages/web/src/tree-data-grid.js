import { Signal, IndexPath, CellIndex, RowHeightIndex, GridLength, ListSortDirection, TreeDataGridSelectionMode, TreeDataGridRowSelectionModel, TreeDataGridCellSelectionModel, FlatTreeDataGridSource, HierarchicalTreeDataGridSource, HierarchicalExpanderColumn, CheckBoxColumn, TemplateColumn, ColumnList, observeSelector, disposeAll, clamp } from '../../core/index.js';
import { TreeDataGridPresentation, TreeDataGridPresentationOptions, TreeDataGridElementFactory, ExpanderCell, TemplateCell, formatValue, parseValue } from './presentation.js';
import { gridStyles } from './styles.js';
const MAX_EXTENT = 8000000;
let gridId = 0;
const drags = new Map();
const eventNames = ['CellClearing', 'CellPrepared', 'CellValueChanged', 'RowClearing', 'RowPrepared', 'RowDragStarted', 'RowDragOver', 'RowDrop', 'SelectionChanging', 'SelectionChanged', 'CellEditStarting', 'CellEditEnding', 'CellEditEnded', 'Rendered', 'Error', 'RowDoubleTapped'];
const eventKeys = new Map(eventNames.map(name => [name, name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()]));
const kebab = name => eventKeys.get(name) ?? name;
function dom(tag, cls, text) { const node = document.createElement(tag); if (cls)
    node.className = cls; if (text != null)
    node.textContent = text; return node; }
function innerColumn(column) { return column instanceof HierarchicalExpanderColumn ? column.Inner : column; }
const triangle = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 3 5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/** Reusable, dependency-free custom element. Core rows are consumed directly, never adapted. */
export class TreeDataGrid extends HTMLElement {
    constructor() {
        super();
        this._id = ++gridId;
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `<style>${gridStyles}</style><div class="root" role="treegrid" tabindex="0" aria-label="Data grid"><div class="header-clip"><div class="header-row" role="row" aria-rowindex="1"></div></div><div class="viewport"><div class="extent" role="rowgroup"></div></div><div class="empty" hidden><strong>No rows to display</strong><span>Change the filter or add an item.</span></div><div class="live" role="status" aria-live="polite"></div></div>`;
        const q = s => this.shadowRoot.querySelector(s);
        this._root = q('.root');
        this._headerClip = q('.header-clip');
        this._header = q('.header-row');
        this._viewport = q('.viewport');
        this._extent = q('.extent');
        this._empty = q('.empty');
        this._live = q('.live');
        for (const name of eventNames)
            this[name] = new Signal();
        this._model = null;
        this._source = null;
        this._options = new TreeDataGridPresentationOptions();
        this._presentation = null;
        this._presentationOff = [];
        this._off = [];
        this._selectionOff = [];
        this._realized = new Map();
        this._heightCache = new Map();
        this._heights = new RowHeightIndex();
        this._elementFactory = new TreeDataGridElementFactory();
        this._frame = 0;
        this._raf = 0;
        this._rowHeight = null;
        this._estimate = 36;
        this._overscan = 160;
        this._frozen = 0;
        this._showHeaders = true;
        this._canResize = false;
        this._canSort = true;
        this._canReorder = true;
        this._autoDrag = false;
        this._gridLines = false;
        this._geometryDirty = true;
        this._layoutDirty = true;
        this._dataDirty = true;
        this._headerDirty = true;
        this._valueDirty = false;
        this._selectionDirty = true;
        this._active = { row: 0, column: 0 };
        this._logicalTop = 0;
        this._typeBuffer = '';
        this._undo = [];
        this._redo = [];
        this._selectionMode = undefined;
        this._disposed = false;
        this._itemsSource = null;
        this.ColumnDefinitions = new ColumnList();
        this.ColumnDefinitions.CollectionChanged.Subscribe(() => this._declarative());
        this.Stats = { Rows: 0, RealizedRows: 0, RealizedCells: 0, FrameMilliseconds: 0, MeasuredRows: 0, TotalHeight: 0, CreatedElements: 0, ReusedElements: 0 };
        this._viewport.addEventListener('scroll', () => { this._headerClip.scrollLeft = this._viewport.scrollLeft; this._schedule(); }, { passive: true });
        this._viewport.addEventListener('wheel', e => { if (this._heights.Total > MAX_EXTENT && e.deltaY && !e.ctrlKey) {
            e.preventDefault();
            const d = e.deltaY * (e.deltaMode === 1 ? this._estimate : e.deltaMode === 2 ? this._viewport.clientHeight : 1);
            this._setLogicalScroll(this._logicalScroll() + d);
        } }, { passive: false });
        this._root.addEventListener('click', e => this._click(e));
        this._root.addEventListener('dblclick', e => this._doubleClick(e));
        this._root.addEventListener('keydown', e => this._keyDown(e));
        this._root.addEventListener('pointerdown', e => this._pointerDown(e));
        this._root.addEventListener('contextmenu', e => this._contextMenu(e));
        this._root.addEventListener('dragstart', e => this._dragStart(e));
        this._root.addEventListener('dragover', e => this._dragOver(e));
        this._root.addEventListener('drop', e => this._drop(e));
        this._root.addEventListener('dragend', () => this._dragEnd());
        this._root.addEventListener('dragleave', e => { if (!this._root.contains(e.relatedTarget))
            this._clearDrop(); });
        this._root.addEventListener('copy', e => { if (this._editing)
            return; const text = this.GetSelectionText(); if (text) {
            e.clipboardData.setData('text/plain', text);
            e.preventDefault();
        } });
        this._root.addEventListener('paste', e => { if (this._editing)
            return; e.preventDefault(); try {
            this.Paste(e.clipboardData.getData('text/plain'));
        }
        catch (error) {
            this._error(error);
        } });
        this._root.addEventListener('focusout', () => { queueMicrotask(() => { if (this._editing && !this._root.contains(this.shadowRoot.activeElement))
            this.CommitEdit(); }); });
        this._resizeObserver = new ResizeObserver(() => { const w = this._viewport.clientWidth; if (Math.abs(w - (this._lastWidth ?? 0)) > .5) {
            this._lastWidth = w;
            this._layoutDirty = true;
            this._invalidateHeights();
        } this._schedule(); });
        this._rowObserver = new ResizeObserver(entries => this._measureRows(entries));
    }
    static get observedAttributes() { return ['aria-label', 'row-height', 'frozen-columns', 'show-column-headers']; }
    attributeChangedCallback(name, old, value) { if (old === value)
        return; if (name === 'aria-label')
        this._root?.setAttribute('aria-label', value ?? 'Data grid'); if (name === 'row-height')
        this.RowHeight = value === 'auto' || value == null ? null : Number(value); if (name === 'frozen-columns')
        this.FrozenColumns = Number(value ?? 0); if (name === 'show-column-headers')
        this.ShowColumnHeaders = value !== 'false'; }
    connectedCallback() { if (this._disposed)
        return; this._resizeObserver.observe(this._viewport); this._ensurePresentation(); this._presentation?.Resume(); this._subscribeSelection(); this._geometryDirty = this._dataDirty = this._layoutDirty = this._headerDirty = true; this._schedule(); }
    disconnectedCallback() { this._resizeObserver.disconnect(); this._rowObserver.disconnect(); this._presentation?.Suspend(); disposeAll(this._selectionOff); cancelAnimationFrame(this._raf); this._raf = 0; this.CancelEdit(); this._clearRows(); this._dragEnd(); this._resizeAbort?.abort(); }
    get Model() { return this._model; }
    set Model(value) { if (this._model === value && !this._source)
        return; this._model = value; this._source = null; this._replacePresentation(); }
    get Source() { return this._source; }
    set Source(value) { if (this._source === value && !this._model)
        return; this._source = value; this._model = null; this._replacePresentation(); }
    get ActiveModel() { return this._model ?? this._source; }
    get PresentationOptions() { return this._options; }
    set PresentationOptions(value) { this._options = value ?? new TreeDataGridPresentationOptions(); this._replacePresentation(); }
    get Presentation() { return this._presentation; }
    get Rows() { return this.ActiveModel?.Rows ?? null; }
    get Columns() { return this._presentation?.Columns ?? []; }
    get RowSelection() { return this.Source?.RowSelection ?? null; }
    get ColumnSelection() { return this.Source?.Selection instanceof TreeDataGridCellSelectionModel ? this.Source.Selection : null; }
    get Scroll() { const g = this; return { get Offset() { return { X: g._viewport.scrollLeft, Y: g._logicalScroll() }; }, set Offset(v) { g._viewport.scrollLeft = v.X ?? 0; g._setLogicalScroll(v.Y ?? 0); }, get Extent() { return { Width: g._presentation?.Layout.Geometry.Total ?? 0, Height: g._heights.Total }; }, get Viewport() { return { Width: g._viewport.clientWidth, Height: g._viewport.clientHeight }; } }; }
    get RowsPresenter() { return this._extent; }
    get ColumnHeadersPresenter() { return this._header; }
    get ElementFactory() { return this._elementFactory; }
    set ElementFactory(v) { if (!v?.GetElement)
        throw new TypeError('Invalid element factory.'); this._clearRows(); this._elementFactory = v; this._dataDirty = true; this._schedule(); }
    get RowHeight() { return this._rowHeight; }
    set RowHeight(v) { v = v == null || v === 'Auto' || v === 'auto' ? null : Number(v); if (v != null && (!Number.isFinite(v) || v < 12))
        throw new RangeError('Row height must be at least 12 pixels.'); this._rowHeight = v; this._invalidateHeights(); this._schedule(); }
    get EstimatedRowHeight() { return this._estimate; }
    set EstimatedRowHeight(v) { if (!Number.isFinite(v) || v < 12)
        throw new RangeError('Invalid estimated height.'); this._estimate = v; this._invalidateHeights(); this._schedule(); }
    get Overscan() { return this._overscan; }
    set Overscan(v) { this._overscan = Math.max(0, Number(v) || 0); this._schedule(); }
    get FrozenColumns() { return this._frozen; }
    set FrozenColumns(v) { this._frozen = Math.max(0, Math.floor(v) || 0); this._layoutDirty = this._dataDirty = this._headerDirty = true; this._schedule(); }
    get ShowColumnHeaders() { return this._showHeaders; }
    set ShowColumnHeaders(v) { this._showHeaders = !!v; this._headerClip.hidden = !v; this._schedule(); }
    get CanUserResizeColumns() { return this._canResize; }
    set CanUserResizeColumns(v) { this._canResize = !!v; this._headerDirty = true; this._schedule(); }
    get CanUserSortColumns() { return this._canSort; }
    set CanUserSortColumns(v) { this._canSort = !!v; this._headerDirty = true; this._schedule(); }
    get CanUserReorderColumns() { return this._canReorder; }
    set CanUserReorderColumns(v) { this._canReorder = !!v; this._headerDirty = true; this._schedule(); }
    get AutoDragDropRows() { return this._autoDrag; }
    set AutoDragDropRows(v) { this._autoDrag = !!v; for (const r of this._realized.values())
        r.el.draggable = !!v; }
    get ShowGridLines() { return this._gridLines; }
    set ShowGridLines(v) { this._gridLines = !!v; this._root.classList.toggle('grid-lines', !!v); }
    get SelectionMode() { return this._selectionMode ?? TreeDataGridSelectionMode.Row; }
    set SelectionMode(value) { this._selectionMode = Number(value); this._applySelectionMode(); }
    get ItemsSource() { return this._itemsSource; }
    set ItemsSource(v) { this._itemsSource = v; this._declarative(); }
    _declarative() { if (!this._itemsSource || !this.ColumnDefinitions.Count)
        return; this._generated?.Dispose(); const type = Array.from(this.ColumnDefinitions).some(c => c instanceof HierarchicalExpanderColumn) ? HierarchicalTreeDataGridSource : FlatTreeDataGridSource; this._generated = new type(this._itemsSource); this._generated.Columns.AddRange(this.ColumnDefinitions); this.Source = this._generated; }
    _applySelectionMode() { const model = this.ActiveModel; if (!model || this._selectionMode === undefined)
        return; const cell = !!(this._selectionMode & TreeDataGridSelectionMode.Cell); if (cell !== (model.Selection instanceof TreeDataGridCellSelectionModel))
        model.Selection = cell ? new TreeDataGridCellSelectionModel(model) : new TreeDataGridRowSelectionModel(model); if (model.Selection)
        model.Selection.SingleSelect = !(this._selectionMode & TreeDataGridSelectionMode.Multiple); this._subscribeSelection(); }
    _replacePresentation() { this.CancelEdit(); this._clearRows(); disposeAll(this._presentationOff); disposeAll(this._selectionOff); this._presentation?.Dispose(); this._presentation = null; this._heightCache.clear(); this._undo = []; this._redo = []; this._active = { row: 0, column: 0 }; this._viewport.scrollTop = 0; this._viewport.scrollLeft = 0; this._ensurePresentation(); this._geometryDirty = this._layoutDirty = this._dataDirty = this._headerDirty = true; this._schedule(); }
    _ensurePresentation() { if (this._presentation || !this.ActiveModel)
        return; this._presentation = TreeDataGridPresentation.Create(this.ActiveModel, this._options); this._presentationOff.push(this._presentation.Changed.Subscribe((_, e) => this._modelChanged(e))); if (this.isConnected)
        this._presentation.Resume(); this._applySelectionMode(); this._subscribeSelection(); }
    _modelChanged(e) {
        if (this._editing && !['Value', 'Selection'].includes(e.Kind))
            this.CancelEdit();
        if (e.Kind === 'Selection') {
            this._subscribeSelection();
            this._selectionDirty = true;
        }
        else if (e.Kind === 'Column' && e.PropertyName === 'SortDirection')
            this._headerDirty = true;
        else if (e.Kind === 'Column' || e.Kind === 'Columns') {
            this._layoutDirty = this._headerDirty = this._dataDirty = true;
            this._invalidateHeights();
        }
        else if (e.Kind === 'Value') {
            this._valueDirty = true;
            for (const r of this._realized.values())
                this._heightCache.delete(r.row);
        }
        else {
            this._geometryDirty = this._dataDirty = this._headerDirty = true;
        }
        this._schedule();
    }
    _subscribeSelection() { disposeAll(this._selectionOff); if (!this.isConnected)
        return; const selection = this.ActiveModel?.Selection; if (selection?.StateChanged)
        this._selectionOff.push(selection.StateChanged.Subscribe((_, e) => { this._selectionDirty = true; this._fire('SelectionChanged', { Selection: selection, ...e }); this._live.textContent = `${selection.Count} ${selection instanceof TreeDataGridCellSelectionModel ? 'cells' : 'rows'} selected`; this._schedule(); })); this._root.setAttribute('aria-multiselectable', String(selection?.SingleSelect === false)); }
    _fire(name, args = {}, cancelable = false) { this[name]?.Emit(this, args); const event = new CustomEvent(kebab(name), { detail: args, bubbles: true, composed: true, cancelable }); if (!this.dispatchEvent(event))
        args.Cancel = true; return args; }
    _error(error) { this._live.textContent = error.message ?? String(error); this._fire('Error', { Error: error }); }
    _schedule() { if (!this._raf && this.isConnected && !this._disposed)
        this._raf = requestAnimationFrame(() => { this._raf = 0; try {
            this._render();
        }
        catch (error) {
            this._error(error);
        } }); }
    InvalidateVisual() { this._valueDirty = this._layoutDirty = this._headerDirty = true; this._schedule(); }
    _invalidateHeights() { this._heightCache.clear(); this._geometryDirty = true; }
    InvalidateRowHeights() { this._invalidateHeights(); this._schedule(); }
    _logicalScroll() { const physical = Math.min(MAX_EXTENT, this._heights.Total), h = this._viewport.clientHeight, max = Math.max(0, this._heights.Total - h), pmax = Math.max(0, physical - h); return pmax > 0 ? this._viewport.scrollTop * max / pmax : 0; }
    _setLogicalScroll(value) { const total = this._heights.Total, h = this._viewport.clientHeight, max = Math.max(0, total - h), pmax = Math.max(0, Math.min(MAX_EXTENT, total) - h); this._viewport.scrollTop = max ? clamp(value, 0, max) * pmax / max : 0; this._schedule(); }
    _resetGeometry() {
        const rows = this.Rows, n = rows?.Count ?? 0;
        const anchor = this._topAnchor;
        this._heights.Reset(n, this._rowHeight ?? this._estimate);
        if (this._rowHeight == null)
            for (const [row, height] of this._heightCache) {
                const i = rows.ModelIndexToRowIndex(row.ModelIndex);
                if (i >= 0 && i < n && rows.Get(i) === row)
                    this._heights.Set(i, height);
                else
                    this._heightCache.delete(row);
            }
        this._extent.style.height = `${Math.min(MAX_EXTENT, this._heights.Total)}px`;
        if (anchor) {
            const i = rows?.ModelIndexToRowIndex(anchor.row.ModelIndex) ?? -1;
            if (i >= 0 && rows.Get(i) === anchor.row)
                this._setLogicalScroll(this._heights.Offset(i) + anchor.within);
        }
        this._geometryDirty = false;
    }
    _visibleColumnIndices() {
        const l = this._presentation.Layout, range = l.Geometry.Range(this._viewport.scrollLeft, this._viewport.clientWidth, 100);
        const selected = new Set();
        for (let i = 0; i < Math.min(this._frozen, l.Columns.length); i++)
            selected.add(i);
        for (let i = range.start; i < range.end; i++)
            selected.add(i);
        // Auto-height columns can opt into continuous realization while horizontally offscreen.
        if (this._rowHeight == null)
            l.Columns.forEach((c, i) => { if (c.Options?.AffectsRowHeight)
                selected.add(i); });
        return [...selected].sort((a, b) => a - b);
    }
    _render() {
        const start = performance.now();
        const p = this._presentation, rows = this.Rows;
        if (!p || !rows) {
            this._clearRows();
            this._header.replaceChildren();
            this._extent.style.height = '0px';
            this._empty.hidden = false;
            return;
        }
        if (this._geometryDirty)
            this._resetGeometry();
        if (this._layoutDirty) {
            const layout = p.Layout;
            layout.Calculate(this.ActiveModel.Columns, this._viewport.clientWidth);
            p.Columns.forEach(v => { const i = layout.Columns.indexOf(v.CoreColumn); v.ActualWidth = i >= 0 ? layout.Widths[i] : 0; });
            this._extent.style.width = `${Math.max(layout.Geometry.Total, this._viewport.clientWidth)}px`;
            this._header.style.width = `${layout.Geometry.Total}px`;
            this._layoutDirty = false;
            this._headerDirty = true;
        }
        const colIndexes = this._visibleColumnIndices(), signature = colIndexes.map(i => `${i}:${p.Layout.Widths[i]}`).join('|');
        if (signature !== this._colSignature) {
            this._colSignature = signature;
            this._dataDirty = this._headerDirty = true;
        }
        if (this._headerDirty) {
            this._renderHeader(colIndexes);
            this._headerDirty = false;
        }
        const top = this._logicalScroll(), height = this._viewport.clientHeight, range = this._heights.Range(top, height, this._overscan);
        this._logicalTop = top;
        if (this._editing && (this._editing.rowIndex < range.start || this._editing.rowIndex >= range.end) && !this.CommitEdit()) {
            this._setLogicalScroll(this._heights.Offset(this._editing.rowIndex));
            return;
        }
        if (this._dataDirty) {
            this._clearRows();
            this._dataDirty = false;
        }
        const base = top - this._viewport.scrollTop, reusable = [];
        for (const [i, record] of this._realized)
            if (i < range.start || i >= range.end) {
                reusable.push(record);
                this._realized.delete(i);
            }
        const fragment = document.createDocumentFragment();
        for (let i = range.start; i < range.end; i++) {
            let record = this._realized.get(i);
            const row = rows.Get(i);
            if (record && record.row !== row) {
                this._recycleRow(record);
                this._realized.delete(i);
                record = null;
            }
            if (!record) {
                if (reusable.length) {
                    record = reusable.pop();
                    this._rebindRow(record, i, row);
                }
                else {
                    record = this._prepareRow(i, row, colIndexes);
                    fragment.append(record.el);
                }
                this._realized.set(i, record);
            }
            if (this._valueDirty)
                for (const c of record.cells)
                    this._updateCell(c);
            record.el.style.transform = `translate3d(0,${this._heights.Offset(i) - base}px,0)`;
            record.el.style.width = `${p.Layout.Geometry.Total}px`;
            record.el.style.height = this._rowHeight == null ? '' : `${this._rowHeight}px`;
            record.el.style.minHeight = `${this._rowHeight ?? Math.max(this._estimate, this._heightCache.get(row) ?? 0)}px`;
            record.el.classList.toggle('selected', !(this.ActiveModel.Selection instanceof TreeDataGridCellSelectionModel) && !!this.ActiveModel.Selection?.IsSelected(row.ModelIndex));
            record.el.setAttribute('aria-selected', String(!(this.ActiveModel.Selection instanceof TreeDataGridCellSelectionModel) && !!this.ActiveModel.Selection?.IsSelected(row.ModelIndex)));
            for (const c of record.cells) {
                const cellSelected = this.ActiveModel.Selection instanceof TreeDataGridCellSelectionModel && this.ActiveModel.Selection.IsSelected(c.columnIndex, row.ModelIndex);
                c.el.classList.toggle('selected', cellSelected);
                c.el.setAttribute('aria-selected', String(cellSelected));
                const active = this._active.row === i && this._active.column === c.columnIndex;
                c.el.classList.toggle('active', active);
                if (active)
                    this._root.setAttribute('aria-activedescendant', c.el.id);
            }
        }
        for (const record of reusable)
            this._recycleRow(record);
        this._extent.append(fragment);
        this._valueDirty = this._selectionDirty = false;
        this._root.setAttribute('aria-rowcount', String(rows.Count + (this._showHeaders ? 1 : 0)));
        this._root.setAttribute('aria-colcount', String(p.Layout.Columns.length));
        this._empty.hidden = rows.Count > 0;
        const topIndex = this._heights.IndexAt(top);
        this._topAnchor = topIndex >= 0 ? { row: rows.Get(topIndex), within: top - this._heights.Offset(topIndex) } : null;
        this.Stats = { Rows: rows.Count, RealizedRows: this._realized.size, RealizedCells: [...this._realized.values()].reduce((n, r) => n + r.cells.length, 0), FrameMilliseconds: performance.now() - start, MeasuredRows: this._heightCache.size, TotalHeight: this._heights.Total, CreatedElements: this.ElementFactory.Created, ReusedElements: this.ElementFactory.Reused, FirstRow: range.start, LastRow: range.end - 1 };
        this._frame++;
        this._fire('Rendered', { Stats: this.Stats });
        if (this._needsWidthMeasure) {
            this._needsWidthMeasure = false;
            this._measureColumns();
        }
    }
    _appendColumns(container, indexes, create) { const l = this._presentation.Layout; let offset = 0; for (const i of indexes) {
        const x = l.Geometry.Offsets[i];
        if (x > offset + .1) {
            const gap = dom('div', 'gap');
            gap.style.width = `${x - offset}px`;
            gap.setAttribute('aria-hidden', 'true');
            container.append(gap);
        }
        const element = create(i);
        container.append(element);
        offset = x + l.Widths[i];
    } if (l.Geometry.Total > offset + .1) {
        const gap = dom('div', 'gap');
        gap.style.width = `${l.Geometry.Total - offset}px`;
        gap.setAttribute('aria-hidden', 'true');
        container.append(gap);
    } }
    _renderHeader(indexes) {
        this._header.replaceChildren();
        this._appendColumns(this._header, indexes, i => {
            const l = this._presentation.Layout, c = l.Columns[i], sourceIndex = this.ActiveModel.Columns.IndexOf(c), h = dom('div', 'header');
            h.dataset.column = sourceIndex;
            h.setAttribute('role', 'columnheader');
            h.setAttribute('aria-colindex', String(i + 1));
            h.style.width = `${l.Widths[i]}px`;
            h.tabIndex = -1;
            const label = dom('span', 'label', c.Header);
            h.append(label);
            const sortable = this._canSort && c.Options?.CanUserSortColumn !== false && c.GetComparison(ListSortDirection.Ascending) != null;
            h.classList.toggle('sortable', sortable);
            h.draggable = this._canReorder;
            h.setAttribute('aria-sort', c.SortDirection === ListSortDirection.Ascending ? 'ascending' : c.SortDirection === ListSortDirection.Descending ? 'descending' : 'none');
            if (c.SortDirection)
                h.append(dom('span', 'sort-indicator', c.SortDirection === ListSortDirection.Ascending ? '↑' : '↓'));
            if (c.Options?.CanUserResizeColumn ?? this._canResize) {
                const grip = dom('span', 'resize-grip');
                grip.dataset.resize = sourceIndex;
                grip.setAttribute('role', 'separator');
                grip.setAttribute('aria-orientation', 'vertical');
                grip.setAttribute('aria-label', `Resize ${c.Header}`);
                grip.tabIndex = 0;
                h.append(grip);
            }
            if (i < this._frozen) {
                h.classList.add('frozen');
                h.style.left = `${l.Geometry.Offsets[i]}px`;
                if (i === this._frozen - 1)
                    h.classList.add('frozen-edge');
            }
            return h;
        });
    }
    _prepareRow(index, row, colIndexes) {
        const el = this.ElementFactory.GetElement('row', () => dom('div', 'row'));
        el.className = 'row';
        el.dataset.row = index;
        el.setAttribute('role', 'row');
        el.setAttribute('aria-rowindex', String(index + (this._showHeaders ? 2 : 1)));
        el.setAttribute('aria-level', String((row.Indent ?? 0) + 1));
        if (row.ShowExpander)
            el.setAttribute('aria-expanded', String(row.IsExpanded));
        else
            el.removeAttribute('aria-expanded');
        el.draggable = this._autoDrag;
        const record = { el, index, row, cells: [] };
        el._record = record;
        this._appendColumns(el, colIndexes, i => { const cell = this._prepareCell(record, i); record.cells.push(cell); return cell.el; });
        this._rowObserver.observe(el);
        this._fire('RowPrepared', { Row: el, RowIndex: index, Model: row.Model, CoreRow: row });
        return record;
    }
    _rebindRow(record, index, row) {
        // Scrolling rebinds retained built-in cell DOM instead of destroying every content node.
        // Custom templates are recreated, so create-time event handlers cannot retain the old model.
        this._rowObserver.unobserve(record.el);
        this._fire('RowClearing', { Row: record.el, RowIndex: record.index, Model: record.row.Model, CoreRow: record.row });
        for (const rec of record.cells) {
            this._fire('CellClearing', { Cell: rec.el, ColumnIndex: rec.columnIndex, RowIndex: rec.rowIndex, Model: rec.row.Model, CellModel: rec.cellModel });
            disposeAll(rec.off);
            rec.cellModel.Dispose();
            if (rec.template) {
                rec.template.dispose?.(rec.templateElement);
                rec.content.replaceChildren();
                rec.templateElement = null;
            }
            rec.row = row;
            rec.rowIndex = index;
            rec.cellModel = rec.view.CreateCell(row);
            rec.inner = rec.cellModel instanceof ExpanderCell ? rec.cellModel.Inner : rec.cellModel;
            rec.el.id = `tdg-${this._id}-${index}-${rec.columnIndex}`;
            rec.el.dataset.row = index;
            if (rec.expander)
                rec.el.style.paddingLeft = `${8 + row.Indent * 18}px`;
            this._updateCell(rec);
            if (rec.column.Getter)
                rec.off.push(observeSelector(row.Model, rec.column.Getter, () => { if (this._editing?.rec !== rec) {
                    this._heightCache.delete(rec.row);
                    this._updateCell(rec);
                    this._schedule();
                } }));
            this._fire('CellPrepared', { Cell: rec.el, ColumnIndex: rec.columnIndex, RowIndex: index, Model: row.Model, Column: rec.coreColumn, CellModel: rec.cellModel });
        }
        record.row = row;
        record.index = index;
        record.el.dataset.row = index;
        record.el.setAttribute('aria-rowindex', String(index + (this._showHeaders ? 2 : 1)));
        record.el.setAttribute('aria-level', String((row.Indent ?? 0) + 1));
        if (row.ShowExpander)
            record.el.setAttribute('aria-expanded', String(row.IsExpanded));
        else
            record.el.removeAttribute('aria-expanded');
        this._rowObserver.observe(record.el);
        this.ElementFactory.Reused += 1 + record.cells.length;
        this._needsWidthMeasure = true;
        this._fire('RowPrepared', { Row: record.el, RowIndex: index, Model: row.Model, CoreRow: row });
    }
    _prepareCell(record, visibleIndex) {
        const l = this._presentation.Layout, column = l.Columns[visibleIndex], columnIndex = this.ActiveModel.Columns.IndexOf(column), view = this._presentation.Columns[columnIndex], model = view.CreateCell(record.row), inner = model instanceof ExpanderCell ? model.Inner : model, c = innerColumn(column);
        const el = this.ElementFactory.GetElement('cell', () => dom('div', 'cell'));
        el.className = 'cell';
        el.id = `tdg-${this._id}-${record.index}-${columnIndex}`;
        el.dataset.column = columnIndex;
        el.dataset.row = record.index;
        el.setAttribute('role', 'gridcell');
        el.setAttribute('aria-colindex', String(visibleIndex + 1));
        el.style.width = `${l.Widths[visibleIndex]}px`;
        el.style.left = '';
        el.style.paddingLeft = '';
        el.title = '';
        el.classList.toggle('wrap', !!c.Options?.TextWrapping);
        el.classList.toggle('right', c.Options?.TextAlignment === 'Right');
        el.classList.toggle('center', c.Options?.TextAlignment === 'Center');
        if (visibleIndex < this._frozen) {
            el.classList.add('frozen');
            el.style.left = `${l.Geometry.Offsets[visibleIndex]}px`;
            if (visibleIndex === this._frozen - 1)
                el.classList.add('frozen-edge');
        }
        const content = dom('div', 'cell-content');
        const rec = { el, content, column: c, coreColumn: column, columnIndex, rowIndex: record.index, row: record.row, cellModel: model, inner, off: [], view, template: null };
        el._cell = rec;
        if (model instanceof ExpanderCell) {
            el.style.paddingLeft = `${8 + model.Indent * 18}px`;
            const button = dom('button', `expander ${model.ShowExpander ? '' : 'empty'} ${model.IsExpanded ? 'open' : ''}`);
            button.type = 'button';
            button.tabIndex = -1;
            button.innerHTML = triangle;
            button.dataset.expand = '';
            button.setAttribute('aria-label', model.IsExpanded ? 'Collapse row' : 'Expand row');
            button.classList.toggle('loading', record.row.IsLoading);
            el.append(button);
            rec.expander = button;
        }
        el.append(content);
        if (inner instanceof TemplateCell) {
            rec.template = inner.Template;
        }
        else if (c instanceof CheckBoxColumn) {
            const input = dom('input');
            input.type = 'checkbox';
            input.tabIndex = -1;
            input.setAttribute('aria-label', String(column.Header));
            input.disabled = !c.Setter;
            content.append(input);
            rec.checkbox = input;
        }
        this._updateCell(rec);
        if (c.Getter)
            rec.off.push(observeSelector(record.row.Model, c.Getter, () => { if (!this._editing || this._editing.rec !== rec) {
                this._heightCache.delete(rec.row);
                this._updateCell(rec);
                this._schedule();
            } }));
        this._needsWidthMeasure = true;
        this._fire('CellPrepared', { Cell: el, ColumnIndex: columnIndex, RowIndex: record.index, Model: record.row.Model, Column: column, CellModel: model });
        return rec;
    }
    _templateContext(rec) { return { grid: this, row: rec.row, column: rec.coreColumn, rowIndex: rec.rowIndex, columnIndex: rec.columnIndex, document, notify: () => { this.ActiveModel.NotifyItemChanged(rec.row.Model); }, setValue: value => { rec.column.SetValue(rec.row.Model, value); this.ActiveModel.NotifyItemChanged(rec.row.Model); } }; }
    _createTemplate(rec) { const template = rec.template, result = template.create?.(rec.row.Model, this._templateContext(rec)); if (result instanceof Node) {
        rec.content.append(result);
        rec.templateElement = result;
    }
    else {
        rec.templateElement = dom('span', '', result ?? '');
        rec.content.append(rec.templateElement);
    } template.update?.(rec.templateElement, rec.row.Model, this._templateContext(rec)); }
    _updateCell(rec) {
        if (this._editing?.rec === rec)
            return;
        if (rec.template) {
            if (!rec.templateElement)
                this._createTemplate(rec);
            else if (rec.template.update)
                rec.template.update(rec.templateElement, rec.row.Model, this._templateContext(rec));
            else if (rec.templateElement) {
                rec.template.dispose?.(rec.templateElement);
                rec.content.replaceChildren();
                this._createTemplate(rec);
            }
        }
        else {
            const value = rec.inner.Value;
            if (rec.checkbox) {
                rec.checkbox.checked = value === true;
                rec.checkbox.indeterminate = value == null && rec.column.IsThreeState;
                rec.checkbox.setAttribute('aria-checked', rec.checkbox.indeterminate ? 'mixed' : String(rec.checkbox.checked));
            }
            else {
                const text = formatValue(rec.column, value, rec.row.Model);
                if (rec.content.textContent !== text)
                    rec.content.textContent = text;
                rec.el.title = text;
            }
        }
        if (rec.expander) {
            rec.expander.classList.toggle('open', rec.row.IsExpanded);
            rec.expander.classList.toggle('empty', !rec.row.ShowExpander);
            rec.expander.classList.toggle('loading', rec.row.IsLoading);
            rec.expander.setAttribute('aria-label', rec.row.IsExpanded ? 'Collapse row' : 'Expand row');
        }
    }
    _recycleCell(rec) { this._fire('CellClearing', { Cell: rec.el, ColumnIndex: rec.columnIndex, RowIndex: rec.rowIndex, Model: rec.row.Model, CellModel: rec.cellModel }); disposeAll(rec.off); rec.template?.dispose?.(rec.templateElement); rec.cellModel.Dispose(); rec.el.replaceChildren(); rec.el._cell = null; rec.el.remove(); this.ElementFactory.RecycleElement('cell', rec.el); }
    _recycleRow(record) { this._rowObserver.unobserve(record.el); for (const cell of record.cells)
        this._recycleCell(cell); this._fire('RowClearing', { Row: record.el, RowIndex: record.index, Model: record.row.Model, CoreRow: record.row }); record.el.replaceChildren(); record.el._record = null; record.el.remove(); this.ElementFactory.RecycleElement('row', record.el); }
    _clearRows() { for (const record of this._realized.values())
        this._recycleRow(record); this._realized.clear(); }
    _measureRows(entries) {
        if (this._rowHeight != null || !this.isConnected)
            return;
        const top = this._logicalScroll(), anchor = this._heights.IndexAt(top), wasAtEnd = Math.abs(this._heights.Total - this._viewport.clientHeight - top) < 2;
        let changed = false, above = 0;
        for (const entry of entries) {
            const record = entry.target._record;
            if (!record || record.index >= this._heights.Count || this.Rows?.Get(record.index) !== record.row)
                continue;
            const h = Math.max(12, entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height);
            const d = this._heights.Set(record.index, h);
            if (d) {
                changed = true;
                this._heightCache.set(record.row, h);
                if (record.index < anchor)
                    above += d;
            }
        }
        if (changed) {
            while (this._heightCache.size > 20000)
                this._heightCache.delete(this._heightCache.keys().next().value);
            this._extent.style.height = `${Math.min(MAX_EXTENT, this._heights.Total)}px`;
            if (wasAtEnd)
                this._setLogicalScroll(this._heights.Total - this._viewport.clientHeight);
            else if (above)
                this._setLogicalScroll(top + above);
            this._schedule();
        }
    }
    _measureColumns() {
        if (!this._presentation)
            return;
        const measures = new Map(), canvas = this._measureCanvas ??= document.createElement('canvas'), ctx = canvas.getContext('2d');
        // Measure intrinsic content, not the stretched flex item's scrollWidth (which would grow forever).
        for (const r of this._realized.values())
            for (const cell of r.cells) {
                const core = cell.coreColumn;
                if (!core.Width.IsAuto)
                    continue;
                ctx.font = getComputedStyle(cell.content).font;
                let natural = 0;
                if (cell.checkbox)
                    natural = 22;
                else if (cell.template) {
                    const clone = cell.content.cloneNode(true);
                    Object.assign(clone.style, { position: 'absolute', visibility: 'hidden', width: 'max-content', maxWidth: 'none', inset: '0 auto auto 0', flex: 'none' });
                    this._root.append(clone);
                    natural = clone.getBoundingClientRect().width;
                    clone.remove();
                }
                else
                    for (const line of cell.content.textContent.split('\n'))
                        natural = Math.max(natural, ctx.measureText(line).width);
                const width = Math.min(1200, Math.max(String(core.Header ?? '').length * 8 + 34, natural + 28 + (cell.expander ? cell.row.Indent * 18 + 24 : 0)));
                measures.set(core, Math.max(measures.get(core) ?? 0, width));
            }
        let changed = false;
        for (const [c, width] of measures)
            changed = this._presentation.Layout.Measure(c, width) || changed;
        if (changed) {
            this._layoutDirty = true;
            this._schedule();
        }
    }
    TryGetCell(columnIndex, rowIndex) { if (columnIndex instanceof Element)
        return columnIndex.closest('.cell'); return this._realized.get(rowIndex)?.cells.find(c => c.columnIndex === columnIndex)?.el ?? null; }
    TryGetRow(indexOrElement) { if (indexOrElement instanceof Element)
        return indexOrElement.closest('.row'); return this._realized.get(indexOrElement)?.el ?? null; }
    TryGetRowModel(element) { return this.TryGetRow(element)?._record?.row.Model ?? null; }
    QueryCancelSelection() { return !!this._fire('SelectionChanging', { Cancel: false }, true).Cancel; }
    ScrollIntoView(rowIndex, columnIndex = -1, alignment = 'nearest') {
        if (!this.Rows?.Count)
            return;
        rowIndex = clamp(rowIndex, 0, this.Rows.Count - 1);
        if (this._geometryDirty)
            this._resetGeometry();
        const top = this._heights.Offset(rowIndex), bottom = this._heights.Offset(rowIndex + 1), current = this._logicalScroll(), vh = this._viewport.clientHeight;
        if (alignment === 'start')
            this._setLogicalScroll(top);
        else if (alignment === 'center')
            this._setLogicalScroll(top - (vh - (bottom - top)) / 2);
        else if (top < current)
            this._setLogicalScroll(top);
        else if (bottom > current + vh)
            this._setLogicalScroll(bottom - vh);
        if (columnIndex >= 0 && this._presentation) {
            const l = this._presentation.Layout, i = l.Columns.indexOf(this.ActiveModel.Columns.Get(columnIndex));
            if (i >= this._frozen) {
                const x = l.Geometry.Offsets[i], w = l.Widths[i], f = l.Geometry.Offsets[Math.min(this._frozen, l.Columns.length)];
                if (x < this._viewport.scrollLeft + f)
                    this._viewport.scrollLeft = Math.max(0, x - f);
                else if (x + w > this._viewport.scrollLeft + this._viewport.clientWidth)
                    this._viewport.scrollLeft = x + w - this._viewport.clientWidth;
            }
        }
        this._schedule();
    }
    BringIntoView(index, columnIndex = -1) { index = IndexPath.From(index); if (this.ActiveModel?.IsHierarchical) {
        this.ActiveModel.Batch(() => { for (let d = 1; d < index.Count; d++)
            this.ActiveModel.Expand(index.Slice(0, d)); });
    } const row = this.Rows?.ModelIndexToRowIndex(index) ?? -1; if (row >= 0)
        this.ScrollIntoView(row, columnIndex); return row; }
    FindDisplayedRowIndex(modelOrPath) { const path = modelOrPath instanceof IndexPath ? modelOrPath : this.ActiveModel.FindModelIndex(modelOrPath); return this.Rows.ModelIndexToRowIndex(path); }
    AutoSizeColumn(columnIndex) { const c = this.ActiveModel.Columns.Get(columnIndex), inner = innerColumn(c); let width = String(c.Header ?? '').length * 8 + 34; for (let i = 0; i < Math.min(300, this.Rows.Count); i++) {
        const row = this.Rows.Get(i), text = formatValue(inner, inner.GetValue?.(row.Model), row.Model);
        width = Math.max(width, ...text.split('\n').map(x => x.length * 7.4 + 28 + (c instanceof HierarchicalExpanderColumn ? 24 + row.Indent * 18 : 0)));
    } c.Width = new GridLength(Math.min(700, Math.ceil(width))); }
    AutoSizeAllColumns() { for (let i = 0; i < this.ActiveModel.Columns.Count; i++)
        this.AutoSizeColumn(i); }
    _eventCell(event) { return event.target.closest?.('.cell')?._cell ?? null; }
    _eventHeader(event) { return event.target.closest?.('.header') ?? null; }
    _select(rowIndex, columnIndex, event = {}) {
        if (this.QueryCancelSelection())
            return;
        const source = this.ActiveModel, selection = source?.Selection;
        if (!selection)
            return;
        const path = this.Rows.RowIndexToModelIndex(rowIndex), ctrl = event.ctrlKey || event.metaKey;
        this._active = { row: rowIndex, column: columnIndex };
        if (selection instanceof TreeDataGridCellSelectionModel) {
            if (event.shiftKey && !selection.SingleSelect) {
                const anchor = selection.AnchorIndex, ar = this.Rows.ModelIndexToRowIndex(anchor.RowIndex);
                if (ar >= 0)
                    selection.SetSelectedRange(anchor, columnIndex - anchor.ColumnIndex + (columnIndex >= anchor.ColumnIndex ? 1 : -1), rowIndex - ar + (rowIndex >= ar ? 1 : -1));
                else
                    selection.SelectedIndex = new CellIndex(columnIndex, path);
            }
            else
                selection.SelectedIndex = new CellIndex(columnIndex, path);
        }
        else if (event.shiftKey && !selection.SingleSelect) {
            const anchor = selection.RangeAnchorIndex.Count ? selection.RangeAnchorIndex : selection.SelectedIndex;
            selection.SelectRange(anchor, path, ctrl);
        }
        else if (ctrl && !selection.SingleSelect) {
            selection.IsSelected(path) ? selection.Deselect(path) : selection.Select(path);
            selection.RangeAnchorIndex = path;
        }
        else
            selection.SelectedIndex = path;
        this._schedule();
    }
    _click(event) {
        const header = this._eventHeader(event);
        if (header) {
            if (event.target.closest('.resize-grip') || this._suppressClick)
                return;
            const column = this.ActiveModel.Columns.Get(+header.dataset.column);
            if (this._canSort && column.Options?.CanUserSortColumn !== false) {
                if (event.ctrlKey || event.metaKey || column.SortDirection === ListSortDirection.Descending)
                    this.ActiveModel.ClearSort();
                else
                    this.ActiveModel.SortBy(column, column.SortDirection === ListSortDirection.Ascending ? ListSortDirection.Descending : ListSortDirection.Ascending);
            }
            return;
        }
        const cell = this._eventCell(event);
        if (!cell)
            return;
        if (this._editing) {
            if (this._editing.rec === cell)
                return;
            if (!this.CommitEdit())
                return;
        }
        if (event.target.closest('[data-expand]')) {
            event.stopPropagation();
            const row = cell.row;
            if (row.HasChildren) {
                row.IsExpanded ? this.ActiveModel.Collapse(row.ModelIndex) : this.ActiveModel.Expand(row.ModelIndex);
            }
            return;
        }
        const interactive = event.target.closest('button,a,select,input,textarea');
        if (interactive && !cell.checkbox)
            return;
        this._select(cell.rowIndex, cell.columnIndex, event);
        this._root.focus({ preventScroll: true });
        if (cell.checkbox && cell.column.Setter) {
            const old = cell.column.GetValue(cell.row.Model), value = cell.column.IsThreeState ? (old === false ? true : old === true ? null : false) : !old;
            this._writeCell(cell, value, old);
        }
        if (cell.column.Options?.BeginEditGestures?.includes('Tap') && !cell.column.Options.BeginEditGestures.includes('DoubleTap'))
            this.BeginEdit(cell.columnIndex, cell.rowIndex);
    }
    _doubleClick(event) { const grip = event.target.closest?.('.resize-grip'); if (grip) {
        event.preventDefault();
        this.AutoSizeColumn(+grip.dataset.resize);
        return;
    } const cell = this._eventCell(event); if (!cell || event.target.closest('[data-expand]'))
        return; this._fire('RowDoubleTapped', { RowIndex: cell.rowIndex, Model: cell.row.Model, Row: cell.row }); if (!cell.checkbox)
        this.BeginEdit(cell.columnIndex, cell.rowIndex); }
    _pointerDown(event) {
        if (event.target.closest?.('.context-menu'))
            return;
        this._hideContextMenu();
        const grip = event.target.closest?.('.resize-grip');
        if (!grip)
            return;
        event.preventDefault();
        event.stopPropagation();
        const columnIndex = +grip.dataset.resize, column = this.ActiveModel.Columns.Get(columnIndex), layout = this._presentation.Layout, vi = layout.Columns.indexOf(column), initial = layout.Widths[vi], start = event.clientX;
        this._resizeAbort?.abort();
        const controller = new AbortController();
        this._resizeAbort = controller;
        this._suppressClick = true;
        const min = GridLength.Parse(column.Options?.MinWidth ?? 30).Value, max = column.Options?.MaxWidth ? GridLength.Parse(column.Options.MaxWidth).Value : 5000;
        document.addEventListener('pointermove', e => { column.Width = new GridLength(clamp(initial + e.clientX - start, min, max)); }, { signal: controller.signal });
        document.addEventListener('pointerup', () => { controller.abort(); this._resizeAbort = null; setTimeout(() => { this._suppressClick = false; }, 0); }, { once: true, signal: controller.signal });
        document.addEventListener('pointercancel', () => { controller.abort(); this._resizeAbort = null; this._suppressClick = false; }, { once: true, signal: controller.signal });
    }
    _keyDown(event) {
        if (event.isComposing)
            return;
        const key = event.key, ctrl = event.ctrlKey || event.metaKey;
        const grip = event.target.closest?.('.resize-grip');
        if (grip && ['ArrowLeft', 'ArrowRight'].includes(key)) {
            event.preventDefault();
            const i = +grip.dataset.resize, w = this.Columns[i].ActualWidth;
            this.ActiveModel.Columns.Get(i).Width = new GridLength(Math.max(30, w + (key === 'ArrowRight' ? 10 : -10)));
            return;
        }
        if (this._editing) {
            if (key === 'Escape') {
                event.preventDefault();
                this.CancelEdit();
                this._root.focus({ preventScroll: true });
            }
            else if (key === 'Enter' && !(event.shiftKey && this._editing.editor.tagName === 'TEXTAREA')) {
                event.preventDefault();
                if (this.CommitEdit())
                    this._root.focus({ preventScroll: true });
            }
            else if (key === 'Tab') {
                event.preventDefault();
                if (this.CommitEdit()) {
                    this._moveActive(0, event.shiftKey ? -1 : 1, false);
                    this.BeginEdit();
                }
            }
            return;
        }
        if (event.target !== this._root && event.target.closest('input,textarea,select,button,a'))
            return;
        const rows = this.Rows;
        if (!rows?.Count)
            return;
        const s = this.ActiveModel.Selection;
        if (ctrl && key.toLowerCase() === 'a') {
            event.preventDefault();
            if (!this.QueryCancelSelection())
                s?.SelectAll();
            return;
        }
        if (ctrl && key.toLowerCase() === 'z') {
            event.preventDefault();
            event.shiftKey ? this.Redo() : this.Undo();
            return;
        }
        if (ctrl && key.toLowerCase() === 'y') {
            event.preventDefault();
            this.Redo();
            return;
        }
        if (key === 'F2' || key === 'Enter') {
            event.preventDefault();
            this.BeginEdit();
            return;
        }
        if (key === 'Escape') {
            s?.Clear();
            return;
        }
        if (key === ' ') {
            event.preventDefault();
            const cell = this.TryGetCell(this._active.column, this._active.row)?._cell;
            if (cell?.checkbox && cell.column.Setter) {
                const old = cell.inner.Value, value = cell.column.IsThreeState ? (old === false ? true : old === true ? null : false) : !old;
                this._writeCell(cell, value, old);
            }
            else
                this._select(this._active.row, this._active.column, { ctrlKey: true });
            return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Tab'].includes(key)) {
            event.preventDefault();
            let r = this._active.row, c = this._active.column;
            const row = rows.Get(clamp(r, 0, rows.Count - 1)), isCells = s instanceof TreeDataGridCellSelectionModel;
            if ((key === 'ArrowRight' || key === 'ArrowLeft') && this.ActiveModel.IsHierarchical && !isCells) {
                if (key === 'ArrowRight') {
                    if (row.HasChildren && !row.IsExpanded) {
                        this.ActiveModel.Expand(row.ModelIndex);
                        return;
                    }
                    if (row.IsExpanded && r + 1 < rows.Count)
                        r++;
                }
                else {
                    if (row.IsExpanded) {
                        this.ActiveModel.Collapse(row.ModelIndex);
                        return;
                    }
                    if (row.ModelIndex.Count > 1)
                        r = rows.ModelIndexToRowIndex(row.ModelIndex.Parent);
                }
            }
            else if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Tab') {
                this._moveActive(0, (key === 'ArrowLeft' || key === 'Tab' && event.shiftKey) ? -1 : 1, event.shiftKey && key !== 'Tab', ctrl);
                return;
            }
            else if (key === 'ArrowUp')
                r--;
            else if (key === 'ArrowDown')
                r++;
            else if (key === 'Home') {
                if (ctrl)
                    r = 0;
                else
                    c = this.ActiveModel.Columns.IndexOf(this._presentation.Layout.Columns[0]);
            }
            else if (key === 'End') {
                if (ctrl)
                    r = rows.Count - 1;
                else
                    c = this.ActiveModel.Columns.IndexOf(this._presentation.Layout.Columns.at(-1));
            }
            else if (key === 'PageDown')
                r = this._heights.IndexAt(this._heights.Offset(r) + this._viewport.clientHeight);
            else if (key === 'PageUp')
                r = this._heights.IndexAt(Math.max(0, this._heights.Offset(r) - this._viewport.clientHeight));
            r = clamp(r, 0, rows.Count - 1);
            if (ctrl && !event.shiftKey) {
                this._active = { row: r, column: c };
                this._schedule();
            }
            else
                this._select(r, c, event);
            this.ScrollIntoView(r, c);
            return;
        }
        if (key.length === 1 && !ctrl && !event.altKey) {
            const now = performance.now();
            this._typeBuffer = now - (this._typeTime ?? 0) > 800 ? key : this._typeBuffer + key;
            this._typeTime = now;
            this.Search(this._typeBuffer, { prefix: true, start: this._active.row + 1 });
        }
    }
    _moveActive(dr, dc, shift = false, ctrl = false) { const l = this._presentation.Layout; let ci = l.Columns.indexOf(this.ActiveModel.Columns.Get(this._active.column)); if (ci < 0)
        ci = 0; let r = this._active.row + dr; ci += dc; if (ci < 0) {
        ci = l.Columns.length - 1;
        r--;
    } if (ci >= l.Columns.length) {
        ci = 0;
        r++;
    } r = clamp(r, 0, this.Rows.Count - 1); const c = this.ActiveModel.Columns.IndexOf(l.Columns[ci]); this._select(r, c, { shiftKey: shift, ctrlKey: ctrl }); this.ScrollIntoView(r, c); this._root.focus({ preventScroll: true }); }
    Search(text, { prefix = false, start = 0, columnIndex = null } = {}) { if (!this.Rows?.Count || !text)
        return -1; const query = String(text).toLocaleLowerCase(), n = this.Rows.Count, columns = columnIndex == null ? this._presentation.Layout.Columns : [this.ActiveModel.Columns.Get(columnIndex)]; for (let k = 0; k < n; k++) {
        const i = (Math.max(0, start) + k) % n, model = this.Rows.GetModel?.(i) ?? this.Rows.Get(i).Model;
        for (const c of columns) {
            const inner = innerColumn(c);
            if (inner instanceof TemplateColumn)
                continue;
            const value = formatValue(inner, inner.GetValue?.(model), model).toLocaleLowerCase();
            if (prefix ? value.startsWith(query) : value.includes(query)) {
                const col = this.ActiveModel.Columns.IndexOf(c);
                this._select(i, col);
                this.ScrollIntoView(i, col, 'center');
                return i;
            }
        }
    } return -1; }
    BeginEdit(columnIndex = this._active.column, rowIndex = this._active.row) {
        if (this._editing)
            return true;
        if (!this.Rows?.Count)
            return false;
        this.ScrollIntoView(rowIndex, columnIndex);
        this._render();
        const rec = this.TryGetCell(columnIndex, rowIndex)?._cell;
        if (!rec || rec.checkbox || !rec.inner.CanEdit)
            return false;
        if (this._fire('CellEditStarting', { Cell: rec.el, Model: rec.row.Model, ColumnIndex: columnIndex, RowIndex: rowIndex, Cancel: false }, true).Cancel)
            return false;
        const original = rec.inner.Value;
        let editor;
        if (rec.template?.edit) {
            editor = rec.template.edit(rec.row.Model, this._templateContext(rec));
            if (!(editor instanceof Element))
                throw new Error('Edit template must return an element.');
        }
        else {
            editor = dom(rec.column.Options?.TextWrapping ? 'textarea' : 'input', 'editor');
            if (editor.tagName === 'INPUT')
                editor.type = 'text';
            editor.value = original == null ? '' : String(original);
            if (editor.tagName === 'TEXTAREA')
                editor.rows = 2;
        }
        editor.classList.add('editor');
        editor.setAttribute('aria-label', `Edit ${rec.coreColumn.Header}`);
        rec.content.replaceChildren(editor);
        rec.el.classList.add('editing');
        this._active = { row: rowIndex, column: columnIndex };
        this._editing = { rec, editor, original, columnIndex, rowIndex };
        rec.inner.IsEditing = true;
        editor.focus({ preventScroll: true });
        editor.select?.();
        return true;
    }
    CommitEdit() {
        const edit = this._editing;
        if (!edit)
            return true;
        const { rec, editor, original } = edit;
        try {
            let value = rec.template?.read ? rec.template.read(editor, rec.row.Model) : parseValue(rec.column, editor.value ?? editor.textContent, original);
            const validation = rec.column.Options?.Validate?.(value, rec.row.Model);
            if (validation === false || typeof validation === 'string')
                throw new Error(typeof validation === 'string' ? validation : 'Value is not valid.');
            const e = this._fire('CellEditEnding', { Cell: rec.el, Model: rec.row.Model, ColumnIndex: rec.columnIndex, RowIndex: rec.rowIndex, Value: value, Cancel: false }, true);
            if (e.Cancel)
                return false;
            value = e.Value;
            if (rec.template?.commit)
                rec.template.commit(rec.row.Model, value, editor, this._templateContext(rec));
            else
                rec.column.SetValue(rec.row.Model, value);
            this._editing = null;
            rec.inner.IsEditing = false;
            rec.el.classList.remove('editing');
            rec.el.querySelector('.error-tip')?.remove();
            rec.content.replaceChildren();
            if (rec.template)
                this._createTemplate(rec);
            this._updateCell(rec);
            this._heightCache.delete(rec.row);
            this.ActiveModel.NotifyItemChanged(rec.row.Model);
            if (!Object.is(original, value) && !rec.template) {
                this._undo.push([{ column: rec.column, model: rec.row.Model, old: original, value }]);
                this._redo = [];
            }
            this._fire('CellValueChanged', { Cell: rec.el, ColumnIndex: rec.columnIndex, RowIndex: rec.rowIndex, Model: rec.row.Model, OldValue: original, Value: value });
            this._fire('CellEditEnded', { Model: rec.row.Model, ColumnIndex: rec.columnIndex, RowIndex: rec.rowIndex, Value: value, Canceled: false });
            this._schedule();
            return true;
        }
        catch (error) {
            editor.setAttribute('aria-invalid', 'true');
            rec.el.querySelector('.error-tip')?.remove();
            const tip = dom('div', 'error-tip', error.message);
            tip.setAttribute('role', 'alert');
            rec.el.append(tip);
            this._live.textContent = error.message;
            return false;
        }
    }
    CancelEdit() { const edit = this._editing; if (!edit)
        return; const rec = edit.rec; this._editing = null; rec.inner.IsEditing = false; rec.el.classList.remove('editing'); rec.el.querySelector('.error-tip')?.remove(); rec.content.replaceChildren(); if (rec.template)
        this._createTemplate(rec); this._updateCell(rec); this._fire('CellEditEnded', { Model: rec.row.Model, ColumnIndex: rec.columnIndex, RowIndex: rec.rowIndex, Canceled: true }); this._schedule(); }
    _writeCell(rec, value, old) { try {
        const validation = rec.column.Options?.Validate?.(value, rec.row.Model);
        if (validation === false || typeof validation === 'string')
            throw new Error(typeof validation === 'string' ? validation : 'Value is not valid.');
        rec.column.SetValue(rec.row.Model, value);
        this._undo.push([{ column: rec.column, model: rec.row.Model, old, value }]);
        this._redo = [];
        this.ActiveModel.NotifyItemChanged(rec.row.Model);
        this._updateCell(rec);
        this._fire('CellValueChanged', { Cell: rec.el, Model: rec.row.Model, ColumnIndex: rec.columnIndex, RowIndex: rec.rowIndex, OldValue: old, Value: value });
    }
    catch (error) {
        this._error(error);
        this._updateCell(rec);
    } }
    Undo() { if (!this.CommitEdit())
        return false; const changes = this._undo.pop(); if (!changes)
        return false; this.ActiveModel.Batch(() => { for (const c of changes) {
        c.column.SetValue(c.model, c.old);
        this.ActiveModel.NotifyItemChanged(c.model);
    } }); this._redo.push(changes); return true; }
    Redo() { const changes = this._redo.pop(); if (!changes)
        return false; this.ActiveModel.Batch(() => { for (const c of changes) {
        c.column.SetValue(c.model, c.value);
        this.ActiveModel.NotifyItemChanged(c.model);
    } }); this._undo.push(changes); return true; }
    GetSelectionText({ headers = false, separator = '\t', safe = false } = {}) { const model = this.ActiveModel, selection = model?.Selection; if (!model || !selection?.Count)
        return ''; const cellSelection = selection instanceof TreeDataGridCellSelectionModel; const paths = cellSelection ? selection.RowSelection.SelectedIndexes : selection.SelectedIndexes; const rowIndexes = paths.map(p => this.Rows.ModelIndexToRowIndex(p)).filter(i => i >= 0).sort((a, b) => a - b); const columns = this._presentation.Layout.Columns.filter(c => !cellSelection || selection._columns.has(c)); const records = []; if (headers)
        records.push(columns.map(c => c.Header)); for (const i of rowIndexes) {
        const row = this.Rows.Get(i);
        records.push(columns.map(c => { const inner = innerColumn(c); return inner instanceof TemplateColumn ? String(inner.Options?.ClipboardValue?.(row.Model) ?? '') : formatValue(inner, inner.GetValue(row.Model), row.Model); }));
    } return records.map(r => r.map(v => quoteField(v, separator, safe)).join(separator)).join('\r\n'); }
    async Copy(options = {}) { const text = this.GetSelectionText(options); if (!text)
        return ''; try {
        await navigator.clipboard.writeText(text);
    }
    catch (error) {
        const area = dom('textarea');
        area.value = text;
        area.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.append(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        this._root.focus();
        if (!ok)
            throw error;
    } return text; }
    Paste(text) {
        if (!this.Rows?.Count)
            return 0;
        const matrix = parseDelimited(text, '\t'), l = this._presentation.Layout, ci = l.Columns.indexOf(this.ActiveModel.Columns.Get(this._active.column));
        const changes = [];
        for (let r = 0; r < matrix.length && this._active.row + r < this.Rows.Count; r++) {
            const model = this.Rows.Get(this._active.row + r).Model;
            for (let c = 0; c < matrix[r].length && ci + c < l.Columns.length; c++) {
                const column = innerColumn(l.Columns[ci + c]);
                if (!column.Setter)
                    continue;
                const old = column.GetValue(model), value = parseValue(column, matrix[r][c], old), check = column.Options?.Validate?.(value, model);
                if (check === false || typeof check === 'string')
                    throw new Error(typeof check === 'string' ? check : 'Invalid paste value.');
                changes.push({ column, model, old, value });
            }
        }
        const applied = [];
        this.ActiveModel.BeginUpdate();
        try {
            for (const change of changes) {
                change.column.SetValue(change.model, change.value);
                applied.push(change);
                this.ActiveModel.NotifyItemChanged(change.model);
            }
        }
        catch (error) {
            for (const change of applied.reverse())
                change.column.SetValue(change.model, change.old);
            throw error;
        }
        finally {
            this.ActiveModel.EndUpdate();
        }
        if (changes.length) {
            this._undo.push(changes);
            this._redo = [];
        }
        return changes.length;
    }
    ExportCsv({ selectedOnly = false, headers = true, safe = true } = {}) { if (selectedOnly)
        return this.GetSelectionText({ headers, separator: ',', safe }); const columns = this._presentation.Layout.Columns, records = []; if (headers)
        records.push(columns.map(c => c.Header)); for (let i = 0; i < this.Rows.Count; i++) {
        const m = this.Rows.GetModel?.(i) ?? this.Rows.Get(i).Model;
        records.push(columns.map(c => { const inner = innerColumn(c); return inner instanceof TemplateColumn ? (inner.Options?.ClipboardValue?.(m) ?? '') : formatValue(inner, inner.GetValue(m), m); }));
    } return records.map(r => r.map(v => quoteField(v, ',', safe)).join(',')).join('\r\n'); }
    SaveViewState() { return { version: 1, columns: Array.from(this.ActiveModel.Columns, c => ({ id: c.Id, width: c.Width.ToString(), visible: c.IsVisible })), sort: Array.from(this.ActiveModel.Columns).filter(c => c.SortDirection).map(c => ({ id: c.Id, direction: c.SortDirection })), frozen: this._frozen, rowHeight: this._rowHeight, estimatedHeight: this._estimate, scroll: { x: this._viewport.scrollLeft, y: this._logicalScroll() } }; }
    RestoreViewState(state) { if (!state || state.version !== 1)
        throw new Error('Unsupported view state.'); const cols = this.ActiveModel.Columns, byId = new Map(Array.from(cols, c => [c.Id, c])); for (let i = 0; i < (state.columns ?? []).length; i++) {
        const item = state.columns[i], c = byId.get(item.id);
        if (!c)
            continue;
        cols.Move(cols.IndexOf(c), Math.min(i, cols.Count - 1));
        c.Width = GridLength.Parse(item.width);
        c.IsVisible = item.visible !== false;
    } this.FrozenColumns = state.frozen ?? 0; this.RowHeight = state.rowHeight ?? null; this.EstimatedRowHeight = state.estimatedHeight ?? 36; this.ActiveModel.ClearSort(); for (const sort of state.sort ?? []) {
        const c = byId.get(sort.id);
        if (c)
            this.ActiveModel.SortBy(c, sort.direction);
    } this._render(); this._viewport.scrollLeft = state.scroll?.x ?? 0; this._setLogicalScroll(state.scroll?.y ?? 0); }
    _dragStart(event) {
        const header = this._eventHeader(event);
        if (header && this._canReorder) {
            this._columnDrag = this.ActiveModel.Columns.Get(+header.dataset.column);
            event.dataTransfer.setData('application/x-treedatagrid-column', String(this._id));
            event.dataTransfer.effectAllowed = 'move';
            return;
        }
        const cell = this._eventCell(event), record = event.target.closest?.('.row')?._record;
        if (!record || !this._autoDrag || this.ActiveModel.Selection instanceof TreeDataGridCellSelectionModel || this.ActiveModel.IsSorted || this.ActiveModel._filter) {
            event.preventDefault();
            return;
        }
        if (event.target.closest?.('input,textarea,button,select,a')) {
            event.preventDefault();
            return;
        }
        const selection = this.ActiveModel.RowSelection;
        if (!selection?.IsSelected(record.row.ModelIndex))
            this._select(record.index, cell?.columnIndex ?? 0);
        const indexes = selection?.SelectedIndexes ?? [record.row.ModelIndex], args = this._fire('RowDragStarted', { Model: this.ActiveModel, Source: this.Source, Indexes: indexes, Rows: indexes.map(p => this.ActiveModel.GetModelAt(p)), Cancel: false }, true);
        if (args.Cancel) {
            event.preventDefault();
            return;
        }
        const token = `${this._id}-${Date.now()}`;
        this._dragToken = token;
        drags.set(token, { Model: this.ActiveModel, Source: this.Source, Indexes: indexes, Grid: this });
        event.dataTransfer.setData('application/x-treedatagrid-rows', token);
        event.dataTransfer.setData('text/plain', indexes.map(String).join(', '));
        event.dataTransfer.effectAllowed = 'move';
        record.el.classList.add('dragging');
    }
    _dropInfo(event) { const record = event.target.closest?.('.row')?._record; if (!record)
        return null; const rect = record.el.getBoundingClientRect(), ratio = (event.clientY - rect.top) / rect.height; const position = this.ActiveModel.IsHierarchical && ratio > .27 && ratio < .73 && record.row.HasChildren ? 'Inside' : ratio < .5 ? 'Before' : 'After'; return { record, position }; }
    _dragOver(event) {
        const types = [...event.dataTransfer.types];
        if (types.includes('application/x-treedatagrid-column') && this._eventHeader(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            return;
        }
        if (!this._autoDrag || !types.includes('application/x-treedatagrid-rows'))
            return;
        const info = this._dropInfo(event);
        if (!info)
            return;
        const args = this._fire('RowDragOver', { Model: this.ActiveModel, TargetIndex: info.record.row.ModelIndex, Position: info.position, DragEvent: event, Cancel: false }, true);
        if (args.Cancel)
            return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        this._clearDrop();
        this._dropTarget = info;
        if (info.position === 'Inside')
            info.record.el.classList.add('drop-inside');
        else {
            const line = dom('div', 'drop-line');
            line.style.top = info.position === 'Before' ? '0' : 'calc(100% - 2px)';
            info.record.el.append(line);
        }
        const rect = this._viewport.getBoundingClientRect();
        this._autoScrollVelocity = event.clientY < rect.top + 36 ? -12 : event.clientY > rect.bottom - 36 ? 12 : 0;
        if (this._autoScrollVelocity && !this._dragRaf) {
            const tick = () => { this._dragRaf = 0; if (this._autoScrollVelocity) {
                this._setLogicalScroll(this._logicalScroll() + this._autoScrollVelocity);
                this._dragRaf = requestAnimationFrame(tick);
            } };
            this._dragRaf = requestAnimationFrame(tick);
        }
    }
    _drop(event) {
        const header = this._eventHeader(event);
        if (header && event.dataTransfer.getData('application/x-treedatagrid-column') === String(this._id) && this._columnDrag) {
            event.preventDefault();
            const from = this.ActiveModel.Columns.IndexOf(this._columnDrag), to = +header.dataset.column;
            this.ActiveModel.Columns.Move(from, to);
            this._columnDrag = null;
            return;
        }
        const token = event.dataTransfer.getData('application/x-treedatagrid-rows'), drag = drags.get(token), info = this._dropInfo(event);
        if (!drag || !info || !this._autoDrag)
            return;
        event.preventDefault();
        const args = this._fire('RowDrop', { DragInfo: drag, Model: this.ActiveModel, TargetIndex: info.record.row.ModelIndex, Position: info.position, Cancel: false }, true);
        if (!args.Cancel) {
            try {
                this.ActiveModel.MoveRows(drag.Model, drag.Indexes, args.TargetIndex, args.Position, 'Move');
                this._live.textContent = 'Rows moved';
            }
            catch (error) {
                this._error(error);
            }
        }
        this._dragEnd();
        drag.Grid._dragEnd();
    }
    _clearDrop() { this._dropTarget?.record.el.classList.remove('drop-inside'); this._dropTarget?.record.el.querySelector('.drop-line')?.remove(); this._dropTarget = null; }
    _dragEnd() { if (this._dragToken)
        drags.delete(this._dragToken); this._dragToken = null; this._columnDrag = null; this._autoScrollVelocity = 0; cancelAnimationFrame(this._dragRaf); this._dragRaf = 0; this._clearDrop(); for (const r of this._realized.values())
        r.el.classList.remove('dragging'); }
    _contextMenu(event) {
        const header = this._eventHeader(event), cell = this._eventCell(event);
        if (!header && !cell)
            return;
        event.preventDefault();
        this._hideContextMenu();
        const menu = dom('div', 'context-menu');
        menu.setAttribute('role', 'menu');
        const add = (text, action) => { const button = dom('button', '', text); button.type = 'button'; button.setAttribute('role', 'menuitem'); button.onclick = () => { this._hideContextMenu(); try {
            Promise.resolve(action()).catch(e => this._error(e));
        }
        catch (e) {
            this._error(e);
        } }; menu.append(button); };
        if (header) {
            const i = +header.dataset.column, c = this.ActiveModel.Columns.Get(i);
            add('Sort ascending', () => this.ActiveModel.SortBy(c, ListSortDirection.Ascending));
            add('Sort descending', () => this.ActiveModel.SortBy(c, ListSortDirection.Descending));
            add('Clear sorting', () => this.ActiveModel.ClearSort());
            add('Fit column to content', () => this.AutoSizeColumn(i));
            add('Hide column', () => { c.IsVisible = false; });
        }
        else {
            if (!this.ActiveModel.Selection?.Count)
                this._select(cell.rowIndex, cell.columnIndex);
            add('Copy selection', () => this.Copy());
            if (cell.inner.CanEdit)
                add('Edit cell', () => this.BeginEdit(cell.columnIndex, cell.rowIndex));
            add('Select all', () => this.ActiveModel.Selection?.SelectAll());
        }
        const rect = this._root.getBoundingClientRect();
        menu.style.left = `${clamp(event.clientX - rect.left, 0, Math.max(0, rect.width - 195))}px`;
        menu.style.top = `${clamp(event.clientY - rect.top, 0, Math.max(0, rect.height - 220))}px`;
        this._root.append(menu);
        this._context = menu;
        menu.firstChild?.focus();
    }
    _hideContextMenu() { this._context?.remove(); this._context = null; }
    Dispose() { if (this._disposed)
        return; this.CancelEdit(); this.disconnectedCallback(); disposeAll(this._presentationOff); disposeAll(this._selectionOff); this._presentation?.Dispose(); this._presentation = null; this._generated?.Dispose(); this.ElementFactory.Clear(); this._heightCache.clear(); this._disposed = true; for (const name of eventNames)
        this[name].Clear(); this._root.replaceChildren(); }
}
export function quoteField(value, separator = ',', safe = true) { let s = String(value ?? ''); if (safe && /^[=+\-@\t\r]/.test(s))
    s = "'" + s; return s.includes(separator) || /["\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }
export function parseDelimited(text, separator = '\t') { const rows = [], row = []; let value = '', quoted = false; for (let i = 0; i < String(text).length; i++) {
    const c = text[i];
    if (c === '"') {
        if (quoted && text[i + 1] === '"') {
            value += '"';
            i++;
        }
        else if (!value || quoted)
            quoted = !quoted;
        else
            value += c;
    }
    else if (c === separator && !quoted) {
        row.push(value);
        value = '';
    }
    else if ((c === '\n' || c === '\r') && !quoted) {
        row.push(value);
        rows.push(row.splice(0));
        value = '';
        if (c === '\r' && text[i + 1] === '\n')
            i++;
    }
    else
        value += c;
} if (quoted)
    throw new Error('Unterminated quoted field.'); if (value || row.length || !rows.length) {
    row.push(value);
    rows.push(row);
} return rows; }
export function registerTreeDataGrid(name = 'tree-data-grid') { if (!customElements.get(name))
    customElements.define(name, name === 'tree-data-grid' ? TreeDataGrid : class extends TreeDataGrid {
    }); }
