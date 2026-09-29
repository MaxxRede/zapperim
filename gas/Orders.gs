function orderMarker_(id){return '[ZAP:'+id+']';}
function concluirPedido(token,payload) {
  const user=session_(token),profile=profile_(user),data=payload||{};
  if(!enabledUf_(profile.uf))throw new Error('Atendimento indisponível para esta UF.');
  const min=rule_(profile.uf,'PEDIDO_MINIMO_CENTAVOS','PEDIDO_MINIMO_CENTAVOS',profile);
  const limit=profile.tipo==='PENDENTE'?rule_(profile.uf,'LIMITE_NOVO_CENTAVOS','LIMITE_NOVO_CENTAVOS',profile):null;
  const requestId=clean_(data.requisicaoId,80);
  if(!/^[a-zA-Z0-9-]{20,80}$/.test(requestId))throw new Error('Identificador do pedido inválido.');
  const quantities=new Map();
  if(!Array.isArray(data.itens)||!data.itens.length||data.itens.length>100)throw new Error('Escolha entre 1 e 100 produtos.');
  data.itens.forEach(item=>{
    const cod=clean_(item.codigo,60),qty=requireInt_(item.quantidade,1,10000,'Quantidade');
    if(!cod||quantities.has(cod))throw new Error('Produto duplicado ou inválido.');
    quantities.set(cod,qty);
  });
  const payment=clean_(data.condicao,60).toUpperCase();
  if(payment!==(profile.tipo==='PENDENTE'?'A VISTA':profile.condicao.toUpperCase()))
    throw new Error('Condição de pagamento não autorizada para este cadastro.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const existing=records_('pedidos').filter(x=>String(x.OBSERVACOES||'').startsWith(orderMarker_(requestId)));
    if(existing.length){
      if(digits_(existing[0]['CNPJ/CPF'])!==user.cnpj)throw new Error('Identificador já utilizado.');
      const total=existing.reduce((sum,x)=>sum+Math.round(Number(x.VALOR)*100)*Number(x.QTDE),0);
      return {pedidoId:requestId,totalCentavos:total,status:'TESTE',repetido:true};
    }
    const catalog=new Map(catalogData_(profile).map(x=>[x.codigo,x]));
    let total=0;const rows=[];
    quantities.forEach((qty,code)=>{
      const p=catalog.get(code);if(!p)throw new Error('Código '+code+' não disponível na tabela do cliente.');
      if(p.estoque<qty)throw new Error('Estoque insuficiente para '+code+'; disponível: '+p.estoque+'.');
      const line=p.precoCentavos*qty;
      if(!Number.isSafeInteger(line))throw new Error('Valor inválido para '+code+'.');
      total+=line;rows.push({codigo:code,produto:p.descricao,quantidade:qty,valor:p.precoCentavos/100});
    });
    if(!Number.isSafeInteger(total)||total<min)throw new Error('Pedido mínimo: '+(min/100).toFixed(2)+'; subtotal: '+(total/100).toFixed(2)+'.');
    if(limit!==null&&total>limit)throw new Error('Limite para novo cliente: '+(limit/100).toFixed(2)+'.');
    const obs=limited_(data.observacoes,900,'Observações');
    const stamp=new Date(),marker=orderMarker_(requestId);
    const values=rows.map(row=>ZAP_SCHEMA.pedidos.map(key=>{
      const fields={'CNPJ/CPF':user.cnpj,RESONSAVEL:profile.responsavel,ATENDIMENTO:user.row.RCA||'CLIENTE',
        TABELA:profile.tabela,CODIGO:row.codigo,PRODUTO:row.produto,QTDE:row.quantidade,VALOR:row.valor,
        DESC_PROD:0,BONIFICADO:'NAO',PGTO:payment,CONDICAO:payment,DESC_PEDIDO:0,'MAT APOIO':'',
        OBSERVACOES:marker+(obs?' '+obs:''),ZERADO:'NAO',DTPed:stamp};
      return safeCell_(fields[key]);
    }));
    const sheet=tab_('pedidos'),first=sheet.getLastRow()+1;
    sheet.getRange(first,1,values.length,ZAP_SCHEMA.pedidos.length).setValues(values);
    return {pedidoId:requestId,totalCentavos:total,status:'TESTE',repetido:false};
  }finally{lock.releaseLock();}
}
function meusPedidos(token) {
  const user=session_(token),groups=new Map();
  records_('pedidos').filter(x=>digits_(x['CNPJ/CPF'])===user.cnpj).forEach(row=>{
    const match=String(row.OBSERVACOES||'').match(/^\[ZAP:([a-zA-Z0-9-]{20,80})\]/);
    if(!match)return;
    const id=match[1],sum=(groups.get(id)||{id,criadoEm:row.DTPed,status:'TESTE',totalCentavos:0,condicao:String(row.CONDICAO||'')});
    sum.totalCentavos+=Math.round(Number(row.VALOR)*100)*Number(row.QTDE);groups.set(id,sum);
  });
  return [...groups.values()].reverse().slice(0,30);
}
