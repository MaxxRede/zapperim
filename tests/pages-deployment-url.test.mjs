import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const dir=mkdtempSync(join(tmpdir(),'zapperim-deployment-'));
try {
  const file=join(dir,'deployments.json');
  const run=data=>{
    writeFileSync(file,JSON.stringify(data));
    return spawnSync(process.execPath,['tools/pages-deployment-url.mjs',file],{encoding:'utf8'});
  };
  const production={environment:'production',url:'https://abcd1234.zapperim-perim.pages.dev',aliases:['zapperim-perim.pages.dev'],latest_stage:{status:'success'}};
  const ready=run([production]);
  assert.equal(ready.status,0,ready.stderr);
  assert.match(ready.stdout,/https:\/\/zapperim-perim\.pages\.dev/);
  assert.match(ready.stdout,/https:\/\/abcd1234\.zapperim-perim\.pages\.dev/);
  assert.equal(run([{...production,latest_stage:{status:'failure'}}]).status,2);
  assert.equal(run([{...production,environment:'preview'}]).status,2);
  assert.equal(run([{...production,url:'https://evil.example.com',aliases:[]}]).status,2);
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('Instalador: URL de publicação Cloudflare validada.');
