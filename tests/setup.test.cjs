const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/../dist/GAS_INSTALAR_PLANILHA.gs','utf8');
const sheets=new Map(), props=new Map();let creates=0,writes=0;
const TEST_ID='test-spreadsheet-id-000000000000001';
props.set('ZAP_SPREADSHEET_ID','old-base-id');
function sheet(name){const row=[];let dataRows=0;return {name,row,getRange(r,_c,_nr,nc){const range={getValues:()=>[Array.from({length:nc},(_,i)=>row[i]||'')],setValues:values=>{writes++;if(r===1)row.splice(0,row.length,...values[0]);else dataRows=values.length;return range;},setBackground:()=>range,setFontColor:()=>range,setFontWeight:()=>range,setNumberFormat:()=>range};return range;},getMaxRows:()=>20,getLastColumn:()=>row.length,getLastRow:()=>dataRows?dataRows+1:row.length?1:0,setFrozenRows(){}};}
const spreadsheet={getId:()=> TEST_ID,getUrl:()=> 'https://docs.google.com/spreadsheets/d/'+TEST_ID,getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=sheet(n);sheets.set(n,s);return s;},getSheets:()=>[...sheets.values()],deleteSheet:s=>sheets.delete(s.name)};
const ctx=vm.createContext({
  Logger:{log(){}},
  Session:{getActiveUser:()=>({getEmail:()=> 'owner@example.com'}),getEffectiveUser:()=>({getEmail:()=> 'owner@example.com'})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},
  SpreadsheetApp:{create:()=>{creates++;throw Error('Não pode criar outra planilha.');},getActiveSpreadsheet:()=>spreadsheet,openById:id=>{assert.equal(id,TEST_ID);return spreadsheet;}}
});
vm.runInContext(code,ctx);
const install=vm.runInContext('instalarZapperim',ctx);
const first=install();assert.equal(first.id,TEST_ID);assert.deepEqual(Array.from(first.abas),['usuarios','acesso','pedidos','view_bd','financeiro','stq','imagens']);assert.equal(creates,0);
assert.equal(props.get('ZAP_BASE_V3_ID'),TEST_ID);
assert.deepEqual(sheets.get('pedidos').row,['CNPJ/CPF','RESONSAVEL','ATENDIMENTO','TABELA','CODIGO','PRODUTO','QTDE','VALOR','DESC_PROD','BONIFICADO','PGTO','CONDICAO','DESC_PEDIDO','MAT APOIO','OBSERVACOES','ZERADO','DTPed']);
const initialWrites=writes;
install();assert.equal(creates,0);assert.equal(writes,initialWrites);
sheets.get('view_bd').row[0]='COLUNA_DIVERGENTE';
assert.throws(()=>install(),/Cabeçalho divergente/);
assert.equal(sheets.get('view_bd').row[0],'COLUNA_DIVERGENTE');
sheets.get('view_bd').row[0]='CNPJ/CPF';
props.set('ZAP_BASE_V3_ID','other-spreadsheet-id-00000000001');
vm.runInContext('ZAP_TARGET_SPREADSHEET_ID='+JSON.stringify(TEST_ID),ctx);
install();assert.equal(props.get('ZAP_BASE_V3_ID'),TEST_ID);
ctx.Session.getActiveUser=()=>({getEmail:()=>''});
assert.throws(()=>install(),/proprietário/);
ctx.Session.getActiveUser=()=>({getEmail:()=> 'owner@example.com'});
props.delete('ZAP_BASE_V3_ID');
vm.runInContext("ZAP_TARGET_SPREADSHEET_ID=''",ctx);
ctx.SpreadsheetApp.getActiveSpreadsheet=()=>null;
assert.throws(()=>install(),/Nenhuma planilha foi criada/);
assert.equal(creates,0);
console.log('Instalador: planilha existente, vínculo explícito, reexecução e proteção de cabeçalhos validados.');
