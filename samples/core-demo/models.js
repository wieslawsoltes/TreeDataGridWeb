import * as C from '../../packages/core/index.js';
import { TreeDataGridPresentationOptions } from '../../packages/web/index.js';
const { FlatTreeDataGridSource, HierarchicalTreeDataGridSource, TextColumn, CheckBoxColumn, TemplateColumn, HierarchicalExpanderColumn, ObservableList, observable } = C;
export { C };
const names = ['Poland', 'Norway', 'Japan', 'Canada', 'Portugal', 'New Zealand', 'Sweden', 'France', 'Germany', 'Australia', 'Finland', 'Switzerland', 'Italy', 'Netherlands', 'Denmark', 'Ireland', 'Austria', 'Spain', 'Belgium', 'Singapore', 'South Korea', 'Iceland', 'Estonia', 'Czechia', 'Greece', 'Mexico', 'Chile', 'Brazil', 'Argentina', 'Peru', 'Colombia', 'Costa Rica', 'South Africa', 'Kenya', 'Morocco', 'Egypt', 'India', 'Indonesia', 'Vietnam', 'Thailand', 'Malaysia', 'Philippines', 'Croatia', 'Slovenia', 'Slovakia', 'Lithuania', 'Latvia', 'Luxembourg'];
const regions = ['Europe', 'Europe', 'Asia Pacific', 'Americas', 'Europe', 'Asia Pacific', 'Europe', 'Europe', 'Europe', 'Asia Pacific', 'Europe', 'Europe', 'Europe', 'Europe', 'Europe', 'Europe', 'Europe', 'Europe', 'Europe', 'Asia Pacific', 'Asia Pacific', 'Europe', 'Europe', 'Europe', 'Europe', 'Americas', 'Americas', 'Americas', 'Americas', 'Americas', 'Americas', 'Americas', 'Africa', 'Africa', 'Africa', 'Africa', 'Asia Pacific', 'Asia Pacific', 'Asia Pacific', 'Asia Pacific', 'Asia Pacific', 'Asia Pacific', 'Europe', 'Europe', 'Europe', 'Europe', 'Europe', 'Europe'];
const numeric = { TextAlignment: 'Right', StringFormat: '{0:N0}', Culture: 'en-US', MinWidth: 105 };
function node(tag, text, style = '') { const e = document.createElement(tag); if (text != null)
    e.textContent = text; e.style.cssText = style; return e; }
function configure(source, options = new TreeDataGridPresentationOptions()) { source.RowSelection.SingleSelect = false; return { source, options, rowHeight: 38 }; }
export function countries(variable = false) {
    const items = new ObservableList(Array.from({ length: variable ? 2400 : names.length }, (_, i) => observable({ Name: names[i % names.length] + (variable ? '\n' + Array.from({ length: i % 4 }, (_, n) => ['Regional overview', 'Illustrative planning dataset', 'Additional information for this location'][n]).join('\n') : ''), Region: regions[i % regions.length], Population: 1000000 + (i * 1275823) % 94000000, Area: 12000 + (i * 72989) % 920000, GDP: 15000 + (i * 1789) % 45000, Enabled: i % 6 !== 0 })));
    const source = new FlatTreeDataGridSource(items);
    source.Columns.AddRange([
        new TextColumn('Country', 'Name', true, '3*', { MinWidth: 200, TextWrapping: variable, AffectsRowHeight: true, Validate: v => v.trim().length > 0 || 'Enter a country name.' }),
        new TextColumn('Region', m => m.Region, null, '2*', { MinWidth: 150 }),
        new TextColumn('Population', m => m.Population, (m, v) => m.Population = v, '1*', numeric),
        new TextColumn('Area · km²', m => m.Area, null, '1*', numeric),
        new TextColumn('GDP index', m => m.GDP, null, '1*', numeric)
    ]);
    return { ...configure(source), rowHeight: variable ? null : 40, items, note: 'Demonstration figures, not current country statistics. Names mirror the upstream Countries scenario.', add: () => items.Add(observable({ Name: 'New location', Region: 'Unassigned', Population: 0, Area: 0, GDP: 0 })) };
}
const firstNames = ['Maya Chen', 'Oliver Reed', 'Sofia Andersson', 'Leo Martin', 'Amelia Novak', 'Noah Williams', 'Isla Park', 'Ethan Brooks', 'Ava Patel', 'Liam Davis', 'Zoe Laurent', 'Lucas Meyer', 'Aria Tan', 'Theo Wilson', 'Freya Scott', 'Felix Weber', 'Nora Evans', 'Hugo Silva'];
function person(Name, Title, Age, children = [], i = 0) { return observable({ Name, Title, Age, Active: i % 7 !== 0, Allocation: 35 + (i * 13) % 65, Location: ['Warsaw', 'London', 'Stockholm', 'Remote'][i % 4], Expansion: { IsExpanded: children.length > 0 }, Children: new ObservableList(children), AllowDrag: true, AllowDrop: true }); }
export function people() {
    let count = 0;
    const groups = ['Product engineering', 'Design & experience', 'Platform & infrastructure', 'Customer solutions'];
    const managers = ['Alex Morgan', 'Elena Fischer', 'Daniel Kim', 'Priya Shah'];
    const root = groups.map((group, g) => person(managers[g], group, 36 + g * 2, Array.from({ length: 7 }, (_, i) => {
        const n = count++;
        return person(firstNames[n % firstNames.length], ['Senior engineer', 'Product designer', 'Staff engineer', 'Research lead', 'Software engineer'][n % 5], 25 + n % 21, i === 2 ? [person('Rowan Ellis', 'Engineering intern', 23, [], 22 + g), person('Emilia Rossi', 'Associate engineer', 24, [], 25 + g)] : [], n + 1);
    }), g + 1));
    const source = new HierarchicalTreeDataGridSource(new ObservableList(root));
    source.Columns.AddRange([
        new HierarchicalExpanderColumn(new TextColumn('Name', 'Name', true, '2.4*', { MinWidth: 225 }), m => m.Children, m => m.Children.Count > 0, 'Expansion.IsExpanded'),
        new TextColumn('Role / team', 'Title', true, '2*', { MinWidth: 180 }),
        new TextColumn('Location', m => m.Location, null, '1*', { MinWidth: 115 }),
        new TextColumn('Age', 'Age', true, 70, { TextAlignment: 'Right', Validate: v => v >= 16 && v <= 110 || 'Age must be between 16 and 110.' }),
        new TemplateColumn('Allocation', 'allocation', '1*', { MinWidth: 125, CompareAscending: (a, b) => a.Allocation - b.Allocation, CompareDescending: (a, b) => b.Allocation - a.Allocation, ClipboardValue: m => m.Allocation + '%' }),
        new CheckBoxColumn('Active', m => m.Active, (m, v) => m.Active = v, 78)
    ]);
    const options = new TreeDataGridPresentationOptions().Register('allocation', {
        create: () => { const e = node('div', null, 'display:flex;align-items:center;gap:10px;width:100%;min-width:80px'); const track = node('div', null, 'height:5px;background:var(--tdg-line);border-radius:9px;flex:1;overflow:hidden'); track.append(node('div', null, 'height:100%;background:var(--tdg-accent);border-radius:9px')); e.append(track, node('span', null, 'font-size:11px;min-width:30px;text-align:right;font-variant-numeric:tabular-nums')); return e; },
        update: (e, m) => { e.firstChild.firstChild.style.width = m.Allocation + '%'; e.lastChild.textContent = m.Allocation + '%'; }
    });
    return { ...configure(source, options), rowHeight: 42, items: source.Items, note: 'Nested observable expansion, editable model properties, checkbox cells and view-owned templates.', add: () => source.Items.Add(person('New colleague', 'Team member', 28, [], 4)) };
}
function file(Name, children = null, Size = 0, i = 0) { return observable({ Name, IsDirectory: children !== null, Children: new ObservableList(children ?? []), IsExpanded: children !== null, IsChecked: false, Size, Modified: new Date(2026, 0, 15 + i % 20, 10, i % 60) }); }
const fileCompare = (a, b) => Number(b.IsDirectory) - Number(a.IsDirectory) || a.Name.localeCompare(b.Name);
export function files(items = null, flat = false) {
    const roots = items ?? new ObservableList([file('workspace', [
            file('src', [file('core', [file('columns.js', null, 13822), file('sources.js', null, 18546), file('selection.js', null, 12905)]), file('web', [file('tree-data-grid.js', null, 46208), file('presentation.js', null, 7120), file('styles.js', null, 6380)]), file('index.js', null, 681)]),
            file('samples', [file('core-demo', [file('models.js', null, 15862), file('app.js', null, 12548), file('app.css', null, 10283)])]),
            file('tests', [file('core.test.mjs', null, 12198), file('browser.py', null, 17640)]), file('README.md', null, 9250), file('package.json', null, 634), file('LICENSE', null, 1114)
        ])]);
    const list = flat ? new ObservableList(flatten(roots)) : roots;
    const source = flat ? new FlatTreeDataGridSource(list) : new HierarchicalTreeDataGridSource(list);
    const name = new TemplateColumn('Name', 'file-name', '3*', { MinWidth: 240, CompareAscending: fileCompare, CompareDescending: (a, b) => Number(b.IsDirectory) - Number(a.IsDirectory) || b.Name.localeCompare(a.Name), ClipboardValue: m => m.Name });
    source.Columns.AddRange([new CheckBoxColumn('Select', m => m.IsChecked, (m, v) => m.IsChecked = v, 60), flat ? name : new HierarchicalExpanderColumn(name, m => m.Children, m => m.IsDirectory, 'IsExpanded'), new TextColumn('Size', m => m.Size, null, '1*', { MinWidth: 90, TextAlignment: 'Right', Formatter: (v, m) => m.IsDirectory ? '—' : v < 1024 ? v + ' B' : (v / 1024).toFixed(1) + ' KB' }), new TextColumn('Modified', m => m.Modified, null, '1.5*', { MinWidth: 180, Formatter: v => v.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) })]);
    const options = new TreeDataGridPresentationOptions().Register('file-name', { create: () => { const e = node('span', null, 'display:flex;align-items:center;gap:9px'); e.append(node('span', null, 'color:var(--tdg-accent);font-size:16px'), node('span')); return e; }, update: (e, m) => { e.firstChild.textContent = m.IsDirectory ? '▱' : '▤'; e.lastChild.textContent = m.Name; } });
    return { ...configure(source, options), roots, flat, rowHeight: 37, note: 'A deterministic virtual filesystem. “Open folder” reads only files you explicitly choose; it does not write to disk.' };
}
function* flatten(items) { for (const m of items) {
    yield m;
    if (m.Children?.Count)
        yield* flatten(m.Children);
} }
export function directoryItems(fileList) { const root = file('Selected folder', []), lookup = new Map([['', root]]); for (const f of fileList) {
    const parts = (f.webkitRelativePath || f.name).split('/');
    let path = '';
    let parent = root;
    for (let i = 0; i < parts.length - 1; i++) {
        path += (path ? '/' : '') + parts[i];
        if (!lookup.has(path)) {
            const folder = file(parts[i], []);
            parent.Children.Add(folder);
            lookup.set(path, folder);
        }
        parent = lookup.get(path);
    }
    parent.Children.Add(file(parts.at(-1), null, f.size));
} return new ObservableList([root]); }
const excerpts = [
    ['Virtualization without a fixed row size', 'Visible rows are measured after layout. A prefix-sum index maps scroll offsets to rows and updates the geometry when content wraps or changes.'],
    ['One model. Independent views.', 'Selection and expansion live in the framework-neutral source. Each presentation owns its cell objects, measured column widths, subscriptions and visual state. Resize one view to see independent star sizing.'],
    ['Observable state and nested paths', 'Editing a value changes the original model. Nested property subscriptions reconnect when an intermediate object is replaced. Removing a view releases the bindings owned by that view.'],
    ['Templates stay in the browser layer', 'Core TemplateColumn only names a presentation key. The view supplies a create, update and dispose contract. This keeps the source usable in Node and avoids coupling the model to DOM elements.'],
    ['An index path is not a row position', 'Sorting and expansion change displayed positions without changing the model path. Use ModelIndexToRowIndex and RowIndexToModelIndex to move between the two coordinate systems.'],
    ['Keyboard-first interaction', 'Arrow keys, Page Up and Page Down, Home and End move through the grid. F2 begins editing. Enter commits. Escape cancels. Shift extends ranges; the modifier key toggles individual rows.']
];
export function articles() {
    const items = new ObservableList(Array.from({ length: 60 }, (_, i) => observable({ Title: excerpts[i % 6][0], Extract: excerpts[i % 6][1] + (i % 3 === 0 ? '\n\n' + excerpts[(i + 1) % 6][1] : ''), Category: ['Architecture', 'Performance', 'Interaction'][i % 3], Number: i + 1 })));
    const source = new FlatTreeDataGridSource(items);
    source.Columns.AddRange([new TemplateColumn('Article', 'article-card', 95), new TextColumn('Title', m => m.Title, null, '2*', { MinWidth: 170, TextWrapping: true, AffectsRowHeight: true }), new TextColumn('Extract', m => m.Extract, null, '4*', { MinWidth: 230, TextWrapping: true, AffectsRowHeight: true })]);
    const options = new TreeDataGridPresentationOptions().Register('article-card', { create: () => node('div', null, 'display:flex;align-items:center;justify-content:center;width:66px;height:58px;margin:4px 0;background:var(--tdg-selected);color:var(--tdg-accent);font-size:24px;font-weight:600;border:1px solid var(--tdg-line);border-radius:7px'), update: (e, m) => e.textContent = String(m.Number).padStart(2, '0') });
    return { ...configure(source, options), items, rowHeight: null, note: 'Offline article fixtures exercise the upstream Wikipedia image/text-template scenario. “Load feed” optionally requests Wikimedia content.', async loadFeed() { const date = new Date(); const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`; const response = await fetch(url, { signal: AbortSignal.timeout(12000) }); if (!response.ok)
            throw new Error('Feed request failed: ' + response.status); const json = await response.json(); const rows = (json.events ?? []).slice(0, 100).map((e, i) => observable({ Title: String(e.year), Extract: e.text, Number: i + 1, Category: 'On this day' })); if (!rows.length)
            throw new Error('The feed returned no articles.'); items.Reset(rows); } };
}
export function dragDrop() { const make = (Name, Children = [], i = 0) => observable({ Name, Children: new ObservableList(Children), AllowDrag: i % 9 !== 8, AllowDrop: i % 7 !== 6 }); const source = new HierarchicalTreeDataGridSource(new ObservableList(['Planning', 'In progress', 'In review', 'Completed'].map((name, g) => make(name, Array.from({ length: 5 }, (_, i) => make(['Implement row recycling', 'Test nested selection', 'Review template lifecycle', 'Measure variable rows', 'Document the public API'][i] + ` · ${g + 1}`, [], g * 5 + i)))))); source.Columns.AddRange([new HierarchicalExpanderColumn(new TextColumn('Work item', 'Name', true, '3*', { MinWidth: 330 }), m => m.Children), new CheckBoxColumn('Allow drag', m => m.AllowDrag, (m, v) => m.AllowDrag = v, '1*', { MinWidth: 110 }), new CheckBoxColumn('Allow drop', m => m.AllowDrop, (m, v) => m.AllowDrop = v, '1*', { MinWidth: 110 })]); source.ExpandAll(); return { ...configure(source), rowHeight: 42, note: 'Drag rows above, below or into groups. Drag/drop permissions are enforced through cancellable grid events.', drag: true }; }
export function templates() {
    const items = new ObservableList(Array.from({ length: 200 }, (_, i) => observable({ Name: `Component ${String(i + 1).padStart(3, '0')}`, Type: ['Foundation', 'Interaction', 'Presentation', 'Integration'][i % 4], Details: `Editable details for component ${i + 1}`, Enabled: i % 3 !== 0, Ready: i % 3 === 0 ? null : i % 2 === 0, Count: i % 9 })));
    const source = new FlatTreeDataGridSource(items);
    source.Columns.AddRange([new TemplateColumn('Status', 'status', 110, { ClipboardValue: m => m.Enabled ? 'Enabled' : 'Disabled' }), new TextColumn('Name', 'Name', true, '1.5*', { MinWidth: 170 }), new TextColumn('Type', m => m.Type, null, '1*', { MinWidth: 120 }), new TemplateColumn('Details · double-click to edit', 'details', '2*', { MinWidth: 230, ClipboardValue: m => m.Details }), new CheckBoxColumn('Ready', m => m.Ready, (m, v) => m.Ready = v, 75, { IsThreeState: true }), new TemplateColumn('Action', 'action', 120)]);
    const options = new TreeDataGridPresentationOptions().Register('status', { create: () => node('span', null, 'display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:4px 9px;border-radius:99px;background:var(--tdg-selected);color:var(--tdg-accent)'), update: (e, m) => e.textContent = m.Enabled ? '● Enabled' : '○ Disabled' })
        .Register('details', { create: () => node('span'), update: (e, m) => e.textContent = m.Details, edit: (m) => { const e = node('input'); e.value = m.Details; e.setAttribute('aria-label', 'Edit details'); return e; }, read: e => e.value, commit: (m, value) => m.Details = value })
        .Register('action', { create: (m, ctx) => { const b = node('button', null, 'border:1px solid var(--tdg-line);background:var(--tdg-bg);color:var(--tdg-text);border-radius:5px;padding:5px 10px;font:inherit;font-size:11px;cursor:pointer'); b.onclick = () => { m.Count++; ctx.notify(); }; return b; }, update: (e, m) => e.textContent = `Run task · ${m.Count}`, dispose: e => { if (e)
            e.onclick = null; } });
    return { ...configure(source, options), rowHeight: 43, note: 'Recycled DOM templates, custom template editors, interactive buttons and nullable three-state checkboxes.' };
}
export function stress(count = 100000, wide = false) {
    const before = performance.now();
    const items = Array.from({ length: count }, (_, i) => ({ Id: i + 1, Name: `Record ${String(i + 1).padStart(7, '0')}`, Category: ['Product', 'Engineering', 'Research', 'Operations'][i % 4], Value: ((i * 7919) % 100000) / 100, Enabled: i % 5 !== 0 }));
    const source = new FlatTreeDataGridSource(items);
    source.Columns.Add(new TextColumn('Record', m => m.Name, null, 210));
    if (wide) {
        source.Columns.AddRange(Array.from({ length: 199 }, (_, i) => new TextColumn(`Field ${i + 2}`, m => (m.Id * (i + 3)) % 10000, null, 115, { TextAlignment: 'Right' })));
    }
    else
        source.Columns.AddRange([new TextColumn('ID', m => m.Id, null, 110, numeric), new TextColumn('Category', m => m.Category, null, '2*', { MinWidth: 180 }), new TextColumn('Value', m => m.Value, (m, v) => m.Value = v, '1*', { ...numeric, StringFormat: '{0:N2}' }), new CheckBoxColumn('Enabled', m => m.Enabled, (m, v) => m.Enabled = v, 100)]);
    return { ...configure(source), items, rowHeight: 32, createdMs: performance.now() - before, note: wide ? '200 columns. Only visible columns and the frozen leading column are realized.' : 'Synthetic local data. Row objects are created lazily; the view realizes only the viewport plus pixel overscan.' };
}
export const catalog = [
    { id: 'people', title: 'People & teams', subtitle: 'Hierarchical sources, nested expansion and editable cells.', icon: 'people', tag: 'HIERARCHY', create: people },
    { id: 'countries', title: 'Countries', subtitle: 'Flat source, sortable columns and observable collections.', icon: 'globe', tag: 'FLAT SOURCE', create: () => countries(false) },
    { id: 'variable', title: 'Variable row heights', subtitle: 'Measured content, pixel-accurate scrolling and stable anchors.', icon: 'rows', tag: 'VARIABLE HEIGHT', create: () => countries(true) },
    { id: 'files', title: 'Files & folders', subtitle: 'Hierarchy templates, directory-first sorting and a flat view.', icon: 'folder', tag: 'TEMPLATES', create: () => files() },
    { id: 'articles', title: 'Article feed', subtitle: 'The Core Wikipedia scenario, with offline content by default.', icon: 'article', tag: 'RICH CONTENT', create: articles },
    { id: 'drag', title: 'Drag & drop', subtitle: 'Reparent and reorder rows with cancellable permissions.', icon: 'drag', tag: 'INTERACTION', create: dragDrop },
    { id: 'templates', title: 'Cell templates', subtitle: 'Custom editors, recycled presentations and interactive content.', icon: 'template', tag: 'PRESENTATION', create: templates },
    { id: 'find', title: 'Find displayed row', subtitle: 'Translate model index paths into sorted display positions.', icon: 'search', tag: 'INDEX MAPPING', create: () => countries(false) },
    { id: 'stress', title: 'Virtualization lab', subtitle: 'Large datasets. Small DOM. Live renderer instrumentation.', icon: 'bolt', tag: 'PERFORMANCE', create: () => stress() },
    { id: 'shared', title: 'Shared model', subtitle: 'Two independent presentations consume exactly the same Core rows.', icon: 'split', tag: 'CORE / VIEW SPLIT', create: () => { const r = people(); for (const c of r.source.Columns)
            c.Options.MinWidth = 60; return r; } }
];
