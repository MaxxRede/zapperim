/** ZAPerim — API do Web App para Cloudflare Pages. Requer GAS_INSTALAR_PLANILHA.gs no mesmo projeto. */

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

function doGet() {
  const installed=!!PropertiesService.getScriptProperties().getProperty('ZAP_BASE_V3_ID');
  return json_({api:3,revision:'v3-formatos-logos-20260929',connected:installed,status:installed?'ready':'not_installed'});
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
function now_() { return Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'America/Sao_Paulo','dd/MM/yyyy HH:mm:ss'); }
function upper_(value,max) { return clean_(value,max).toLocaleUpperCase('pt-BR'); }
function formatCnpj_(value) { const s=digits_(value); return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'); }
function validCnpj_(s) {
  if(!/^\d{14}$/.test(s)||/^(\d)\1{13}$/.test(s))return false;
  const calc=len=>{let sum=0,pos=len-7;for(let i=0;i<len;i++){sum+=Number(s[i])*pos--;if(pos<2)pos=9;}const r=sum%11;return r<2?0:11-r;};
  return calc(12)===Number(s[12])&&calc(13)===Number(s[13]);
}
function formatPhone_(value) { const s=digits_(value); if(s.length===10)return s.replace(/^(\d{2})(\d{4})(\d{4})$/,'($1) $2-$3'); if(s.length===11)return s.replace(/^(\d{2})(\d{5})(\d{4})$/,'($1) $2-$3'); return s; }
function phone_(value) { const s=digits_(value); if(!/^\d{10,11}$/.test(s))throw new Error('Telefone inválido. Informe DDD e número fixo ou celular.'); return formatPhone_(s); }
function formatCep_(value) { const s=digits_(value); return s.length===8?s.replace(/^(\d{5})(\d{3})$/,'$1-$2'):s; }
function cep_(value) { const s=digits_(value); if(!/^\d{8}$/.test(s))throw new Error('CEP inválido. Informe 8 dígitos.'); return formatCep_(s); }
function digits_(s) { return String(s||'').replace(/\D/g,''); }
function clean_(value,max) { return String(value||'').trim().slice(0,max); }
function email_(v) { const s=clean_(v,180).toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error('E-mail inválido.'); return s; }
function cnpj_(v) { const s=digits_(v); if(!validCnpj_(s)) throw new Error('CNPJ inválido. Confira os 14 dígitos e os dígitos verificadores.'); return s; }
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

const AUTH_TTL=21600;
function accessData_(row) {
  try {const value=JSON.parse(String(row.OBSERVACOES||'')); return value && typeof value==='object' ? value : {};}
  catch(_){return {};}
}
function accessFor_(cnpj) {
  return records_('acesso').filter(r=>digits_(r.CNPJ)===cnpj).reverse();
}
function clientFor_(cnpj) {
  return records_('view_bd').find(r=>digits_(r['CNPJ/CPF'])===cnpj);
}
function pendingFor_(cnpj) {
  return accessFor_(cnpj).find(r=>accessData_(r).tipo==='PENDENTE');
}
function identificarCnpj(cnpj) {
  const id=cnpj_(cnpj), client=clientFor_(id), pending=pendingFor_(id);
  const tipo=client?'EXISTENTE':pending?'PENDENTE':'NOVO';
  let email='';
  if(client) {
    email=String(client['E-MAIL']||'').trim().toLowerCase();
    if(!email) {
      const acesso=accessFor_(id).find(r=>String(accessData_(r).email||'').trim());
      if(acesso) email=String(accessData_(acesso).email||'').trim().toLowerCase();
    }
  } else if(pending) {
    email=String(accessData_(pending).email||'').trim().toLowerCase();
  }
  return {tipo,cnpj:formatCnpj_(id),email};
}
function saveAccess_(cnpj,responsavel,tabela,data) {
  append_('acesso',{ST:'ZAP_PERIM',CNPJ:cnpj,RESPONSAVEL:responsavel,TABELA:tabela,
    OBSERVACOES:JSON.stringify(data),STATUS:new Date()});
}
function cadastrarCliente(data) {
  const cnpj=cnpj_(data.cnpj), uf=uf_(data.uf), email=email_(data.email);
  if(!enabledUf_(uf))throw new Error('Ainda não atendemos esta UF.');
  const req={cnpj:formatCnpj_(cnpj),nome:upper_(data.nome,140),email,
    telefone:phone_(data.telefone),endereco:upper_(data.endereco,180),
    cidade:upper_(data.cidade,80),uf,cep:cep_(data.cep),
    complemento:upper_(data.complemento,100),responsavel:upper_(data.responsavel,100),
    cargo:upper_(data.cargo,80),seller:upper_(data.seller,30),tipo:'PENDENTE'};
  if(!req.nome||!req.endereco||!req.cidade||!req.responsavel||!req.cargo)
    throw new Error('Preencha todos os dados obrigatórios.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    if(clientFor_(cnpj))throw new Error('Este CNPJ já consta da base. Acesse com o e-mail registrado.');
    if(pendingFor_(cnpj))throw new Error('Cadastro já recebido. Use o e-mail informado ou solicite revisão.');
    saveAccess_(req.cnpj,req.responsavel,upper_(config_('TABELA_NOVO')||'NOVO',60),req);
  }finally{lock.releaseLock();}
  solicitarCodigo(cnpj,email);
  return {mensagem:'Cadastro recebido. Enviamos um código ao e-mail informado; a aprovação comercial ainda está pendente.'};
}
function authRecord_(cnpj,email) {
  const client=clientFor_(cnpj), accesses=accessFor_(cnpj), latest=accesses[0];
  if(client && String(client['E-MAIL']).trim().toLowerCase()===email)
    return {row:client,access:latest,tipo:'EXISTENTE'};
  if(!client){const pending=accesses.find(r=>{const d=accessData_(r);return d.tipo==='PENDENTE' && d.email===email;});
    if(pending)return {row:pending,access:pending,tipo:'PENDENTE'};}
  return null;
}
function solicitarCodigo(cnpj,email) {
  const id=cnpj_(cnpj),mail=email_(email),cache=CacheService.getScriptCache();
  const throttle='rate:'+id;if(cache.get(throttle))throw new Error('Aguarde um minuto antes de solicitar outro código.');
  const found=authRecord_(id,mail);
  if(found){
    const code=String(100000+(parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,12),16)%900000));
    const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,code+':'+id+':'+mail).map(n=>('0'+(n&255).toString(16)).slice(-2)).join('');
    cache.put('otp:'+id+':'+mail,JSON.stringify({hash,attempts:0}),600);
    MailApp.sendEmail({to:mail,subject:'Código de acesso ZAPerim',body:'Seu código é '+code+'. Ele vale por 10 minutos. Não compartilhe este código.'});
  }
  cache.put(throttle,'1',60);
  return {mensagem:'Se este e-mail estiver vinculado ao CNPJ, enviaremos um código de acesso.'};
}
function confirmarCodigo(cnpj,email,code) {
  const id=cnpj_(cnpj),mail=email_(email),key='otp:'+id+':'+mail,cache=CacheService.getScriptCache();
  const entry=cache.get(key);if(!entry)throw new Error('Código expirado ou inválido. Solicite outro.');
  const data=JSON.parse(entry);
  if(data.attempts>=5){cache.remove(key);throw new Error('Muitas tentativas. Solicite novo código.');}
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,clean_(code,6)+':'+id+':'+mail).map(n=>('0'+(n&255).toString(16)).slice(-2)).join('');
  if(!/^\d{6}$/.test(String(code))||hash!==data.hash){data.attempts++;cache.put(key,JSON.stringify(data),600);throw new Error('Código inválido.');}
  const found=authRecord_(id,mail);if(!found)throw new Error('Cadastro indisponível.');
  cache.remove(key);
  const token=uuid_()+uuid_();cache.put('session:'+token,JSON.stringify({cnpj:id,email:mail}),AUTH_TTL);
  const profile=profile_(found);
  // Histórico da entrada; preserva as informações completas em OBSERVACOES.
  const notes=found.tipo==='PENDENTE'?accessData_(found.row):Object.assign({},accessData_(found.access||{}),
    {tipo:'EXISTENTE',cnpj:id,nome:profile.nome,email:mail,telefone:profile.telefone,
      endereco:String(found.row['ENDEREÇO']||''),cidade:String(found.row.CIDADE||''),uf:profile.uf,
      responsavel:profile.responsavel,cargo:profile.cargo,tabela:profile.tabela,condicao:profile.condicao});
  saveAccess_(formatCnpj_(id),profile.responsavel,profile.tabela,notes);
  return {token,cliente:profile};
}
function session_(token) {
  if(!/^[a-f0-9-]{72}$/.test(String(token||'')))throw new Error('Acesso expirado. Entre novamente.');
  const raw=CacheService.getScriptCache().get('session:'+token);if(!raw)throw new Error('Acesso expirado. Entre novamente.');
  const user=JSON.parse(raw),found=authRecord_(user.cnpj,user.email);
  if(!found)throw new Error('Cadastro indisponível.');
  return Object.assign(user,found);
}
function profile_(found) {
  const row=found.row, notes=accessData_(found.access||row);
  if(found.tipo==='PENDENTE')return {cnpj:formatCnpj_(digits_(row.CNPJ)),nome:upper_(notes.nome||'',140),uf:String(notes.uf||''),
    responsavel:upper_(notes.responsavel||row.RESPONSAVEL||'',100),email:String(notes.email||''),telefone:formatPhone_(notes.telefone||''),
    cargo:upper_(notes.cargo||'',80),tipo:'PENDENTE',tabela:upper_(row.TABELA||'NOVO',60),condicao:'A VISTA',minimo:''};
  const uf=ufEndereco_(row['ENDEREÇO']);
  return {cnpj:formatCnpj_(digits_(row['CNPJ/CPF'])),nome:upper_(row.CLIENTE||'',140),uf,
    responsavel:upper_(notes.responsavel||(found.access&&found.access.RESPONSAVEL)||'',100),email:String(row['E-MAIL']||''),
    telefone:formatPhone_(notes.telefone||row.TELEFONE||''),cargo:upper_(notes.cargo||'',80),
    tipo:'EXISTENTE',tabela:upper_((found.access&&found.access.TABELA)||row.TABELA||'',60),
    condicao:upper_(row['CONDIÇÃO']||'A VISTA',60),minimo:row['PED. MÍNIMO']};
}
function minhaConta(token){return profile_(session_(token));}
function confirmarDados(token,data) {
  const user=session_(token),responsavel=upper_(data.responsavel,100),cargo=upper_(data.cargo,80),telefone=phone_(data.telefone);
  if(!responsavel||!cargo)throw new Error('Informe responsável e cargo.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const current=session_(token),profile=profile_(current),notes=Object.assign({},accessData_(current.access||{}),
      {tipo:current.tipo,cnpj:formatCnpj_(user.cnpj),nome:profile.nome,email:user.email,responsavel,cargo,telefone,
        endereco:current.tipo==='EXISTENTE'?upper_(current.row['ENDEREÇO']||'',180):upper_(accessData_(current.access||{}).endereco||'',180),
        cidade:current.tipo==='EXISTENTE'?upper_(current.row.CIDADE||'',80):upper_(accessData_(current.access||{}).cidade||'',80),
        uf:profile.uf,tabela:profile.tabela,condicao:profile.condicao});
    saveAccess_(formatCnpj_(user.cnpj),responsavel,profile.tabela,notes);
    return profile_(session_(token));
  }finally{lock.releaseLock();}
}
function sair(token){CacheService.getScriptCache().remove('session:'+String(token));return true;}

function catalogData_(profile) {
  const images=records_('imagens'), byProduct=new Map();
  images.forEach(row=>{
    const key=String(row.Produto||'').trim().toUpperCase();
    if(key && !byProduct.has(key) && /^https:\/\//i.test(String(row.URL||'')))byProduct.set(key,String(row.URL));
  });
  const sold=new Map();
  records_('pedidos').forEach(row=>{const code=String(row.CODIGO||'').trim();
    if(code)sold.set(code,(sold.get(code)||0)+(Number(row.QTDE)||0));});
  const chosen=new Map();
  records_('stq').forEach(row=>{
    const code=String(row.COD||'').trim(),table=String(row.TABELA||'').trim();
    if(!code||table.toUpperCase()!==profile.tabela.toUpperCase())return;
    if(chosen.has(code))throw new Error('Código duplicado na tabela '+table+': '+code);
    const price=moneyCents_(row['PRECO VND'],'PRECO VND de '+code);
    const stock=Math.max(0,Math.trunc(Number(row.SALDO_STQ!==''?row.SALDO_STQ:row.ESTOQUE)||0));
    const desc=String(row.DESCRICAO||'');
    chosen.set(code,{codigo:code,ean:String(row.EAN||''),descricao:desc,marca:String(row.MARCA||''),
      imagem:byProduct.get(code.toUpperCase())||byProduct.get(desc.trim().toUpperCase())||'',
      precoCentavos:price,estoque:stock,vendidos:Math.max(0,sold.get(code)||0),promocao:false,
      packing:String(row.PACKING||'')});
  });
  return [...chosen.values()];
}
function listarCatalogo(token,opts) {
  const profile=profile_(session_(token)),o=opts||{};
  const pagina=requireInt_(o.pagina||1,1,100000,'Página');
  const busca=clean_(o.busca,100).toLowerCase(),marca=clean_(o.marca,80).toLowerCase();
  const somenteEstoque=Boolean(o.somenteEstoque),favoritos=Boolean(o.favoritos);
  let items=catalogData_(profile).filter(x=>(!busca||(x.codigo+' '+x.ean+' '+x.descricao+' '+x.marca).toLowerCase().includes(busca))&&
    (!marca||x.marca.toLowerCase()===marca)&&(!somenteEstoque||x.estoque>0));
  if(favoritos)items.sort((a,b)=>b.vendidos-a.vendidos||a.codigo.localeCompare(b.codigo));
  else items.sort((a,b)=>a.descricao.localeCompare(b.descricao,'pt-BR'));
  if(favoritos)items=items.slice(0,60);
  const pageSize=21;
  return {itens:items.slice((pagina-1)*pageSize,pagina*pageSize),pagina,total:items.length,
    paginas:Math.ceil(items.length/pageSize),marcas:[...new Set(items.map(x=>x.marca).filter(Boolean))].sort()};
}
function topDez(token){return catalogData_(profile_(session_(token))).sort((a,b)=>b.vendidos-a.vendidos).slice(0,10);}
function pedidoDinamico(token,input) {
  const codes=[...new Set(clean_(input,1200).split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean))].slice(0,60);
  const catalog=catalogData_(profile_(session_(token)));
  const byCode=new Map(catalog.map(x=>[x.codigo.toUpperCase(),x]));
  return {encontrados:codes.map(c=>byCode.get(c.toUpperCase())).filter(Boolean),naoEncontrados:codes.filter(c=>!byCode.has(c.toUpperCase()))};
}

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
    const obs=upper_(data.observacoes,900);
    const stamp=new Date(),marker=orderMarker_(requestId);
    const values=rows.map(row=>ZAP_SCHEMA.pedidos.map(key=>{
      const fields={'CNPJ/CPF':formatCnpj_(user.cnpj),RESONSAVEL:upper_(profile.responsavel,100),ATENDIMENTO:user.row.RCA||'CLIENTE',
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
