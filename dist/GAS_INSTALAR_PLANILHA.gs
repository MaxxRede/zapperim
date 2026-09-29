/** ZAPerim — instale a planilha uma vez; mantenha este arquivo no mesmo projeto da API. */

/** Contrato v3. Nomes e ordem das colunas fornecidos pelo usuário. */
var ZAP_SCHEMA = Object.freeze({
  usuarios: ['RESPONSAVEL','LOGIN','SENHA','UNIDADE','TIPO','EQUIPE','SALDO'],
  acesso: ['ST','CNPJ','RESPONSAVEL','TABELA','OBSERVACOES','STATUS'],
  pedidos: ['CNPJ/CPF','RESONSAVEL','ATENDIMENTO','TABELA','CODIGO','PRODUTO','QTDE','VALOR','DESC_PROD','BONIFICADO','PGTO','CONDICAO','DESC_PEDIDO','MAT APOIO','OBSERVACOES','ZERADO','DTPed'],
  view_bd: ['CNPJ/CPF','MEDIANA','SUG. VISITA','PED. MÍNIMO','CLIENTE','CIDADE','SALDO','CONDIÇÃO','PONTUALIDADE','OBSERVAÇÃO','ENDEREÇO','TABELA','CRM','COD_CLI','TELEFONE','E-MAIL'],
  financeiro: ['CNPJ','CREDITO','SALDO','TOT_COMPRAS','MED_COMPRA','NUMMESES','MEDIA_ATRASO','DATA_ULT_COMPRA','DESC_PRAZO','PERC_PONTUALIDADE','MOTIVO_BLOQUEIO','CANAL','RCA','CLIENTE'],
  stq: ['EAN','COD','DESCRICAO','TABELA','ESTOQUE','PRECO VND','SALDO_STQ','MARCA','PACKING'],
  imagens: ['Nome do Arquivo','URL','Produto']
});
var ZAP_UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

/* Execute instalarZapperim() em projeto Apps Script novo. Não modifica a base anterior. */
function instalarZapperim() {
  const active=Session.getActiveUser().getEmail(), owner=Session.getEffectiveUser().getEmail();
  if(!active || !owner || active.toLowerCase()!==owner.toLowerCase())
    throw new Error('Instalação permitida somente ao proprietário no editor Apps Script.');
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const props=PropertiesService.getScriptProperties();
    const id=props.getProperty('ZAP_BASE_V3_ID');
    const ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.create('ZAPerim - Base v3 - homologação');
    Object.keys(ZAP_SCHEMA).forEach(name=>{
      const sh=ss.getSheetByName(name); if(!sh)return;
      const header=ZAP_SCHEMA[name];
      const actual=sh.getRange(1,1,1,Math.max(header.length,sh.getLastColumn())).getValues()[0];
      if(actual.some(x=>x!=='') && actual.join('\u001f')!==header.join('\u001f'))
        throw new Error('Cabeçalho divergente na aba '+name+'; nenhum dado existente foi alterado.');
    });
    Object.keys(ZAP_SCHEMA).forEach(name=>{
      const header=ZAP_SCHEMA[name],sh=ss.getSheetByName(name)||ss.insertSheet(name);
      sh.getRange(1,1,1,header.length).setValues([header]).setBackground('#17365d').setFontColor('#fff').setFontWeight('bold');
      sh.setFrozenRows(1);
      header.forEach((column,i)=>{
        const range=sh.getRange(2,i+1,Math.max(1,sh.getMaxRows()-1),1);
        if(['CNPJ','CNPJ/CPF','COD','EAN','COD_CLI','TELEFONE','LOGIN'].includes(column))range.setNumberFormat('@');
        if(['PRECO VND','VALOR','PED. MÍNIMO','CREDITO','SALDO','TOT_COMPRAS','MED_COMPRA'].includes(column))range.setNumberFormat('"R$" #,##0.00');
        if(['STATUS','DTPed'].includes(column))range.setNumberFormat('dd/MM/yyyy HH:mm:ss');
      });
    });
    const initial=ss.getSheetByName('Página1')||ss.getSheetByName('Sheet1');
    if(initial && initial.getLastRow()===0 && ss.getSheets().length>1)ss.deleteSheet(initial);
    if(!id)props.setProperty('ZAP_BASE_V3_ID',ss.getId());
    if(!props.getProperty('ZAP_AMBIENTE_V3'))props.setProperty('ZAP_AMBIENTE_V3','HOMOLOGACAO');
    const result={url:ss.getUrl(),id:ss.getId(),abas:Object.keys(ZAP_SCHEMA),ambiente:'HOMOLOGACAO'};
    Logger.log('Planilha ZAPerim v3: '+result.url);
    return result;
  }finally{lock.releaseLock();}
}

