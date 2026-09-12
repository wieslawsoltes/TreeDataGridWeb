import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { dirname, join, resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = resolve('.'), pkg = JSON.parse(await readFile('package.json', 'utf8'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 180000, env: { ...process.env, NODE_AUTH_TOKEN: '', NPM_TOKEN: '' } });
  if (result.status !== 0) throw Error(`${command} ${args.join(' ')} failed: ${result.error?.message ?? result.stdout + result.stderr}`);
  return result.stdout;
}
const temporary = await mkdtemp(join(tmpdir(), 'treedatagrid-consumer-'));
let browser, server;
try {
  const supplied = process.argv.indexOf('--tarball');
  const tarball = supplied >= 0 ? resolve(process.argv[supplied + 1]) : join(temporary, JSON.parse(run(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], root))[0].filename);
  const consumer = join(temporary, 'consumer'); await mkdir(consumer);
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'treedatagrid-installed-consumer', version: '1.0.0', private: true, type: 'module' }));
  await writeFile(join(consumer, '.npmrc'), 'registry=https://registry.npmjs.org\n@wieslawsoltes:registry=https://registry.npmjs.org\n');
  run(npm, ['install', tarball, '--ignore-scripts', '--no-audit', '--no-fund'], consumer);
  const installed = join(consumer, 'node_modules', ...pkg.name.split('/'));
  assert.equal((await stat(installed)).isDirectory(), true);
  const installedPackage = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert.equal(installedPackage.name, pkg.name); assert.equal(installedPackage.version, pkg.version);
  const smoke = `import assert from 'node:assert/strict';
import * as root from '${pkg.name}'; import * as core from '${pkg.name}/core';
assert.equal(root.FlatTreeDataGridSource, core.FlatTreeDataGridSource); assert.equal(root.ObservableList, core.ObservableList);
assert(import.meta.resolve('${pkg.name}').includes('/consumer/node_modules/'));
const rows = new core.ObservableList([{Name:'one'},{Name:'two'}]); const source = new root.FlatTreeDataGridSource(rows);
source.Columns.Add(new core.TextColumn('Name', value=>value.Name)); assert.equal(source.Rows.Count,2); rows.Add({Name:'three'}); assert.equal(source.Rows.Count,3);
assert(source.RowSelection instanceof core.TreeDataGridRowSelectionModel); source.Dispose(); console.log('Installed ESM Core behavior and constructor identity passed.');`;
  await writeFile(join(consumer, 'consumer.mjs'), smoke); console.log(run(process.execPath, ['consumer.mjs'], consumer).trim());
  const cjs = `const assert=require('node:assert/strict'); const main=require('${pkg.name}'), core=require('${pkg.name}/core'); assert.equal(main.FlatTreeDataGridSource,core.FlatTreeDataGridSource); assert.equal(new core.ObservableList([1,2]).Count,2);`;
  await writeFile(join(consumer, 'consumer.cjs'), cjs); run(process.execPath, ['consumer.cjs'], consumer);
  await writeFile(join(consumer, 'consumer.ts'), `import {ObservableList, FlatTreeDataGridSource, TextColumn} from '${pkg.name}/core'; import type {TreeDataGrid} from '${pkg.name}/web'; interface Row {Name:string} const source = new FlatTreeDataGridSource<Row>(new ObservableList<Row>([{Name:'typed'}])); source.Columns.Add(new TextColumn<Row,string>('Name', x=>x.Name)); declare const grid:TreeDataGrid<Row>; grid.Model=source; source.Dispose();`);
  const require = createRequire(import.meta.url), tsc = require.resolve('typescript/bin/tsc');
  run(process.execPath, [tsc, '--strict', '--noEmit', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--lib', 'ES2022,DOM', join(consumer, 'consumer.ts')], consumer);
  const css = await readFile(join(installed, 'dist/treedatagrid.css'), 'utf8'); assert(css.includes(':host') && css.includes('.viewport'));
  for (const path of ['LICENSE','THIRD_PARTY_NOTICES.md','packages/core/LICENSE','packages/web/LICENSE','dist/treedatagrid.global.js','dist/TreeDataGridWeb.html']) assert((await stat(join(installed,path))).size > 0, `${path} missing from package`);
  if (process.argv.includes('--browser')) {
    const {chromium} = await import('playwright');
    const html = `<!doctype html><html><body><script type="module">import * as core from './node_modules/${pkg.name}/packages/core/index.js'; import * as web from './node_modules/${pkg.name}/packages/web/index.js'; const items=new core.ObservableList([core.observable({Name:'First'}),core.observable({Name:'Second'})]); const source=new core.FlatTreeDataGridSource(items); source.Columns.Add(new core.TextColumn('Name',x=>x.Name)); const grid=document.createElement('tree-data-grid'); grid.style.cssText='display:block;width:500px;height:300px'; grid.Model=source; document.body.append(grid); window.probe={core,web,items,source,grid};</script></body></html>`;
    await writeFile(join(consumer,'index.html'),html);
    server = createServer(async (request,response) => { try { const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname); const file=resolve(consumer,'.'+(pathname==='/'?'/index.html':pathname)); if(!file.startsWith(consumer+'/'))throw Error('Invalid path'); response.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]??'application/octet-stream'); response.end(await readFile(file)); } catch { response.statusCode=404;response.end(); } });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    browser = await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})}); const page=await browser.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.probe?.grid.Stats.RealizedRows===2);
    assert(await page.evaluate(()=>{const {core,web,source,grid,items}=probe; if(!(grid instanceof web.TreeDataGrid)||grid.Model!==source||grid.Rows!==source.Rows||!(grid.Presentation.Layout instanceof core.ColumnLayout))return false;items.Add(core.observable({Name:'Third'}));return source.Rows.Count===3;}));
    await page.waitForFunction(()=>probe.grid.Stats.RealizedRows===3);
    assert(await page.evaluate(()=>probe.grid.shadowRoot.querySelector('style').textContent.includes('.viewport')));
    assert.equal(errors.length,0,errors.join('\n')); await page.evaluate(()=>{probe.grid.Dispose();probe.source.Dispose();});
    console.log('Installed browser component, live model updates, shared Core identity and embedded styles passed.');
  }
  console.log('Installed tarball verified: ESM, CommonJS on supported Node, strict TypeScript, Core identity, CSS, standalone assets and notices.');
} finally { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); await rm(temporary,{recursive:true,force:true}); }
