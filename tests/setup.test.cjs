const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/../gas/Setup.gs','utf8');
const sheets=new Map(), props=new Map();let creates=0;
function sheet(name){const row=[];let dataRows=0;return {name,row,getRange(r,_c,_nr,nc){const range={getValues:()=>[Array.from({length:nc},(_,i)=>row[i]||'')],setValues:values=>{if(r===1)row.splice(0,row.length,...values[0]);else dataRows=values.length;return range;},setBackground:()=>range,setFontColor:()=>range,setFontWeight:()=>range,setNumberFormat:()=>range};return range;},getMaxRows:()=>20,getLastRow:()=>dataRows?dataRows+1:row.length?1:0,setFrozenRows(){}};}
const spreadsheet={getId:()=> 'sheet-test',getUrl:()=> 'https://docs.google.com/spreadsheets/d/sheet-test',getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=sheet(n);sheets.set(n,s);return s;},getSheets:()=>[...sheets.values()],deleteSheet:s=>sheets.delete(s.name)};
const ctx=vm.createContext({
  Session:{getActiveUser:()=>({getEmail:()=> 'owner@example.com'}),getEffectiveUser:()=>({getEmail:()=> 'owner@example.com'})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},
  SpreadsheetApp:{create:()=>{creates++;return spreadsheet;},openById:id=>{assert.equal(id,'sheet-test');return spreadsheet;}}
});
vm.runInContext(code,ctx);
const install=vm.runInContext('instalarZapperim',ctx);
const first=install();assert.equal(first.id,'sheet-test');assert.equal(first.abas.length,11);assert.equal(creates,1);
assert.equal(sheets.get('CONFIG').row[0],'CHAVE');
install();assert.equal(creates,1);
sheets.get('CLIENTES').row[0]='COLUNA_DIVERGENTE';
assert.throws(()=>install(),/Cabeçalho divergente/);
ctx.Session.getActiveUser=()=>({getEmail:()=>''});
assert.throws(()=>install(),/proprietário/);
console.log('Instalador: criação, reexecução, conflito de cabeçalho e acesso validados.');
