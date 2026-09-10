/** Small deterministic packager for this project's static ES-module grammar.
 * Runtime output contains no eval, Function constructor, module loader dependency or network request.
 * Source ES modules remain the primary package. Unsupported module syntax fails the build.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const license=(await readFile(resolve(root,'LICENSE'),'utf8')).replace(/\*\//g,'* /');
async function bundle(entries,tail=''){
 const modules=new Map();
 async function visit(path){path=resolve(root,path);const id=relative(root,path).replaceAll('\\','/');if(modules.has(id))return id;modules.set(id,'');let source=await readFile(path,'utf8'),imports='',names=[];
 // Imports/re-exports in this codebase occur before the first declaration. Do not rewrite
 // the integration examples inside template literals in the sample app.
 while(true){const match=source.match(/^\s*(import\s+(?:(\*\s+as\s+\w+|\{[^}]*\})\s+from\s+)?['"]([^'"]+)['"]\s*;|export\s+\*\s+from\s+['"]([^'"]+)['"]\s*;)/);if(!match)break;
   const dep=await visit(resolve(dirname(path),match[3]??match[4]));
   if(match[4])imports+=`Object.assign(exports,require(${JSON.stringify(dep)}));\n`;
   else if(!match[2])imports+=`require(${JSON.stringify(dep)});\n`;
   else if(match[2].startsWith('*'))imports+=`const ${match[2].replace(/\*\s+as\s+/,'')}=require(${JSON.stringify(dep)});\n`;
   else imports+=`const ${match[2].replace(/\s+as\s+/g,':')}=require(${JSON.stringify(dep)});\n`;
   source=source.slice(match[0].length);
 }
 source=source.replace(/^export\s+(async\s+)?(class|function|const|let|var)\s+(\w+)/gm,(_,a='',kind,name)=>{names.push(name);return `${a}${kind} ${name}`;});
 source=source.replace(/^export\s*\{([^}]+)\};?/gm,(_,list)=>{for(const n of list.split(','))names.push(n.trim());return '';});
 const assigns=names.map(n=>n.includes(' as ')?n.split(/\s+as\s+/).reverse().join(':'):n).join(',');
 modules.set(id,`function(exports,require){\n${imports}${source}\nObject.assign(exports,{${assigns}});\n}`);return id;
 }
 const ids=[];for(const entry of entries)ids.push(await visit(entry));
 return `/* TreeDataGrid Web 0.1.0 | Source-informed port.
${license}
Upstream: wieslawsoltes/TreeDataGrid@3ca47316d724e5e040ab0281a880e8df999b25fc
See THIRD_PARTY_NOTICES.md for provenance. */\n(()=>{\n'use strict';\nconst modules={\n${[...modules].map(([id,code])=>JSON.stringify(id)+':'+code).join(',\n')}\n};\nconst cache=Object.create(null);function require(id){if(cache[id])return cache[id];const exports={};cache[id]=exports;if(!modules[id])throw new Error('Unknown bundled module: '+id);modules[id](exports,require);return exports;}\n${ids.map(id=>`require(${JSON.stringify(id)});`).join('\n')}\n${tail}\n})();\n`;
}
await mkdir(resolve(root,'dist'),{recursive:true});
const library=await bundle(['packages/core/index.js','packages/web/index.js'],`globalThis.TreeDataGridCore=require('packages/core/index.js');globalThis.TreeDataGridWeb=require('packages/web/index.js');`);
const app=await bundle(['samples/core-demo/app.js']);
await writeFile(resolve(root,'dist/treedatagrid.global.js'),library);
await writeFile(resolve(root,'dist/core-demo.bundle.js'),app);
const html=await readFile(resolve(root,'index.html'),'utf8'),css=await readFile(resolve(root,'samples/core-demo/app.css'),'utf8');
const standalone=html.replace('<link rel="stylesheet" href="./samples/core-demo/app.css">',`<style>${css}</style>`).replace('<script type="module" src="./samples/core-demo/app.js"></script>',`<script>${app.replace(/<\/script/gi,'<\\/script')}</script>`).replace('href="./README.md" target="_blank" rel="noopener" id="readme-link"','href="#" onclick="document.getElementById(\'source-toggle\').click();return false" id="readme-link"');
await writeFile(resolve(root,'dist/TreeDataGridWeb.html'),standalone);
console.log(`Built library (${library.length.toLocaleString()} chars), showcase (${app.length.toLocaleString()} chars), standalone (${standalone.length.toLocaleString()} chars).`);
