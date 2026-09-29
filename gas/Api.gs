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
