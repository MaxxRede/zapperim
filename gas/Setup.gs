/* Execute instalarZapperim() em um projeto Apps Script NOVO. */
const ZAP_SCHEMA = Object.freeze({
  CONFIG: ['CHAVE','VALOR','DESCRICAO'],
  REGRAS_UF: ['UF','ATIVO','PEDIDO_MINIMO_CENTAVOS','LIMITE_NOVO_CENTAVOS','CONDICOES','ATUALIZADO_EM'],
  CLIENTES: ['CNPJ','COD_CLIENTE','RAZAO_SOCIAL','EMAIL','TELEFONE','ENDERECO','CIDADE','UF','CEP','COMPLEMENTO','RESPONSAVEL','CARGO','SELLER_ID','TABELA','CONDICAO','STATUS','ATUALIZADO_EM'],
  CADASTROS_PENDENTES: ['ID','CRIADO_EM','CNPJ','RAZAO_SOCIAL','EMAIL','TELEFONE','ENDERECO','CIDADE','UF','CEP','COMPLEMENTO','RESPONSAVEL','CARGO','SELLER_ID','STATUS'],
  PRODUTOS: ['CODIGO','EAN','DESCRICAO','MARCA','IMAGEM_URL','ATIVO','ATUALIZADO_EM'],
  PRECOS: ['CODIGO','TABELA','PRECO_CENTAVOS','PROMOCAO','ATUALIZADO_EM'],
  ESTOQUE: ['CODIGO','QTDE_DISPONIVEL','ATUALIZADO_EM'],
  RANKING: ['CODIGO','QTDE_VENDIDA','PERIODO','ATUALIZADO_EM'],
  PEDIDOS: ['PEDIDO_ID','REQUISICAO_ID','CRIADO_EM','CNPJ','RAZAO_SOCIAL','EMAIL','UF','SELLER_ID','TABELA','CONDICAO','STATUS','TOTAL_CENTAVOS','OBSERVACOES','PDF_ID','XLSX_ID','EMAIL_STATUS','ERRO'],
  PEDIDO_ITENS: ['PEDIDO_ID','CODIGO','DESCRICAO','QTDE','PRECO_UNIT_CENTAVOS','TOTAL_CENTAVOS','ESTOQUE_NA_COMPRA'],
  LOG_IMPORTACAO: ['EXECUCAO_ID','INICIO','FIM','FONTE','ABA','REGISTROS','STATUS','ERRO']
});
const ZAP_UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

function instalarZapperim() {
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
    return {url:ss.getUrl(),id:ss.getId(),abas:Object.keys(ZAP_SCHEMA),ambiente:'HOMOLOGACAO'};
  } finally { lock.releaseLock(); }
}
