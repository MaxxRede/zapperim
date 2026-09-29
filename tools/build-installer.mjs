import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>readFileSync(resolve(root,'gas',name),'utf8').trim();
const style=read('Styles.html'), app=read('App.html');
let html=read('Index.html');
const styleToken="<?!= include_('Styles'); ?>",appToken="<?!= include_('App'); ?>";
if(!html.includes(styleToken)||!html.includes(appToken))throw Error('Marcadores HTML não encontrados.');
html=html.replace(styleToken,style).replace(appToken,app);
if(html.includes('<?!='))throw Error('Template HTML não resolvido.');

const installer=[
  '/** ZAPerim — instale a planilha uma vez; mantenha este arquivo no mesmo projeto da API. */',
  read('Schema.gs'),read('Setup.gs'),''].join('\n\n');
const installerFile=resolve(root,'dist','GAS_INSTALAR_PLANILHA.gs');
mkdirSync(dirname(installerFile),{recursive:true});
writeFileSync(installerFile,installer);
console.log(`${installerFile}: ${Buffer.byteLength(installer)} bytes`);

const api=[
  '/** ZAPerim — API do Web App para Cloudflare Pages. Requer GAS_INSTALAR_PLANILHA.gs no mesmo projeto. */',
  ...['Schema.gs','Core.gs','Auth.gs','Catalog.gs','Orders.gs','Api.gs'].map(read),''].join('\n\n');
const apiFile=resolve(root,'dist','GAS_API_ZAPPERIM.gs');
writeFileSync(apiFile,api);
console.log(`${apiFile}: ${Buffer.byteLength(api)} bytes`);

const apiCall='google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[method](...args)';
if(!app.includes(apiCall))throw Error('RPC da tela não encontrado.');
const cloudApp=app.replace(apiCall,
  `fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:method,args})})`+
  `.then(async response=>{const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Falha de comunicação.');return data.result;})`+
  `.then(resolve,reject)`);
const cloudHtml=read('Index.html').replace(styleToken,style).replace(appToken,cloudApp);
if(cloudHtml.includes('<?!=')||cloudHtml.includes('google.script.run'))throw Error('HTML Cloudflare incompleto.');
const cloudFile=resolve(root,'dist','cloudflare','index.html');
mkdirSync(dirname(cloudFile),{recursive:true});
writeFileSync(cloudFile,cloudHtml);
const assetsDir=resolve(root,'dist','cloudflare','assets');mkdirSync(assetsDir,{recursive:true});
copyFileSync(resolve(root,'assets','zappedidos-logo.svg'),resolve(assetsDir,'zappedidos-logo.svg'));
copyFileSync(resolve(root,'assets','perim-logo.svg'),resolve(assetsDir,'perim-logo.svg'));
console.log(`${cloudFile}: ${Buffer.byteLength(cloudHtml)} bytes`);
