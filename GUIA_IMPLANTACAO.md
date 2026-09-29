# Implantação de teste: Cloudflare Pages + Google Apps Script

O endereço atual `zapperim.pages.dev` continua em produção. Crie **outro projeto Cloudflare Pages**, por exemplo `zapperim-v2`, para testar esta versão. Não vincule este repositório à configuração de build do projeto atual.

## 1. Instalar o GAS na sua conta Google

1. Abra um **projeto Apps Script novo** em [script.google.com](https://script.google.com/). Use uma conta que pode criar planilhas e enviar e-mails.
2. Substitua o conteúdo do arquivo `Code.gs` pelo conteúdo integral de [`dist/Code.gs`](dist/Code.gs). Ele já contém servidor, instalador e versão de prévia das telas; não é necessário copiar os vários arquivos da pasta `gas/`.
3. Se o projeto criado mostrar uma função `myFunction` antiga, remova-a. Salve o projeto e selecione `instalarZapperim` no menu de funções; clique em **Executar** e conceda as permissões solicitadas.
4. No **Registro de execução**, copie a URL da nova planilha. Uma planilha chamada **ZAPerim - Base de homologação** será criada. O ID fica nas propriedades do script como `ZAP_SPREADSHEET_ID`; novas execuções reutilizam a mesma planilha e não apagam dados.
5. Publique como **Aplicativo da Web**, execute como **você** e configure o acesso para **qualquer pessoa** (necessário para a função Cloudflare chegar à API). Copie a URL terminada em `/exec`. Teste a URL no navegador: o GAS mostra uma prévia das telas. A URL `/dev` não é adequada para a Cloudflare.

**Atenção:** o GAS é uma API pública com verificação de acesso por código enviado ao e-mail registrado. A planilha contém dados comerciais; use apenas dados de teste até revisar permissões, limites de envio, fluxos de erro e regras de negócio. O código não contém IDs de planilhas ou credenciais.

## 2. Criar um projeto Cloudflare Pages de teste

1. Em **Workers & Pages**, crie um projeto **Pages** novo conectado a `MaxxRede/zapperim` (branch `main`). Use um nome diferente do projeto que serve `zapperim.pages.dev`.
2. Framework preset: **None**. Root directory: `/`. Build command: `npm run build`. Build output directory: `dist/cloudflare`.
3. Na configuração do projeto Pages, adicione a variável de ambiente **`GAS_WEB_APP_URL`** com a URL `/exec` copiada no passo 1, para **Preview** e **Production** do novo projeto. A função `functions/api.js` usará essa URL no servidor. O navegador do cliente só chama `/api` no mesmo domínio.
4. Publique e abra o novo endereço `https://zapperim-v2.pages.dev` ou o nome que você escolheu. Se aparecer “API ainda não configurada”, confira a variável e refaça a implantação. Se a resposta do GAS não for JSON, confira `/exec`, acesso do Web App e autorização do script.

## 3. Preparar dados de homologação

- Em `CONFIG`, mantenha `AMBIENTE=HOMOLOGACAO`. Informe as regras de pedido mínimo e limite para cadastro novo **em centavos**. A tela bloqueia a conclusão se faltarem regras.
- `PRODUTOS`: `CODIGO`, `EAN`, `DESCRICAO`, `MARCA`, URL HTTPS da imagem, `ATIVO=SIM`.
- `PRECOS`: uma linha por `CODIGO` + `TABELA`, `PRECO_CENTAVOS` inteiro. A tabela `NOVO` é usada para cadastro pendente.
- `ESTOQUE`: quantidade não negativa por código. `RANKING`: quantidade vendida por código (opcional).
- `CLIENTES`: cadastre CNPJ com 14 dígitos como texto, e-mail real de teste, UF válida, tabela, condição, telefone e `STATUS=ATIVO`. O acesso usa código enviado ao e-mail cadastrado.

O catálogo responde com 21 produtos por página, mas o GAS ainda lê as tabelas para filtrar e paginar. Meça a latência com o volume real antes de liberar clientes.

## Falta para produção

Não há importação da base antiga, geração de PDF/XLSX, envio de pedido ao faturamento, descontos nem reserva de estoque. Pedidos em homologação recebem status `TESTE`. **Não mude `AMBIENTE` para `PRODUCAO` nem substitua o site atual** antes de implementar e validar essas etapas.
