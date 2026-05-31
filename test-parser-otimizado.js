// Importar parser
const fs = require('fs');

// Copiar função do parser otimizado
function parsearDadosPOOtimizado(texto) {
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
    condicoes_pagamento: '',
    prazos: '',
    item_numero: '',
    item_tipo: '',
    descricao: '',
    item_quantidade: '',
    item_unidade: '',
    item_preco_unitario: '',
    data_entrega: '',
    valor_total: '',
    moeda: 'BRL',
    requisitante: '',
    proposta: ''
  };

  var m = texto.match(/Pedido de Compra\s+(\d+)/);
  if (m) dados.numero_po = m[1];

  m = texto.match(/Data de Criação\s+([\d.]+)/);
  if (m) dados.data_criacao = m[1];

  m = texto.match(/Data Atual\s+([\d.]+)/);
  if (m) dados.data_atual = m[1];

  var compradorSeção = texto.match(/Comprador\s+([\s\S]*?)Vendedor/);
  if (compradorSeção) {
    var comp = compradorSeção[1];
    m = comp.match(/^([^\n]+)/);
    if (m) dados.comprador_nome = m[1].trim();
    m = comp.match(/([A-Z][a-z\s]+),\s*(\d+)/);
    if (m) {
      dados.comprador_rua = m[1].trim();
      dados.comprador_numero = m[2];
    }
    m = comp.match(/(\d{5}-\d{3}),\s*([A-Za-z]+)/);
    if (m) {
      dados.comprador_cep = m[1];
      dados.comprador_cidade = m[2];
    }
    m = comp.match(/^([A-Za-z]+),/m);
    if (m) dados.comprador_pais = m[1];
    m = comp.match(/CNPJ:\s*(\d+)/);
    if (m) dados.comprador_cnpj = m[1];
    m = comp.match(/Inscrição Estadual:\s*(\d+)/);
    if (m) dados.comprador_ie = m[1];
  }

  var vendedorSeção = texto.match(/Vendedor\s+([\s\S]*?)(?:Por favor enviar|Contato do Comprador)/);
  if (vendedorSeção) {
    var vend = vendedorSeção[1];
    m = vend.match(/^([A-Z][a-z\s]+)\s+(\d+)/m);
    if (m) {
      dados.vendedor_rua = m[1].trim();
      dados.vendedor_numero = m[2];
    }
    m = vend.match(/(\d{5}-\d{3})\s+([A-Za-z]+)/);
    if (m) {
      dados.vendedor_cep = m[1];
      dados.vendedor_cidade = m[2];
    }
    m = vend.match(/Brazil|Brasil/i);
    if (m) dados.vendedor_pais = 'Brazil';
    m = vend.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)\s+\d/);
    if (m) dados.vendedor_nome = m[1];
    m = vend.match(/^([A-Za-z\s]+\s+)?(\d{10,11})/m);
    if (m) dados.vendedor_cpf = m[2];
    m = vend.match(/CNPJ\s+(\d+)/);
    if (m) dados.vendedor_cnpj = m[1];
    m = vend.match(/Inscrição Estadual\s+(\d+)/);
    if (m) dados.vendedor_ie = m[1];
    m = vend.match(/Nome do banco\s+([A-Z][A-Za-z\s\.]+)/);
    if (m) dados.banco = m[1].trim();
    m = vend.match(/Conta\s+(\d+)/);
    if (m) dados.conta = m[1];
    m = vend.match(/Banco\s+(\d+)(?:\s|$)/);
    if (m) dados.banco_codigo = m[1];
    m = vend.match(/Número do Fornecedor\s+(\d+)/);
    if (m) dados.vendedor_numero_fornecedor = m[1];
  }

  m = texto.match(/Contato do Comprador\s+([A-Za-z\s]+)/);
  if (m) dados.contato_nome = m[1].trim();

  m = texto.match(/Telefone\s+([\d\s\-\(\)]+)/);
  if (m) dados.contato_telefone = m[1].trim();

  m = texto.match(/E-mail\s+([\w\.\-]+@[\w\.\-]+)/);
  if (m) dados.contato_email = m[1];

  m = texto.match(/Adequação[^\n]+/i);
  if (m) dados.descricao = m[0].trim();

  m = texto.match(/Proposta:\s+([A-Z\d.]+)/);
  if (m) dados.proposta = m[1];

  m = texto.match(/Requisitante:\s+([A-Za-z\s]+)/);
  if (m) dados.requisitante = m[1].trim();

  m = texto.match(/Condições de pagamento\s+(.+?)(?:\n|$)/);
  if (m) dados.condicoes_pagamento = m[1].trim();

  m = texto.match(/(\d+)\s+Days from invoice date/);
  if (m) dados.prazos = m[1] + ' days';

  m = texto.match(/Item\s+Material\s+Quantidade\s+Unidade[\s\S]*?(\d+)\s+([0-9.,]+)\s+([A-Za-z\.]+)\s+([\d.,]+)/);
  if (m) {
    dados.item_numero = m[1];
    dados.item_quantidade = m[2];
    dados.item_unidade = m[3];
    dados.item_preco_unitario = m[4];
  }

  m = texto.match(/Data de entrega\s+([\d.]+)/);
  if (m) dados.data_entrega = m[1];

  m = texto.match(/Preço Bruto Total\s+([\d.,]+)/);
  if (m) dados.valor_total = m[1];

  if (!dados.valor_total) {
    m = texto.match(/(\d{1,3}[.,]\d{3}[.,]\d{2})/);
    if (m) dados.valor_total = m[1];
  }

  m = texto.match(/Moeda\s+([A-Z]{3})/);
  if (m) dados.moeda = m[1];

  Object.keys(dados).forEach(key => {
    if (typeof dados[key] === 'string') {
      dados[key] = dados[key]
        .replace(/[\n\r]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  });

  return dados;
}

// Ler arquivo com texto do PDF
const textoPDF = fs.readFileSync('teste-texto-po.txt', 'utf-8');

console.log('════════════════════════════════════════════════════════════');
console.log('🧪 TESTE PARSER OTIMIZADO - Texto Real do PDF');
console.log('════════════════════════════════════════════════════════════\n');

const resultado = parsearDadosPOOtimizado(textoPDF);

const campos = [
  'numero_po', 'data_criacao', 'data_atual',
  'comprador_nome', 'comprador_cnpj', 'comprador_ie', 'comprador_rua', 'comprador_numero', 'comprador_cep', 'comprador_cidade',
  'vendedor_nome', 'vendedor_cnpj', 'vendedor_ie', 'vendedor_cpf', 'vendedor_rua', 'vendedor_numero', 'vendedor_cep', 'vendedor_cidade',
  'banco', 'conta', 'banco_codigo', 'vendedor_numero_fornecedor',
  'contato_nome', 'contato_telefone', 'contato_email',
  'descricao', 'item_numero', 'item_quantidade', 'item_unidade', 'item_preco_unitario',
  'data_entrega', 'valor_total', 'moeda', 'condicoes_pagamento', 'prazos', 'proposta', 'requisitante'
];

let preenchidos = 0;
let vazios = 0;

console.log('✅ CAMPOS EXTRAÍDOS:\n');
campos.forEach(campo => {
  const valor = resultado[campo];
  if (valor && valor.toString().trim()) {
    console.log(`  ✅ ${campo.padEnd(30)} : ${valor}`);
    preenchidos++;
  } else {
    console.log(`  ❌ ${campo.padEnd(30)} : [vazio]`);
    vazios++;
  }
});

console.log('\n════════════════════════════════════════════════════════════');
console.log(`\n📊 RESULTADO: ${preenchidos}/${campos.length} campos preenchidos`);
console.log(`✅ Taxa de sucesso: ${((preenchidos/campos.length)*100).toFixed(1)}%\n`);
console.log('════════════════════════════════════════════════════════════');
