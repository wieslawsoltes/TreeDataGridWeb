import * as W from '../../packages/web/index.js';
import { C, catalog, stress, files, directoryItems } from './models.js';
const $ = id => document.getElementById(id), grid = $('grid'), grid2 = $('grid2');
const paths = {
    grid: 'M3 4h18v16H3zM3 9h18M3 14h18M9 4v16', people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0', globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18', rows: 'M4 3h16v4H4zM4 11h16v10H4zM8 14h8M8 18h6', folder: 'M3 7V4h6l2 3h10v13H3z', article: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h4', drag: 'M8 4v16M4 8l4-4 4 4M4 16l4 4 4-4M16 6h5M16 12h5M16 18h5', template: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', search: 'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0', bolt: 'M13 2 4 14h7l-1 8 10-13h-7z', split: 'M3 4h18v16H3zM12 4v16', moon: 'M21 13a9 9 0 0 1-10-10A9 9 0 1 0 21 13', code: 'M8 5 2 12l6 7M16 5l6 7-6 7M14 3 10 21', reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6', download: 'M12 3v12M7 10l5 5 5-5M4 17v4h16v-4', plus: 'M12 4v16M4 12h16', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7', expand: 'M6 3v5H1M6 8 1 3M18 21v-5h5M18 16l5 5M8 12h8', collapse: 'M1 8h5V3M6 8 1 3M23 16h-5v5M18 16l5 5M8 12h8', copy: 'M9 9h12v12H9zM5 15H3V3h12v2', info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 11v6M12 7v.1', sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6', save: 'M4 3h13l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8', close: 'M5 5l14 14M19 5 5 19'
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] ?? paths.grid}"/></svg>`; }
for (const n of document.querySelectorAll('[data-icon]'))
    n.innerHTML = icon(n.dataset.icon);
const models = new Map(), events = [];
let current = null, currentId = '', offs = [], toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 3800); }
function log(type, description = '') { events.unshift({ time: new Date().toLocaleTimeString('en-GB'), type, description }); if (events.length > 100)
    events.pop(); $('event-count').textContent = Number($('event-count').textContent) + 1; renderEvents(); }
function renderEvents() { if ($('event-panel').hidden)
    return; const box = $('events'); box.replaceChildren(); for (const e of events.slice(0, 30)) {
    const line = document.createElement('div');
    line.className = 'event-line';
    for (const [tag, text] of [['span', e.time], ['strong', e.type], ['span', e.description]]) {
        const n = document.createElement(tag);
        n.textContent = text;
        line.append(n);
    }
    box.append(line);
} }
for (const [item, i] of catalog.map((x, i) => [x, i])) {
    if (i === 8) {
        const d = document.createElement('div');
        d.className = 'nav-divider';
        $('navigation').append(d);
    }
    const b = document.createElement('button');
    b.dataset.demo = item.id;
    b.innerHTML = icon(item.icon);
    const text = document.createElement('span');
    text.textContent = item.title;
    b.append(text);
    if (item.id === 'stress') {
        const tag = document.createElement('small');
        tag.className = 'nav-new';
        tag.textContent = 'LAB';
        b.append(tag);
    }
    b.onclick = () => switchDemo(item.id);
    $('navigation').append(b);
}
function clearOffs() { for (const off of offs)
    off(); offs = []; }
function replaceActive(result) { models.set(currentId, result); switchDemo(currentId); }
function updateColumns() { const box = $('column-list'); box.replaceChildren(); const columns = current?.source.Columns; if (!columns)
    return; let i = 0; for (const c of columns) {
    if (i++ >= 12)
        break;
    const label = document.createElement('label');
    label.className = 'column-option';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = c.IsVisible;
    check.onchange = () => c.IsVisible = check.checked;
    const name = document.createElement('span');
    name.textContent = c.Header;
    const width = document.createElement('small');
    width.textContent = c.Width.ToString();
    label.append(check, name, width);
    box.append(label);
} if (columns.Count > 12) {
    const text = document.createElement('small');
    text.style.cssText = 'font-size:9px;color:var(--muted)';
    text.textContent = `+ ${columns.Count - 12} more columns`;
    box.append(text);
} }
function updateStatus() { if (!current)
    return; const stats = grid.Stats, s = current.source.Selection; $('row-count').textContent = current.source.Rows.Count.toLocaleString('en-US'); $('selection-count').textContent = s?.Count ? `${s.Count.toLocaleString()} ${s instanceof C.TreeDataGridCellSelectionModel ? 'cells' : 'rows'} selected` : 'No selection'; $('row-location').textContent = stats.Rows ? `Rows ${(stats.FirstRow + 1).toLocaleString()}–${(stats.LastRow + 1).toLocaleString()}` : 'No rows'; $('metric-rows').textContent = stats.RealizedRows; $('metric-cells').textContent = stats.RealizedCells; $('metric-frame').textContent = stats.FrameMilliseconds.toFixed(2) + ' ms'; $('metric-reused').textContent = stats.ReusedElements.toLocaleString(); $('metric-measured').textContent = stats.MeasuredRows.toLocaleString(); }
function toolButton(text, action) { const b = document.createElement('button'); b.className = 'button'; b.textContent = text; b.onclick = () => { try {
    Promise.resolve(action()).catch(e => toast(e.message));
}
catch (e) {
    toast(e.message);
} }; $('scenario-tools').append(b); return b; }
function tools() {
    const box = $('scenario-tools');
    box.replaceChildren();
    box.hidden = true;
    const id = currentId;
    if (id === 'files') {
        box.hidden = false;
        toolButton('Open folder…', () => $('folder-input').click());
        toolButton(current.flat ? 'Tree view' : 'Flat view', () => replaceActive(files(current.roots, !current.flat)));
        const label = document.createElement('span');
        label.className = 'tool-label';
        label.textContent = 'Read-only local file metadata';
        box.append(label);
    }
    if (id === 'articles') {
        box.hidden = false;
        toolButton('Load Wikimedia feed', async () => { await current.loadFeed(); toast('Live article feed loaded.'); });
        const label = document.createElement('span');
        label.className = 'tool-label';
        label.textContent = 'Offline fixtures until explicitly loaded';
        box.append(label);
    }
    if (id === 'find') {
        box.hidden = false;
        const input = document.createElement('input');
        input.id = 'model-index';
        input.type = 'number';
        input.min = 0;
        input.max = current.source.Items.Count - 1;
        input.value = '12';
        input.setAttribute('aria-label', 'Model index');
        box.append(input);
        toolButton('Reveal model index', () => { const path = new C.IndexPath(Number(input.value)), row = grid.BringIntoView(path); if (row >= 0) {
            current.source.RowSelection.SelectedIndex = path;
            toast(`Model ${path} → displayed row ${row}`);
        } });
        toolButton('Sort by country', () => current.source.SortBy(current.source.Columns.Get(0), C.ListSortDirection.Ascending));
    }
    if (id === 'people') { /* Main view intentionally stays focused on the component. */ }
    if (id === 'stress') {
        box.hidden = false;
        const select = document.createElement('select');
        select.id = 'dataset-size';
        select.setAttribute('aria-label', 'Dataset size');
        for (const n of [10000, 100000, 1000000])
            select.add(new Option(n.toLocaleString() + ' rows', String(n)));
        select.value = String(current.items.length);
        select.onchange = () => replaceActive(stress(Number(select.value)));
        box.append(select);
        toolButton('200 columns', () => replaceActive(stress(2000, true)));
        toolButton('Jump to middle', () => grid.ScrollIntoView(Math.floor(current.source.Rows.Count / 2), 0, 'start'));
        toolButton('Last row', () => grid.ScrollIntoView(current.source.Rows.Count - 1, 0));
        toolButton('Measure scrolling', scrollBenchmark);
    }
    if (id === 'shared') {
        box.hidden = false;
        toolButton('Update shared model', () => { const m = current.source.Items.Get(0); m.Name = m.Name.endsWith(' ✓') ? m.Name.slice(0, -2) : m.Name + ' ✓'; });
        toolButton('Replace nested expansion', () => { const m = current.source.Items.Get(0); m.Expansion = { IsExpanded: !m.Expansion.IsExpanded }; });
    }
}
export function switchDemo(id = 'people') {
    const definition = catalog.find(x => x.id === id) ?? catalog[0];
    id = definition.id;
    clearOffs();
    currentId = id;
    grid.Model = null;
    grid2.Model = null;
    current = models.get(id) ?? definition.create();
    models.set(id, current);
    grid.PresentationOptions = current.options;
    grid.Model = current.source;
    grid.RowHeight = current.rowHeight;
    grid.EstimatedRowHeight = 36;
    grid.CanUserResizeColumns = $('resize-cols').checked;
    grid.CanUserReorderColumns = $('reorder-cols').checked;
    grid.ShowColumnHeaders = $('headers').checked;
    grid.ShowGridLines = $('grid-lines').checked;
    grid.AutoDragDropRows = !!current.drag;
    grid.FrozenColumns = id === 'stress' ? 1 : 0;
    $('grid-host').classList.toggle('split', id === 'shared');
    $('second-view').hidden = id !== 'shared';
    if (id === 'shared') {
        grid2.PresentationOptions = current.options;
        grid2.Model = current.source;
        grid2.RowHeight = current.rowHeight;
        grid2.CanUserResizeColumns = true;
    }
    $('page-title').textContent = definition.title;
    $('breadcrumb-name').textContent = definition.title;
    $('page-subtitle').textContent = definition.subtitle;
    $('scenario-tag').textContent = definition.tag;
    $('sample-note').textContent = current.note;
    for (const b of $('navigation').querySelectorAll('button')) {
        b.classList.toggle('active', b.dataset.demo === id);
        b.setAttribute('aria-current', b.dataset.demo === id ? 'page' : 'false');
    }
    $('search').value = '';
    $('search').placeholder = id === 'find' ? 'Find a country…' : 'Search rows…';
    $('add').disabled = !current.add;
    $('remove').disabled = !current.source.Items.RemoveAt;
    $('expand').disabled = $('collapse').disabled = !current.source.IsHierarchical;
    $('frozen').value = String(grid.FrozenColumns);
    const choice = current.rowHeight === null ? 'auto' : String(current.rowHeight);
    if (![...$('row-height').options].some(o => o.value === choice))
        $('row-height').add(new Option(`Sample · ${choice} px`, choice));
    $('row-height').value = choice;
    const isCell = current.source.Selection instanceof C.TreeDataGridCellSelectionModel;
    $('row-mode').classList.toggle('selected', !isCell);
    $('cell-mode').classList.toggle('selected', isCell);
    offs.push(current.source.Changed.Subscribe((_, e) => { if (e.Kind === 'Columns' || e.Kind === 'Column')
        updateColumns(); updateStatus(); }), current.source.Sorted.Subscribe(() => log('Sorted', 'Displayed order rebuilt')));
    if (current.source.IsHierarchical) {
        offs.push(current.source.RowExpanded.Subscribe((_, e) => log('RowExpanded', String(e.ModelIndex))), current.source.RowCollapsed.Subscribe((_, e) => log('RowCollapsed', String(e.ModelIndex))));
    }
    tools();
    updateColumns();
    updateStatus();
    log('ModelChanged', definition.title);
    history.replaceState(null, '', '#' + id);
    window.demo.current = current;
    window.demo.id = id;
}
const sourceExample = `import { observable, ObservableList, HierarchicalTreeDataGridSource,
  HierarchicalExpanderColumn, TextColumn, CheckBoxColumn
} from './packages/core/index.js';
import './packages/web/index.js';

// No DOM dependency in the source or its model objects.
const people = new ObservableList([
  observable({ Name: 'Alex Morgan', Active: true,
    Expansion: { IsExpanded: true },
    Children: new ObservableList([
      observable({ Name: 'Maya Chen', Active: true,
        Expansion: { IsExpanded: false }, Children: new ObservableList() })
    ])
  })
]);
const model = new HierarchicalTreeDataGridSource(people);
model.Columns.Add(new HierarchicalExpanderColumn(
  new TextColumn('Name', 'Name', true, '3*'),
  person => person.Children, null, 'Expansion.IsExpanded'
));
model.Columns.Add(new CheckBoxColumn('Active',
  person => person.Active, (person, value) => person.Active = value, 100
));
model.RowSelection.SingleSelect = false;

const grid = document.querySelector('tree-data-grid');
grid.CanUserResizeColumns = true;
grid.RowHeight = null;       // Measure variable-height content.
grid.Model = model;          // Direct Core binding; no Source adapter.

// HTML: <tree-data-grid style="height:500px"></tree-data-grid>
// Reuse this model in another view; never dispose it from a view.`;
$('source-code').textContent = sourceExample;
$('source-toggle').onclick = () => $('code-dialog').showModal();
$('close-code').onclick = () => $('code-dialog').close();
$('copy-code').onclick = async () => { try {
    await navigator.clipboard.writeText(sourceExample);
    toast('Example copied.');
}
catch {
    toast('Select and copy the example from the code panel.');
} };
$('theme').onclick = () => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; try {
    localStorage.setItem('tdg-theme', dark ? 'dark' : 'light');
}
catch { } grid.InvalidateVisual(); };
try {
    document.documentElement.dataset.theme = localStorage.getItem('tdg-theme') ?? 'light';
}
catch { }
$('reset').onclick = () => { const old = models.get(currentId); models.delete(currentId); switchDemo(currentId); old?.source.Dispose(); toast('Sample reset.'); };
$('search').addEventListener('input', () => { const value = $('search').value.trim().toLocaleLowerCase(); if (currentId === 'find') {
    if (value)
        grid.Search(value);
    return;
} current.source.SetFilter(value ? m => { for (const c of current.source.Columns) {
    const column = c.Inner ?? c;
    const v = column.Options?.ClipboardValue?.(m) ?? column.GetValue?.(m);
    if (v != null && typeof v !== 'object' && String(v).toLocaleLowerCase().includes(value))
        return true;
} return false; } : null); });
$('add').onclick = () => { current.add?.(); const i = current.source.Items.Count - 1; grid.BringIntoView(new C.IndexPath(i)); toast('Item added to the observable collection.'); };
$('remove').onclick = () => { const selection = current.source.Selection instanceof C.TreeDataGridCellSelectionModel ? current.source.Selection.RowSelection : current.source.RowSelection; if (!selection?.Count)
    return; const paths = selection.SelectedIndexes.slice().sort((a, b) => b.CompareTo(a)); current.source.Batch(() => { for (const path of paths) {
    if (paths.some(p => p.IsAncestorOf(path)))
        continue;
    const list = current.source.GetParentItems(path.Parent);
    list.RemoveAt?.(path[path.Count - 1]);
} }); toast('Selected items removed.'); };
$('expand').onclick = () => current.source.ExpandAll?.();
$('collapse').onclick = () => current.source.CollapseAll?.();
$('copy').onclick = () => grid.Copy().then(text => toast(text ? 'Selection copied.' : 'Select rows or cells first.')).catch(e => toast(e.message));
function selectionMode(cell) { grid.SelectionMode = (cell ? C.TreeDataGridSelectionMode.Cell : 0) | C.TreeDataGridSelectionMode.Multiple; $('row-mode').classList.toggle('selected', !cell); $('cell-mode').classList.toggle('selected', cell); grid.AutoDragDropRows = !!current.drag && !cell; updateStatus(); }
$('row-mode').onclick = () => selectionMode(false);
$('cell-mode').onclick = () => selectionMode(true);
$('row-height').onchange = () => grid.RowHeight = $('row-height').value === 'auto' ? null : Number($('row-height').value);
$('frozen').onchange = () => grid.FrozenColumns = Number($('frozen').value);
$('headers').onchange = () => grid.ShowColumnHeaders = $('headers').checked;
$('grid-lines').onchange = () => grid.ShowGridLines = $('grid-lines').checked;
$('resize-cols').onchange = () => grid.CanUserResizeColumns = $('resize-cols').checked;
$('reorder-cols').onchange = () => grid.CanUserReorderColumns = $('reorder-cols').checked;
$('fit-columns').onclick = () => grid.AutoSizeAllColumns();
function download(name, text, type = 'text/plain') { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type })); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('export').onclick = () => { try {
    download(`treedatagrid-${currentId}.csv`, '\ufeff' + grid.ExportCsv(), 'text/csv;charset=utf-8');
    toast('Visible source rows exported as CSV.');
}
catch (e) {
    toast(e.message);
} };
$('save-state').onclick = () => { try {
    localStorage.setItem('tdg-view-' + currentId, JSON.stringify(grid.SaveViewState()));
    toast('View configuration saved locally.');
}
catch (e) {
    toast(e.message);
} };
$('restore-state').onclick = () => { try {
    const text = localStorage.getItem('tdg-view-' + currentId);
    if (!text) {
        toast('Save a view configuration first.');
        return;
    }
    grid.RestoreViewState(JSON.parse(text));
    updateColumns();
    toast('View restored.');
}
catch (e) {
    toast(e.message);
} };
$('events-toggle').onclick = () => { $('event-panel').hidden = !$('event-panel').hidden; renderEvents(); };
$('clear-events').onclick = () => { events.length = 0; $('event-count').textContent = '0'; renderEvents(); };
$('folder-input').onchange = () => { if ($('folder-input').files.length)
    replaceActive(files(directoryItems($('folder-input').files))); };
grid.Rendered.Subscribe(updateStatus);
grid.SelectionChanged.Subscribe((_, e) => { updateStatus(); log('SelectionChanged', `${e.Selection.Count} selected`); });
grid.CellValueChanged.Subscribe((_, e) => log('CellValueChanged', `row ${e.RowIndex}, column ${e.ColumnIndex}`));
grid.CellEditEnded.Subscribe((_, e) => log('CellEditEnded', e.Canceled ? 'Canceled' : 'Committed'));
grid.Error.Subscribe((_, e) => { log('Error', e.Error.message); toast(e.Error.message); });
grid.RowDrop.Subscribe((_, e) => { const target = current.source.GetModelAt(e.TargetIndex); if (target.AllowDrop === false)
    e.Cancel = true; log('RowDrop', `${e.TargetIndex} · ${e.Position}`); });
grid.RowDragStarted.Subscribe((_, e) => { if (e.Rows.some(m => m.AllowDrag === false))
    e.Cancel = true; });
grid.RowDragOver.Subscribe((_, e) => { if (current.source.GetModelAt(e.TargetIndex).AllowDrop === false)
    e.Cancel = true; });
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    $('search').focus();
} });
export async function scrollBenchmark() { const frame = () => new Promise(resolve => requestAnimationFrame(resolve)); const total = current.source.Rows.Count, times = [], cpu = []; const off = grid.Rendered.Subscribe((_, e) => cpu.push(e.Stats.FrameMilliseconds)); for (let i = 0; i < 90; i++) {
    const t = performance.now();
    grid.ScrollIntoView(Math.floor((i / 89) * (total - 1)), 0, 'start');
    await frame();
    await frame();
    times.push(performance.now() - t);
} off(); cpu.sort((a, b) => a - b); const report = { rows: total, columns: current.source.Columns.Count, realizedRows: grid.Stats.RealizedRows, realizedCells: grid.Stats.RealizedCells, jsRenderMedianMs: cpu[Math.floor(cpu.length * .5)] ?? 0, jsRenderP95Ms: cpu[Math.floor(cpu.length * .95)] ?? 0, twoRafMeanMs: times.reduce((a, b) => a + b, 0) / times.length, passes: cpu.length }; window.demo.lastBenchmark = report; toast(`JS render median ${report.jsRenderMedianMs.toFixed(2)} ms · p95 ${report.jsRenderP95Ms.toFixed(2)} ms · ${report.realizedRows} DOM rows`); log('Benchmark', JSON.stringify(report)); return report; }
window.demo = { C, W, grid, grid2, models, catalog, switchDemo, stress, files, toast, events, scrollBenchmark, current: null };
switchDemo(location.hash.slice(1) || 'people');
