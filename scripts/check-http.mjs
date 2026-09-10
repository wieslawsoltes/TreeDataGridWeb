/** HTTP transport smoke test; independent of the browser's navigation policy. */
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url)),port=Number(process.env.TEST_PORT??4186);
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'pipe'});
let stderr='';server.stderr.on('data',chunk=>stderr+=String(chunk));
const results=[];
try {
  let ready=false;
  for(let i=0;i<50;i++){
    if(server.exitCode!==null)throw new Error('Server exited: '+stderr);
    try{const response=await fetch(`http://127.0.0.1:${port}/`);ready=response.ok;if(ready)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,'Server did not start');
  for(const [path,type,marker] of [
    ['/','text/html','tree-data-grid'],
    ['/samples/core-demo/app.js','text/javascript','switchDemo'],
    ['/samples/core-demo/app.css','text/css','--'],
    ['/packages/core/index.js','text/javascript','export'],
    ['/packages/web/index.js','text/javascript','registerTreeDataGrid'],
    ['/samples/minimal/index.html','text/html','FlatTreeDataGridSource']
  ]){
    const response=await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal(response.status,200);assert.ok(response.headers.get('content-type').startsWith(type));
    assert.ok((await response.text()).includes(marker));results.push({path,status:200,passed:true});
  }
  const missing=await fetch(`http://127.0.0.1:${port}/file-not-present`);assert.equal(missing.status,404);
  const traversal=await fetch(`http://127.0.0.1:${port}/..%2F..%2Fetc%2Fpasswd`);assert.equal(traversal.status,403);
  const report={runtime:process.version,results,notFoundStatus:missing.status,traversalStatus:traversal.status,note:'Node HTTP transport only; not browser URL navigation.'};
  await writeFile(new URL('../verification/http-tests.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{server.kill('SIGTERM');}
