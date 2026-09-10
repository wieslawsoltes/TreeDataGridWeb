import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../packages/core/index.js';
const {observable,ObservableList,FlatTreeDataGridSource,HierarchicalTreeDataGridSource,HierarchicalExpanderColumn,TextColumn,IndexPath}=C;
const flat=(items=[{Name:'B',Value:2},{Name:'A',Value:1},{Name:'C',Value:3}])=>{const s=new C.FlatTreeDataGridSource(new C.ObservableList(items));s.Columns.Add(new C.TextColumn('Name',x=>x.Name,(x,v)=>x.Name=v,'2*'));s.Columns.Add(new C.TextColumn('Value',x=>x.Value,(x,v)=>x.Value=v));return s;};
const tree=()=>{const children=new C.ObservableList([C.observable({Name:'Child A',Children:new C.ObservableList([]),State:{Expanded:false}}),C.observable({Name:'Child B',Children:new C.ObservableList([]),State:{Expanded:false}})]);const root=C.observable({Name:'Root',Children:children,State:{Expanded:false}});const s=new C.HierarchicalTreeDataGridSource(new C.ObservableList([root]));s.Columns.Add(new C.HierarchicalExpanderColumn(new C.TextColumn('Name',x=>x.Name,(x,v)=>x.Name=v),x=>x.Children,null,'State.Expanded'));return s;};
test('IndexPath value semantics, hierarchy, slicing, hash, numeric indexer',()=>{const p=new C.IndexPath(2,4,1);assert.equal(p.Count,3);assert.equal(p[1],4);assert.equal(p.ToString(),'(2.4.1)');assert.ok(p.Slice(0,2).IsParentOf(p));assert.ok(p.Equals([2,4,1]));assert.equal(p.CompareTo([2,5]),-1);assert.ok(C.IndexPath.Unselected.IsAncestorOf(p));assert.throws(()=>p.Append(-1));assert.throws(()=>p.Slice(1,5));assert.deepEqual([...p],[2,4,1]);});
test('GridLength parsing validates input and preserves units',()=>{for(const[a,b]of [['*','1*'],['2*','2*'],['24px','24'],['Auto','Auto']])assert.equal(C.GridLength.Parse(a).ToString(),b);assert.throws(()=>C.GridLength.Parse('bad'));assert.throws(()=>new C.GridLength(-1));});
test('ObservableList supports range, move, replace, batch, and unique columns',()=>{const list=new C.ObservableList([1,2]);let events=[];list.CollectionChanged.Subscribe((_,e)=>events.push(e.Action));list.AddRange([3,4]);list.Move(0,3);list[1]=9;list.Batch(l=>{l.Add(5);l.RemoveAt(0);});assert.deepEqual(list.ToArray(),[9,4,1,5]);assert.deepEqual(events,['Add','Move','Replace','Reset']);const cols=new C.ColumnList(),col=new C.TextColumn('N',x=>x);cols.Add(col);assert.throws(()=>cols.Add(col));assert.equal(cols.Count,1);});
test('Nested selector dependencies reconnect and disposal stops notification',()=>{const p=C.observable({Person:{Name:'A'},Other:1});const values=[];const off=C.observeSelector(p,x=>x.Person.Name,v=>values.push(v));p.Other=3;p.Person.Name='B';const old=p.Person;p.Person={Name:'C'};old.Name='ignored';p.Person.Name='D';off();p.Person.Name='E';assert.deepEqual(values,['B','C','D']);});
test('Flat rows are lazy and sorted indexes are source indexes',()=>{const s=flat();assert.equal(s.Rows.CachedRowCount,0);const row=s.Rows[0];s.SortBy(s.Columns[0],C.ListSortDirection.Ascending);assert.equal(s.Rows[0].Model.Name,'A');assert.equal(s.Rows.ModelIndexToRowIndex(0),1);assert.equal(s.Rows[1],row);s.ClearSort();assert.equal(s.Rows[0],row);});
test('Custom ascending and descending comparisons and sorting opt-out',()=>{const s=flat();s.Columns[0].Options.CompareAscending=(a,b)=>b.Value-a.Value;assert.equal(s.SortBy(s.Columns[0],C.ListSortDirection.Ascending),true);assert.equal(s.Rows[0].Model.Value,3);s.Columns[1].Options.CanUserSortColumn=false;assert.equal(s.SortBy(s.Columns[1]),false);});
test('Selection batch reads are deferred and notification coalesces',()=>{const s=flat(),sel=s.RowSelection;sel.SingleSelect=false;let count=0;sel.SelectionChanged.Subscribe(()=>count++);sel.BeginBatchUpdate();sel.Select(0);sel.Select(2);assert.equal(sel.Count,0);sel.EndBatchUpdate();assert.equal(sel.Count,2);assert.equal(count,1);assert.deepEqual(sel.SelectedIndexes.map(p=>p.Key),['0','2']);});
test('Selection follows insert, remove, replace, and move',()=>{const s=flat(),sel=s.RowSelection;sel.SelectedIndex=1;const selected=sel.SelectedItem;s.Items.Insert(0,{Name:'X',Value:0});assert.equal(sel.SelectedIndex.Key,'2');assert.equal(sel.SelectedItem,selected);s.Items.Move(2,0);assert.equal(sel.SelectedIndex.Key,'0');s.Items.RemoveAt(0);assert.equal(sel.Count,0);});
test('Row ranges follow displayed sort order',()=>{const s=flat();s.SortBy(s.Columns[0]);const sel=s.RowSelection;sel.SingleSelect=false;sel.SelectRange(1,0);assert.deepEqual(sel.SelectedItems.map(x=>x.Name),['A','B']);});
test('Cell ranges support negative lengths and hidden source-column indexes',()=>{const s=flat();const sel=new C.TreeDataGridCellSelectionModel(s);s.Selection=sel;sel.SingleSelect=false;s.Columns[1].IsVisible=false;sel.SetSelectedRange(new C.CellIndex(1,2),-2,-2);assert.equal(sel.Count,4);assert.ok(sel.IsSelected(1,1));assert.ok(sel.IsSelected(0,2));assert.equal(sel.AnchorIndex.ColumnIndex,1);assert.equal(sel.RangeAnchorIndex.ColumnIndex,0);sel.Dispose();});
test('Cell selection tracks column instance through reordering',()=>{const s=flat(),sel=new C.TreeDataGridCellSelectionModel(s);s.Selection=sel;sel.SelectedIndex=new C.CellIndex(0,1);s.Columns.Move(0,1);assert.equal(sel.SelectedIndex.ColumnIndex,1);assert.ok(sel.IsSelected(1,1));s.Columns.RemoveAt(1);assert.equal(sel.Count,0);sel.Dispose();});
test('Explicit null selection stays disabled',()=>{const s=flat();s.Selection=null;assert.equal(s.Selection,null);assert.equal(s.RowSelection,null);});
test('Core values, read-only behavior, visitors and delegates',()=>{const s=flat(),m=s.Items[0];s.Columns[0].SetValue(m,'Changed');assert.equal(m.Name,'Changed');const ro=new C.TextColumn('X','Name');assert.throws(()=>ro.SetValue(m,'x'));assert.equal(s.Accept({Visit:x=>x.IsHierarchical}),false);const d=C.ValueColumn.FromDelegate('Value',x=>x.Value,'Value',(x,v)=>x.Value=v);assert.equal(d.PropertyName,'Value');assert.equal(d.GetValue(m),2);});
test('Hierarchy expansion events, bound nested state, and row index mapping',()=>{const s=tree(),events=[];s.RowExpanding.Subscribe(()=>events.push('before'));s.RowExpanded.Subscribe(()=>events.push('after'));assert.equal(s.Rows.Count,1);s.Expand(0);assert.equal(s.Rows.Count,3);assert.equal(s.Items[0].State.Expanded,true);assert.equal(s.Rows.RowIndexToModelIndex(2).Key,'0.1');assert.equal(s.Rows.ModelIndexToRowIndex([0,1]),2);s.Items[0].State={Expanded:false};assert.equal(s.Rows.Count,1);assert.deepEqual(events,['before','after']);s.Dispose();});
test('Expansion can be canceled without mutating bound state',()=>{const s=tree();s.RowExpanding.Subscribe((_,e)=>{e.Cancel=true;});s.Expand(0);assert.equal(s.Rows.Count,1);assert.equal(s.Items[0].State.Expanded,false);});
test('Hierarchy collection mutation preserves selected model paths',()=>{const s=tree();s.Expand(0);s.RowSelection.SelectedIndex=[0,1];const selected=s.RowSelection.SelectedItem;s.Items[0].Children.Insert(0,C.observable({Name:'New',Children:new C.ObservableList()}));assert.equal(s.Rows.Count,4);assert.equal(s.RowSelection.SelectedIndex.Key,'0.2');assert.equal(s.RowSelection.SelectedItem,selected);});
test('Replacing child collections releases old subscriptions',()=>{const s=tree();s.Expand(0);const old=s.Items[0].Children;s.Items[0].Children=new C.ObservableList([C.observable({Name:'Replacement',Children:[]})]);assert.equal(s.Rows.Count,2);old.Add({Name:'Should not display',Children:[]});assert.equal(s.Rows.Count,2);assert.equal(s.Rows[1].Model.Name,'Replacement');s.Dispose();assert.equal(old.CollectionChanged.Count,0);});
test('ExpandAll / CollapseAll and branch sorting',()=>{const s=tree();s.ExpandAll();assert.equal(s.Rows.Count,3);s.SortBy(s.Columns[0],C.ListSortDirection.Descending);assert.equal(s.Rows[1].Model.Name,'Child B');s.CollapseAll();assert.equal(s.Rows.Count,1);});
test('Hierarchy rejects duplicate expander columns',()=>{const s=tree();assert.throws(()=>s.Columns.Add(new C.HierarchicalExpanderColumn(new C.TextColumn('X',x=>x.Name),x=>x.Children)));assert.equal(s.Columns.Count,1);});
test('Filter projection preserves source items and model indexes',()=>{const s=flat();s.SetFilter(x=>x.Value>1);assert.equal(s.Items.Count,3);assert.equal(s.Rows.Count,2);assert.equal(s.Rows.RowIndexToModelIndex(1).Key,'2');s.SetFilter(null);assert.equal(s.Rows.Count,3);});
test('Flat MoveRows preserves selection including duplicate object occurrences',()=>{const shared={Name:'same'},items=[shared,{Name:'middle'},shared,{Name:'end'}],s=flat(items);s.RowSelection.SelectedIndex=2;s.MoveRows(s,[new C.IndexPath(2)],new C.IndexPath(0),'Before','Move');assert.equal(s.Items[0],shared);assert.equal(s.RowSelection.SelectedIndex.Key,'0');assert.equal(s.Items[1],shared);});
test('Hierarchy movement is cycle-safe and supports reparenting',()=>{const s=tree();s.Items.Add(C.observable({Name:'Other',Children:new C.ObservableList(),State:{Expanded:true}}));s.ExpandAll();assert.throws(()=>s.MoveRows(s,[0],[0,0],'Inside','Move'));assert.equal(s.Items.Count,2);s.MoveRows(s,[[0,1]],[1],'Inside','Move');assert.equal(s.Items[0].Children.Count,1);assert.equal(s.Items[1].Children[0].Name,'Child B');});
test('MoveRows validates duplicates, sorted data, and unsupported copy before mutation',()=>{const s=flat(),before=s.Items.ToArray();assert.throws(()=>s.MoveRows(s,[0,0],2,'After','Move'));assert.deepEqual(s.Items.ToArray(),before);assert.throws(()=>s.MoveRows(s,[0],2,'After','Copy'));s.SortBy(s.Columns[0]);assert.throws(()=>s.MoveRows(s,[0],2,'After','Move'));});
test('Async children load once and cancellation does not reopen a collapsed row',async()=>{const s=tree();s.ChildrenLoader=async(_m,signal)=>{await new Promise(r=>setTimeout(r,5));return [{Name:'Loaded',Children:[]}];};const pending=s.ExpandAsync(0);s.Collapse(0);await pending;assert.equal(s.Rows.Count,1);await s.ExpandAsync(0);assert.equal(s.Rows.Count,2);assert.equal(s.Rows[1].Model.Name,'Loaded');s.Dispose();});
test('Row height index agrees with a naive oracle after random updates',()=>{const n=10000,index=new C.RowHeightIndex(n,32),naive=Array(n).fill(32);let seed=7;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};for(let k=0;k<1000;k++){const i=Math.floor(random()*n),v=16+Math.floor(random()*150);index.Set(i,v);naive[i]=v;}let sum=0;for(let i=0;i<n;i++){assert.ok(Math.abs(index.Offset(i)-sum)<.01);assert.equal(index.IndexAt(sum+.01),i);sum+=naive[i];}assert.equal(index.Total,sum);assert.equal(index.IndexAt(sum+99),n-1);});
test('Column star layout honors min/max and view-local natural measurements',()=>{const s=flat();s.Columns[0].Width='*';s.Columns[1].Width='2*';const a=new C.ColumnLayout(),b=new C.ColumnLayout();assert.deepEqual(a.Calculate(s.Columns,300),[100,200]);s.Columns[1].Options.MaxWidth=100;assert.deepEqual(a.Calculate(s.Columns,300),[200,100]);s.Columns[0].Width='Auto';a.Measure(s.Columns[0],250);b.Measure(s.Columns[0],80);a.Calculate(s.Columns,500);b.Calculate(s.Columns,500);assert.equal(a.Widths[0],250);assert.equal(b.Widths[0],80);});
test('100,000 flat items do not materialize offscreen row objects',()=>{const s=flat(Array.from({length:100000},(_,i)=>({Name:`Row ${i}`,Value:i})));assert.equal(s.Rows.CachedRowCount,0);for(let i=50000;i<50040;i++)s.Rows.Get(i);assert.equal(s.Rows.CachedRowCount,40);assert.equal(s.Rows.Count,100000);s.Dispose();});
test('Disposal disconnects root and nested source subscriptions',()=>{const s=tree();s.ExpandAll();const list=s.Items,children=s.Items[0].Children;s.Dispose();assert.equal(list.CollectionChanged.Count,0);assert.equal(children.CollectionChanged.Count,0);assert.throws(()=>s.Rows);});

test('Async-loaded children participate in model-path lookup and selection', async () => {
  const root=observable({name:'Remote folder',children:new ObservableList(),hasChildren:true});
  const source=new HierarchicalTreeDataGridSource(new ObservableList([root]));
  source.Columns.Add(new HierarchicalExpanderColumn(new TextColumn('Name',m=>m.name),m=>m.children,m=>m.hasChildren));
  source.ChildrenLoader=async()=>[observable({name:'Loaded child',children:new ObservableList(),hasChildren:false})];
  await source.ExpandAsync(0);
  const path=new IndexPath(0,0);
  assert.equal(source.GetModelAt(path).name,'Loaded child');
  source.RowSelection.SelectedIndex=path;
  assert.equal(source.RowSelection.SelectedItem.name,'Loaded child');
  source.Dispose();
});

test('Large Reset remaps selected duplicate occurrences without quadratic scans', () => {
  const items=Array.from({length:20000},(_,i)=>({id:i}));
  const list=new ObservableList(items),source=new FlatTreeDataGridSource(list);
  source.Columns.Add(new TextColumn('Id',m=>m.id));source.RowSelection.SingleSelect=false;
  source.RowSelection.SelectAll();
  list.Reset(items.slice().reverse());
  assert.equal(source.RowSelection.Count,20000);
  assert.equal(source.RowSelection.SelectedIndex[0],19999);
  assert.equal(source.RowSelection.SelectedItem.id,0);
  source.Dispose();
});

test('Removed selection events contain the removed model, not its successor',()=>{
  const s=flat(),a=s.Items[0];s.RowSelection.SelectedIndex=0;let event;
  s.RowSelection.SelectionChanged.Subscribe((_,e)=>event=e);
  s.Items.RemoveAt(0);
  assert.deepEqual(event.DeselectedItems,[a]);assert.equal(s.RowSelection.Count,0);s.Dispose();
});
test('Removing a parent reports the selected descendant as deselected',()=>{
  const s=tree();s.ExpandAll();const child=s.Items[0].Children[1];s.RowSelection.SelectedIndex=[0,1];let event;
  s.RowSelection.SelectionChanged.Subscribe((_,e)=>event=e);s.Items.RemoveAt(0);
  assert.deepEqual(event.DeselectedItems,[child]);assert.equal(s.RowSelection.Count,0);s.Dispose();
});
test('Index shifts do not report surviving items as deselected and selected',()=>{
  const s=flat(),sel=s.RowSelection;sel.SelectedIndex=1;const item=sel.SelectedItem;
  let selectionEvents=0,indexEvents=0;sel.SelectionChanged.Subscribe(()=>selectionEvents++);sel.IndexesChanged.Subscribe(()=>indexEvents++);
  s.Items.Insert(0,{Name:'X',Value:0});assert.equal(selectionEvents,0);assert.equal(indexEvents,1);assert.equal(sel.SelectedItem,item);s.Dispose();
});
test('Collection changes inside selection batches preserve committed items until commit',()=>{
  const s=flat(),sel=s.RowSelection;sel.SelectedIndex=1;const item=sel.SelectedItem;
  let selectionEvents=0,indexEvents=0;sel.SelectionChanged.Subscribe(()=>selectionEvents++);sel.IndexesChanged.Subscribe(()=>indexEvents++);
  sel.BeginBatchUpdate();s.Items.Insert(0,{Name:'X',Value:0});assert.equal(sel.SelectedIndex.Key,'1');assert.equal(sel.SelectedItem,item);
  assert.equal(indexEvents,0);sel.EndBatchUpdate();assert.equal(sel.SelectedIndex.Key,'2');assert.equal(sel.SelectedItem,item);assert.equal(selectionEvents,0);assert.equal(indexEvents,1);s.Dispose();
});
