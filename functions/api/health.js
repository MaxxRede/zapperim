/** Health do proxy: valida que a Cloudflare consegue ler o status do GAS. */
export async function onRequestGet({env}) {
  const url=env.GAS_WEB_APP_URL_V3;
  if(!url||!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url))
    return Response.json({api:3,connected:false,status:'api_not_configured'},{status:503});
  try {
    const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    if(!response.ok||data.api!==3||data.revision!=='v3-ufs-local-20260929')
      return Response.json({api:3,connected:false,status:'gas_outdated',receivedApi:data.api??null,receivedRevision:data.revision??null},{status:503,headers:{'Cache-Control':'no-store'}});
    if(typeof data.connected!=='boolean')throw Error('invalid');
    return Response.json(data,{status:data.connected?200:503,headers:{'Cache-Control':'no-store'}});
  }catch(_){return Response.json({api:3,connected:false,status:'gas_unreachable'},{status:502});}
}
