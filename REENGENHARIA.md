# ZAPedido novo: reengenharia da versão Lovable

## Diagnóstico confirmado no repositório

- `src/stores/authStore.ts` consulta FINANCEIRO/302, depois pode recorrer à lista 302 inteira, View_BD inteira e a um cadastro guardado em `localStorage`. Há correspondência permissiva por prefixo de CNPJ. O fluxo também registra acesso no CRM após um temporizador de 20 segundos.
- `docs/google-apps-script.js`: `carregarDados302()` lê `getDataRange().getValues()` da aba financeira para uma consulta individual; `buscarProdutoSTQ()` lê toda STQ a cada busca; `listarPedidos()` lê toda a aba de pedidos.
- `src/pages/PedidosPage.tsx` inicia diversas consultas ao entrar. `src/lib/googleSheetsService.ts` limita GETs a duas consultas concorrentes, permite 60 segundos por tentativa e tenta novamente várias vezes. Isso multiplica a espera percebida.
- A mesma aplicação contém vendedor, CRM, pagamentos, promoções e checkout em `PedidosPage.tsx` com mais de 5.000 linhas. O catálogo e a compra do cliente dependem de caminhos que não usam necessariamente as mesmas regras de preço/estoque.
- O cache do navegador pode reutilizar listas por até 24 horas. Preço e estoque precisam de validação atual no servidor antes de aceitar um pedido.

## Arquitetura proposta

1. **Frontend HTML/CSS/JS em módulos pequenos:** entrada, confirmação, Queridinhos, catálogo, carrinho e histórico. Separar `api`, `sessao`, `catalogo`, `carrinho`, `pedido`, `formatacao` e `ui`; CSS por base e componentes. Exibir 21 produtos por página, carregar imagens sob demanda e renderizar só a página visível. A experiência deve funcionar em celular e desktop, sem dependências visuais pesadas.
2. **GAS exclusivo do ZAPedido, separado por módulos funcionais:** `Config`, `Clientes`, `Catalogo`, `Precos`, `Pedidos`, `Documentos`, `Email` e `Importacao`. Ações pequenas para `identificarCnpj`, `confirmarContato`, `listarQueridinhos`, `listarCatalogo`, `buscarProdutos`, `validarPedido`, `criarPedido`, `consultarPedido` e `reenviarEmail`. Uma ação responde somente com os dados necessários; nenhuma tela pede a lista inteira de clientes ou de pedidos. A opção inicial é servir o HTML pelo próprio Apps Script e usar chamadas assíncronas `google.script.run`, sujeita a medição de desempenho no protótipo.
3. **Planilha operacional nova:** criada por `criarPlanilhaZapNovo()` em `Code.gs`. A planilha antiga é fonte para uma importação controlada, não recebe escritas do novo site. Importações de clientes, catálogo, preços, estoque e ranking serão escritas em lote e registrarão contagem, horário e falhas.
4. **Pedido imutável por versão:** `REQUISICAO_ID` evita duplicações. O GAS busca CNPJ e tabela autorizada, recalcula todos os preços/descontos/quantidades, aplica as regras comerciais e grava cabeçalho e itens sob `LockService`. Documentos e envios têm estados próprios e podem ser reprocessados sem repetir o pedido.
5. **Segurança:** CNPJ identifica a empresa, mas sozinho não prova autorização para ver financeiro, pedidos ou preços. O acesso a dados privados exigirá verificação de contato ou outra credencial; a escolha do método precisa ser validada com a operação. Nunca disponibilizar `listarClientes`, `listarPedidos` global ou ações administrativas em um web app público.

## Abas e chaves

| Aba | Chave | Finalidade |
| --- | --- | --- |
| CLIENTES | CNPJ (14 dígitos como texto) | Cadastro aprovado, tabela, condição e vínculo com vendedor |
| REGRAS_UF | UF (duas letras) | Ativação e condições comerciais específicas por estado |
| CADASTROS_PENDENTES | ID | Dados novos aguardando validação |
| PRODUTOS | CODIGO | Descrição e imagem, sem preço duplicado |
| PRECOS | CODIGO + TABELA | Preço em centavos e promoção |
| ESTOQUE | CODIGO | Quantidade e carimbo da atualização |
| RANKING | CODIGO + PERIODO | Ordenação dos Queridinhos |
| PEDIDOS | PEDIDO_ID; REQUISICAO_ID único | Estado e valores consolidados |
| PEDIDO_ITENS | PEDIDO_ID + CODIGO | Registro do preço e desconto usados no fechamento |
| ENVIO_EMAIL | ENVIO_ID | Destinatário, tentativas e erro de entrega |
| LOG_IMPORTACAO | EXECUCAO_ID | Auditoria da atualização das fontes |

## Regras a fechar antes do checkout

- Novo cliente: a tela anuncia **limite à vista de R$ 350,00**, mas o checkout pede **mínimo de R$ 350,00**. São regras diferentes.
- Condição de pagamento: o PDF anexado exibe `30/45 DIAS` e a observação informa `30/60 DIAS`.
- Documento: o PDF anexo é rotulado **ORÇAMENTO**. Definir quando um orçamento passa a pedido aprovado, e quando itens em ruptura podem ser faturados.
- Importação: o arquivo `.xls` anexo contém HTML, com código, quantidade e preço bruto. A nova exportação deve gerar XLSX verdadeiro e registrar desconto, valor líquido e estado de ruptura conforme o layout exigido pelo faturamento.
- Vendedor: preservar links `?seller=...`, mas confirmar a fonte de `SELLER_ID`, nome e destino de cópia do pedido.
- Método de acesso: validar como cliente novo e cliente existente provam que controlam o contato cadastrado.
- Abrangência: SP, PR, SC e as demais UFs brasileiras são aceitas pelo modelo. `UFS_ATENDIDAS=*` habilita todas; a aba `REGRAS_UF` permite restrições e condições locais. Remover os textos fixos do site atual que dizem atender só SP e PR. Validar UF tanto no cadastro quanto no pedido.

## Migração sem afetar o site em uso

1. Executar `criarPlanilhaZapNovo()` em **um novo projeto Apps Script** e guardar o ID retornado. A função é repetível e recusa cabeçalhos divergentes sem sobrescrevê-los.
2. Mapear cabeçalhos e amostras sem dados sensíveis das fontes atuais FINANCEIRO/302, View_BD, STQ, promoções, imagens e ranking. Construir importadores com conferência de quantidade, CNPJ, código e tabela.
3. Criar as ações de leitura e medir p50/p95 no ambiente de teste; confirmar preço por tabela e catálogo de 21 itens.
4. Implementar autenticação, carrinho, regras comerciais e conclusão; testar reenvio, clique duplo, falha de rede, estoque desatualizado e desconto indevido.
5. Gerar PDF e XLSX a partir do pedido gravado, conferir valores idênticos, e registrar e-mail para faturamento e cliente separadamente.
6. Publicar endereço de teste, comparar pedidos gerados em paralelo com o fluxo antigo e só então trocar o endereço de produção.

## Situação deste marco

O instalador cria apenas o **esquema vazio** da nova base. Ele não importa dados, não publica um site e não envia e-mails. As decisões comerciais acima e o mapeamento das planilhas atuais são pré-requisitos para ativar o checkout.
