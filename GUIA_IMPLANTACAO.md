# Implantação de teste: Cloudflare Pages + Google Apps Script

O endereço atual `zapperim.pages.dev` continua em produção. Este instalador cria/publica somente um projeto novo com nome exclusivo **`zapperim-perim-...`** e guarda esse nome em `PAGES_PROJECT_NAME.txt` na pasta extraída. Mantenha esse arquivo para executar o `.bat` novamente e atualizar o mesmo projeto. O instalador Windows usa Direct Upload via Wrangler; essa modalidade não cria integração automática com o GitHub.

## 1. Instalar o GAS na sua conta Google

1. Abra um **projeto Apps Script novo** em [script.google.com](https://script.google.com/). Use uma conta que pode criar planilhas e enviar e-mails.
2. Crie **dois arquivos de script no mesmo projeto**: `GAS_INSTALAR_PLANILHA.gs` com o conteúdo de [`dist/GAS_INSTALAR_PLANILHA.gs`](dist/GAS_INSTALAR_PLANILHA.gs) e `GAS_API_ZAPPERIM.gs` com o conteúdo de [`dist/GAS_API_ZAPPERIM.gs`](dist/GAS_API_ZAPPERIM.gs). Os arquivos em `gas/` são o código modular de origem; os de `dist/` já vêm prontos para colar.
3. Remova a `myFunction` padrão se houver. Salve, selecione `instalarZapperim` e clique em **Executar**. Autorize a criação da planilha e o envio de códigos por e-mail para o projeto.
4. No **Registro de execução**, copie a URL da nova planilha. Uma planilha chamada **ZAPerim - Base de homologação** será criada. O ID fica nas propriedades do script como `ZAP_SPREADSHEET_ID`; novas execuções reutilizam a mesma planilha e não apagam dados.
5. Publique como **Aplicativo da Web**, execute como **você** e configure o acesso para **qualquer pessoa** (necessário para a função Cloudflare chegar à API). Copie a URL terminada em `/exec`. Ao abrir essa URL no navegador, o GAS deve responder `{"api":2,"connected":true,"status":"ready"}`. A URL `/dev` não é adequada para a Cloudflare.

**Atenção:** o GAS é uma API pública com verificação de acesso por código enviado ao e-mail registrado. A planilha contém dados comerciais; use apenas dados de teste até revisar permissões, limites de envio, fluxos de erro e regras de negócio. O código não contém IDs de planilhas ou credenciais.

## 2. Publicar pelo instalador Windows

1. Baixe o repositório como ZIP no GitHub e **extraia a pasta inteira**. Mantenha o `.bat`, `tools/`, `functions/` e `dist/` juntos. É necessário ter Node.js LTS no Windows.
2. Abra [`INSTALAR_ZAPPERIM_WINDOWS.bat`](INSTALAR_ZAPPERIM_WINDOWS.bat). Ele gera os arquivos, abre o login do Wrangler, cria um projeto Pages com nome exclusivo se ainda não existir, pergunta o valor da variável `GAS_WEB_APP_URL` e publica a página e a função `/api`. O nome gerado é reutilizado nas próximas execuções nessa mesma pasta.
3. Se a pasta extraída tiver `GAS_WEB_APP_URL.txt`, o instalador configura essa URL `/exec` sem pedir que você a digite novamente. Sem esse arquivo, cole a URL quando o Wrangler pedir o valor. O instalador não pede senha nem ID da planilha. Ele não publica em `zapperim.pages.dev`. **Se substituir a pasta por uma nova versão do instalador, preserve `PAGES_PROJECT_NAME.txt` para manter o endereço do teste.**
4. Ao final, o instalador consulta o projeto e imprime o **endereço de produção registrado** e o endereço de `/api/health`. Use esse domínio exato: o subdomínio pode receber um sufixo se `zapperim-app.pages.dev` não estiver disponível. Se surgir erro 523 na página inicial, confira no painel Cloudflare se o deploy de produção foi concluído; no primeiro deploy, aguarde a propagação do DNS e teste em outra rede. Se a página abrir e apenas health não responder `ready`, confira `/exec`, acesso do Web App e autorização do script.

Quem preferir integração GitHub automática pode criar **outro** projeto Pages manualmente com build `npm run build`, output `dist/cloudflare` e a variável `GAS_WEB_APP_URL`. Um projeto iniciado por Direct Upload não pode ser convertido em integração Git posteriormente.

## 3. Preparar dados de homologação

- Em `CONFIG`, mantenha `AMBIENTE=HOMOLOGACAO`. Informe as regras de pedido mínimo e limite para cadastro novo **em centavos**. A tela bloqueia a conclusão se faltarem regras.
- `PRODUTOS`: `CODIGO`, `EAN`, `DESCRICAO`, `MARCA`, URL HTTPS da imagem, `ATIVO=SIM`.
- `PRECOS`: uma linha por `CODIGO` + `TABELA`, `PRECO_CENTAVOS` inteiro. A tabela `NOVO` é usada para cadastro pendente.
- `ESTOQUE`: quantidade não negativa por código. `RANKING`: quantidade vendida por código (opcional).
- `CLIENTES`: cadastre CNPJ com 14 dígitos como texto, e-mail real de teste, UF válida, tabela, condição, telefone e `STATUS=ATIVO`. O acesso usa código enviado ao e-mail cadastrado.

O catálogo responde com 21 produtos por página, mas o GAS ainda lê as tabelas para filtrar e paginar. Meça a latência com o volume real antes de liberar clientes.

## Falta para produção

Não há importação da base antiga, geração de PDF/XLSX, envio de pedido ao faturamento, descontos nem reserva de estoque. Pedidos em homologação recebem status `TESTE`. **Não mude `AMBIENTE` para `PRODUCAO` nem substitua o site atual** antes de implementar e validar essas etapas.
