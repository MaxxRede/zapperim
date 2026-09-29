import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const [id,output]=process.argv.slice(2);
if(!id||!output||!/^[A-Za-z0-9_-]{20,}$/.test(id)){
  console.error('Informe o ID válido de uma planilha e o caminho do arquivo de saída.');
  process.exit(2);
}
const source=readFileSync(resolve('dist/GAS_INSTALAR_PLANILHA.gs'),'utf8');
const marker="var ZAP_TARGET_SPREADSHEET_ID = '';";
if(!source.includes(marker))throw Error('Marcador de planilha-alvo ausente; rode npm run build.');
writeFileSync(resolve(output),source.replace(marker,`var ZAP_TARGET_SPREADSHEET_ID = '${id}';`));
console.log(`Instalador direcionado gravado em ${output}.`);
