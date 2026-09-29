import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const dir=mkdtempSync(join(tmpdir(),'zapperim-name-'));
const file=join(dir,'PAGES_PROJECT_NAME.txt');
const run=()=>spawnSync(process.execPath,['tools/pages-project-name.mjs',file],{encoding:'utf8'});
try {
  const first=run();
  assert.equal(first.status,0,first.stderr);
  assert.match(first.stdout.trim(),/^zapperim-perim-[0-9a-f]{16}$/);
  assert.equal(run().stdout,first.stdout);
  assert.equal(readFileSync(file,'utf8').trim(),first.stdout.trim());
  writeFileSync(file,'zapperim.pages.dev\n');
  assert.equal(run().status,2);
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('Instalador: nome exclusivo persistente validado.');
const bat=readFileSync('INSTALAR_ZAPPERIM_WINDOWS.bat','utf8');
const deploy=bat.indexOf('wrangler pages deploy');
assert.ok(deploy>0);
assert.match(bat.slice(deploy),/pages project list --json/);
assert.match(bat.slice(deploy),/pages-project-url\.mjs/);
assert.doesNotMatch(bat.slice(deploy),/https:\/\/%PROJECT_NAME%\.pages\.dev/);
