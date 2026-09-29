import {readFileSync} from 'node:fs';

const file=process.argv[2];
if(!file)process.exit(2);
try {
  const data=JSON.parse(readFileSync(file,'utf8'));
  const list=Array.isArray(data)?data:Array.isArray(data.result)?data.result:Array.isArray(data.deployments)?data.deployments:null;
  if(!list)throw Error('Formato inesperado da lista de publicações.');
  const deployment=list.find(item=>String(item.environment??item.Environment).toLowerCase()==='production'&&(item.latest_stage?.status==='success'||/^(success|just now|.* ago)$/i.test(String(item.Status||''))));
  if(!deployment)throw Error('Nenhuma publicação de produção concluída foi confirmada.');
  const urls=[...(deployment.aliases||[]),deployment.url??deployment.Deployment].filter(value=>typeof value==='string').map(value=>value.startsWith('https://')?value:`https://${value}`).filter(value=>/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pages\.dev\/?$/i.test(value));
  if(!urls.length)throw Error('A Cloudflare não informou URL válida para a publicação.');
  for(const url of new Set(urls))console.log(`URL informada pela Cloudflare: ${url}`);
  console.log('Confirme que o endereço abre no navegador antes de testar /api/health.');
}catch(error){console.error(error.message);process.exit(2);}
