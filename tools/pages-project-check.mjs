import {readFileSync} from 'node:fs';
const [file,name]=process.argv.slice(2);
if(!file||!name)process.exit(2);
try {
  const data=JSON.parse(readFileSync(file,'utf8'));
  const projects=Array.isArray(data)?data:Array.isArray(data.projects)?data.projects:Array.isArray(data.result)?data.result:null;
  if(!projects)throw Error('Formato inesperado.');
  process.exit(projects.some(project=>(project.name??project['Project Name'])===name)?0:1);
}catch(_){console.error('Não foi possível conferir os projetos Cloudflare.');process.exit(2);}
