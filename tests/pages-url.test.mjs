import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const dir=mkdtempSync(join(tmpdir(),'zapperim-pages-'));
try {
  const file=join(dir,'projects.json');
  const run=data=>{
    writeFileSync(file,JSON.stringify(data));
    return spawnSync(process.execPath,['tools/pages-project-url.mjs',file,'zapperim-app'],{encoding:'utf8'});
  };
  const project={name:'zapperim-app',subdomain:'zapperim-app-abc.pages.dev',canonical_deployment:{latest_stage:{status:'success'}}};
  const ready=run([project]);
  assert.equal(ready.status,0,ready.stderr);
  assert.match(ready.stdout,/https:\/\/zapperim-app-abc\.pages\.dev\/api\/health/);
  assert.equal(run([{...project,canonical_deployment:null}]).status,2);
  assert.equal(run([{...project,subdomain:'other.example.com'}]).status,2);
  assert.equal(run([]).status,2);
} finally {rmSync(dir,{recursive:true,force:true});}
console.log('Instalador: dominio real e status de publicacao validados.');
