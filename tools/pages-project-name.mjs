import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';

const file=process.argv[2];
if(!file)process.exit(2);
try {
  const existing=existsSync(file)?readFileSync(file,'utf8').trim():'';
  if(existing && !/^zapperim-perim-[0-9a-f]{16}$/.test(existing)){
    throw Error('Nome de projeto invalido em PAGES_PROJECT_NAME.txt.');
  }
  const name=existing||`zapperim-perim-${randomBytes(8).toString('hex')}`;
  if(!existing)writeFileSync(file,`${name}\n`,{flag:'wx'});
  console.log(name);
}catch(error){console.error(error.message);process.exit(2);}
