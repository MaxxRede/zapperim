/** ZAPerim — API do Web App para Cloudflare Pages. Requer GAS_INSTALAR_PLANILHA.gs no mesmo projeto. */

function doGet() {
  const installed=!!PropertiesService.getScriptProperties().getProperty('ZAP_SPREADSHEET_ID');
  return json_({api:2,connected:installed,status:installed?'ready':'not_installed'});
}
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

const AUTH_TTL=21600;
function identificarCnpj(cnpj) {
  const id=cnpj_(cnpj), client=records_('CLIENTES').find(r=>digits_(r.CNPJ)===id && String(r.STATUS).toUpperCase()==='ATIVO');
  const pending=records_('CADASTROS_PENDENTES').find(r=>digits_(r.CNPJ)===id && String(r.STATUS).toUpperCase()==='PENDENTE');
  return {tipo:client?'EXISTENTE':pending?'PENDENTE':'NOVO',cnpj:id};
}
function cadastrarCliente(data) {
  const cnpj=cnpj_(data.cnpj), uf=uf_(data.uf), email=email_(data.email);
  if(!enabledUf_(uf)) throw new Error('Ainda não atendemos esta UF.');
  const req={CNPJ:cnpj,RAZAO_SOCIAL:limited_(data.nome,140,'Razão social'),EMAIL:email,
    TELEFONE:digits_(data.telefone),ENDERECO:limited_(data.endereco,180,'Endereço'),
    CIDADE:limited_(data.cidade,80,'Cidade'),UF:uf,CEP:digits_(data.cep),
    COMPLEMENTO:limited_(data.complemento,100,'Complemento'),RESPONSAVEL:limited_(data.responsavel,100,'Responsável'),
    CARGO:limited_(data.cargo,80,'Cargo'),SELLER_ID:limited_(data.seller,30,'Vendedor')};
  if(!req.RAZAO_SOCIAL || !req.ENDERECO || !req.CIDADE || !req.RESPONSAVEL || !req.CARGO || !/^\d{10,11}$/.test(req.TELEFONE) || !/^\d{8}$/.test(req.CEP))
    throw new Error('Preencha os dados obrigatórios; telefone com DDD e CEP com 8 dígitos.');
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    if(records_('CLIENTES').some(r=>digits_(r.CNPJ)===cnpj)) throw new Error('Este CNPJ já está cadastrado. Acesse com o e-mail registrado.');
    const existing=records_('CADASTROS_PENDENTES').find(r=>digits_(r.CNPJ)===cnpj && r.STATUS==='PENDENTE');
    if(existing) throw new Error('Cadastro já recebido. Use o e-mail informado para acessar ou solicite revisão do cadastro.');
    append_('CADASTROS_PENDENTES',Object.assign({ID:uuid_(),CRIADO_EM:now_(),STATUS:'PENDENTE'},req));
  } finally { lock.releaseLock(); }
  solicitarCodigo(cnpj,email);
  return {mensagem:'Cadastro recebido. Enviamos um código ao e-mail informado; a aprovação comercial ainda está pendente.'};
}
function authRecord_(cnpj,email) {
  const client=records_('CLIENTES').find(r=>digits_(r.CNPJ)===cnpj && String(r.EMAIL).toLowerCase()===email && String(r.STATUS).toUpperCase()==='ATIVO');
  if(client) return {row:client,tipo:'EXISTENTE'};
  const pending=records_('CADASTROS_PENDENTES').find(r=>digits_(r.CNPJ)===cnpj && String(r.EMAIL).toLowerCase()===email && r.STATUS==='PENDENTE');
  return pending?{row:pending,tipo:'PENDENTE'}:null;
}
function solicitarCodigo(cnpj,email) {
  const id=cnpj_(cnpj), mail=email_(email), cache=CacheService.getScriptCache();
  const throttle='rate:'+id;
  if(cache.get(throttle)) throw new Error('Aguarde um minuto antes de solicitar outro código.');
  const found=authRecord_(id,mail);
  // Mesma resposta para e-mail conhecido ou desconhecido; evita expor o contato do cliente.
  if(found) {
    const code=String(100000+(parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,12),16)%900000));
    const key='otp:'+id+':'+mail;
    const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,code+':'+id+':'+mail).map(n=>('0'+(n&255).toString(16)).slice(-2)).join('');
    cache.put(key,JSON.stringify({hash:hash,attempts:0}),600);
    MailApp.sendEmail({to:mail,subject:'Código de acesso ZAPerim',body:'Seu código é '+code+'. Ele vale por 10 minutos. Não compartilhe este código.'});
  }
  cache.put(throttle,'1',60);
  return {mensagem:'Se este e-mail estiver vinculado ao CNPJ, enviaremos um código de acesso.'};
}
function confirmarCodigo(cnpj,email,code) {
  const id=cnpj_(cnpj),mail=email_(email),key='otp:'+id+':'+mail,cache=CacheService.getScriptCache();
  const entry=cache.get(key); if(!entry) throw new Error('Código expirado ou inválido. Solicite outro.');
  const data=JSON.parse(entry);
  if(data.attempts>=5){cache.remove(key);throw new Error('Muitas tentativas. Solicite novo código.');}
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,clean_(code,6)+':'+id+':'+mail).map(n=>('0'+(n&255).toString(16)).slice(-2)).join('');
  if(!/^\d{6}$/.test(String(code)) || hash!==data.hash){data.attempts++;cache.put(key,JSON.stringify(data),600);throw new Error('Código inválido.');}
  const found=authRecord_(id,mail); if(!found) throw new Error('Cadastro indisponível.');
  cache.remove(key);
  const token=uuid_()+uuid_();
  cache.put('session:'+token,JSON.stringify({cnpj:id,email:mail}),AUTH_TTL);
  return {token:token,cliente:profile_(found)};
}
function session_(token) {
  if(!/^[a-f0-9-]{72}$/.test(String(token||''))) throw new Error('Acesso expirado. Entre novamente.');
  const raw=CacheService.getScriptCache().get('session:'+token);
  if(!raw) throw new Error('Acesso expirado. Entre novamente.');
  const user=JSON.parse(raw), found=authRecord_(user.cnpj,user.email);
  if(!found) throw new Error('Cadastro indisponível.');
  return Object.assign(user,found);
}
function profile_(found) {
  const x=found.row;
  return {cnpj:digits_(x.CNPJ),nome:String(x.RAZAO_SOCIAL),uf:String(x.UF),responsavel:String(x.RESPONSAVEL),
    email:String(x.EMAIL),telefone:String(x.TELEFONE),cargo:String(x.CARGO),
    tipo:found.tipo,tabela:found.tipo==='EXISTENTE'?String(x.TABELA):config_('TABELA_NOVO'),
    condicao:found.tipo==='EXISTENTE'?String(x.CONDICAO):'A VISTA'};
}
function minhaConta(token) { return profile_(session_(token)); }
function confirmarDados(token,data) {
  const user=session_(token),responsavel=limited_(data.responsavel,100,'Responsável'),cargo=limited_(data.cargo,80,'Cargo'),telefone=digits_(data.telefone);
  if(!responsavel||!cargo||!/^\d{10,11}$/.test(telefone)) throw new Error('Informe responsável, cargo e telefone com DDD.');
  if(user.tipo!=='EXISTENTE') return profile_(user);
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const current=session_(token),s=tab_('CLIENTES');
    ['RESPONSAVEL','CARGO','TELEFONE'].forEach((key,i)=>s.getRange(current.row._ROW,ZAP_SCHEMA.CLIENTES.indexOf(key)+1).setValue([responsavel,cargo,telefone][i]));
    return profile_(session_(token));
  } finally {lock.releaseLock();}
}
function sair(token) { CacheService.getScriptCache().remove('session:'+String(token)); return true; }

function catalogData_(profile) {
  const products=records_('PRODUTOS').filter(x=>String(x.ATIVO).toUpperCase()==='SIM');
  const prices=new Map(records_('PRECOS').filter(x=>String(x.TABELA)===profile.tabela).map(x=>[String(x.CODIGO),x]));
  const stock=new Map(records_('ESTOQUE').map(x=>[String(x.CODIGO),x]));
  const rank=new Map(records_('RANKING').map(x=>[String(x.CODIGO),x]));
  return products.filter(x=>prices.has(String(x.CODIGO))).map(x=>{
    const cod=String(x.CODIGO), p=prices.get(cod), e=stock.get(cod), r=rank.get(cod);
    return {codigo:cod,ean:String(x.EAN||''),descricao:String(x.DESCRICAO||''),marca:String(x.MARCA||''),
      imagem:String(x.IMAGEM_URL||''),precoCentavos:amount_(p.PRECO_CENTAVOS,'Preço'),
      estoque:Math.max(0,Number(e&&e.QTDE_DISPONIVEL)||0),vendidos:Math.max(0,Number(r&&r.QTDE_VENDIDA)||0),
      promocao:String(p.PROMOCAO).toUpperCase()==='SIM'};
  });
}
function listarCatalogo(token,opts) {
  const profile=profile_(session_(token)), o=opts||{};
  const pagina=requireInt_(o.pagina||1,1,100000,'Página');
  const busca=clean_(o.busca,100).toLowerCase(), marca=clean_(o.marca,80).toLowerCase();
  const somenteEstoque=Boolean(o.somenteEstoque), favoritos=Boolean(o.favoritos);
  let items=catalogData_(profile).filter(x=>(!busca || (x.codigo+' '+x.ean+' '+x.descricao+' '+x.marca).toLowerCase().includes(busca)) &&
    (!marca || x.marca.toLowerCase()===marca) && (!somenteEstoque || x.estoque>0) && (!favoritos || !x.promocao));
  if(favoritos) items.sort((a,b)=>b.vendidos-a.vendidos || a.codigo.localeCompare(b.codigo));
  else items.sort((a,b)=>a.descricao.localeCompare(b.descricao,'pt-BR'));
  if(favoritos) items=items.slice(0,60);
  const pageSize=21;
  return {itens:items.slice((pagina-1)*pageSize,pagina*pageSize),pagina:pagina,total:items.length,
    paginas:Math.ceil(items.length/pageSize),marcas:[...new Set(items.map(x=>x.marca).filter(Boolean))].sort()};
}
function topDez(token) { return catalogData_(profile_(session_(token))).filter(x=>!x.promocao).sort((a,b)=>b.vendidos-a.vendidos).slice(0,10); }
function pedidoDinamico(token,input) {
  const codes=[...new Set(clean_(input,1200).split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean))].slice(0,60);
  const catalog=catalogData_(profile_(session_(token)));
  const byCode=new Map(catalog.map(x=>[x.codigo.toUpperCase(),x]));
  return {encontrados:codes.map(c=>byCode.get(c.toUpperCase())).filter(Boolean),naoEncontrados:codes.filter(c=>!byCode.has(c.toUpperCase()))};
}

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

/** Endpoint para Cloudflare Pages Functions. Publique o Web App como proprietário. */
function doPost(event) {
  try {
    const body=JSON.parse(event && event.postData && event.postData.contents || '{}');
    const actions={identificarCnpj:identificarCnpj,cadastrarCliente:cadastrarCliente,
      solicitarCodigo:solicitarCodigo,confirmarCodigo:confirmarCodigo,confirmarDados:confirmarDados,
      minhaConta:minhaConta,sair:sair,listarCatalogo:listarCatalogo,topDez:topDez,
      pedidoDinamico:pedidoDinamico,concluirPedido:concluirPedido,meusPedidos:meusPedidos};
    const fn=Object.prototype.hasOwnProperty.call(actions,body.action)?actions[body.action]:null;
    if(!fn||!Array.isArray(body.args)||body.args.length>3)throw new Error('Ação inválida.');
    return json_({ok:true,result:fn.apply(null,body.args)});
  } catch(error) {
    return json_({ok:false,error:error&&error.message?String(error.message).slice(0,300):'Erro na operação.'});
  }
}
function json_(value) {return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}

