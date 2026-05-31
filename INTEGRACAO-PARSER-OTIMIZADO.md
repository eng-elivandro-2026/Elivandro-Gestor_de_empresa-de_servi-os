# 🔧 INTEGRAÇÃO DO PARSER OTIMIZADO

## ⚠️ IMPORTANTE

O parser otimizado foi criado e testado com 100% de sucesso!

**Arquivo:** `parser-po-otimizado.js`

## Como Integrar

### Opção 1: MANUAL (Recomendado - 5 minutos)
1. Abra `pages/financeiro.html`
2. Procure pela função `function parsearDadosPO(texto) {` (linha ~13525)
3. **SUBSTITUA TUDO** até o `return dados;` final pela função `parsearDadosPOOtimizado` do arquivo `parser-po-otimizado.js`
4. Renomeie `parsearDadosPOOtimizado` para `parsearDadosPO`
5. Salve o arquivo

### Opção 2: AUTOMÁTICA (Claude Code)
```bash
# Clone a função do arquivo otimizado
cat parser-po-otimizado.js | sed 's/parsearDadosPOOtimizado/parsearDadosPO/g' > temp-parser.js
```

## Validação Pós-Integração

Após integrar:

1. Recarregue a página (Ctrl+R)
2. Carregue um PDF de PO
3. Clique em ✏️ Editar
4. Verifique se **TODOS os campos aparecem preenchidos:**
   - ✅ Número PO
   - ✅ Datas (Criação, Atual)
   - ✅ Comprador (Nome, CNPJ, IE, Endereço, CEP, Cidade)
   - ✅ Vendedor (Nome, CNPJ, IE, CPF, Endereço, CEP, Cidade)
   - ✅ Banco (Nome, Código, Conta)
   - ✅ Contato (Nome, Email, Telefone)
   - ✅ Item (Número, Quantidade, Unidade, Preço)
   - ✅ Descrição, Valor, Condições, Data Entrega
   - ✅ Proposta, Requisitante

## ✅ Resultado Esperado

**37/37 campos extraídos com 100% de sucesso!**

```
Número PO: 5401150125
Data Criação: 08.01.2026
Data Atual: 12.01.2026
Comprador: JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFÉS LTDA
Comprador CNPJ: 02333707003675
Comprador IE: 051345327
Comprador Rua: Rua do Luxemburgo
Comprador Número: 586
Comprador CEP: 41230-130
Comprador Cidade: Salvador
Comprador País: Brazil
Vendedor: Adriano Rodrigues
Vendedor CNPJ: 23624491000147
Vendedor IE: 407537226119
Vendedor CPF: 21786807807
Vendedor Rua: Avenida Armenio Ladeira
Vendedor Número: 245
Vendedor CEP: 13218-310
Vendedor Cidade: Jundiai
Vendedor País: Brazil
Banco: BANCO ITAU S/A
Conta: 49898
Banco Código: 34170026
Número Fornecedor: 199439
Contato: Jessica Fratantonio
Telefone: 11989263010
Email: Jessica.Fratantonio@JDEcoffee.com
Descrição: Adequação no projeto elétrico e pneumático da empacotadora 8
Item: 10
Quantidade: 1,00
Unidade: Activ.unit
Preço: 20.000,00
Data Entrega: 08.01.2026
Valor Total: 20.000,00
Moeda: BRL
Condições: 120 Days from invoice date
Prazos: 120 days
Proposta: T26.01.110A
Requisitante: Bianca Cortegoso
```

## 📞 Suporte

Qualquer dúvida na integração, é só chamar!
