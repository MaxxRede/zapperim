function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate().setTitle('ZAPerim • Pedidos')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}
function include_(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }
function ss_() {
  const id=PropertiesService.getScriptProperties().getProperty('ZAP_SPREADSHEET_ID');
  if (!id) throw new Error('Execute instalarZapperim() antes de publicar.');
  return SpreadsheetApp.openById(id);
}
function tab_(name) { const s=ss_().getSheetByName(name); if(!s) throw new Error('Aba ausente: '+name); return s; }
function records_(name) {
  const s=tab_(name), n=s.getLastRow(); if(n<2) return [];
  const values=s.getRange(1,1,n,ZAP_SCHEMA[name].length).getValues();
  return values.slice(1).map((row,i)=>Object.fromEntries(values[0].map((key,j)=>[key,row[j]]).concat([['_ROW',i+2]])));
}
function append_(name,row) { tab_(name).appendRow(ZAP_SCHEMA[name].map(k=>row[k] == null ? '' : safeCell_(row[k]))); }
function safeCell_(value) { return typeof value==='string' && /^[=+\-@]/.test(value) ? "'"+value : value; }
function config_(key) { const r=records_('CONFIG').find(x=>x.CHAVE===key); return r ? String(r.VALOR).trim() : ''; }
function now_() { return new Date().toISOString(); }
function digits_(s) { return String(s||'').replace(/\D/g,''); }
function clean_(value,max) { return String(value||'').trim().slice(0,max); }
function email_(v) { const s=clean_(v,180).toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error('E-mail inválido.'); return s; }
function cnpj_(v) { const s=digits_(v); if(!/^\d{14}$/.test(s)) throw new Error('Informe um CNPJ de 14 dígitos.'); return s; }
function uf_(v) { const s=clean_(v,2).toUpperCase(); if(!ZAP_UFS.includes(s)) throw new Error('UF inválida.'); return s; }
function uuid_() { return Utilities.getUuid(); }
function requireInt_(v,min,max,label) { const x=Number(v); if(!Number.isSafeInteger(x)||x<min||x>max) throw new Error(label+' inválido.'); return x; }
function limited_(text,max,label) { const s=clean_(text,max+1); if(s.length>max) throw new Error(label+' excede '+max+' caracteres.'); return s; }
function amount_(v,label) { return requireInt_(v,0,100000000000,label); }
function enabledUf_(uf) {
  const rule=records_('REGRAS_UF').find(r=>r.UF===uf);
  if(rule) return String(rule.ATIVO).toUpperCase()==='SIM';
  const all=config_('UFS_ATENDIDAS'); return all==='*' || all.split(',').map(s=>s.trim().toUpperCase()).includes(uf);
}
function rule_(uf,key,globalKey) {
  const local=records_('REGRAS_UF').find(r=>r.UF===uf);
  const value=local&&local[key]!=='' ? local[key] : config_(globalKey);
  if(value==='') throw new Error('Regra '+globalKey+' ainda não configurada.');
  return amount_(value,globalKey);
}
function publicError_(e) { throw new Error(e && e.message ? e.message : 'Não foi possível concluir a operação.'); }
