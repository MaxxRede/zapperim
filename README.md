# ZAPerim

Nova implementação do ZAPedido, independente do sistema em produção.

## Objetivo

Construir o atendimento de clientes e os pedidos com HTML, CSS e JavaScript em módulos pequenos, uma planilha Google exclusiva e um projeto Apps Script próprio. O catálogo terá paginação de 21 produtos, e preço e estoque serão revalidados no servidor ao concluir cada pedido. A cobertura por UF é configurável, inclusive SP, PR e SC.

## Conteúdo inicial

- `Code.gs`: instalador da estrutura vazia da planilha operacional. Ainda não é a API de pedidos.
- `REENGENHARIA.md`: diagnóstico do sistema atual, modelo de dados, decisões pendentes e etapas de migração.

## Isolamento

Este projeto não usa a planilha de produção para escrita. Não publique o novo fluxo para clientes nem importe dados reais antes de revisar o mapeamento das fontes, regras comerciais e autenticação. O sistema atual permanece ativo durante o desenvolvimento e a comparação de resultados.

## Próximo marco

Definir as regras de pedido mínimo e limite para cliente novo, obter o layout definitivo do XLSX do faturamento e mapear as planilhas atuais. Depois, implementar a importação em lote e os endpoints de leitura, medir o tempo das consultas e iniciar as telas HTML.
