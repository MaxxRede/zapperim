import {readFileSync,writeFileSync} from 'node:fs';
const [input,output]=process.argv.slice(2);
if(!input||!output)process.exit(2);
const url=readFileSync(input,'utf8').trim();
if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/\s]+\/exec$/.test(url)) {
  console.error('URL GAS inválida: informe o endereço /exec do aplicativo Web.');
  process.exit(2);
}
writeFileSync(output,JSON.stringify({GAS_WEB_APP_URL_V3:url}));
