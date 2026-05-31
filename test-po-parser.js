const fs = require('fs');
const path = require('path');

// Função parsearDadosPO (copiada do sistema)
function parsearDadosPO(texto) {
  console.log('🔍 Parseando dados da PO - EXTRAINDO TODOS OS 40+ CAMPOS...\n');

  var dados = {
    numero_po: '',
    data_criacao: '',
    data_atual: '',
    comprador_nome: '',
    comprador_cnpj: '',
    comprador_ie: '',
    comprador_rua: '',
    comprador_numero: '',
    comprador_cep: '',
    comprador_cidade: '',
    comprador_pais: '',
    vendedor_nome: '',
    vendedor_cnpj: '',
    vendedor_ie: '',
    vendedor_cpf: '',
    vendedor_rua: '',
    vendedor_numero: '',
    vendedor_cep: '',
    vendedor_cidade: '',
    vendedor_pais: '',
    vendedor_numero_fornecedor: '',
    banco: '',
    banco_codigo: '',
    conta: '',
    agencia: '',
    contato_nome: '',
    contato_telefone: '',
    contato_email: '',
    item_numero: '',
    item_tipo: '',
    descricao: '',
    item_quantidade: '',
    item_unidade: '',
    item_preco_unitario: '',
    data_entrega: '',
    prazos: '',
    valor_total: '',
    moeda: 'BRL'
  };

  // IDENTIFICAÇÃO
  var matchPO = texto.match(/Número[:\s]*([A-Z0-9\-]+)/i);
  if (matchPO) dados.numero_po = matchPO[1];

  if (!dados.numero_po) {
    var matchPO2 = texto.match(/PO[:\s]*(\d+)/i);
    if (matchPO2) dados.numero_po = matchPO2[1];
  }

  var matchDataCriacao = texto.match(/Data de Cria[çc][ãa]o[:\s]+([\d./-]+)/i);
  if (matchDataCriacao) dados.data_criacao = matchDataCriacao[1];

  var matchDataAtual = texto.match(/Data Atual[:\s]+([\d./-]+)/i);
  if (matchDataAtual) dados.data_atual = matchDataAtual[1];

  // COMPRADOR
  if (texto.includes('JACOBS')) {
    dados.comprador_nome = 'JACOBS DOUWE EGBERTS BR COMERCIALIZAÇÃO DE CAFÉS LTDA';
  }

  var matchCompradorCNPJ = texto.match(/COMPRADOR[\s\S]*?CNPJ[:\s]*(\d+)/i);
  if (matchCompradorCNPJ) dados.comprador_cnpj = matchCompradorCNPJ[1];

  var matchCompradorIE = texto.match(/Inscrição Estadual[:\s]*(\d+)/i);
  if (matchCompradorIE) dados.comprador_ie = matchCompradorIE[1];

  var matchCompradorRua = texto.match(/(?:Rua|Avenida)[:\s]*([^,]+),\s*(\d+)/);
  if (matchCompradorRua) {
    dados.comprador_rua = matchCompradorRua[1].trim();
    dados.comprador_numero = matchCompradorRua[2];
  }

  var matchCompradorCEP = texto.match(/CEP[:\s]*(\d{5}-?\d{3})/i);
  if (matchCompradorCEP) dados.comprador_cep = matchCompradorCEP[1];

  var matchCompradorCidade = texto.match(/Cidade[:\s]*([A-ZÀ-Ü][A-Za-zÀ-ü\s]+)/i);
  if (matchCompradorCidade) dados.comprador_cidade = matchCompradorCidade[1].trim();

  var matchCompradorPais = texto.match(/País[:\s]*([A-Za-zÀ-ü\s]+)/i);
  if (matchCompradorPais) dados.comprador_pais = matchCompradorPais[1].trim();

  // VENDEDOR
  var matchVendedorNome = texto.match(/VENDEDOR[:\s]*([A-ZÀ-Ü][A-Za-zÀ-ü\s\d\-\.&]+?)(?:CNPJ|$)/i);
  if (matchVendedorNome) dados.vendedor_nome = matchVendedorNome[1].trim();

  var matchVendedorCNPJ = texto.match(/VENDEDOR[\s\S]*?CNPJ[:\s]*(\d+)/i);
  if (matchVendedorCNPJ) dados.vendedor_cnpj = matchVendedorCNPJ[1];

  var matchVendedorIE = texto.match(/VENDEDOR[\s\S]*?Inscrição Estadual[:\s]*(\d+)/i);
  if (matchVendedorIE) dados.vendedor_ie = matchVendedorIE[1];

  var matchVendedorCPF = texto.match(/VENDEDOR[\s\S]*?CPF[:\s]*(\d+)/i);
  if (matchVendedorCPF) dados.vendedor_cpf = matchVendedorCPF[1];

  var matchVendedorRua = texto.match(/VENDEDOR[\s\S]*?(?:Avenida|Rua)[:\s]*([^,]+),\s*(\d+)/i);
  if (matchVendedorRua) {
    dados.vendedor_rua = matchVendedorRua[1].trim();
    dados.vendedor_numero = matchVendedorRua[2];
  }

  var matchVendedorCEP = texto.match(/VENDEDOR[\s\S]*?CEP[:\s]*(\d{5}-?\d{3})/i);
  if (matchVendedorCEP) dados.vendedor_cep = matchVendedorCEP[1];

  var matchVendedorCidade = texto.match(/VENDEDOR[\s\S]*?Cidade[:\s]*([A-ZÀ-Ü][A-Za-zÀ-ü\s]+?)(?:País|$)/i);
  if (matchVendedorCidade) dados.vendedor_cidade = matchVendedorCidade[1].trim();

  var matchVendedorPais = texto.match(/VENDEDOR[\s\S]*?País[:\s]*([A-Za-zÀ-ü\s]+)/i);
  if (matchVendedorPais) dados.vendedor_pais = matchVendedorPais[1].trim();

  var matchNumeroFornecedor = texto.match(/Número do Fornecedor[:\s]*(\d+)/i);
  if (matchNumeroFornecedor) dados.vendedor_numero_fornecedor = matchNumeroFornecedor[1];

  // BANCO
  var matchBanco = texto.match(/Nome do Banco[:\s]*([A-Za-zÀ-ü\s]+?)(?:\n|Código|$)/i);
  if (matchBanco) dados.banco = matchBanco[1].trim();

  var matchBancoCodigo = texto.match(/Código Banco[:\s]*(\d+)/i);
  if (matchBancoCodigo) dados.banco_codigo = matchBancoCodigo[1];

  var matchConta = texto.match(/Conta[:\s]*(\d+[\-\d]*)/i);
  if (matchConta) dados.conta = matchConta[1];

  var matchAgencia = texto.match(/Agência[:\s]*([0-9\-X]+)/i);
  if (matchAgencia) dados.agencia = matchAgencia[1];

  // CONTATO
  var matchContatoNome = texto.match(/CONTATO[\s\S]*?Nome[:\s]*([A-ZÀ-Ü][A-Za-zÀ-ü\s]+?)(?:Telefone|$)/i);
  if (matchContatoNome) dados.contato_nome = matchContatoNome[1].trim();

  var matchTelefone = texto.match(/Telefone[:\s]*(\(?[\d\s\-\)]+)/i);
  if (matchTelefone) dados.contato_telefone = matchTelefone[1].trim();

  var matchEmail = texto.match(/Email[:\s]*([\w\.\-]+@[\w\.\-]+)/i);
  if (matchEmail) dados.contato_email = matchEmail[1];

  // DESCRIÇÃO
  var matchDescricao = texto.match(/DESCRIÇÃO[:\s]*([\s\S]*?)(?:ITENS|DADOS|$)/i);
  if (matchDescricao) dados.descricao = matchDescricao[1].trim().substring(0, 300);

  // ITENS
  var matchItem = texto.match(/Item[:\s]*(\d+)/i);
  if (matchItem) dados.item_numero = matchItem[1];

  var matchTipo = texto.match(/Material[:\s]*([A-Za-zÀ-ü\s]+?)(?:Quantidade|$)/i);
  if (matchTipo) dados.item_tipo = matchTipo[1].trim();

  var matchQtd = texto.match(/Quantidade[:\s]*([0-9.,]+)/i);
  if (matchQtd) dados.item_quantidade = matchQtd[1];

  var matchUnit = texto.match(/Unidade[:\s]*([A-Za-z]+)/i);
  if (matchUnit) dados.item_unidade = matchUnit[1];

  var matchPrecoUnit = texto.match(/Preço Bruto[:\s]*([0-9.,]+)/i);
  if (matchPrecoUnit) dados.item_preco_unitario = matchPrecoUnit[1];

  // COMERCIAL
  var matchValor = texto.match(/Valor Total Bruto[:\s]*R\$\s*([\d.,]+)/i);
  if (matchValor) dados.valor_total = matchValor[1];

  var matchCondicoes = texto.match(/Condições de Pagamento[:\s]*([^\n]+)/i);
  if (matchCondicoes) dados.condicoes_pagamento = matchCondicoes[1].trim();

  var matchEntrega = texto.match(/Data de Entrega[:\s]+([\d./-]+)/i);
  if (matchEntrega) dados.data_entrega = matchEntrega[1];

  var matchPrazo = texto.match(/Prazo[:\s]*(\d+)\s*dias/i);
  if (matchPrazo) dados.prazos = matchPrazo[1] + ' dias';

  // LIMPEZA FINAL: remover quebras de linha desnecessárias
  Object.keys(dados).forEach(key => {
    if (typeof dados[key] === 'string') {
      dados[key] = dados[key]
        .replace(/[\n\r]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  });

  return dados;
}

// ═══════════════════════════════════════════════════════════════
// TESTA A EXTRAÇÃO
// ═══════════════════════════════════════════════════════════════

const textoArquivo = fs.readFileSync('po-teste-completo.txt', 'utf-8');
const dados = parsearDadosPO(textoArquivo);

console.log('════════════════════════════════════════════════════════════');
console.log('📊 RESULTADO DA EXTRAÇÃO - 40+ CAMPOS');
console.log('════════════════════════════════════════════════════════════\n');

// Verificar quais campos foram extraídos
const camposEsperados = [
  'numero_po', 'data_criacao', 'data_atual',
  'comprador_nome', 'comprador_cnpj', 'comprador_ie', 'comprador_rua', 'comprador_numero', 'comprador_cep', 'comprador_cidade', 'comprador_pais',
  'vendedor_nome', 'vendedor_cnpj', 'vendedor_ie', 'vendedor_cpf', 'vendedor_rua', 'vendedor_numero', 'vendedor_cep', 'vendedor_cidade', 'vendedor_pais', 'vendedor_numero_fornecedor',
  'banco', 'banco_codigo', 'conta', 'agencia',
  'contato_nome', 'contato_telefone', 'contato_email',
  'item_numero', 'item_tipo', 'descricao', 'item_quantidade', 'item_unidade', 'item_preco_unitario',
  'data_entrega', 'prazos', 'valor_total', 'moeda'
];

let preenchidos = 0;
let vazios = 0;

console.log('🔍 VERIFICAÇÃO CAMPO POR CAMPO:\n');

camposEsperados.forEach(campo => {
  const valor = dados[campo];
  if (valor && valor.toString().trim() !== '') {
    console.log(`✅ ${campo.padEnd(30)} : ${valor}`);
    preenchidos++;
  } else {
    console.log(`❌ ${campo.padEnd(30)} : [não extraído]`);
    vazios++;
  }
});

console.log('\n════════════════════════════════════════════════════════════');
console.log(`\n📈 RESUMO: ${preenchidos}/${camposEsperados.length} campos extraídos com sucesso`);
console.log(`✅ Taxa de sucesso: ${((preenchidos/camposEsperados.length)*100).toFixed(1)}%\n`);

if (vazios > 0) {
  console.log(`⚠️  ${vazios} campo(s) não extraído(s) - revisar regex\n`);
}

console.log('════════════════════════════════════════════════════════════');
console.log('\n📋 DADOS COMPLETOS EM JSON:\n');
console.log(JSON.stringify(dados, null, 2));
