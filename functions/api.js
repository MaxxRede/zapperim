/** Proxy na Cloudflare Pages: evita CORS do Web App GAS e não expõe a URL de implantação. */
let checkedGas={url:'',until:0};
async function ensureGasV3(url) {
  if(checkedGas.url===url && checkedGas.until>Date.now())return;
  const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(15000)});
  let health;
  try {health=await response.json();}
  catch(_){throw Error('O Web App GAS não respondeu JSON. Confira a URL /exec e as permissões da implantação.');}
  if(!response.ok||health.api!==3||health.revision!=='v3-ufs-local-20260929')
    throw Error('A implantação /exec do GAS está desatualizada. Atualize-a em Gerenciar implantações → Editar → Nova versão, ou configure a URL da implantação correta em GAS_WEB_APP_URL_V3. Confira /api/health.');
  if(health.connected!==true)
    throw Error('O GAS v3 respondeu, mas a planilha ainda não está vinculada. Execute instalarZapperim no mesmo projeto Apps Script da implantação /exec e confira /api/health.');
  checkedGas={url,until:Date.now()+60000};
}
export async function onRequestPost({request,env}) {
  const url=env.GAS_WEB_APP_URL_V3;
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
  try {await ensureGasV3(url);}catch(error){return Response.json({ok:false,error:error.message||'Não foi possível validar a versão do GAS.'},{status:503});}
  try {
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:raw,redirect:'follow',signal:AbortSignal.timeout(30000)});
    const result=await response.text();
    let parsed;
    try{parsed=JSON.parse(result);}catch(_){return Response.json({ok:false,error:'A resposta do GAS não é JSON. Verifique a implantação /exec e o acesso.'},{status:502});}
    if(!response.ok)return Response.json({ok:false,error:'Falha na API do GAS.'},{status:502});
    return Response.json(parsed,{status:parsed.ok?200:400,headers:{'Cache-Control':'no-store'}});
  }catch(_){return Response.json({ok:false,error:'Não foi possível acessar o GAS.'},{status:502});}
}
