# ZAPerim — reconstrução independente

Esta é a primeira versão das telas HTML e da base Google Sheets do novo sistema de pedidos. O site atual em `zapperim.pages.dev` e as planilhas antigas não são alterados por este código.

**Instalação:** siga [`GUIA_IMPLANTACAO.md`](GUIA_IMPLANTACAO.md). O [`INSTALAR_ZAPPERIM_WINDOWS.bat`](INSTALAR_ZAPPERIM_WINDOWS.bat) publica em um projeto Pages exclusivo, separado do site atual. `npm run build` gera `dist/cloudflare/index.html` e os GAS separados `dist/GAS_INSTALAR_PLANILHA.gs` e `dist/GAS_API_ZAPPERIM.gs`. `functions/` contém o proxy `/api` e o diagnóstico `/api/health`.

## O que está implementado

- Instalador `instalarZapperim()` que cria **uma planilha nova** se ainda não existir, grava seu ID nas propriedades do projeto Apps Script e verifica o cabeçalho de cada aba ao executar novamente.
- Telas de CNPJ, cadastro novo, código por e-mail, confirmação do contato, Queridinhos, catálogo com 21 produtos por página, busca por código/EAN/nome, filtro por marca/estoque, pedido dinâmico, carrinho, top 10 e histórico.
- Busca de preços por tabela do cliente. No fechamento, o servidor recalcula preço e estoque, valida UF, mínimo, limite de novo cadastro e condição; pedidos repetidos com o mesmo identificador retornam o primeiro resultado.
- Cadastro novo fica `PENDENTE`, sem criar cliente aprovado automaticamente. Pedidos gerados enquanto `AMBIENTE=HOMOLOGACAO` recebem status `TESTE`.

## Instalação em ambiente de teste

1. Crie **um projeto Apps Script novo e independente**; inclua os dois arquivos GAS gerados em `dist/` no mesmo projeto. A tela HTML é publicada pela Cloudflare, sem copiar os arquivos HTML no Apps Script.
2. Execute `instalarZapperim()` como administrador. Anote a URL retornada e confira as abas da nova planilha. Se executar novamente, ela reutiliza o ID guardado em propriedades do script e não apaga linhas.
3. Preencha `REGRAS_UF` se quiser limitar UFs. Na aba `CONFIG`, informe `PEDIDO_MINIMO_CENTAVOS` e `LIMITE_NOVO_CENTAVOS` com números inteiros; avalie a regra comercial antes de liberar testes de fechamento. O valor `35000` representa R$ 350,00.
4. Cadastre dados de homologação em `PRODUTOS` (`ATIVO=SIM`), `PRECOS` (`TABELA=NOVO` ou tabela do cliente, `PRECO_CENTAVOS` inteiro), `ESTOQUE` (por código) e, se desejar, `RANKING`. Em `CLIENTES`, use CNPJ como texto com 14 dígitos, e-mail real do teste, `STATUS=ATIVO`, `TABELA`, `CONDICAO`, `UF` e telefone.
5. Publique **uma implantação de teste** como aplicativo Web, executando como proprietário do script e com acesso a qualquer pessoa para o proxy Cloudflare alcançar o `doPost`. O aplicativo envia códigos por MailApp, portanto a conta do projeto deverá autorizar esse escopo. Use o `.bat` para publicar o frontend no projeto Pages separado.

## Colunas da planilha

O contrato completo está em `gas/Schema.gs` (objeto `ZAP_SCHEMA`). Cada linha 1 recebe os cabeçalhos na ordem exata. Valores com sufixo `_CENTAVOS` são inteiros; `CNPJ`, `CODIGO`, `EAN`, `CEP` e IDs são texto. `REGRAS_UF` permite SP, PR, SC e as demais UFs; `UFS_ATENDIDAS=*` aceita todas por padrão.

| Aba | Uso |
| --- | --- |
| CONFIG / REGRAS_UF | Ambiente, limites e atendimento por estado |
| CLIENTES / CADASTROS_PENDENTES | Cadastro aprovado e solicitações novas |
| PRODUTOS / PRECOS / ESTOQUE / RANKING | Catálogo, tabelas, saldo e Queridinhos |
| PEDIDOS / PEDIDO_ITENS | Cabeçalho e linhas de pedidos de teste |
| LOG_IMPORTACAO | Registro preparado para a futura importação |

## Antes de usar comercialmente

Esta versão **não importa os dados antigos**, não produz PDF nem XLSX, não envia pedidos ao faturamento e ainda não aplica descontos promocionais/por condição. Não altere `AMBIENTE` para `PRODUCAO` enquanto esses fluxos e as regras comerciais não forem implementados e testados. A leitura das abas de produtos ainda precisa ser medida com o volume real; a paginação limita a resposta à tela, mas não elimina a leitura das tabelas na planilha. A contagem de estoque é validada no momento do pedido e não reserva produtos para outros canais.
