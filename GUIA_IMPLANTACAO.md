# Implantação da base v3 para homologação

O endereço atual `zapperim.pages.dev` continua em produção. Esta instalação usa uma **planilha nova** e um projeto Pages separado. O código reconhece a nova planilha pela propriedade `ZAP_BASE_V3_ID`; nunca usa a propriedade da base anterior.

## 1. Criar a planilha com o GAS

1. Crie um **projeto Apps Script novo** em [script.google.com](https://script.google.com/), na conta que vai ser proprietária da planilha.
2. Copie o conteúdo completo de [`dist/GAS_INSTALAR_PLANILHA.gs`](dist/GAS_INSTALAR_PLANILHA.gs) para um arquivo `.gs` e o de [`dist/GAS_API_ZAPPERIM.gs`](dist/GAS_API_ZAPPERIM.gs) para outro **no mesmo projeto**. Remova versões anteriores desses arquivos e a `myFunction` padrão. Os arquivos em `gas/` são somente o código modular de origem.
3. Salve e execute `instalarZapperim` no editor. Autorize a criação da planilha. O Registro de execução traz a URL da nova planilha **ZAPerim - Base v3 - homologação**.
4. Confira as sete abas: `usuarios`, `acesso`, `pedidos`, `view_bd`, `financeiro`, `stq`, `imagens`. Os cabeçalhos são idênticos aos de [`gas/Schema.gs`](gas/Schema.gs), inclusive `RESONSAVEL`, `CNPJ/CPF`, `PED. MÍNIMO`, `PRECO VND` e `DTPed`. Reexecutar o instalador preserva os dados; um cabeçalho divergente provoca erro antes de sobrescrevê-lo.
5. Publique como **Aplicativo da Web**, execução como você, acesso para qualquer pessoa, e use a URL `/exec`. Ela deve responder `{"api":3,"revision":"v3-ufs-local-20260929","connected":true,"status":"ready"}`. Se editar o GAS depois de publicar, vá a **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar** para atualizar a mesma URL.

## 2. Alimentar a base de teste

- `view_bd`: CNPJ com 14 dígitos, cliente, telefone, `E-MAIL`, tabela e condição. Informe a UF de forma explícita **no final** de `ENDEREÇO`, como `Rua X, Avaré/SP, 18700-080`. `PED. MÍNIMO` é tratado como reais; o pedido fica bloqueado se estiver vazio.
- `stq`: uma linha por `COD` e `TABELA`, sem duplicatas. `PRECO VND` em reais com centavos; `SALDO_STQ` é a quantidade disponível usada para impedir pedidos acima do estoque. `EAN`, descrição, marca e packing são opcionais no catálogo.
- `imagens`: `Produto` igual ao `COD` ou à descrição em `stq`; `URL` HTTPS. A aba `pedidos` alimenta a tag de quantidade vendida.
- `acesso`: o aplicativo registra `ST=ZAP_PERIM`, todos os dados de cadastro/atualização em `OBSERVACOES` (JSON) e data/hora da entrada em `STATUS`.
- `financeiro` e `usuarios`: crie ou importe os dados respeitando os cabeçalhos. O fluxo do cliente ainda não usa `LOGIN`/`SENHA` nem aplica bloqueio por saldo ou crédito sem sua regra comercial.

Para **cadastro novo** e pedido em teste, defina as propriedades do script `ZAP_PEDIDO_MINIMO_CENTAVOS_V3` e `ZAP_LIMITE_NOVO_CENTAVOS_V3` com valores inteiros em centavos. Exemplo: `35000` representa R$ 350,00. Para usar uma tabela diferente de `NOVO`, defina `ZAP_TABELA_NOVO_V3`. Para limitar estados, `ZAP_UFS_ATENDIDAS_V3` aceita uma lista como `SP,PR,SC`; vazia aceita todas as UFs. `ZAP_AMBIENTE_V3` é iniciado como `HOMOLOGACAO` e os pedidos permanecem `TESTE` nesta versão.

## 3. Publicar a interface em um projeto Cloudflare separado

1. Extraia o pacote completo no Windows, mantendo `INSTALAR_ZAPPERIM_WINDOWS.bat`, `tools/`, `functions/` e `dist/` juntos. É necessário Node.js LTS.
2. Execute o `.bat`. Ele gera os arquivos, autoriza o Wrangler, cria um projeto Pages de nome exclusivo `zapperim-perim-...`, configura o segredo **`GAS_WEB_APP_URL_V3`** e publica. Se quiser preencher a URL sem digitar, crie `GAS_WEB_APP_URL_V3.txt` na pasta com somente a nova URL `/exec`. O arquivo anterior `GAS_WEB_APP_URL.txt` **não é usado** nesta versão.
3. Mantenha `PAGES_PROJECT_NAME.txt` para que futuras execuções atualizem o mesmo projeto. Após `Deployment complete!`, o instalador mostra `https://<nome-do-projeto>.pages.dev/` e o teste `/api/health`. A Cloudflare também mostra a URL individual da implantação no resultado do Wrangler. O esperado em health é `api:3`, `revision:v3-ufs-local-20260929`, `connected:true`, `status:ready`. `gas_outdated` indica que a URL `/exec` ainda aponta para uma versão antiga do Apps Script: substitua os dois arquivos GAS e atualize a implantação existente para **Nova versão**. A lista de projetos da Cloudflare pode demorar a refletir a criação; a consulta de confirmação não interrompe mais uma publicação concluída.

O projeto Pages usa Direct Upload; ele não altera o domínio atual nem sincroniza automaticamente com o GitHub. O código da API `/exec` é público, mas o acesso aos dados é verificado por código enviado ao e-mail do cadastro.

## Pendências antes da produção

É preciso validar os formatos da base real e a extração da UF, confirmar a semântica de `ST`, `SALDO_STQ`, `PED. MÍNIMO`, `ATENDIMENTO` e condições de pagamento, além de definir ID/status formal de pedido. PDF, XLSX, envio ao faturamento, descontos, promoções e reservas de estoque não estão implementados. Mantenha a operação real no site anterior até esses fluxos serem validados.
