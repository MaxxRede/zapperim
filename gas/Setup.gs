/* Execute instalarZapperim() em um projeto Apps Script NOVO. */
function instalarZapperim() {
  const active=Session.getActiveUser().getEmail(), owner=Session.getEffectiveUser().getEmail();
  if(!active || !owner || active.toLowerCase()!==owner.toLowerCase())
    throw new Error('Instalação permitida somente ao proprietário no editor Apps Script.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const prop = PropertiesService.getScriptProperties();
    const id = prop.getProperty('ZAP_SPREADSHEET_ID');
    const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('ZAPerim - Base de homologação');
    if (!id) prop.setProperty('ZAP_SPREADSHEET_ID', ss.getId());
    Object.keys(ZAP_SCHEMA).forEach(name => {
      const header = ZAP_SCHEMA[name];
      const sh = ss.getSheetByName(name) || ss.insertSheet(name);
      const actual = sh.getRange(1,1,1,header.length).getValues()[0];
      if (actual.some(x => x !== '') && actual.join('\u001f') !== header.join('\u001f'))
        throw new Error('Cabeçalho divergente em ' + name + '; nenhum cabeçalho foi sobrescrito.');
      sh.getRange(1,1,1,header.length).setValues([header]).setBackground('#17365d').setFontColor('#fff').setFontWeight('bold');
      sh.setFrozenRows(1);
      header.forEach((column, i) => {
        if (['CNPJ','COD_CLIENTE','CODIGO','EAN','CEP','TELEFONE','SELLER_ID','PEDIDO_ID','REQUISICAO_ID'].includes(column))
          sh.getRange(2,i+1,Math.max(1,sh.getMaxRows()-1),1).setNumberFormat('@');
      });
    });
    const sheet = ss.getSheetByName('CONFIG');
    if (sheet.getLastRow() === 1) sheet.getRange(2,1,8,3).setValues([
      ['SCHEMA_VERSION','2','Não alterar sem migração'],
      ['AMBIENTE','HOMOLOGACAO','Não usar para clientes reais antes de validar'],
      ['PAGE_SIZE','21','Produtos por página'],
      ['PEDIDO_MINIMO_CENTAVOS','','Obrigatório para liberar fechamento'],
      ['LIMITE_NOVO_CENTAVOS','','Obrigatório para liberar fechamento'],
      ['UFS_ATENDIDAS','*','* ou siglas separadas por vírgula; REGRAS_UF substitui'],
      ['TABELA_NOVO','NOVO','Tabela para cadastro novo'],
      ['EMAIL_FATURAMENTO','','Destinatário do pedido após a homologação']
    ]);
    const initial = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
    if (initial && initial.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(initial);
    const result={url:ss.getUrl(),id:ss.getId(),abas:Object.keys(ZAP_SCHEMA),ambiente:'HOMOLOGACAO'};
    Logger.log('Planilha ZAPerim: '+result.url);
    return result;
  } finally { lock.releaseLock(); }
}
