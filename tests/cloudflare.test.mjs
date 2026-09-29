import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {onRequestPost} from '../functions/api.js';
import {onRequestGet} from '../functions/api/health.js';
const html=readFileSync(resolve('dist/cloudflare/index.html'),'utf8');
assert.ok(html.includes('fetch(\'/api\''));
assert.ok(!html.includes('google.script.run'));
const url='https://script.google.com/macros/s/TEST123/exec';
const originalFetch=globalThis.fetch;
globalThis.fetch=async (_url,opts)=>{
  assert.equal(_url,url);
  if(!opts || opts.method!=='POST')return new Response(JSON.stringify({api:3,revision:'v3-ufs-local-20260929',connected:true,status:'ready'}),{status:200});
  assert.equal(opts.method,'POST');
  assert.equal(opts.redirect,'follow');
  return new Response(JSON.stringify({ok:true,result:{tipo:'NOVO'}}),{status:200});
};
try {
  const request=new Request('https://zapperim.pages.dev/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'identificarCnpj',args:['99999999000199']})});
  const response=await onRequestPost({request,env:{GAS_WEB_APP_URL_V3:url}});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true,result:{tipo:'NOVO'}});
  const missing=await onRequestPost({request,env:{}});
  assert.equal(missing.status,503);
  globalThis.fetch=async()=>new Response(JSON.stringify({api:3,revision:'v3-ufs-local-20260929',connected:true,status:'ready'}),{status:200});
  const health=await onRequestGet({env:{GAS_WEB_APP_URL_V3:url}});
  assert.deepEqual(await health.json(),{api:3,revision:'v3-ufs-local-20260929',connected:true,status:'ready'});
  globalThis.fetch=async()=>new Response(JSON.stringify({api:2,connected:true,status:'ready'}),{status:200});
  const stale=await onRequestGet({env:{GAS_WEB_APP_URL_V3:url}});
  assert.equal(stale.status,503);
  assert.equal((await stale.json()).status,'gas_outdated');
  const staleRequest=new Request('https://zapperim.pages.dev/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'identificarCnpj',args:['99999999000199']})});
  const stalePost=await onRequestPost({request:staleRequest,env:{GAS_WEB_APP_URL_V3:'https://script.google.com/macros/s/OLD/exec'}});
  assert.equal(stalePost.status,503);
  assert.match((await stalePost.json()).error,/versão antiga/);
} finally {globalThis.fetch=originalFetch;}
console.log('Cloudflare: frontend e proxy GAS validados.');
