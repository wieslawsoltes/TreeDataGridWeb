"""Actual Chromium layout/input tests of the bundled component and sample.

The restricted build environment blocks URL navigation. Tests intentionally load
our own generated HTML with Playwright set_content (no policy changes, network,
or permission overrides). HTTP hosting, native clipboard permissions, file-picker
permissions and live external feeds are therefore outside this test run.
"""
from pathlib import Path
import os,sys,json,time,traceback,subprocess,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','scripts/build.mjs'],cwd=ROOT,check=True)
results=[];page_errors=[];browser_version='';benchmarks={}
with sync_playwright() as p:
    executable=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
    browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
    browser_version=browser.version
    context=browser.new_context(viewport={'width':1440,'height':980},device_scale_factor=1)
    page=context.new_page()
    page.set_default_timeout(7000)
    page.on('pageerror',lambda e:page_errors.append(str(e)))
    page.set_content((ROOT/'dist/TreeDataGridWeb.html').read_text(),wait_until='load')
    page.wait_for_function('window.demo && demo.grid.Stats.RealizedRows > 0')
    def js(code,*args):return page.evaluate(code,*args)
    def wait():page.wait_for_timeout(130)
    def switch(name):
        js('(id)=>{demo.grid.CancelEdit();demo.switchDemo(id);demo.grid.Model.ClearSort();demo.grid.Model.SetFilter(null);demo.grid.Scroll.Offset={X:0,Y:0};}',name)
        wait()
    def check(expression):
        value=js(expression)
        assert value is True, f'{expression} => {value!r}'
    def test(name,action):
        start=time.perf_counter()
        print('RUN',name,flush=True)
        try:
            action();results.append({'name':name,'passed':True,'milliseconds':round((time.perf_counter()-start)*1000,2)})
            print('PASS',name,round(time.perf_counter()-start,2),flush=True)
        except Exception as e:
            results.append({'name':name,'passed':False,'error':str(e),'milliseconds':round((time.perf_counter()-start)*1000,2)})
            print('FAIL',name,str(e)[:800],flush=True)
    def cell(row,col):return page.locator(f'#grid .cell[data-row="{row}"][data-column="{col}"]')
    def core_catalog():
        for item in ['people','countries','variable','files','articles','drag','templates','find','stress','shared']:
            switch(item)
            check('demo.grid.Model===demo.current.source && demo.grid.Source===null && demo.grid.Rows===demo.current.source.Rows && demo.grid.Stats.RealizedRows>0')
            assert js('demo.grid.Stats.RealizedRows')<75
        switch('people')
        check('document.documentElement.scrollHeight <= innerHeight+2')
    test('All ten showcase views bind Core Model directly and fit the viewport',core_catalog)
    def expand():
        switch('people');n=js('demo.grid.Rows.Count')
        page.locator('#grid .row[data-row="0"] .expander').click();wait()
        assert js('demo.grid.Rows.Count')<n
        check('!demo.current.source.Items.Get(0).Expansion.IsExpanded')
        page.locator('#grid .row[data-row="0"] .expander').click();wait()
        assert js('demo.grid.Rows.Count')==n
        check('demo.grid.TryGetRow(0).getAttribute("aria-expanded")==="true"')
    test('Pointer expansion writes nested model state and ARIA',expand)
    def selection():
        switch('countries');page.locator('#row-mode').click();cell(1,0).click();cell(4,0).click(modifiers=['Shift']);wait()
        assert js('demo.current.source.Selection.Count')==4
        cell(2,0).click(modifiers=['Control']);wait();assert js('demo.current.source.Selection.Count')==3
        js('demo.grid._root.focus()');page.keyboard.press('Control+a');wait();assert js('demo.current.source.Selection.Count')==48
        page.keyboard.press('Escape');wait();assert js('demo.current.source.Selection.Count')==0
    test('Pointer ranges, additive row selection, select all and Escape',selection)
    def cells():
        switch('countries');page.locator('#cell-mode').click();cell(1,0).click();cell(4,2).click(modifiers=['Shift']);wait()
        assert js('demo.current.source.Selection.Count')==12
        check('demo.current.source.Selection.IsSelected(2,new demo.C.IndexPath(4))')
        assert js('demo.grid.GetSelectionText().split("\\r\\n").length')==4
        page.locator('#row-mode').click()
    test('Rectangular cell selection follows source-column indexes',cells)
    def editing():
        switch('people');page.locator('#row-mode').click();cell(0,0).click();page.keyboard.press('F2')
        page.locator('#grid .editor').fill('Alex Web');page.keyboard.press('Enter');wait()
        check('demo.current.source.Items.Get(0).Name==="Alex Web" && !demo.grid._editing')
        js('demo.grid.Undo()');wait();check('demo.current.source.Items.Get(0).Name==="Alex Morgan"')
        js('demo.grid.Redo()');wait();check('demo.current.source.Items.Get(0).Name==="Alex Web"')
        js('demo.grid.BeginEdit(0,0)');page.locator('#grid .editor').fill('Cancelled');page.keyboard.press('Escape');wait()
        check('demo.current.source.Items.Get(0).Name==="Alex Web"')
        js('demo.current.source.Items.Get(0).Name="Alex Morgan"')
    test('F2 editing, Enter commit, Escape cancel, undo and redo',editing)
    def validation():
        switch('people');js('demo.grid.BeginEdit(3,0)');page.locator('#grid .editor').fill('150');page.keyboard.press('Enter');wait()
        assert page.locator('#grid .editor').get_attribute('aria-invalid')=='true'
        check('demo.current.source.Items.Get(0).Age===36')
        page.locator('#grid .editor').fill('42');page.keyboard.press('Enter');wait();check('demo.current.source.Items.Get(0).Age===42')
        js('demo.current.source.Items.Get(0).Age=36')
    test('Numeric conversion and validation retain the editor on failure',validation)
    def keyboard():
        switch('countries');cell(0,0).click();page.keyboard.press('ArrowDown');wait();check('demo.current.source.RowSelection.SelectedIndex.Equals(1)')
        page.keyboard.press('PageDown');wait();assert js('demo.grid._active.row')>1
        page.keyboard.press('Control+End');wait();assert js('demo.grid._active.row')==47
        check('demo.grid.TryGetRow(47)!==null')
        page.keyboard.press('Control+Home');wait();assert js('demo.grid._active.row')==0
        page.keyboard.type('Nor');wait();check('demo.current.source.RowSelection.SelectedItem.Name==="Norway"')
    test('Arrow, Page, Ctrl+Home/End and type-to-search navigation',keyboard)
    def sorting():
        switch('countries');js('demo.current.source.RowSelection.SelectedIndex=new demo.C.IndexPath(0)')
        page.locator('#grid .header[data-column="0"] .label').click();wait()
        check('demo.current.source.IsSorted && demo.current.source.Rows.Get(0).Model.Name==="Argentina"')
        check('demo.current.source.RowSelection.SelectedItem.Name==="Poland"')
        page.locator('#grid .header[data-column="0"] .label').click();wait()
        check('demo.current.source.Columns.Get(0).SortDirection==="Descending"')
        page.locator('#grid .header[data-column="0"] .label').click();wait();check('!demo.current.source.IsSorted')
    test('Three-state header sorting preserves model selection',sorting)
    def resize():
        switch('countries');initial=js('demo.grid.Columns[0].ActualWidth')
        rect=page.locator('#grid .resize-grip[data-resize="0"]').bounding_box();page.mouse.move(rect['x']+4,rect['y']+15);page.mouse.down();page.mouse.move(rect['x']+49,rect['y']+15,steps=8);page.mouse.up();wait()
        assert js('demo.current.source.Columns.Get(0).Width.Value')>initial+35
        check('demo.current.source.Columns.Get(0).Width.IsAbsolute')
    test('Column resize with actual pointer input',resize)
    def reorder():
        switch('countries');before=js('demo.current.source.Columns.Get(0).Header')
        page.locator('#grid .header[data-column="0"]').drag_to(page.locator('#grid .header[data-column="2"]'));wait()
        assert js('demo.current.source.Columns.Get(2).Header')==before
        js('demo.current.source.Columns.Move(2,0)');wait()
    test('Native header drag reorders source columns',reorder)
    def menu():
        switch('countries');page.locator('#grid .header[data-column="1"]').click(button='right');page.locator('#grid .context-menu button',has_text='Hide column').click();wait()
        check('!demo.current.source.Columns.Get(1).IsVisible')
        assert page.locator('#grid .header').count()==4
        js('demo.current.source.Columns.Get(1).IsVisible=true');wait()
    test('Context menu and live column visibility',menu)
    def template():
        switch('templates');check('demo.grid.TryGetCell(0,0).textContent.includes("Disabled")')
        page.locator('#grid .cell[data-row="0"][data-column="5"] button').click();wait()
        check('demo.current.source.Items.Get(0).Count===1')
        js('demo.grid.BeginEdit(3,0)');page.locator('#grid .editor').fill('Custom template edited');page.keyboard.press('Enter');wait()
        check('demo.current.source.Items.Get(0).Details==="Custom template edited"')
        check('demo.grid.TryGetCell(4,0).querySelector("input").indeterminate')
        cell(0,4).click();wait();check('demo.current.source.Items.Get(0).Ready===false')
        cell(0,4).click();wait();check('demo.current.source.Items.Get(0).Ready===true')
        cell(0,4).click();wait();check('demo.current.source.Items.Get(0).Ready===null')
    test('Templates initialize, update, edit and retain three-state checkboxes',template)
    def clipboard():
        switch('countries');check('(()=>{const g=demo.grid;g._active={row:0,column:0};const n=g.Paste("Edited country\\tignored\\t12345");return n===2&&g.Rows.Get(0).Model.Name==="Edited country"&&g.Rows.Get(0).Model.Population===12345;})()')
        js('demo.grid.Undo()');wait();check('demo.grid.Rows.Get(0).Model.Name==="Poland"')
        check('(()=>{try{demo.grid.Paste("must not apply\\tx\\tinvalid-number");return false;}catch{return demo.grid.Rows.Get(0).Model.Name==="Poland";}})()')
        check('(()=>{const a=demo.W.parseDelimited("\\\"one\\ttwo\\\"\\t\\\"line1\\nline2\\\"\\r\\nthree\\tfour");return a.length===2&&a[0][0]==="one\\ttwo"&&a[0][1]==="line1\\nline2";})()')
        check('demo.W.quoteField("=1+1",",",true).startsWith("\u0027")')
        assert js('demo.grid.ExportCsv().split("\\r\\n").length')==49
    test('TSV round-tripping, transactional paste, undo and safe CSV output',clipboard)
    def mutations():
        switch('countries');n=js('demo.current.source.Items.Count');page.locator('#add').click();wait();assert js('demo.current.source.Items.Count')==n+1
        js('demo.current.source.RowSelection.SelectedIndex=new demo.C.IndexPath(demo.current.source.Items.Count-1)');page.locator('#remove').click();wait();assert js('demo.current.source.Items.Count')==n
        page.locator('#search').fill('Norway');wait();assert js('demo.grid.Rows.Count')==1
        page.locator('#search').fill('no-match-xx');wait();check('!demo.grid._empty.hidden && demo.grid.Stats.RealizedRows===0')
        page.locator('#search').fill('');wait();assert js('demo.grid.Rows.Count')==n
    test('Observable add/remove, filtering and empty state',mutations)
    def variable():
        switch('variable');wait();heights=js('[...demo.grid._realized.values()].map(r=>r.el.getBoundingClientRect().height)');assert max(heights)>min(heights)+25
        js('demo.grid.ScrollIntoView(1200,0,"start")');page.wait_for_timeout(300)
        check('demo.grid.TryGetRow(1200)!==null')
        check('(()=>{const a=[...demo.grid._realized.values()].sort((a,b)=>a.index-b.index);return a.every((r,i)=>!i||Math.abs(r.el.getBoundingClientRect().top-a[i-1].el.getBoundingClientRect().bottom)<1.1);})()')
        assert js('demo.grid.Stats.RealizedRows')<65
        js('demo.grid.ScrollIntoView(2399,0)');page.wait_for_timeout(300);check('demo.grid.TryGetRow(2399)!==null')
        page.screenshot(path=str(ROOT/'verification/variable-heights.png'))
    test('Variable-height distant scrolling remains contiguous and bounded',variable)
    def grow_shrink():
        switch('variable');js('demo.grid.ScrollIntoView(0,0)');wait();old=js('demo.grid._heights.Get(0)')
        js('demo.current.source.Items.Get(0).Name="Line\\n".repeat(12)');page.wait_for_timeout(250);assert js('demo.grid._heights.Get(0)')>old+100
        js('demo.current.source.Items.Get(0).Name="Poland"');page.wait_for_timeout(250);assert js('demo.grid._heights.Get(0)')<old+8
    test('ResizeObserver tracks live content growth and shrinkage',grow_shrink)
    def stress100k():
        switch('stress');assert js('demo.grid.Rows.Count')==100000
        js('demo.grid.ScrollIntoView(50000,0,"start")');wait();check('demo.grid.TryGetRow(50000)!==null')
        assert js('demo.grid.Stats.RealizedRows')<60
        js('demo.grid.ScrollIntoView(99999,0)');wait();check('demo.grid.TryGetRow(99999)!==null')
        assert js('demo.current.source.Rows.CachedRowCount')<160
        check('demo.grid.Stats.ReusedElements>0')
        benchmarks['100k']=js('demo.scrollBenchmark()')
    test('100,000 rows: jump, tail reachability, bounded DOM and recycling',stress100k)
    def million():
        js('demo.models.set("stress",demo.stress(1000000));demo.switchDemo("stress")');wait()
        assert js('demo.grid.Rows.Count')==1000000
        js('demo.grid.ScrollIntoView(750000,0,"start")');wait();check('demo.grid.TryGetRow(750000)!==null')
        js('demo.grid.ScrollIntoView(999999,0)');wait();check('demo.grid.TryGetRow(999999)!==null')
        assert js('demo.grid._viewport.scrollHeight')<=8000001
        assert js('demo.grid.Stats.RealizedRows')<60
        benchmarks['million']=js('demo.grid.Stats')
    test('One million rows: scaled scrollbar reaches beyond CSS extent limits',million)
    def wide():
        js('demo.models.set("stress",demo.stress(2000,true));demo.switchDemo("stress")');wait()
        js('demo.grid.ScrollIntoView(1000,150,"start")');wait()
        assert page.locator('#grid .header').count()<15
        assert js('demo.grid.Stats.RealizedCells')<600
        check('demo.grid.TryGetCell(150,1000)!==null && demo.grid.TryGetCell(0,1000)!==null')
        check('Math.abs(demo.grid.TryGetCell(0,1000).getBoundingClientRect().left-demo.grid._viewport.getBoundingClientRect().left)<2')
        check('Math.abs(demo.grid._headerClip.scrollLeft-demo.grid._viewport.scrollLeft)<1')
        benchmarks['wide200']=js('demo.grid.Stats')
    test('200 columns: horizontal virtualization, pinned cells and header alignment',wide)
    def shared():
        switch('shared');check('demo.grid.Rows===demo.grid2.Rows && demo.grid.Rows.Get(0)===demo.grid2.Rows.Get(0) && demo.grid.Columns[0]!==demo.grid2.Columns[0]')
        js('demo.current.source.Items.Get(0).Name="Synchronized name"');wait()
        check('demo.grid.TryGetCell(0,0).textContent.includes("Synchronized name") && demo.grid2.TryGetCell(0,0).textContent.includes("Synchronized name")')
        js('demo.current.source.Items.Get(0).Expansion={IsExpanded:false}');wait()
        check('demo.grid.Stats.Rows===demo.grid2.Stats.Rows && demo.grid.Stats.Rows===31')
        js('demo.current.source.Items.Get(0).Expansion={IsExpanded:true}');wait()
        check('demo.grid.Columns[0].ActualWidth!==demo.grid2.Columns[0].ActualWidth')
    test('Shared source, direct row identity, independent widths and nested binding',shared)
    def lifetime():
        switch('countries');before=js('demo.current.source.Changed.Count')
        js('window.detachedGrid=demo.grid;demo.grid.remove()');wait()
        assert js('demo.current.source.Changed.Count')==before-1
        js('demo.current.source.Items.Get(0).Name="Changed while detached";document.getElementById("grid-host").prepend(demo.grid)');wait()
        assert js('demo.current.source.Changed.Count')==before
        check('demo.grid.TryGetCell(0,0).textContent.includes("Changed while detached")')
        js('demo.current.source.Items.Get(0).Name="Poland"');wait()
    test('Detach suspends bindings; reattach resynchronizes without disposing the model',lifetime)
    def drag():
        switch('drag');js('demo.grid.SelectionMode=demo.C.TreeDataGridSelectionMode.Multiple;demo.grid.AutoDragDropRows=true');wait()
        name=js('demo.current.source.Items.Get(0).Children.Get(0).Name')
        src=cell(1,0);target=cell(7,0)
        src.drag_to(target);wait()
        check('demo.events.some(e=>e.type==="RowDrop")')
        assert js('demo.current.source.Items.Get(0).Children.Get(0).Name')!=name
    test('Native row drag moves an item between hierarchical groups',drag)
    def autosize():
        switch('countries');js('demo.current.source.Columns.Get(0).Width=demo.C.GridLength.Auto');page.wait_for_timeout(300)
        w=js('demo.grid.Columns[0].ActualWidth');frame=js('demo.grid._frame');page.wait_for_timeout(400)
        assert abs(js('demo.grid.Columns[0].ActualWidth')-w)<.5
        assert js('demo.grid._frame')-frame<5
        assert w>80
    test('Auto width converges instead of feeding back stretched flex widths',autosize)
    def preserve_state():
        switch('countries');js('window.saved=demo.grid.SaveViewState();demo.current.source.Columns.Get(1).IsVisible=false;demo.grid.FrozenColumns=2;demo.grid.RowHeight=48;demo.grid.RestoreViewState(saved)');wait()
        check('demo.current.source.Columns.Get(1).IsVisible && demo.grid.FrozenColumns===saved.frozen && demo.grid.RowHeight===saved.rowHeight')
    test('Serializable view-state save and restoration',preserve_state)
    def xss():
        switch('countries');js('demo.current.source.Items.Get(0).Name="<img src=x onerror=window.xss=true>"');wait()
        check('!window.xss && !demo.grid.TryGetCell(0,0).querySelector("img") && demo.grid.TryGetCell(0,0).textContent.includes("<img")')
        js('demo.current.source.Items.Get(0).Name="Poland"');wait()
    test('Model strings render as text, never executable HTML',xss)
    def theme():
        switch('people');page.screenshot(path=str(ROOT/'verification/people-light.png'))
        page.locator('#theme').click();wait();check('document.documentElement.dataset.theme==="dark"')
        page.screenshot(path=str(ROOT/'verification/people-dark.png'))
        check('getComputedStyle(demo.grid).color!=="rgb(36, 51, 62)"')
        page.locator('#theme').click();wait()
        page.set_viewport_size({'width':390,'height':844});wait();assert js('document.documentElement.scrollWidth')<=392
        page.screenshot(path=str(ROOT/'verification/mobile.png'));page.set_viewport_size({'width':1440,'height':980});wait()
    test('Light, dark and narrow responsive layouts',theme)
    def cancellation():
        switch('countries');page.locator('#row-mode').click();js('demo.current.source.RowSelection.Clear();window.cancelCalls=0;window.cancelOff=demo.grid.SelectionChanging.Subscribe((_,e)=>{cancelCalls++;e.Cancel=true}); void 0');check('demo.current.source.RowSelection.Count===0')
        cell(0,0).click();wait();assert js('demo.current.source.RowSelection.Count')==0, str(js('({count:demo.current.source.RowSelection.Count,batch:demo.current.source.RowSelection._batch,paths:demo.current.source.RowSelection.SelectedIndexes.map(p=>p.Key),calls:cancelCalls,listeners:demo.grid.SelectionChanging.Count,cancel:demo.grid.QueryCancelSelection()})'));js('cancelOff()')
        js('window.cancelEditOff=demo.grid.CellEditStarting.Subscribe((_,e)=>e.Cancel=true); void 0');check('demo.grid.BeginEdit(0,0)===false');js('cancelEditOff()')
        check('demo.grid.BeginEdit(0,0)===true');js('demo.grid.CancelEdit()')
    test('Cancellable selection and edit-start events',cancellation)
    def template_recycle():
        switch('templates');js('demo.grid.ScrollIntoView(150,5,"start")');wait()
        before=js('demo.current.source.Items.Get(150).Count')
        page.locator('#grid .cell[data-row="150"][data-column="5"] button').click();wait()
        assert js('demo.current.source.Items.Get(150).Count')==before+1
        check('demo.current.source.Items.Get(0).Count===1')
    test('Recycled template handlers target the new model, not the old row',template_recycle)
    def alias_tag():
        check('(()=>{demo.W.registerTreeDataGrid("my-tree-grid");const el=document.createElement("my-tree-grid");return el instanceof demo.W.TreeDataGrid;})()')
    test('Additional custom-element tag registration',alias_tag)
    test('No uncaught browser exceptions',lambda:check('demo.events.filter(e=>e.type==="Error").length===0'))
    browser.close()
report={'browser':browser_version,'transport':'Playwright set_content with generated standalone HTML; URL navigation is policy-blocked','viewport':{'width':1440,'height':980},'passed':sum(r['passed'] for r in results),'failed':sum(not r['passed'] for r in results),'uncaughtExceptions':page_errors,'tests':results,'benchmarks':benchmarks,'notExercised':['Firefox','WebKit','physical touch/stylus','screen reader software','native OS clipboard permissions','directory-picker permissions','live Wikimedia request','HTTP navigation in Chromium']}
(ROOT/'verification/browser-tests.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'passed':report['passed'],'failed':report['failed'],'pageErrors':page_errors,'benchmarks':benchmarks},indent=2))
sys.exit(1 if report['failed'] or page_errors else 0)
