/* Execute instalarZapperim() no editor Apps Script. Não cria planilhas novas. */
var ZAP_TARGET_SPREADSHEET_ID = '';
function instalarZapperim() {
  const active=Session.getActiveUser().getEmail(), owner=Session.getEffectiveUser().getEmail();
  if(!active || !owner || active.toLowerCase()!==owner.toLowerCase())
    throw new Error('Instalação permitida somente ao proprietário no editor Apps Script.');
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const props=PropertiesService.getScriptProperties();
    const explicit=String(ZAP_TARGET_SPREADSHEET_ID||'').trim();
    const saved=String(props.getProperty('ZAP_BASE_V3_ID')||'').trim();
    const bound=explicit||saved?null:SpreadsheetApp.getActiveSpreadsheet();
    const id=explicit||saved||(bound&&bound.getId())||'';
    if(!/^[A-Za-z0-9_-]{20,}$/.test(id))
      throw new Error('Informe o ID da planilha no instalador ou execute o script vinculado à planilha. Nenhuma planilha foi criada.');
    const ss=SpreadsheetApp.openById(id);
    Object.keys(ZAP_SCHEMA).forEach(name=>{
      const sh=ss.getSheetByName(name); if(!sh)return;
      const header=ZAP_SCHEMA[name];
      const actual=sh.getRange(1,1,1,Math.max(header.length,sh.getLastColumn())).getValues()[0];
      if(actual.some(x=>x!=='') && actual.join('\u001f')!==header.join('\u001f'))
        throw new Error('Cabeçalho divergente na aba '+name+'; nenhum dado existente foi alterado.');
      if(actual.every(x=>x==='') && sh.getLastRow()>1)
        throw new Error('Aba '+name+' contém dados sem cabeçalho; nenhum dado foi alterado.');
    });
    Object.keys(ZAP_SCHEMA).forEach(name=>{
      const header=ZAP_SCHEMA[name],existing=ss.getSheetByName(name);
      if(existing && existing.getLastRow()>0)return; // Preserva conteúdo e formatação da aba existente.
      const sh=existing||ss.insertSheet(name);
      sh.getRange(1,1,1,header.length).setValues([header]).setBackground('#17365d').setFontColor('#fff').setFontWeight('bold');
      sh.setFrozenRows(1);
      header.forEach((column,i)=>{
        const range=sh.getRange(2,i+1,Math.max(1,sh.getMaxRows()-1),1);
        if(['CNPJ','CNPJ/CPF','COD','EAN','COD_CLI','TELEFONE','LOGIN'].includes(column))range.setNumberFormat('@');
        if(['PRECO VND','VALOR','PED. MÍNIMO','CREDITO','SALDO','TOT_COMPRAS','MED_COMPRA'].includes(column))range.setNumberFormat('"R$" #,##0.00');
        if(['STATUS','DTPed'].includes(column))range.setNumberFormat('dd/MM/yyyy HH:mm:ss');
      });
    });
    // Só atualiza o vínculo depois de validar e preparar a planilha indicada.
    if(saved!==id)props.setProperty('ZAP_BASE_V3_ID',id);
    if(!props.getProperty('ZAP_AMBIENTE_V3'))props.setProperty('ZAP_AMBIENTE_V3','HOMOLOGACAO');
    const result={url:ss.getUrl(),id:ss.getId(),abas:Object.keys(ZAP_SCHEMA),ambiente:'HOMOLOGACAO'};
    Logger.log('Planilha ZAPerim v3 vinculada: '+result.url);
    return result;
  }finally{lock.releaseLock();}
}
