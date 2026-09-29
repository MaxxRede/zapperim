/** Proxy na Cloudflare Pages: evita CORS do Web App GAS e não expõe a URL de implantação. */
export async function onRequestPost({request,env}) {
  const url=env.GAS_WEB_APP_URL;
  if(!url||!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url))
    return Response.json({ok:false,error:'API ainda não configurada.'},{status:503});
  const type=request.headers.get('content-type')||'';
  if(!type.toLowerCase().includes('application/json'))
    return Response.json({ok:false,error:'Envie JSON.'},{status:415});
  const raw=await request.text();
  if(raw.length>15000)return Response.json({ok:false,error:'Requisição muito grande.'},{status:413});
  let body;
  try {body=JSON.parse(raw);}catch(_){return Response.json({ok:false,error:'JSON inválido.'},{status:400});}
  if(!body||typeof body.action!=='string'||!Array.isArray(body.args))
    return Response.json({ok:false,error:'Ação inválida.'},{status:400});
  try {
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:raw,redirect:'follow',signal:AbortSignal.timeout(30000)});
    const result=await response.text();
    let parsed;
    try{parsed=JSON.parse(result);}catch(_){return Response.json({ok:false,error:'A resposta do GAS não é JSON. Verifique a implantação /exec e o acesso.'},{status:502});}
    if(!response.ok)return Response.json({ok:false,error:'Falha na API do GAS.'},{status:502});
    return Response.json(parsed,{status:parsed.ok?200:400,headers:{'Cache-Control':'no-store'}});
  }catch(_){return Response.json({ok:false,error:'Não foi possível acessar o GAS.'},{status:502});}
}
