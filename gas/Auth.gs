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
  const id=cnpj_(cnpj);
  return {tipo:clientFor_(id)?'EXISTENTE':pendingFor_(id)?'PENDENTE':'NOVO',cnpj:id};
}
function saveAccess_(cnpj,responsavel,tabela,data) {
  append_('acesso',{ST:'ZAP_PERIM',CNPJ:cnpj,RESPONSAVEL:responsavel,TABELA:tabela,
    OBSERVACOES:JSON.stringify(data),STATUS:new Date()});
}
function cadastrarCliente(data) {
  const cnpj=cnpj_(data.cnpj), uf=uf_(data.uf), email=email_(data.email);
  if(!enabledUf_(uf))throw new Error('Ainda não atendemos esta UF.');
  const req={cnpj,nome:limited_(data.nome,140,'Razão social'),email,
    telefone:digits_(data.telefone),endereco:limited_(data.endereco,180,'Endereço'),
    cidade:limited_(data.cidade,80,'Cidade'),uf,cep:digits_(data.cep),
    complemento:limited_(data.complemento,100,'Complemento'),responsavel:limited_(data.responsavel,100,'Responsável'),
    cargo:limited_(data.cargo,80,'Cargo'),seller:limited_(data.seller,30,'Vendedor'),tipo:'PENDENTE'};
  if(!req.nome||!req.endereco||!req.cidade||!req.responsavel||!req.cargo||!/^[0-9]{10,11}$/.test(req.telefone)||!/^[0-9]{8}$/.test(req.cep))
    throw new Error('Preencha os dados obrigatórios; telefone com DDD e CEP com 8 dígitos.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    if(clientFor_(cnpj))throw new Error('Este CNPJ já consta da base. Acesse com o e-mail registrado.');
    if(pendingFor_(cnpj))throw new Error('Cadastro já recebido. Use o e-mail informado ou solicite revisão.');
    saveAccess_(cnpj,req.responsavel,config_('TABELA_NOVO')||'NOVO',req);
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
  saveAccess_(id,profile.responsavel,profile.tabela,notes);
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
  if(found.tipo==='PENDENTE')return {cnpj:digits_(row.CNPJ),nome:String(notes.nome||''),uf:String(notes.uf||''),
    responsavel:String(notes.responsavel||row.RESPONSAVEL||''),email:String(notes.email||''),telefone:String(notes.telefone||''),
    cargo:String(notes.cargo||''),tipo:'PENDENTE',tabela:String(row.TABELA||'NOVO'),condicao:'A VISTA',minimo:''};
  const uf=ufEndereco_(row['ENDEREÇO']);
  return {cnpj:digits_(row['CNPJ/CPF']),nome:String(row.CLIENTE||''),uf,
    responsavel:String(notes.responsavel||found.access&&found.access.RESPONSAVEL||''),email:String(row['E-MAIL']||''),
    telefone:String(notes.telefone||row.TELEFONE||''),cargo:String(notes.cargo||''),
    tipo:'EXISTENTE',tabela:String(found.access&&found.access.TABELA||row.TABELA||''),
    condicao:String(row['CONDIÇÃO']||'A VISTA'),minimo:row['PED. MÍNIMO']};
}
function minhaConta(token){return profile_(session_(token));}
function confirmarDados(token,data) {
  const user=session_(token),responsavel=limited_(data.responsavel,100,'Responsável'),cargo=limited_(data.cargo,80,'Cargo'),telefone=digits_(data.telefone);
  if(!responsavel||!cargo||!/^[0-9]{10,11}$/.test(telefone))throw new Error('Informe responsável, cargo e telefone com DDD.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const current=session_(token),profile=profile_(current),notes=Object.assign({},accessData_(current.access||{}),
      {tipo:current.tipo,cnpj:user.cnpj,nome:profile.nome,email:user.email,responsavel,cargo,telefone,
        endereco:current.tipo==='EXISTENTE'?String(current.row['ENDEREÇO']||''):accessData_(current.access||{}).endereco,
        cidade:current.tipo==='EXISTENTE'?String(current.row.CIDADE||''):accessData_(current.access||{}).cidade,
        uf:profile.uf,tabela:profile.tabela,condicao:profile.condicao});
    saveAccess_(user.cnpj,responsavel,profile.tabela,notes);
    return profile_(session_(token));
  }finally{lock.releaseLock();}
}
function sair(token){CacheService.getScriptCache().remove('session:'+String(token));return true;}
