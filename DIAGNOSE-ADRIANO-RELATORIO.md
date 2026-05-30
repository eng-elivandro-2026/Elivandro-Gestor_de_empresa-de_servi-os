# DIAGNÓSTICO: Apontamentos do Adriano com TOTAL R$ 0,00

**Data do Diagnóstico:** 2026-05-30  
**Objetivo:** Investigar por que apontamentos aparecem com TOTAL R$ 0,00 mesmo com valor/hora cadastrado

## 1. FLUXO DE CARREGAMENTO DE VALOR/HORA (Análise de Código)

### 1.1 Função `carregarColabs()` (linha 313-373)

O RH carrega colaboradores em 3 passos:

```
Passo 1: Busca vínculos em colaborador_empresas
         ├─ Seleciona: colaborador_id, valor_hora, ...
         └─ Filtra: empresa_id = atual, ativo = true

Passo 2: Busca dados em colaboradores
         └─ Seleciona: * (incluindo valor_hora global)

Passo 3: Mescla com PRIORIDADE de empresa
         └─ valor_hora = colaborador_empresas.valor_hora OU colaboradores.valor_hora
```

**Código relevante (linha 365):**
```javascript
valor_hora: (o.valor_hora != null) ? o.valor_hora : c.valor_hora,
```

Hierarquia:
1. `colaborador_empresas.valor_hora` (vínculo com empresa) — **PRIORIDADE 1**
2. `colaboradores.valor_hora` (global) — **FALLBACK**

### 1.2 Função `salvarApontamento()` (linha 3077-3109)

Ao salvar um apontamento:

```javascript
var vh = colab ? (colab.valor_hora||0) : 0;  // linha 3078
// ... validação com alerta se vh === 0 (linhas 3083-3086)
var calc = calcularHorasCLT(..., vh, ...);   // linha 3088
var row = Object.assign({
  valor_hora_base: vh,                        // linha 3104
  ...
}, calc);  // merge com calc que contém valor_total
```

**Fluxo:**
1. Obtém `colab.valor_hora` (0 se não encontrado)
2. Se `vh === 0`, mostra alerta (implementado em FASE RH-VALOR-HORA-C)
3. Calcula com `calcularHorasCLT(vh=0)` → todos os cálculos resultam em 0
4. Salva `valor_hora_base: 0` e `valor_total: 0`

## 2. ROOT CAUSE (CAUSA RAIZ)

**CENÁRIO IDENTIFICADO:**

Os apontamentos do Adriano aparecem com `TOTAL R$ 0,00` porque:

### Cenário A: Valor/Hora NÃO Cadastrado na Data do Apontamento
- Datas dos apontamentos: 26/05/2026, 27/05/2026
- Data de cadastro de valor/hora: POSTERIOR às datas dos apontamentos
- Quando o apontamento foi salvo, `colaborador_empresas.valor_hora = NULL`
- Quando o apontamento foi salvo, `colaboradores.valor_hora = NULL`
- Resultado: `vh = 0` (fallback) → `valor_total = 0` (matemática: horas × 0 = 0)

### Cenário B: Valor/Hora Cadastrado em Campo Diferente
- Valor de R$ 150,00 foi cadastrado em `colaboradores.valor_hora`
- Mas `colaborador_empresas.valor_hora` não foi preenchido
- E o vínculo NÃO foi sincronizado com o novo valor

### Verificação Necessária no Banco:
```sql
-- Consultar dados do Adriano
SELECT 
  c.id,
  c.nome,
  c.valor_hora AS valor_global,
  ce.valor_hora AS valor_empresa
FROM colaboradores c
LEFT JOIN colaborador_empresas ce ON c.id = ce.colaborador_id
WHERE c.nome ILIKE '%adriano%';

-- Consultar apontamentos problemáticos
SELECT 
  a.id,
  a.data,
  a.horas_total,
  a.valor_hora_base,
  a.valor_total
FROM apontamentos a
WHERE a.colaborador_id = (SELECT id FROM colaboradores WHERE nome ILIKE '%adriano%')
  AND a.data IN ('2026-05-26', '2026-05-27')
ORDER BY a.data;
```

## 3. CÁLCULO ESPERADO vs REALIDADE

### Esperado (com valor_hora = R$ 150,00):
- **26/05/2026:** 9h × R$ 150,00 = **R$ 1.350,00**
- **27/05/2026:** 9h × R$ 150,00 = **R$ 1.350,00**
- **TOTAL:** **R$ 2.700,00**

### Realidade (com valor_hora = 0):
- **26/05/2026:** 9h × R$ 0,00 = **R$ 0,00**
- **27/05/2026:** 9h × R$ 0,00 = **R$ 0,00**
- **TOTAL:** **R$ 0,00**

## 4. DIAGRAMA DO PROBLEMA

```
Timeline:
├─ 26/05/2026, 09:00 → Adriano trabalha 9h
│                      ├─ valor_hora em colaboradores: NULL
│                      ├─ valor_hora em colaborador_empresas: NULL
│                      └─ Apontamento SALVO com vh=0 → valor_total=0 ❌
│
├─ 27/05/2026, 09:00 → Adriano trabalha 9h
│                      ├─ valor_hora em colaboradores: NULL
│                      ├─ valor_hora em colaborador_empresas: NULL
│                      └─ Apontamento SALVO com vh=0 → valor_total=0 ❌
│
└─ [DATA POSTERIOR] → Gestor cadastra valor_hora = R$ 150,00
                      ├─ colaboradores.valor_hora = 150 OU
                      └─ colaborador_empresas.valor_hora = 150
                      
RESULTADO: Apontamentos antigos com valor_total=0 não são atualizados automaticamente
```

## 5. SQL PARA DIAGNOSTICAR (SEM EXECUTAR)

### Verificar dados do Adriano:
```sql
-- Colaborador Adriano
SELECT id, nome, valor_hora 
FROM colaboradores 
WHERE nome ILIKE '%adriano%';

-- Vínculo com empresa
SELECT ce.id, c.nome, ce.valor_hora, e.nome as empresa
FROM colaborador_empresas ce
JOIN colaboradores c ON c.id = ce.colaborador_id
JOIN empresas e ON e.id = ce.empresa_id
WHERE c.nome ILIKE '%adriano%';

-- Apontamentos de 26/05 e 27/05
SELECT 
  a.id,
  a.data,
  a.hora_entrada,
  a.hora_saida,
  a.horas_total,
  a.valor_hora_base,
  a.valor_total,
  a.status
FROM apontamentos a
WHERE a.colaborador_id = (SELECT id FROM colaboradores WHERE nome ILIKE '%adriano%')
  AND a.data IN ('2026-05-26', '2026-05-27')
ORDER BY a.data, a.hora_entrada;
```

## 6. SQL PARA CORRIGIR (SEM EXECUTAR AINDA)

### ⚠️ IMPORTANTE: SÓ EXECUTAR APÓS CONFIRMAÇÃO

```sql
-- PASSO 1: Verificar quantos apontamentos serão afetados
SELECT COUNT(*) as total_apontamentos_afetados
FROM apontamentos a
WHERE a.colaborador_id = (SELECT id FROM colaboradores WHERE nome ILIKE '%adriano%')
  AND a.valor_total = 0
  AND a.valor_hora_base = 0;

-- PASSO 2: Simular atualização (SEM FAZER UPDATE)
SELECT 
  a.id,
  a.data,
  a.horas_total,
  0 as vh_atual,
  150 as vh_novo,
  (a.horas_total * 150) as valor_total_novo
FROM apontamentos a
WHERE a.colaborador_id = (SELECT id FROM colaboradores WHERE nome ILIKE '%adriano%')
  AND a.data IN ('2026-05-26', '2026-05-27')
  AND a.valor_total = 0;

-- PASSO 3: ATUALIZAR (SOMENTE APÓS APROVAÇÃO EXPLÍCITA)
-- UPDATE apontamentos
-- SET valor_hora_base = 150,
--     valor_total = horas_total * 150,
--     atualizado_em = now(),
--     atualizado_por = auth_usuario_id()
-- WHERE colaborador_id = (SELECT id FROM colaboradores WHERE nome ILIKE '%adriano%')
--   AND data IN ('2026-05-26', '2026-05-27')
--   AND valor_total = 0;

-- PASSO 4: Verificar resultado
-- SELECT id, data, horas_total, valor_hora_base, valor_total
-- FROM apontamentos
-- WHERE colaborador_id = (SELECT id FROM colaboradores WHERE nome ILIKE '%adriano%')
--   AND data IN ('2026-05-26', '2026-05-27');
```

## 7. RESUMO DO DIAGNÓSTICO

| Item | Status | Detalhes |
|------|--------|----------|
| **Código de cálculo** | ✓ Correto | Usa `valor_hora` de `_colabs`, que tem hierarquia correta |
| **Alerta implementado** | ✓ Sim | Avisa quando `vh === 0` (FASE RH-VALOR-HORA-C) |
| **Problema identificado** | ✓ Sim | Apontamentos salvos COM `valor_hora = 0` nas datas 26-27/05 |
| **Causa provável** | ✓ Identificada | `valor_hora` não estava cadastrado quando apontamentos foram salvos |
| **Solução** | Proposta | UPDATE dos apontamentos com `valor_hora_base = 150` e recálculo de `valor_total` |
| **Risco de perda de dados** | ✗ Baixo | Apontamentos têm horas registradas, apenas valores zerados |
| **Validação anterior a UPDATE** | ✓ Necessária | Conferir valor_hora de Adriano em colaborador_empresas/colaboradores |

## 8. PRÓXIMAS AÇÕES

1. **Executar diagnóstico no banco** (Supabase):
   - Confirmar `colaborador_empresas.valor_hora` para Adriano
   - Confirmar `colaboradores.valor_hora` para Adriano
   - Listar apontamentos de 26-27/05 com valores

2. **Validar apontamentos**:
   - Confirmar que `horas_total` está preenchido corretamente
   - Confirmar que faltam apenas `valor_hora_base` e `valor_total`

3. **Executar correção** (após aprovação):
   - UPDATE com transação (para reversibilidade)
   - Validar com SELECT pós-update
   - Registrar em comentário da correção

4. **Implementar prevenção**:
   - Validação de `valor_hora` antes de salvar apontamento (já feito via alerta)
   - Considerar RLS para garantir `valor_hora` obrigatório antes de INSERT

---

**Status:** Diagnóstico concluído  
**Autorização solicitada para:** Executar UPDATE de correção  
**Estimado de apontamentos afetados:** Mínimo 2 (26/05 e 27/05)
