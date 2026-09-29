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
