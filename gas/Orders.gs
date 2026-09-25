function concluirPedido(token,payload) {
  const user=session_(token), profile=profile_(user), data=payload||{};
  if(!enabledUf_(profile.uf)) throw new Error('Atendimento indisponível para esta UF.');
  const min=rule_(profile.uf,'PEDIDO_MINIMO_CENTAVOS','PEDIDO_MINIMO_CENTAVOS');
  const limit=profile.tipo==='PENDENTE' ? rule_(profile.uf,'LIMITE_NOVO_CENTAVOS','LIMITE_NOVO_CENTAVOS') : null;
  const requestId=clean_(data.requisicaoId,80);
  if(!/^[a-zA-Z0-9-]{20,80}$/.test(requestId)) throw new Error('Identificador do pedido inválido.');
  const quantities=new Map();
  if(!Array.isArray(data.itens)||!data.itens.length||data.itens.length>100) throw new Error('Escolha entre 1 e 100 produtos.');
  data.itens.forEach(item=>{
    const cod=clean_(item.codigo,60), qty=requireInt_(item.quantidade,1,10000,'Quantidade');
    if(!cod||quantities.has(cod)) throw new Error('Produto duplicado ou inválido.');
    quantities.set(cod,qty);
  });
  const payment=clean_(data.condicao,60).toUpperCase();
  if(payment!==(profile.tipo==='PENDENTE'?'A VISTA':profile.condicao.toUpperCase()))
    throw new Error('Condição de pagamento não autorizada para este cadastro.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const existing=records_('PEDIDOS').find(x=>String(x.REQUISICAO_ID)===requestId);
    if(existing) {
      if(digits_(existing.CNPJ)!==user.cnpj) throw new Error('Identificador já utilizado.');
      return {pedidoId:String(existing.PEDIDO_ID),totalCentavos:Number(existing.TOTAL_CENTAVOS),status:String(existing.STATUS),repetido:true};
    }
    const catalog=new Map(catalogData_(profile).map(x=>[x.codigo,x]));
    let total=0;const rows=[];
    quantities.forEach((qty,code)=>{
      const p=catalog.get(code); if(!p) throw new Error('Código '+code+' não disponível na tabela do cliente.');
      if(p.estoque<qty) throw new Error('Estoque insuficiente para '+code+'; disponível: '+p.estoque+'.');
      const line=p.precoCentavos*qty;
      if(!Number.isSafeInteger(line)) throw new Error('Valor inválido para '+code+'.');
      total+=line;
      rows.push({CODIGO:code,DESCRICAO:p.descricao,QTDE:qty,PRECO_UNIT_CENTAVOS:p.precoCentavos,TOTAL_CENTAVOS:line,ESTOQUE_NA_COMPRA:p.estoque});
    });
    if(!Number.isSafeInteger(total)||total<min) throw new Error('Pedido mínimo: '+(min/100).toFixed(2)+'; subtotal: '+(total/100).toFixed(2)+'.');
    if(limit!==null && total>limit) throw new Error('Limite para novo cliente: '+(limit/100).toFixed(2)+'.');
    const id=uuid_(), status=config_('AMBIENTE')==='PRODUCAO'?'PENDENTE':'TESTE';
    const sheet=tab_('PEDIDO_ITENS');
    const itemRows=rows.map(x=>ZAP_SCHEMA.PEDIDO_ITENS.map(k=>k==='PEDIDO_ID'?id:(x[k] == null?'':safeCell_(x[k]))));
    const firstRow=sheet.getLastRow()+1;
    try {
      sheet.getRange(firstRow,1,itemRows.length,ZAP_SCHEMA.PEDIDO_ITENS.length).setValues(itemRows);
      append_('PEDIDOS',{PEDIDO_ID:id,REQUISICAO_ID:requestId,CRIADO_EM:now_(),CNPJ:user.cnpj,
        RAZAO_SOCIAL:profile.nome,EMAIL:user.email,UF:profile.uf,SELLER_ID:user.row.SELLER_ID,
        TABELA:profile.tabela,CONDICAO:payment,STATUS:status,TOTAL_CENTAVOS:total,
        OBSERVACOES:limited_(data.observacoes,1000,'Observações'),EMAIL_STATUS:'NAO_ENVIADO'});
    } catch(e) {
      if(!records_('PEDIDOS').some(x=>String(x.PEDIDO_ID)===id)) sheet.getRange(firstRow,1,itemRows.length,ZAP_SCHEMA.PEDIDO_ITENS.length).clearContent();
      throw e;
    }
    return {pedidoId:id,totalCentavos:total,status:status,repetido:false};
  } finally {lock.releaseLock();}
}
function meusPedidos(token) {
  const user=session_(token);
  return records_('PEDIDOS').filter(x=>digits_(x.CNPJ)===user.cnpj).reverse().slice(0,30).map(x=>({
    id:String(x.PEDIDO_ID),criadoEm:String(x.CRIADO_EM),status:String(x.STATUS),
    totalCentavos:Number(x.TOTAL_CENTAVOS),condicao:String(x.CONDICAO)
  }));
}
