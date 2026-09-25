/** ZAPedido novo: instalador da planilha operacional isolada.
 * Execute criarPlanilhaZapNovo uma única vez no projeto Apps Script novo.
 * Este arquivo não consulta nem altera a base antiga.
 */
const ZAP_SCHEMA_VERSION = '1';
const ZAP_TABS = Object.freeze({
  CONFIG: ['CHAVE', 'VALOR', 'DESCRICAO'],
  REGRAS_UF: ['UF', 'ATIVO', 'PEDIDO_MINIMO_CENTAVOS', 'LIMITE_CLIENTE_NOVO_CENTAVOS', 'CONDICOES_PERMITIDAS', 'ATUALIZADO_EM'],
  CLIENTES: ['CNPJ', 'COD_CLIENTE', 'RAZAO_SOCIAL', 'NOME_FANTASIA', 'EMAIL', 'TELEFONE', 'ENDERECO', 'CIDADE', 'UF', 'CEP', 'RESPONSAVEL', 'CARGO', 'SELLER_ID', 'TABELA', 'CONDICAO', 'LIMITE_CENTAVOS', 'STATUS', 'ATUALIZADO_EM'],
  CADASTROS_PENDENTES: ['ID', 'CRIADO_EM', 'CNPJ', 'RAZAO_SOCIAL', 'EMAIL', 'TELEFONE', 'ENDERECO', 'CIDADE', 'UF', 'CEP', 'RESPONSAVEL', 'CARGO', 'SELLER_ID', 'STATUS'],
  PRODUTOS: ['CODIGO', 'EAN', 'DESCRICAO', 'MARCA', 'PACKING', 'IMAGEM_URL', 'ATIVO', 'ATUALIZADO_EM'],
  PRECOS: ['CODIGO', 'TABELA', 'PRECO_CENTAVOS', 'PROMOCAO', 'ATUALIZADO_EM'],
  ESTOQUE: ['CODIGO', 'QTDE_DISPONIVEL', 'ATUALIZADO_EM'],
  RANKING: ['CODIGO', 'QTDE_VENDIDA', 'POSICAO', 'PERIODO', 'ATUALIZADO_EM'],
  PEDIDOS: ['PEDIDO_ID', 'REQUISICAO_ID', 'CRIADO_EM', 'CNPJ', 'COD_CLIENTE', 'SELLER_ID', 'TABELA', 'CONDICAO', 'STATUS', 'TOTAL_CENTAVOS', 'DESCONTO_CENTAVOS', 'OBSERVACOES', 'EMAIL_CLIENTE', 'PDF_ID', 'XLSX_ID', 'ERRO'],
  PEDIDO_ITENS: ['PEDIDO_ID', 'CODIGO', 'DESCRICAO', 'QTDE', 'PRECO_UNIT_CENTAVOS', 'DESCONTO_PCT', 'TOTAL_CENTAVOS', 'BONIFICADO', 'RUPTURA'],
  ENVIO_EMAIL: ['ENVIO_ID', 'PEDIDO_ID', 'DESTINATARIO', 'TIPO', 'STATUS', 'TENTATIVAS', 'ULTIMA_TENTATIVA', 'ERRO'],
  LOG_IMPORTACAO: ['EXECUCAO_ID', 'INICIO', 'FIM', 'FONTE', 'ABA', 'REGISTROS', 'STATUS', 'ERRO']
});

function criarPlanilhaZapNovo() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('ZAP_SPREADSHEET_ID');
  let ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('ZAPedido Novo - Base Operacional');
    id = ss.getId();
    props.setProperty('ZAP_SPREADSHEET_ID', id);
  }
  Object.keys(ZAP_TABS).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = ZAP_TABS[name];
    const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (existing.some(function(value) { return value !== ''; }) &&
        existing.join('\u001f') !== headers.join('\u001f')) {
      throw new Error('Cabeçalho divergente na aba ' + name + '. Nenhum dado foi sobrescrito.');
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#17365d').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    const rows = Math.max(1, sheet.getMaxRows() - 1);
    headers.forEach(function(header, index) {
      if (['CNPJ', 'COD_CLIENTE', 'CODIGO', 'EAN', 'CEP', 'TELEFONE', 'SELLER_ID',
           'REQUISICAO_ID', 'PEDIDO_ID', 'ENVIO_ID', 'EXECUCAO_ID'].indexOf(header) !== -1) {
        sheet.getRange(2, index + 1, rows, 1).setNumberFormat('@');
      } else if (header.indexOf('CENTAVOS') !== -1 ||
                 ['QTDE', 'QTDE_VENDIDA', 'QTDE_DISPONIVEL', 'POSICAO', 'TENTATIVAS'].indexOf(header) !== -1) {
        sheet.getRange(2, index + 1, rows, 1).setNumberFormat('0');
      }
    });
    sheet.autoResizeColumns(1, headers.length);
  });
  const initialSheet = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (initialSheet && initialSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(initialSheet);
  }
  const cfg = ss.getSheetByName('CONFIG');
  if (cfg.getLastRow() === 1) {
    cfg.getRange(2, 1, 6, 3).setValues([
      ['SCHEMA_VERSION', ZAP_SCHEMA_VERSION, 'Não alterar manualmente'],
      ['PAGE_SIZE', '21', 'Produtos por página'],
      ['STATUS_PUBLICACAO', 'RASCUNHO', 'Ativar somente após validação dos dados e regras'],
      ['PEDIDO_MINIMO_CENTAVOS', '', 'Definir política comercial antes de ativar'],
      ['LIMITE_CLIENTE_NOVO_CENTAVOS', '', 'Definir política comercial antes de ativar'],
      ['UFS_ATENDIDAS', '*', '* permite todas as UFs brasileiras; REGRAS_UF pode ajustar por estado']
    ]);
  }
  return { id: id, url: ss.getUrl(), abas: Object.keys(ZAP_TABS), status: 'RASCUNHO' };
}
