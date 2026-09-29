const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({});
for(const f of ['Schema.gs','Core.gs','Catalog.gs'])vm.runInContext(fs.readFileSync(__dirname+'/../gas/'+f,'utf8'),ctx,{filename:f});
assert.deepEqual(Object.keys(ctx.ZAP_SCHEMA),['usuarios','acesso','pedidos','view_bd','financeiro','stq','imagens']);
assert.equal(vm.runInContext("moneyCents_('R$ 1.234,56','preço')",ctx),123456);
assert.equal(vm.runInContext("ufEndereco_('Rua 123, Avaré/SP, 18700-080')",ctx),'SP');
assert.throws(()=>vm.runInContext("ufEndereco_('Rua 123, Avaré')",ctx),/UF não identificada/);
const source={
  stq:[{EAN:'123',COD:'4447',DESCRICAO:'Produto A',TABELA:'T1',ESTOQUE:80,'PRECO VND':35.9,SALDO_STQ:61,MARCA:'Barbours',PACKING:'12'},
    {EAN:'123',COD:'4447',DESCRICAO:'Produto A',TABELA:'T2',ESTOQUE:80,'PRECO VND':42.9,SALDO_STQ:61,MARCA:'Barbours'}],
  imagens:[{Produto:'4447',URL:'https://example.com/4447.jpg'}],
  pedidos:[{CODIGO:'4447',QTDE:3},{CODIGO:'4447',QTDE:2}]
};
ctx.records_=name=>source[name]||[];
const catalog=vm.runInContext("catalogData_({tabela:'T1'})",ctx);
assert.equal(catalog.length,1);assert.equal(catalog[0].precoCentavos,3590);
assert.equal(catalog[0].estoque,61);assert.equal(catalog[0].vendidos,5);
assert.equal(catalog[0].imagem,'https://example.com/4447.jpg');
console.log('Base v3: abas, preço em reais, UF e catálogo por tabela validados.');
