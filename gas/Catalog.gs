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
