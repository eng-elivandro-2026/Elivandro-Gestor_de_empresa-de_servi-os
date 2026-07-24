/**
 * PARSER OTIMIZADO PARA PO - VERSÃO MELHORADA
 * Com todas as 10 correções obrigatórias
 */

function parsearDadosPO(texto) {
  console.log('🔍 PARSER OTIMIZADO v2 - Extraindo e normalizando dados...');

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
    descricao_item: '',
    item_quantidade: '',
    item_unidade: '',
    item_preco_unitario: '',
    data_entrega: '',
    valor_total: '',
    moeda: 'BRL',
    requisitante: '',
    proposta: '',
    local_entrega: ''
  };

  // ════════════════════════════════════════════════════════════════════
  // HELPER: Normalizar datas de DD.MM.AAAA para AAAA-MM-DD
  // ════════════════════════════════════════════════════════════════════
  function normalizarData(dataStr) {
    if (!dataStr) return '';
    var match = dataStr.match(/(\d{2})[\.\-\/](\d{2})[\.\-\/](\d{4})/);
    if (match) {
      return match[3] + '-' + match[2] + '-' + match[1];
    }
    return dataStr;
  }

  // ════════════════════════════════════════════════════════════════════
  // HELPER: Normalizar valores brasileiros "20.000,00" => 20000.00
  // ════════════════════════════════════════════════════════════════════
  function normalizarValor(valorStr) {
    if (!valorStr) return '0.00';
    valorStr = String(valorStr).trim();
    // Remove "R$"
    valorStr = valorStr.replace(/R\$\s*/g, '');
    // Converte 20.000,00 => 20000.00
    valorStr = valorStr.replace(/\./g, ''); // Remove pontos (separador de milhar)
    valorStr = valorStr.replace(',', '.'); // Converte vírgula em ponto
    return parseFloat(valorStr).toFixed(2);
  }

  // ════════════════════════════════════════════════════════════════════
  // HELPER: Normalizar CNPJ removendo pontuação
  // ════════════════════════════════════════════════════════════════════
  function normalizarCNPJ(cnpjStr) {
    if (!cnpjStr) return '';
    return cnpjStr.replace(/\D/g, '');
  }

  // ════════════════════════════════════════════════════════════════════
  // 1. IDENTIFICAÇÃO
  // ════════════════════════════════════════════════════════════════════

  var m = texto.match(/Pedido de Compra\s+(\d+)/);
  if (m) dados.numero_po = m[1];

  m = texto.match(/Data de Cria[çc][ãa]o\s+([\d.]+)/);
  if (m) dados.data_criacao = normalizarData(m[1]);

  m = texto.match(/Data Atual\s+([\d.]+)/);
  if (m) dados.data_atual = normalizarData(m[1]);

  // ════════════════════════════════════════════════════════════════════
  // 2. BLOCO COMPRADOR
  // ════════════════════════════════════════════════════════════════════

  var compradorSeção = texto.match(/Comprador\s+([\s\S]*?)Vendedor/);
  if (compradorSeção) {
    var comp = compradorSeção[1];

    m = comp.match(/^([^\n]+)/);
    if (m) dados.comprador_nome = m[1].trim();

    m = comp.match(/Rua ([^\n,]+),\s*(\d+)/i);
    if (m) {
      dados.comprador_rua = 'Rua ' + m[1].trim();
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
    if (m) dados.comprador_cnpj = normalizarCNPJ(m[1]);

    m = comp.match(/Inscrição Estadual:\s*(\d+)/);
    if (m) dados.comprador_ie = m[1];
  }

  // ════════════════════════════════════════════════════════════════════
  // 3. BLOCO VENDEDOR
  // ════════════════════════════════════════════════════════════════════

  var vendedorSeção = texto.match(/Vendedor\s+([\s\S]*?)(?:Por favor enviar|Contato do Comprador|Por favor entregar)/);
  if (vendedorSeção) {
    var vend = vendedorSeção[1];

    // Nome Pessoa: "Adriano Rodrigues" + CPF
    m = vend.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(\d{8,11})/);
    if (m) {
      dados.vendedor_nome = m[1];
      dados.vendedor_cpf = m[2];
    }

    m = vend.match(/^(Avenida Armenio Ladeira|Avenida [^\n]+)\s+(\d+)/m);
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

    m = vend.match(/CNPJ\s+(\d+)/);
    if (m) dados.vendedor_cnpj = normalizarCNPJ(m[1]);

    m = vend.match(/Inscrição Estadual\s+(\d+)/);
    if (m) dados.vendedor_ie = m[1];

    m = vend.match(/Nome do banco\s+([A-Z][A-Za-z\s\.]+?)(?:\n|Conta)/);
    if (m) dados.banco = m[1].trim();

    m = vend.match(/Conta\s+(\d+)/);
    if (m) dados.conta = m[1];

    m = vend.match(/Banco\s+(\d+)(?:\s|$)/);
    if (m) dados.banco_codigo = m[1];

    m = vend.match(/Número do Fornecedor\s+(\d+)/);
    if (m) dados.vendedor_numero_fornecedor = m[1];
  }

  // ════════════════════════════════════════════════════════════════════
  // 4. BLOCO CONTATO
  // ════════════════════════════════════════════════════════════════════

  m = texto.match(/Contato do Comprador\s+([A-Za-z\s]+?)(?:\n|Telefone)/);
  if (m) dados.contato_nome = m[1].trim();

  m = texto.match(/Telefone\s+([\d\s\-\(\)]+)/);
  if (m) dados.contato_telefone = m[1].trim();

  m = texto.match(/E-mail\s+([\w\.\-]+@[\w\.\-]+)/);
  if (m) dados.contato_email = m[1];

  // ════════════════════════════════════════════════════════════════════
  // 5. BLOCO ENTREGA
  // ════════════════════════════════════════════════════════════════════

  var entregaSeção = texto.match(/Por favor entregar em:([\s\S]*?)(?:Adequação|Proposta|Descrição|Condições)/);
  if (entregaSeção) {
    var entrega = entregaSeção[1];
    dados.local_entrega = entrega.trim().split('\n').slice(0, 4).join(', ').replace(/\s+/g, ' ');
  }

  // ════════════════════════════════════════════════════════════════════
  // 6. DESCRIÇÃO GERAL E PROPOSTA
  // ════════════════════════════════════════════════════════════════════

  m = texto.match(/Adequação[^\n]+/i);
  if (m) dados.descricao = m[0].trim();

  m = texto.match(/Proposta:\s+([A-Z\d.]+)/);
  if (m) dados.proposta = m[1];

  m = texto.match(/Requisitante:\s+([A-Za-z\s]+?)(?:\n|$)/);
  if (m) dados.requisitante = m[1].trim();

  // ════════════════════════════════════════════════════════════════════
  // 7. CONDIÇÕES DE PAGAMENTO E PRAZOS
  // ════════════════════════════════════════════════════════════════════

  m = texto.match(/Condi[çc][ãa]es de pagamento\s+(.+?)(?:\n|$)/);
  if (m) dados.condicoes_pagamento = m[1].trim();

  m = texto.match(/(\d+)\s+Days from invoice date/);
  if (m) dados.prazos = m[1] + ' days';

  // ════════════════════════════════════════════════════════════════════
  // 8. BLOCO ITENS - Por padrão, extrai primeira linha da tabela
  // ════════════════════════════════════════════════════════════════════

  m = texto.match(/Item\s+Material\s+Quantidade\s+Unidade[\s\S]*?(\d+)\s+([0-9.,]+)\s+([A-Za-z\.]+)\s+([\d.,]+)/);
  if (m) {
    dados.item_numero = m[1];
    dados.item_quantidade = m[2];
    dados.item_unidade = m[3];
    dados.item_preco_unitario = normalizarValor(m[4]);
  }

  // ════════════════════════════════════════════════════════════════════
  // 9. DESCRIÇÃO DO ITEM (SEPARADA)
  // ════════════════════════════════════════════════════════════════════

  m = texto.match(/Descri[çc][ãa]o\s+([A-Za-z\s\-áéíóúâêô]+)/i);
  if (m) dados.descricao_item = m[1].trim();

  // ════════════════════════════════════════════════════════════════════
  // 10. DATA DE ENTREGA (DA TABELA)
  // ════════════════════════════════════════════════════════════════════

  m = texto.match(/Data de entrega[\s\S]*?([\d]{2}\.[\d]{2}\.[\d]{4})/);
  if (m) dados.data_entrega = normalizarData(m[1]);

  // ════════════════════════════════════════════════════════════════════
  // 11. VALORES FINAIS
  // ════════════════════════════════════════════════════════════════════

  // Procurar Preço Bruto Total em múltiplos padrões
  m = texto.match(/Preço Bruto Total\s+([\d.,]+)/i);
  if (m) dados.valor_total = normalizarValor(m[1]);

  // Se não encontrar, tentar padrão alternativo "Valor Total Bruto"
  if (!dados.valor_total) {
    m = texto.match(/Valor Total Bruto\s+([\d.,]+)/i);
    if (m) dados.valor_total = normalizarValor(m[1]);
  }

  // CORREÇÃO OBRIGATÓRIA #9: Se valor_total for vazio ou 0,00 mas existir preco_unitario, usar este
  if ((!dados.valor_total || dados.valor_total === '0.00') && dados.item_preco_unitario && dados.item_preco_unitario !== '0.00') {
    console.warn('⚠️ Valor total não encontrado, usando preço unitário:', dados.item_preco_unitario);
    dados.valor_total = dados.item_preco_unitario;
  }

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

  console.log('📊 RESUMO - DADOS EXTRAÍDOS E NORMALIZADOS:');
  console.log('  ✅ PO:', dados.numero_po);
  console.log('  ✅ Data Criação (normalizada):', dados.data_criacao);
  console.log('  ✅ Comprador:', dados.comprador_nome);
  console.log('  ✅ CNPJ (normalizado):', dados.comprador_cnpj);
  console.log('  ✅ Vendedor:', dados.vendedor_nome);
  console.log('  ✅ Valor Total (normalizado):', dados.valor_total);
  console.log('  ✅ Data Entrega (normalizada):', dados.data_entrega);
  console.log('  ✅ Banco:', dados.banco);
  console.log('  ✅ Número Fornecedor:', dados.vendedor_numero_fornecedor);
  console.log('📋 COMPLETO:', dados);

  return dados;
}
