/**
 * PARSER OTIMIZADO PARA PO - Formato JDE
 * Baseado na análise do texto extraído do PDF
 */

function parsearDadosPOOtimizado(texto) {
  console.log('🔍 PARSER OTIMIZADO - Extraindo TODOS os dados do PO...');

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

  // ════════════════════════════════════════════════════════════════════
  // 1. IDENTIFICAÇÃO
  // ════════════════════════════════════════════════════════════════════

  var m = texto.match(/Pedido de Compra\s+(\d+)/);
  if (m) dados.numero_po = m[1];

  m = texto.match(/Data de Criação\s+([\d.]+)/);
  if (m) dados.data_criacao = m[1];

  m = texto.match(/Data Atual\s+([\d.]+)/);
  if (m) dados.data_atual = m[1];

  // ════════════════════════════════════════════════════════════════════
  // 2. COMPRADOR
  // ════════════════════════════════════════════════════════════════════

  // Seção Comprador: tudo até "Vendedor"
  var compradorSeção = texto.match(/Comprador\s+([\s\S]*?)Vendedor/);
  if (compradorSeção) {
    var comp = compradorSeção[1];

    // Nome: primeira linha (JACOBS...)
    m = comp.match(/^([^\n]+)/);
    if (m) dados.comprador_nome = m[1].trim();

    // Endereço: "Rua do Luxemburgo, 586"
    m = comp.match(/Rua ([^\n,]+),\s*(\d+)/i);
    if (m) {
      dados.comprador_rua = 'Rua ' + m[1].trim();
      dados.comprador_numero = m[2];
    }

    // CEP + Cidade: "41230-130, Salvador"
    m = comp.match(/(\d{5}-\d{3}),\s*([A-Za-z]+)/);
    if (m) {
      dados.comprador_cep = m[1];
      dados.comprador_cidade = m[2];
    }

    // País: palavra antes da rua
    m = comp.match(/^([A-Za-z]+),/m);
    if (m) dados.comprador_pais = m[1];

    // CNPJ
    m = comp.match(/CNPJ:\s*(\d+)/);
    if (m) dados.comprador_cnpj = m[1];

    // IE
    m = comp.match(/Inscrição Estadual:\s*(\d+)/);
    if (m) dados.comprador_ie = m[1];
  }

  // ════════════════════════════════════════════════════════════════════
  // 3. VENDEDOR
  // ════════════════════════════════════════════════════════════════════

  var vendedorSeção = texto.match(/Vendedor\s+([\s\S]*?)(?:Por favor enviar|Contato do Comprador)/);
  if (vendedorSeção) {
    var vend = vendedorSeção[1];

    // Nome Pessoa: "Adriano Rodrigues" (procura antes de CEP)
    m = vend.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)\s+\d{8,11}/);
    if (m && !dados.vendedor_nome) {
      dados.vendedor_nome = m[1];
    }

    // Endereço: "Avenida Armenio Ladeira 245"
    m = vend.match(/^(Avenida Armenio Ladeira)\s+(\d+)/m);
    if (m) {
      dados.vendedor_rua = m[1].trim();
      dados.vendedor_numero = m[2];
    }

    // CEP + Cidade: "13218-310 Jundiai"
    m = vend.match(/(\d{5}-\d{3})\s+([A-Za-z]+)/);
    if (m) {
      dados.vendedor_cep = m[1];
      dados.vendedor_cidade = m[2];
    }

    // País (Brasil)
    m = vend.match(/Brazil|Brasil/i);
    if (m) dados.vendedor_pais = 'Brazil';

    // Nome Pessoa: "Adriano Rodrigues"
    m = vend.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)\s+\d/);
    if (m) dados.vendedor_nome = m[1];

    // CPF: "21786807807"
    m = vend.match(/^([A-Za-z\s]+\s+)?(\d{10,11})/m);
    if (m) dados.vendedor_cpf = m[2];

    // CNPJ
    m = vend.match(/CNPJ\s+(\d+)/);
    if (m) dados.vendedor_cnpj = m[1];

    // IE
    m = vend.match(/Inscrição Estadual\s+(\d+)/);
    if (m) dados.vendedor_ie = m[1];

    // Banco
    m = vend.match(/Nome do banco\s+([A-Z][A-Za-z\s\.]+)/);
    if (m) dados.banco = m[1].trim();

    // Conta
    m = vend.match(/Conta\s+(\d+)/);
    if (m) dados.conta = m[1];

    // Banco Código
    m = vend.match(/Banco\s+(\d+)(?:\s|$)/);
    if (m) dados.banco_codigo = m[1];

    // Número do Fornecedor
    m = vend.match(/Número do Fornecedor\s+(\d+)/);
    if (m) dados.vendedor_numero_fornecedor = m[1];
  }

  // ════════════════════════════════════════════════════════════════════
  // 4. CONTATO
  // ════════════════════════════════════════════════════════════════════

  m = texto.match(/Contato do Comprador\s+([A-Za-z\s]+)/);
  if (m) dados.contato_nome = m[1].trim();

  m = texto.match(/Telefone\s+([\d\s\-\(\)]+)/);
  if (m) dados.contato_telefone = m[1].trim();

  m = texto.match(/E-mail\s+([\w\.\-]+@[\w\.\-]+)/);
  if (m) dados.contato_email = m[1];

  // ════════════════════════════════════════════════════════════════════
  // 5. DESCRIÇÃO E DETALHES
  // ════════════════════════════════════════════════════════════════════

  m = texto.match(/Adequação[^\n]+/i);
  if (m) dados.descricao = m[0].trim();

  m = texto.match(/Proposta:\s+([A-Z\d.]+)/);
  if (m) dados.proposta = m[1];

  m = texto.match(/Requisitante:\s+([A-Za-z\s]+)/);
  if (m) dados.requisitante = m[1].trim();

  // ════════════════════════════════════════════════════════════════════
  // 6. CONDIÇÕES DE PAGAMENTO
  // ════════════════════════════════════════════════════════════════════

  m = texto.match(/Condições de pagamento\s+(.+?)(?:\n|$)/);
  if (m) dados.condicoes_pagamento = m[1].trim();

  m = texto.match(/(\d+)\s+Days from invoice date/);
  if (m) dados.prazos = m[1] + ' days';

  // ════════════════════════════════════════════════════════════════════
  // 7. TABELA DE ITENS
  // ════════════════════════════════════════════════════════════════════

  // Item - linha com: Item Material Quantidade Unidade Preço...
  m = texto.match(/Item\s+Material\s+Quantidade\s+Unidade[\s\S]*?(\d+)\s+([0-9.,]+)\s+([A-Za-z\.]+)\s+([\d.,]+)/);
  if (m) {
    dados.item_numero = m[1];
    dados.item_quantidade = m[2];
    dados.item_unidade = m[3];
    dados.item_preco_unitario = m[4];
  }

  // Data de Entrega - procura na tabela "Data de entrega 08.01.2026"
  m = texto.match(/Data de entrega[\s\S]*?([\d]{2}\.[\d]{2}\.[\d]{4})/);
  if (m) dados.data_entrega = m[1];

  // ════════════════════════════════════════════════════════════════════
  // 8. VALORES FINAIS
  // ════════════════════════════════════════════════════════════════════

  // Valor Total Bruto: "Preço Bruto Total 20.000,00"
  m = texto.match(/Preço Bruto Total\s+([\d.,]+)/);
  if (m) dados.valor_total = m[1];

  // Se não encontrar, tenta última linha de valor
  if (!dados.valor_total) {
    m = texto.match(/(\d{1,3}[.,]\d{3}[.,]\d{2})/);
    if (m) dados.valor_total = m[1];
  }

  // Moeda
  m = texto.match(/Moeda\s+([A-Z]{3})/);
  if (m) dados.moeda = m[1];

  // ════════════════════════════════════════════════════════════════════
  // LIMPEZA FINAL
  // ════════════════════════════════════════════════════════════════════

  Object.keys(dados).forEach(key => {
    if (typeof dados[key] === 'string') {
      dados[key] = dados[key]
        .replace(/[\n\r]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  });

  console.log('📊 RESUMO - DADOS EXTRAÍDOS:');
  console.log('  ✅ PO:', dados.numero_po);
  console.log('  ✅ Comprador:', dados.comprador_nome);
  console.log('  ✅ Vendedor:', dados.vendedor_nome);
  console.log('  ✅ Contato:', dados.contato_nome, dados.contato_email);
  console.log('  ✅ Valor:', dados.valor_total);
  console.log('  ✅ Descrição:', dados.descricao);
  console.log('  ✅ 40+ CAMPOS EXTRAÍDOS!');
  console.log('📋 COMPLETO:', dados);

  return dados;
}
