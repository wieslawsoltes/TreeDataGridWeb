import * as core from '../../packages/core/index.js';
import * as web from '../../packages/web/index.js';
export const api = { ...core, ...web, Core: core, Web: web };
const states = new WeakMap();
let style;
function loadStyles() {
  return style ??= new Promise((resolve, reject) => {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./styles.css', import.meta.url).href;
    link.onload = resolve; link.onerror = () => { style = null; link.remove(); reject(new Error('Could not load TreeDataGrid styles.')); }; document.head.append(link);
  });
}
function configure(grid, options) {
  const state = states.get(grid);
  const { items = [], columns = [], childrenProperty, model, ...properties } = options;
  if (model) {
    if (grid.Model !== model) { grid.Model = model; state.owned?.Dispose(); state.owned = null; state.signature = null; }
  } else {
    const signature = JSON.stringify([items, columns, childrenProperty]);
    if (signature !== state.signature) {
      const source = childrenProperty ? new core.HierarchicalTreeDataGridSource(items) : new core.FlatTreeDataGridSource(items);
      try {
        columns.forEach((column, index) => {
          const Type = column.kind === 'checkbox' ? core.CheckBoxColumn : core.TextColumn;
          let value = new Type(column.header, column.property, column.editable ? true : null, column.width ?? '*', column.options ?? null, column.id ?? column.property);
          if (index === 0 && childrenProperty) value = new core.HierarchicalExpanderColumn(value, childrenProperty);
          source.Columns.Add(value);
        });
        grid.Model = source;
      } catch (error) { source.Dispose(); throw error; }
      state.owned?.Dispose(); state.owned = source; state.signature = signature;
    }
  }
  for (const [name, value] of Object.entries(properties)) if (grid[name] !== value) grid[name] = value;
}
export async function mount(host, options) {
  await loadStyles(); web.registerTreeDataGrid();
  const grid = document.createElement('tree-data-grid'); grid.style.cssText = 'display:block;width:100%;height:100%;min-height:0';
  const state = { owned: null, signature: null, disposed: false }; states.set(grid, state);
  const dispose = grid.Dispose.bind(grid);
  grid.Dispose = () => { if (state.disposed) return; state.disposed = true; try { dispose(); } finally { state.owned?.Dispose(); grid.remove(); states.delete(grid); } };
  try { configure(grid, options); host.append(grid); return grid; }
  catch (error) { grid.Dispose(); throw error; }
}
export function update(grid, options) { configure(grid, options); }
