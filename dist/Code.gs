/** ZAPerim — instalador unificado gerado de gas/*. Execute instalarZapperim() no editor.

 * Não edite este arquivo diretamente; altere os módulos e execute node tools/build-installer.mjs.

 * A função cria uma planilha nova somente quando ZAP_SPREADSHEET_ID não existe.

 */

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

function doGet() {
  return HtmlService.createHtmlOutput(ZAP_HTML).setTitle('ZAPerim • Pedidos')
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
    const fn=actions[body.action];
    if(!fn||!Array.isArray(body.args)||body.args.length>3)throw new Error('Ação inválida.');
    return json_({ok:true,result:fn.apply(null,body.args)});
  } catch(error) {
    return json_({ok:false,error:error&&error.message?String(error.message).slice(0,300):'Erro na operação.'});
  }
}
function json_(value) {return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}

const ZAP_HTML = "<!doctype html>\n<html lang=\"pt-BR\"><head><base target=\"_top\"><meta charset=\"utf-8\"><title>ZAPerim • Pedidos</title>\n<style>\n:root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#262626;background:#faf8f6;--orange:#fb7915;--line:#e7e0db}*{box-sizing:border-box}body{margin:0}button,input,select,textarea{font:inherit}button{cursor:pointer}button:disabled{opacity:.55;cursor:wait}.top{background:#fff;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:12px max(18px,calc((100vw - 1250px)/2));gap:16px}.brand{font-weight:900;color:var(--orange);font-size:23px}.brand span{color:#4b4b4b}nav{display:flex;gap:7px;flex-wrap:wrap}nav button,.secondary,.link{border:1px solid var(--line);background:#fff;border-radius:10px;padding:10px 13px;color:#3d3d3d}nav button.active{background:var(--orange);color:#fff;border-color:var(--orange)}main{max-width:1250px;margin:auto;padding:22px 18px 90px}.panel,.card,.client{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 2px 6px #25190808}.panel{padding:24px}.narrow{max-width:540px;margin:32px auto}h1{font-size:25px;margin:0 0 8px}h2{font-size:20px}p{color:#685f59;line-height:1.5}label{display:block;font-size:14px;margin:14px 0 5px}input,select,textarea{width:100%;border:1px solid var(--line);border-radius:9px;padding:12px;background:#fff;color:#222;margin-top:5px}input:focus,select:focus,textarea:focus{outline:2px solid var(--orange)}.primary{background:var(--orange);border:1px solid var(--orange);color:white;border-radius:10px;padding:12px 18px;font-weight:700}.narrow form>.primary{width:100%;margin-top:16px}.formgrid{display:grid;grid-template-columns:1fr 1fr;column-gap:12px}.full{grid-column:1/-1}.formgrid .primary{width:100%}.link{border:0;color:#cf5a00;margin-top:10px}.client{padding:12px 16px;margin-bottom:18px;color:#57504b}.toolbar{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:16px 0}.toolbar label{flex:1;min-width:150px;margin:0}.toolbar select{min-width:150px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}.card{overflow:hidden;display:flex;flex-direction:column}.card img{width:100%;height:205px;object-fit:contain;background:white}.card .body{padding:12px;display:flex;flex-direction:column;gap:9px;flex:1}.card h3{font-size:14px;min-height:40px;margin:0}.muted{font-size:12px;color:#746e68}.price{color:#e56300;font-weight:750}.row{display:flex;justify-content:space-between;gap:12px;align-items:center}.card input[type=number]{max-width:78px;margin:0;padding:8px}.card button{padding:9px}.paging{display:flex;justify-content:center;align-items:center;gap:14px;margin:24px}.client strong{color:#252525}.items{list-style:none;padding:0}.items li{padding:11px;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:center;justify-content:space-between}.items input{width:85px;margin:0}.error{color:#9c2700;background:#ffefe6;border:1px solid #f7c4a9;padding:12px;border-radius:9px;margin-bottom:14px}.success{color:#115132;background:#e8f7ed;border:1px solid #a9d4b6;padding:12px;border-radius:9px;margin-bottom:14px}.overlay{position:fixed;inset:0;background:#0008;display:grid;place-items:center;padding:14px}.overlay[hidden]{display:none}.overlay .panel{width:min(100%,480px);max-height:90vh;overflow:auto}.pill{background:#fff2e7;color:#b75000;border-radius:20px;padding:5px 9px;font-size:12px}.summary{border:1px solid #ffd1ad;border-radius:10px;background:#fff4eb;padding:14px;margin:14px 0}button:focus-visible{outline:3px solid #333} [hidden]{display:none!important}@media(max-width:650px){.top{display:block}.top nav{margin-top:10px}nav button{flex:1;font-size:12px;padding:9px 4px}.formgrid{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.card img{height:145px}.card h3{font-size:12px}.items li{align-items:start;flex-wrap:wrap}.toolbar{display:block}.toolbar label{margin:10px 0}}\n</style></head><body>\n<header class=\"top\"><div class=\"brand\">ZAP<span>erim</span></div><nav id=\"nav\" hidden><button data-page=\"favoritos\">♡ Queridinhos</button><button data-page=\"catalogo\">Catálogo</button><button data-page=\"pedido\">Pedido <span id=\"badge\">0</span></button><button data-page=\"historico\">Meus pedidos</button><button id=\"logout\">Sair</button></nav></header>\n<main>\n  <div id=\"notice\" role=\"status\" aria-live=\"polite\"></div>\n  <section id=\"entry\" class=\"panel narrow\"><h1>Acesse com seu CNPJ</h1><p>Digite os 14 dígitos para começar.</p><form id=\"cnpjForm\"><label>CNPJ<input name=\"cnpj\" inputmode=\"numeric\" required placeholder=\"00.000.000/0000-00\" maxlength=\"18\" autocomplete=\"off\"></label><button class=\"primary\">Entrar</button></form></section>\n  <section id=\"register\" class=\"panel narrow\" hidden><h1>Novo cadastro</h1><p>O cadastro ficará pendente de análise comercial.</p><form id=\"registerForm\" class=\"formgrid\">\n    <label class=\"full\">Nome ou razão social *<input name=\"nome\" required maxlength=\"140\"></label>\n    <label>Telefone com DDD *<input name=\"telefone\" type=\"tel\" required inputmode=\"tel\"></label><label>E-mail *<input name=\"email\" type=\"email\" required></label>\n    <label class=\"full\">Endereço completo *<input name=\"endereco\" required maxlength=\"180\"></label>\n    <label>Cidade *<input name=\"cidade\" required></label><label>UF *<select name=\"uf\" required><option value=\"\">Selecione</option></select></label>\n    <label>CEP *<input name=\"cep\" inputmode=\"numeric\" required maxlength=\"9\"></label><label>Complemento<input name=\"complemento\"></label>\n    <label>Responsável *<input name=\"responsavel\" required></label><label>Cargo *<input name=\"cargo\" required></label>\n    <button class=\"primary full\">Enviar cadastro</button></form><button class=\"link back\">Voltar</button></section>\n  <section id=\"emailStep\" class=\"panel narrow\" hidden><h1>Confirme seu contato</h1><p id=\"emailHelp\"></p><form id=\"emailForm\"><label>E-mail cadastrado<input name=\"email\" type=\"email\" required autocomplete=\"email\"></label><button class=\"primary\">Enviar código</button></form><button class=\"link back\">Voltar</button></section>\n  <section id=\"verify\" class=\"panel narrow\" hidden><h1>Código de acesso</h1><p>Informe o código recebido por e-mail. Ele vence em 10 minutos.</p><form id=\"verifyForm\"><label>Código de 6 dígitos<input name=\"code\" inputmode=\"numeric\" maxlength=\"6\" pattern=\"[0-9]{6}\" required autocomplete=\"one-time-code\"></label><button class=\"primary\">Confirmar</button></form><button id=\"resend\" class=\"link\">Reenviar código</button></section>\n  <section id=\"confirm\" class=\"panel narrow\" hidden><h1>Confirme seus dados</h1><p id=\"confirmName\"></p><form id=\"confirmForm\"><label>E-mail cadastrado<input name=\"email\" disabled></label><label>Telefone com DDD *<input name=\"telefone\" type=\"tel\" required></label><label>Responsável *<input name=\"responsavel\" required></label><label>Cargo *<input name=\"cargo\" required></label><button class=\"primary\">Continuar</button></form></section>\n  <section id=\"shop\" hidden><div class=\"client\" id=\"client\"></div><div id=\"page\"></div></section>\n</main><div id=\"modal\" class=\"overlay\" hidden></div>\n<script>\n(() => {\n  'use strict';\n  const $=s=>document.querySelector(s), money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(n)||0)/100);\n  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\n  const state={cnpj:'',email:'',token:sessionStorage.getItem('zap_token')||'',profile:null,page:'favoritos',current:1,\n    search:'',brand:'',stock:false,cart:new Map(),requestId:null};\n  function rpc(method,...args){return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[method](...args));}\n  function notice(message,error=false){const n=$('#notice');n.textContent=message||'';n.className=message?(error?'error':'success'):'';if(message) window.scrollTo({top:0,behavior:'smooth'});}\n  function section(id){['entry','register','emailStep','verify','confirm','shop'].forEach(x=>$('#'+x).hidden=x!==id);notice('');}\n  function busy(form,on){const b=form.querySelector('button[type=submit],button.primary');if(b)b.disabled=on;}\n  async function run(form,action){busy(form,true);try{await action();}catch(e){notice(e.message||String(e),true);}finally{busy(form,false);}}\n  function updateBadge(){ $('#badge').textContent=[...state.cart.values()].filter(x=>x.quantidade>0).length; }\n  function saveCart(){sessionStorage.setItem('zap_cart_'+state.cnpj,JSON.stringify([...state.cart.values()]));updateBadge();}\n  function setQty(product,qty){qty=Number(qty);if(!Number.isSafeInteger(qty)||qty<0||qty>10000){notice('Quantidade inválida.',true);return;}\n    if(qty>Number(product.estoque)){notice('Quantidade acima do estoque disponível.',true);return;}\n    if(qty)state.cart.set(product.codigo,{...product,quantidade:qty});else state.cart.delete(product.codigo);\n    state.requestId=null;saveCart();notice(qty?'Produto atualizado no pedido.':'Produto removido.');}\n  function showShop(){section('shop');$('#nav').hidden=false;$('#client').innerHTML=`<strong>${esc(state.profile.nome)}</strong> · CNPJ ${esc(state.profile.cnpj)} · ${esc(state.profile.uf)} · ${esc(state.profile.tipo==='PENDENTE'?'Cadastro em análise':'Cliente cadastrado')}`;renderPage();}\n  function confirmOrShop(){if(state.profile.tipo==='EXISTENTE'){$('#confirmName').textContent=state.profile.nome+' · '+state.profile.cnpj;\n      const f=$('#confirmForm');f.elements.email.value=state.profile.email;f.elements.telefone.value=state.profile.telefone;\n      f.elements.responsavel.value=state.profile.responsavel;f.elements.cargo.value=state.profile.cargo;\n      section('confirm');}else showShop();}\n  function safeImage(url){return /^https:\\/\\/[^\\s\"<>]+$/i.test(String(url))?url:'';}\n  function productCard(p){const src=safeImage(p.imagem), qty=state.cart.get(p.codigo)?.quantidade||0;\n    return `<article class=\"card\"><img src=\"${esc(src)}\" alt=\"${esc(p.descricao)}\" loading=\"lazy\" onerror=\"this.style.visibility='hidden'\"><div class=\"body\"><span class=\"muted\">${esc(p.marca)} · ${esc(p.codigo)}</span><h3>${esc(p.descricao)}</h3><div class=\"row\"><span class=\"price\">${money(p.precoCentavos)}</span><span class=\"pill\">${Number(p.vendidos)||0} vendidos</span></div><span class=\"muted\">Estoque: ${Number(p.estoque)||0}</span><div class=\"row\"><label>Qtd <input type=\"number\" min=\"1\" max=\"${Number(p.estoque)||0}\" value=\"${qty||1}\" data-qty=\"${esc(p.codigo)}\"></label><button class=\"primary\" data-add=\"${esc(p.codigo)}\" ${p.estoque<=0?'disabled':''}>Adicionar</button></div></div></article>`;}\n  let visible=new Map();\n  async function renderPage(){const page=state.page;document.querySelectorAll('nav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));\n    const root=$('#page');root.innerHTML='<p>Carregando…</p>';\n    try{if(page==='pedido')return await renderOrder();if(page==='historico')return await renderHistory();\n      const result=await rpc('listarCatalogo',state.token,{pagina:state.current,busca:state.search,marca:state.brand,somenteEstoque:state.stock,favoritos:page==='favoritos'});\n      if(state.page!==page)return;\n      visible=new Map(result.itens.map(x=>[x.codigo,x]));\n      root.innerHTML=`<h1>${page==='favoritos'?'♡ Os Queridinhos':'Catálogo'}</h1><p>${result.total} produtos · ${result.paginas} páginas</p>\n        <div class=\"toolbar\"><label>Pesquisar código, EAN ou nome<input id=\"search\" value=\"${esc(state.search)}\" placeholder=\"Buscar produtos\"></label><label>Marca<select id=\"brand\"><option value=\"\">Todas</option>${result.marcas.map(m=>`<option value=\"${esc(m)}\" ${m===state.brand?'selected':''}>${esc(m)}</option>`).join('')}</select></label><label><input id=\"stock\" type=\"checkbox\" ${state.stock?'checked':''} style=\"width:auto\"> Apenas com estoque</label></div>\n        <div class=\"grid\">${result.itens.map(productCard).join('')||'<p>Nenhum produto encontrado.</p>'}</div>\n        <div class=\"paging\"><button class=\"secondary\" data-pager=\"prev\" ${result.pagina<=1?'disabled':''}>Anterior</button><span>${result.pagina} / ${result.paginas||1}</span><button class=\"secondary\" data-pager=\"next\" ${result.pagina>=result.paginas?'disabled':''}>Próxima</button></div>`;\n    }catch(e){root.textContent='Erro: '+(e.message||String(e));}}\n  async function renderOrder(){const root=$('#page'), items=[...state.cart.values()];\n    const sum=items.reduce((n,x)=>n+x.precoCentavos*x.quantidade,0);\n    root.innerHTML=`<h1>Pedido</h1><p>Valores e estoque serão conferidos novamente ao concluir.</p>\n      <details class=\"panel\"><summary>Pedido dinâmico: digite códigos separados por espaço ou vírgula</summary><label>Códigos<textarea id=\"codes\" rows=\"3\"></textarea></label><button id=\"lookup\" class=\"secondary\">Localizar códigos</button><div id=\"found\"></div></details>\n      <div class=\"panel\" style=\"margin-top:12px\"><h2>Itens (${items.length})</h2><ul class=\"items\">${items.map(x=>`<li><div><strong>${esc(x.codigo)}</strong> · ${esc(x.descricao)}<br><span class=\"muted\">${money(x.precoCentavos)} cada</span></div><label>Qtd<input type=\"number\" min=\"0\" max=\"${Number(x.estoque)}\" value=\"${x.quantidade}\" data-cartqty=\"${esc(x.codigo)}\"></label><b>${money(x.precoCentavos*x.quantidade)}</b><button class=\"secondary\" data-remove=\"${esc(x.codigo)}\" aria-label=\"Remover ${esc(x.codigo)}\">×</button></li>`).join('')||'<li>O pedido está vazio. Adicione produtos pelo catálogo.</li>'}</ul><div class=\"summary row\"><strong>Subtotal</strong><strong>${money(sum)}</strong></div>\n      <label>Condição de pagamento<input value=\"${esc(state.profile.condicao)}\" disabled></label><label>Observações<textarea id=\"notes\" rows=\"3\" maxlength=\"1000\"></textarea></label><button id=\"finish\" class=\"primary\" ${items.length?'':'disabled'}>Concluir pedido</button></div>`;\n    const top=await rpc('topDez',state.token);if(state.page!== 'pedido')return;\n    visible=new Map(top.map(x=>[x.codigo,x]));root.insertAdjacentHTML('beforeend',`<div class=\"panel\" style=\"margin-top:12px\"><h2>Top 10 mais vendidos</h2><div class=\"grid\">${top.map(productCard).join('')}</div></div>`);\n  }\n  async function renderHistory(){const root=$('#page');try{const rows=await rpc('meusPedidos',state.token);if(state.page!=='historico')return;\n    root.innerHTML=`<h1>Meus pedidos</h1><div class=\"panel\"><ul class=\"items\">${rows.map(x=>`<li><strong>${esc(x.id)}</strong><span>${esc(x.criadoEm)}</span><span>${esc(x.status)}</span><strong>${money(x.totalCentavos)}</strong></li>`).join('')||'<li>Nenhum pedido registrado.</li>'}</ul></div>`;\n  }catch(e){root.textContent=e.message||String(e);}}\n  let timer;\n  $('#cnpjForm').addEventListener('submit',e=>{e.preventDefault();run(e.target,async()=>{const c=$('#cnpjForm [name=cnpj]').value;const r=await rpc('identificarCnpj',c);state.cnpj=r.cnpj;\n    if(r.tipo==='NOVO'){section('register');}else{section('emailStep');$('#emailHelp').textContent=r.tipo==='PENDENTE'?'Seu cadastro aguarda análise. Informe o e-mail utilizado.':'Informe o e-mail cadastrado.';}});});\n  $('#registerForm').addEventListener('submit',e=>{e.preventDefault();run(e.target,async()=>{const d=Object.fromEntries(new FormData(e.target));d.cnpj=state.cnpj;d.seller=new URLSearchParams(location.search).get('seller')||'';\n    const r=await rpc('cadastrarCliente',d);state.email=d.email;section('verify');notice(r.mensagem);});});\n  $('#emailForm').addEventListener('submit',e=>{e.preventDefault();run(e.target,async()=>{state.email=e.target.elements.email.value;const r=await rpc('solicitarCodigo',state.cnpj,state.email);section('verify');notice(r.mensagem);});});\n  $('#verifyForm').addEventListener('submit',e=>{e.preventDefault();run(e.target,async()=>{const r=await rpc('confirmarCodigo',state.cnpj,state.email,e.target.elements.code.value);state.token=r.token;state.profile=r.cliente;sessionStorage.setItem('zap_token',r.token);\n    try{state.cart=new Map(JSON.parse(sessionStorage.getItem('zap_cart_'+state.cnpj)||'[]').map(x=>[x.codigo,x]));}catch(_){state.cart=new Map();}updateBadge();confirmOrShop();});});\n  $('#confirmForm').addEventListener('submit',e=>{e.preventDefault();run(e.target,async()=>{const f=e.target;state.profile=await rpc('confirmarDados',state.token,{telefone:f.elements.telefone.value,responsavel:f.elements.responsavel.value,cargo:f.elements.cargo.value});showShop();});});\n  $('#resend').addEventListener('click',()=>run($('#verifyForm'),async()=>{const r=await rpc('solicitarCodigo',state.cnpj,state.email);notice(r.mensagem);}));\n  document.querySelectorAll('.back').forEach(b=>b.addEventListener('click',()=>section('entry')));\n  $('#nav').addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b){state.page=b.dataset.page;state.current=1;state.search='';state.brand='';renderPage();}});\n  $('#logout').addEventListener('click',async()=>{try{await rpc('sair',state.token);}catch(_){}sessionStorage.removeItem('zap_token');state.token='';state.profile=null;state.cart.clear();$('#nav').hidden=true;section('entry');});\n  $('#page').addEventListener('input',e=>{if(e.target.id==='search'){clearTimeout(timer);const v=e.target.value;timer=setTimeout(()=>{state.search=v;state.current=1;renderPage();},400);}});\n  $('#page').addEventListener('change',e=>{if(e.target.id==='brand'){state.brand=e.target.value;state.current=1;renderPage();}if(e.target.id==='stock'){state.stock=e.target.checked;state.current=1;renderPage();}\n    if(e.target.matches('[data-cartqty]')){const x=state.cart.get(e.target.dataset.cartqty);if(x){setQty(x,e.target.value);renderOrder();}}});\n  $('#page').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;\n    if(b.dataset.pager){state.current+=b.dataset.pager==='next'?1:-1;renderPage();return;}\n    if(b.dataset.add){const p=visible.get(b.dataset.add);const q=b.closest('.card').querySelector('input[data-qty]');if(p)setQty(p,q.value);return;}\n    if(b.dataset.remove){state.cart.delete(b.dataset.remove);state.requestId=null;saveCart();renderOrder();return;}\n    if(b.id==='lookup'){b.disabled=true;try{const r=await rpc('pedidoDinamico',state.token,$('#codes').value);r.encontrados.forEach(x=>visible.set(x.codigo,x));\n      $('#found').innerHTML=`<p>${r.naoEncontrados.length?'Não encontrados: '+esc(r.naoEncontrados.join(', ')):''}</p><div class=\"grid\">${r.encontrados.map(productCard).join('')}</div>`;\n    }catch(err){notice(err.message,true);}finally{b.disabled=false;}return;}\n    if(b.id==='finish'){b.disabled=true;try{state.requestId=state.requestId||crypto.randomUUID();const r=await rpc('concluirPedido',state.token,{requisicaoId:state.requestId,condicao:state.profile.condicao,\n      itens:[...state.cart.values()].map(x=>({codigo:x.codigo,quantidade:x.quantidade})),observacoes:$('#notes').value});\n      state.cart.clear();saveCart();state.requestId=null;state.page='historico';await renderPage();notice('Pedido '+r.pedidoId+' registrado com status '+r.status+'.');\n    }catch(err){notice(err.message||String(err),true);}finally{b.disabled=false;}}\n  });\n  document.querySelector('#register select[name=uf]').insertAdjacentHTML('beforeend','AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(x=>`<option>${x}</option>`).join(''));\n  if(state.token)rpc('minhaConta',state.token).then(p=>{state.profile=p;state.cnpj=p.cnpj;try{state.cart=new Map(JSON.parse(sessionStorage.getItem('zap_cart_'+state.cnpj)||'[]').map(x=>[x.codigo,x]));}catch(_){state.cart=new Map();}updateBadge();confirmOrShop();}).catch(()=>{sessionStorage.removeItem('zap_token');section('entry');});\n})();\n</script></body></html>";

