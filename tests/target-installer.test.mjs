import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const dir=mkdtempSync(join(tmpdir(),'zapperim-target-'));
try {
  const target='test-spreadsheet-id-000000000000001',output=join(dir,'GAS_INSTALAR_ALVO.gs');
  const run=spawnSync(process.execPath,['tools/build-target-gas.mjs',target,output],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const gas=readFileSync(output,'utf8');
  assert.ok(gas.includes(`var ZAP_TARGET_SPREADSHEET_ID = '${target}';`));
  assert.ok(!gas.includes('SpreadsheetApp.create('));
  assert.ok(gas.includes('SpreadsheetApp.openById(id)'));
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('GAS direcionado: ID explícito e ausência de criação de outra planilha validados.');
