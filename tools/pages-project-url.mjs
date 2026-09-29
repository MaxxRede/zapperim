import {readFileSync} from 'node:fs';

const [file, name] = process.argv.slice(2);
if (!file || !name) process.exit(2);

try {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const projects = Array.isArray(data) ? data : Array.isArray(data.projects) ? data.projects : data.result;
  if (!Array.isArray(projects)) throw Error('Formato inesperado da lista de projetos.');
  const project = projects.find(item => item.name === name);
  if (!project) throw Error(`Projeto ${name} não encontrado nesta conta Cloudflare.`);
  const host = project.subdomain;
  if (typeof host !== 'string' || !/^[a-z0-9-]+\.pages\.dev$/i.test(host)) {
    throw Error('A Cloudflare não informou o subdomínio do projeto. Confira a URL exibida pelo Wrangler.');
  }
  const deployment = project.canonical_deployment;
  if (!deployment) throw Error('O projeto ainda não tem publicação de produção confirmada. Confira a saída do deploy.');
  const status = deployment.latest_stage?.status;
  if (status && status !== 'success') throw Error(`A publicação de produção está em estado ${status}.`);
  console.log(`Endereco de producao registrado: https://${host}/`);
  console.log(`Teste da pagina: https://${host}/`);
  console.log(`Teste da API: https://${host}/api/health`);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
