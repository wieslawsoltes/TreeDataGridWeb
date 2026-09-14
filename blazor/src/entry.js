import * as core from '../../packages/core/index.js';
import * as web from '../../packages/web/index.js';
export const api = { ...core, ...web, Core: core, Web: web };
const states = new WeakMap(), functionIds = new WeakMap();
let style, nextFunction = 0;
function signature(value) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item !== 'function') return item;
    if (item.templateKey) return item.templateKey;
    if (!functionIds.has(item)) functionIds.set(item, ++nextFunction);
    return { $function: functionIds.get(item) };
  });
}
function loadStyles() {
  return style ??= new Promise((resolve, reject) => {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./styles.css', import.meta.url).href;
    link.onload = resolve; link.onerror = () => { style = null; link.remove(); reject(new Error('Could not load TreeDataGrid styles.')); }; document.head.append(link);
  });
}
function selection(grid) { const value = grid.Model?.Selection; return value?.RowSelection ?? value; }
function emit(grid, name, detail) { grid.dispatchEvent(new CustomEvent(name, { detail })); }
function configure(grid, options) {
  const state = states.get(grid);
  const { items = [], columns = [], childrenProperty, model, itemsRevision = 0, selectedPaths, ...properties } = options;
  if (model) {
    if (grid.Model !== model) { grid.Model = model; state.owned?.Dispose(); state.owned = null; state.schema = null; }
  } else {
    const schema = signature([columns, childrenProperty]), input = signature(items ?? []);
    const differentSchema = state.schema !== schema || !state.owned;
    const changedInput = state.input !== input || state.itemsRevision !== itemsRevision;
    // A parent acknowledgement of a native edit must not rebuild the source or lose selection/scroll.
    if (differentSchema || (changedInput && input !== signature(Array.from(grid.Model?.Items ?? [])))) {
      const source = childrenProperty ? new core.HierarchicalTreeDataGridSource(items ?? []) : new core.FlatTreeDataGridSource(items ?? []);
      const presentation = new web.TreeDataGridPresentationOptions();
      try {
        columns.forEach((column, index) => {
          if (!['text', 'checkbox', 'template'].includes(column.kind ?? 'text')) throw new TypeError(`Unknown column kind: ${column.kind}`);
          const Type = column.kind === 'checkbox' ? core.CheckBoxColumn : core.TextColumn;
          let value = new Type(column.header, column.property, column.editable ? true : null, column.width ?? '*', column.options ?? null, column.id ?? column.property);
          if (column.template) {
            if (typeof column.template !== 'function') throw new TypeError('Template must be a browser or Razor factory.');
            const key = `blazor-column-${index}`; value.PresentationKey = key;
            const factory = column.template;
            const template = { create: factory, update: factory.update, dispose: factory.dispose };
            if (column.editTemplate) {
              template.edit = column.editTemplate;
              template.read = (host, row) => {
                const input = host.matches?.('[data-grid-value]') ? host : host.querySelector('[data-grid-value]');
                if (!input) throw new Error('An edit template must contain an input marked data-grid-value.');
                return input.type === 'checkbox' ? input.checked : web.parseValue(value, input.value, value.GetValue(row));
              };
            }
            presentation.Register(key, template);
          }
          if (index === 0 && childrenProperty) value = new core.HierarchicalExpanderColumn(value, childrenProperty);
          source.Columns.Add(value);
        });
        grid.Model = null; grid.PresentationOptions = presentation; grid.Model = source;
      } catch (error) { source.Dispose(); throw error; }
      state.owned?.Dispose(); state.owned = source;
    }
    state.schema = schema; state.input = input; state.itemsRevision = itemsRevision;
  }
  for (const [name, value] of Object.entries(properties)) if (grid[name] !== value) grid[name] = value;
  if (selectedPaths != null && signature(selectedPaths) !== state.selectedInput) {
    grid.SelectPaths(selectedPaths); state.selectedInput = signature(selectedPaths);
  }
}
export async function mount(host, options) {
  await loadStyles(); web.registerTreeDataGrid();
  const grid = document.createElement('tree-data-grid'); grid.style.cssText = 'display:block;width:100%;height:100%;min-height:0';
  const state = { owned: null, schema: null, disposed: false, subscriptions: [] }; states.set(grid, state);
  grid.ReadItems = () => Array.from(grid.Model?.Items ?? []);
  grid.SelectPaths = paths => {
    const selected = selection(grid); if (!selected) return;
    if (signature(selected.SelectedIndexes.map(path => path.Key)) === signature(paths)) return;
    selected.BeginBatchUpdate(); try { selected.Clear(); for (const path of paths) selected.Select(core.IndexPath.From(path)); } finally { selected.EndBatchUpdate(); }
  };
  grid.SetCellValue = (path, id, value) => {
    const source = grid.Model, columns = [...source.Columns], index = columns.findIndex(column => column.Id === id);
    if (index < 0) throw new RangeError(`Unknown column: ${id}`);
    const column = columns[index], row = source.GetModelAt(core.IndexPath.From(path)), old = column.GetValue(row);
    column.SetValue(row, value); source.NotifyItemChanged(row);
    grid.CellValueChanged.Emit(grid, { Model: row, ColumnIndex: index, RowIndex: source.Rows.ModelIndexToRowIndex(core.IndexPath.From(path)), OldValue: old, Value: value });
  };
  state.subscriptions.push(grid.CellValueChanged.Subscribe((_sender, event) => {
    const source = grid.Model;
    emit(grid, 'blazor-cellchange', { item: event.Model, path: source.FindModelIndex(event.Model).Key, columnIndex: event.ColumnIndex, columnId: source.Columns.Get(event.ColumnIndex).Id, oldValue: event.OldValue, value: event.Value });
  }));
  state.subscriptions.push(grid.SelectionChanged.Subscribe(() => emit(grid, 'blazor-selectionchange', { paths: selection(grid)?.SelectedIndexes.map(path => path.Key) ?? [] })));
  const dispose = grid.Dispose.bind(grid);
  grid.Dispose = () => {
    if (state.disposed) return; state.disposed = true;
    for (const subscription of state.subscriptions) subscription.Dispose();
    try { dispose(); } finally { state.owned?.Dispose(); grid.remove(); states.delete(grid); }
  };
  try { configure(grid, options); host.append(grid); return grid; }
  catch (error) { grid.Dispose(); throw error; }
}
export function update(grid, options) { configure(grid, options); }
