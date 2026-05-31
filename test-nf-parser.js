const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');

// Lê o XML de teste
const xml = fs.readFileSync('C:\Users\eliva\Downloads\370.xml', 'utf8');
const xmlDoc = new DOMParser().parseFromString(xml, 'text/xml');

// Extrai NF-e standard
var nNF = xmlDoc.getElementsByTagName('Numero')[0]?.textContent || '';
var dhEmi = xmlDoc.getElementsByTagName('DataEmissao')[0]?.textContent?.substring(0,10) || '';
var vNF = parseFloat(xmlDoc.getElementsByTagName('ValorLiquidoNfse')[0]?.textContent || 0);

// Extrai prestador/empresa
var prestador = xmlDoc.getElementsByTagName('RazaoSocial')[0]?.textContent || '';
var cnpjPrestador = xmlDoc.getElementsByTagName('Cnpj')[0]?.textContent || '';
var enderecoPrestador = xmlDoc.getElementsByTagName('Endereco')[0]?.getElementsByTagName('Endereco')[0]?.textContent || '';
var numeroPrestador = xmlDoc.getElementsByTagName('Endereco')[0]?.getElementsByTagName('Numero')[0]?.textContent || '';
var bairroPrestador = xmlDoc.getElementsByTagName('Endereco')[0]?.getElementsByTagName('Bairro')[0]?.textContent || '';
var cepPrestador = xmlDoc.getElementsByTagName('Endereco')[0]?.getElementsByTagName('Cep')[0]?.textContent || '';
var emailPrestador = xmlDoc.getElementsByTagName('Email')[0]?.textContent || '';
var telefonePrestador = xmlDoc.getElementsByTagName('Telefone')[0]?.textContent || '';

// Extrai tomador/cliente
var allRazoes = xmlDoc.getElementsByTagName('RazaoSocial');
var tomador = allRazoes.length > 1 ? allRazoes[1].textContent : '';
var cnpjTomador = xmlDoc.getElementsByTagName('CpfCnpj')[1]?.getElementsByTagName('Cnpj')[0]?.textContent || '';

// Extrai serviço/descrição
var descricao = xmlDoc.getElementsByTagName('Discriminacao')[0]?.textContent || '';
var aliquota = xmlDoc.getElementsByTagName('Aliquota')[0]?.textContent || '';
var baseCalculo = xmlDoc.getElementsByTagName('BaseCalculo')[0]?.textContent || vNF;

console.log('✅ EXTRAÇÃO DE DADOS DO XML:');
console.log('NF:', nNF);
console.log('Data:', dhEmi);
console.log('Valor:', vNF);
console.log('Prestador:', prestador);
console.log('CNPJ Prestador:', cnpjPrestador);
console.log('Endereço:', enderecoPrestador, numeroPrestador);
console.log('Bairro:', bairroPrestador);
console.log('CEP:', cepPrestador);
console.log('Email:', emailPrestador);
console.log('Telefone:', telefonePrestador);
console.log('Tomador:', tomador);
console.log('CNPJ Tomador:', cnpjTomador);
console.log('Descrição:', descricao.substring(0, 50) + '...');
console.log('Alíquota:', aliquota);
console.log('Base Cálculo:', baseCalculo);
