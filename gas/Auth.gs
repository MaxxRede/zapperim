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
