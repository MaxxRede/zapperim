function doGet() {
  const installed=!!PropertiesService.getScriptProperties().getProperty('ZAP_BASE_V3_ID');
  return json_({api:3,revision:'v3-ufs-local-20260929',connected:installed,status:installed?'ready':'not_installed'});
}
function ss_() {
  const id=PropertiesService.getScriptProperties().getProperty('ZAP_BASE_V3_ID');
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
function config_(key) { return String(PropertiesService.getScriptProperties().getProperty('ZAP_'+key+'_V3')||'').trim(); }
function now_() { return new Date().toISOString(); }
function digits_(s) { return String(s||'').replace(/\D/g,''); }
function clean_(value,max) { return String(value||'').trim().slice(0,max); }
function email_(v) { const s=clean_(v,180).toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error('E-mail inválido.'); return s; }
function cnpj_(v) { const s=digits_(v); if(!/^\d{14}$/.test(s)) throw new Error('Informe um CNPJ de 14 dígitos.'); return s; }
function validUf_(s) { return 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').includes(s); }
function uf_(v) { const s=clean_(v,2).toUpperCase(); if(!validUf_(s)) throw new Error('UF inválida.'); return s; }
function uuid_() { return Utilities.getUuid(); }
function requireInt_(v,min,max,label) { const x=Number(v); if(!Number.isSafeInteger(x)||x<min||x>max) throw new Error(label+' inválido.'); return x; }
function limited_(text,max,label) { const s=clean_(text,max+1); if(s.length>max) throw new Error(label+' excede '+max+' caracteres.'); return s; }
function amount_(v,label) { return requireInt_(v,0,100000000000,label); }
function moneyCents_(v,label) {
  if(typeof v==='number' && Number.isFinite(v))return amount_(Math.round(v*100),label);
  let s=String(v==null?'':v).replace(/R\$|\s/g,'');
  if(!s)throw new Error(label+' não configurado.');
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  if(!/^\d+(\.\d{1,2})?$/.test(s))throw new Error(label+' inválido: '+v);
  return amount_(Math.round(Number(s)*100),label);
}
function ufEndereco_(text) {
  const s=String(text||'').toUpperCase().trim().replace(/(?:[,\s]+)?\d{5}-?\d{3}\s*$/,'').replace(/[\s,;]+$/,'');
  const match=s.match(/(?:\bUF\s*[:=-]\s*|[-,/\s])([A-Z]{2})\s*$/);
  if(!match || !validUf_(match[1]))throw new Error('UF não identificada no final do ENDEREÇO do cliente. Informe a sigla (ex.: AVARÉ - SP).');
  return match[1];
}
function enabledUf_(uf) {
  const all=config_('UFS_ATENDIDAS'); return !all||all==='*'||all.split(',').map(s=>s.trim().toUpperCase()).includes(uf);
}
function rule_(uf,key,globalKey,profile) {
  if(key==='PEDIDO_MINIMO_CENTAVOS') {
    if(profile && profile.tipo==='EXISTENTE')return moneyCents_(profile.minimo,'PED. MÍNIMO');
  }
  const value=config_(globalKey);
  if(value==='')throw new Error('Regra '+globalKey+' ainda não configurada nas propriedades do script.');
  return amount_(Number(value),globalKey);
}
function publicError_(e) { throw new Error(e && e.message ? e.message : 'Não foi possível concluir a operação.'); }
