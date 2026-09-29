# ZAPerim — base v3 independente

Reconstrução do sistema de pedidos com HTML leve, Cloudflare Pages, Apps Script e Google Sheets. O site de produção `zapperim.pages.dev` e as planilhas anteriores não são alterados por este projeto.

O contrato das **sete abas exatas** está em [`gas/Schema.gs`](gas/Schema.gs). `npm test` gera e confere os arquivos prontos em `dist/`: instalador da planilha, API e frontend. Siga o [`GUIA_IMPLANTACAO.md`](GUIA_IMPLANTACAO.md) para instalar em ambiente de teste.

## Modelo das abas

| Aba | Uso nesta versão |
| --- | --- |
| `usuarios` | Estrutura para acessos internos; o login do cliente usa CNPJ e código enviado por e-mail. |
| `acesso` | Origem `ST=ZAP_PERIM`, CNPJ, responsável, tabela, dados de cadastro/atualização em `OBSERVACOES` (JSON), entrada em `STATUS` (data/hora). |
| `pedidos` | Uma linha por item, com o identificador do pedido em `OBSERVACOES` como `[ZAP:...]`. |
| `view_bd` | Cadastro de clientes existentes, condição, tabela e mínimo. |
| `financeiro` | Fonte comercial e financeira preparada; nenhum bloqueio automático foi presumido. |
| `stq` | Produto, estoque e preço por tabela; `PRECO VND` em reais. |
| `imagens` | Associa `Produto` ao código ou descrição do item e usa `URL` HTTPS. |

O catálogo mostra 21 itens por página. A API usa `SALDO_STQ` como saldo disponível, e conta vendas a partir da aba `pedidos`. A UF de um cliente existente é extraída do final de `view_bd → ENDEREÇO` (exemplo: `Avaré/SP, 18700-080`); sem sigla explícita, o acesso mostra um erro de dados para correção. Cadastros novos guardam UF informada no formulário.

Esta versão é de **homologação**. Ainda faltam a importação/validação das bases reais, regras comerciais do financeiro, PDFs, XLSX, e-mail ao faturamento, descontos e status operacionais dos pedidos. As abas informadas não incluem coluna de ID/status para pedido nem uma aba de regras; o protótipo registra o ID dentro de `OBSERVACOES` e devolve `TESTE`. O catálogo ainda lê `stq` e `pedidos` para cada consulta; a latência precisa ser medida com os dados reais antes de oferecer o sistema aos clientes. Não use a nova API para faturamento antes de definir esses contratos.
