# 🧪 Testes: Função de Deletar Assinaturas

## Checklist de Testes Manuais

### ✅ Teste 1: Deletar Assinatura de Documento Assinado
- [ ] Abra um documento **com assinaturas visíveis** (cliente + empresa)
- [ ] Console: `opGestaoLimparAssinaturasCompleto()`
- [ ] Clique **OK** no dialog
- [ ] **Resultado esperado:** 
  - Mensagem de sucesso aparece
  - Página recarrega
  - ✅ Assinaturas **desaparecem** completamente
  - ✅ Campo de assinatura fica vazio

### ✅ Teste 2: Limpar Apenas Uma Assinatura
- [ ] Abra um documento **com apenas 1 assinatura** (cliente OU empresa)
- [ ] Console: `opGestaoLimparAssinaturasCompleto()`
- [ ] Clique **OK**
- [ ] **Resultado esperado:**
  - Ambas as assinaturas são limpas (não apenas a visível)
  - Documento fica completamente sem assinaturas

### ✅ Teste 3: Validar Estado em Memória
- [ ] Abra um documento assinado
- [ ] Console: `console.log(state.gestaoDocumento)`
- [ ] Anote os valores de:
  - `assinatura_cliente` (antes)
  - `assinatura_empresa` (antes)
- [ ] Execute: `opGestaoLimparAssinaturasCompleto()` → OK
- [ ] Console: `console.log(state.gestaoDocumento)` (depois)
- [ ] **Resultado esperado:**
  - Todos os campos de assinatura estão **vazios ou null**
  - Status documento mudou para `'rascunho'`
  - Bloqueado = `false`

### ✅ Teste 4: Persistência no Banco
- [ ] Abra documento assinado
- [ ] Delete assinaturas via RPC
- [ ] Página recarrega
- [ ] **Feche a aba**
- [ ] **Abra novamente o mesmo documento**
- [ ] **Resultado esperado:**
  - Assinaturas ainda estão deletadas ✅
  - Não reaparecem após fechar/reabrir

### ✅ Teste 5: Datas de Assinatura
- [ ] Documento assinado mostra datas? (ex: "ASSINADO EM 30/05/2026, 13:45")
- [ ] Delete assinaturas
- [ ] **Resultado esperado:**
  - Datas também desaparecem
  - Campo de data fica vazio

### ✅ Teste 6: Erro Handling - Sem Documento
- [ ] Feche todos os documentos
- [ ] Console: `opGestaoLimparAssinaturasCompleto()`
- [ ] **Resultado esperado:**
  - Mensagem de erro: "Nenhum documento."
  - Sem dialog, sem RPC call

### ✅ Teste 7: Cancelar Dialog
- [ ] Abra documento assinado
- [ ] Console: `opGestaoLimparAssinaturasCompleto()`
- [ ] Clique **CANCELAR** no dialog
- [ ] **Resultado esperado:**
  - Nada acontece
  - Assinaturas permanecem intactas
  - Sem chamada RPC

### ✅ Teste 8: Múltiplos Documentos
- [ ] Abra documento A (assinado)
- [ ] Delete assinaturas → OK
- [ ] Abra documento B (diferente, também assinado)
- [ ] **Resultado esperado:**
  - Documento A: sem assinaturas ✅
  - Documento B: **ainda tem assinaturas** ✅ (não foi afetado)

### ✅ Teste 9: Exportar PDF Após Deletar
- [ ] Abra documento assinado
- [ ] Delete assinaturas
- [ ] Clique em "Exportar PDF"
- [ ] **Resultado esperado:**
  - PDF gerado sem assinaturas
  - Sem erros de renderização

### ✅ Teste 10: Validar RPC Logs
- [ ] F12 → Console
- [ ] Abra documento assinado
- [ ] Execute: `opGestaoLimparAssinaturasCompleto()` → OK
- [ ] **Resultado esperado em Console:**
  ```
  🗑️ Deletando assinaturas: {doc_id: "...", empresa_id: "..."}
  📋 Resposta RPC: {data: {success: true, updated_rows: 1, message: "..."}}
  ✅ RPC executada com sucesso: {success: true, updated_rows: 1, ...}
  🔄 Recarregando página...
  ```

---

## 📊 Resultado Final

| Teste | Status | Observações |
|-------|--------|-------------|
| 1 - Deletar Assinatura | ⏳ | |
| 2 - Limpar Uma Assinatura | ⏳ | |
| 3 - Estado em Memória | ⏳ | |
| 4 - Persistência Banco | ⏳ | |
| 5 - Datas de Assinatura | ⏳ | |
| 6 - Erro Handling | ⏳ | |
| 7 - Cancelar Dialog | ⏳ | |
| 8 - Múltiplos Documentos | ⏳ | |
| 9 - Exportar PDF | ⏳ | |
| 10 - RPC Logs | ⏳ | |

---

## 🚀 Como Executar

1. Abra o portal
2. Navegue para **Operacional** → **Gestão de Negócio**
3. Execute cada teste em ordem
4. Marque ✅ quando passar, ❌ se falhar
5. Anote observações

**Dúvidas? Cole no console:**
```javascript
console.log('Doc ID:', state.gestaoDocumento?.id);
console.log('Empresa:', window._empresaAtiva?.nome_curto);
```
