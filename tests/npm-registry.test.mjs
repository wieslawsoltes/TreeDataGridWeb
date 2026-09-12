import test from 'node:test';
import assert from 'node:assert/strict';
import { integrityOf, assertRegistryArtifact, fetchRegistryJson } from '../scripts/npm-registry.mjs';
const pkg = {name:'@wieslawsoltes/treedatagridweb',version:'0.1.0'};
test('registry retry accepts only byte-identical public package metadata', () => {
 const integrity=integrityOf(Buffer.from('verified release'));
 const metadata={...pkg,dist:{integrity,tarball:'https://registry.npmjs.org/@wieslawsoltes/treedatagridweb/-/treedatagridweb-0.1.0.tgz'}};
 assert.equal(assertRegistryArtifact(metadata,pkg,integrity).hostname,'registry.npmjs.org');
 assert.throws(()=>assertRegistryArtifact({...metadata,dist:{...metadata.dist,integrity:'sha512-other'}},pkg,integrity),/different bytes/);
 assert.throws(()=>assertRegistryArtifact({...metadata,dist:{...metadata.dist,tarball:'https://example.com/package.tgz'}},pkg,integrity),/Unexpected registry/);
 assert.throws(()=>assertRegistryArtifact({...metadata,version:'0.2.0'},pkg,integrity),/version differs/);
});
test('registry existence checks distinguish absence from authorization and network failure', async () => {
 const response=status=>async()=>new Response(status===200?'{}':'', {status});
 assert.equal(await fetchRegistryJson('https://registry.npmjs.org/package',response(404)),null);
 await assert.rejects(fetchRegistryJson('https://registry.npmjs.org/package',response(403)),/HTTP 403/);
 await assert.rejects(fetchRegistryJson('https://registry.npmjs.org/package',response(503)),/HTTP 503/);
 await assert.rejects(fetchRegistryJson('https://registry.npmjs.org/package',async()=>new Response('[]')),/malformed/);
});
