# PLANO DE CORREÇÃO: Apontamentos do Adriano (R$ 0,00)

**Data:** 2026-05-30  
**Colaborador:** Adriano  
**Problema:** Apontamentos com valor_total = R$ 0,00  
**Causa:** Salvos quando valor_hora_base = 0  
**Solução:** UPDATE com valor_hora_base = R$ 150,00

---

## 📋 PASSO 1: Encontrar o ID do Adriano

```sql
SELECT id, nome, valor_hora FROM colaboradores WHERE nome ILIKE '%adriano%';
```

**O quê:** Localizar o ID exato do Adriano  
**Resultado esperado:** Uma ou mais linhas com nome contendo "Adriano"  
**Ação:** Copie o ID (`adxxxxxx...`) para usar nos passos seguintes

---

## ✅ PASSO 2: SELECT ANTES (Conferência Inicial)

Substitua `ADRIANO_ID` pelo ID obtido no PASSO 1:

```sql
SELECT
  a.id,
  a.colaborador_id,
  a.empresa_id,
  a.data,
  a.horas_normal,
  a.horas_extra_50,
  a.horas_extra_100,
  ROUND((a.horas_normal + a.horas_extra_50 * 1.5 + a.horas_extra_100 * 2)::numeric, 2) as horas_total_calc,
  a.valor_hora_base as valor_hora_base_atual,
  a.valor_total as valor_total_atual,
  a.status,
  a.atualizado_em
FROM apontamentos a
WHERE a.colaborador_id = 'ADRIANO_ID'
  AND a.data IN ('2026-05-26', '2026-05-27')
ORDER BY a.data, a.id;
```

**O quê:** Mostra os dados ATUAIS dos apontamentos problemáticos  
**Esperado:** 
- 2 apontamentos (26/05 e 27/05)
- `valor_hora_base_atual` = 0
- `valor_total_atual` = 0
- `horas_total_calc` = 9 ou outro valor > 0

**Anote:** Os IDs dos apontamentos para referência

---

## 🧮 PASSO 3: Cálculo Esperado

Substitua `ADRIANO_ID`:

```sql
SELECT
  a.id,
  a.data,
  a.horas_normal,
  a.horas_extra_50,
  a.horas_extra_100,
  ROUND((a.horas_normal + a.horas_extra_50 * 1.5 + a.horas_extra_100 * 2)::numeric, 2) as horas_total,
  150 as novo_valor_hora_base,
  ROUND(((a.horas_normal + a.horas_extra_50 * 1.5 + a.horas_extra_100 * 2) * 150)::numeric, 2) as novo_valor_total,
  a.valor_hora_base as valor_hora_atual,
  a.valor_total as valor_total_atual
FROM apontamentos a
WHERE a.colaborador_id = 'ADRIANO_ID'
  AND a.data IN ('2026-05-26', '2026-05-27')
ORDER BY a.data;
```

**O quê:** Simula o cálculo correto ANTES de fazer UPDATE  
**Mostra:** 
- Horas com multiplicadores
- Novo valor_hora_base (150)
- Novo valor_total calculado
- Comparação com valor atual

**Verificar:** Se os valores de `novo_valor_total` fazem sentido

---

## ⚠️ PASSO 4: UPDATE (Correção Transacional)

**IMPORTANTE:** Substitua `ADRIANO_ID`:

```sql
BEGIN;

UPDATE apontamentos
SET
  valor_hora_base = 150,
  valor_total = ROUND(((horas_normal + horas_extra_50 * 1.5 + horas_extra_100 * 2) * 150)::numeric, 2),
  atualizado_em = now(),
  atualizado_por = auth_usuario_id()
WHERE colaborador_id = 'ADRIANO_ID'
  AND data IN ('2026-05-26', '2026-05-27')
  AND valor_hora_base = 0;
```

**O quê:** Executa a correção em transação  
**Segurança:** 
- ✅ `BEGIN;` inicia transação (pode fazer ROLLBACK)
- ✅ Apenas 2 campos alterados (valor_hora_base, valor_total)
- ✅ Horas NÃO são alteradas
- ✅ Status NÃO é alterado
- ✅ Data NÃO é alterada
- ✅ Auditoria ativada (atualizado_em, atualizado_por)

**Resultado esperado:** `UPDATE 2` (2 apontamentos alterados)

---

## ✔️ PASSO 5: SELECT DEPOIS (Verificação Pós-Update)

**ANTES de fazer COMMIT**, execute esta query para validar:

Substitua `ADRIANO_ID`:

```sql
SELECT
  a.id,
  a.data,
  a.horas_normal,
  a.horas_extra_50,
  a.horas_extra_100,
  ROUND((a.horas_normal + a.horas_extra_50 * 1.5 + a.horas_extra_100 * 2)::numeric, 2) as horas_total,
  a.valor_hora_base as novo_valor_hora_base,
  a.valor_total as novo_valor_total,
  a.atualizado_em,
  a.status
FROM apontamentos a
WHERE a.colaborador_id = 'ADRIANO_ID'
  AND a.data IN ('2026-05-26', '2026-05-27')
ORDER BY a.data;
```

**O quê:** Mostra os dados NOVOS (ainda em transação)  
**Verificar:**
- ✅ `novo_valor_hora_base` = 150 (ambos)
- ✅ `novo_valor_total` = esperado (ex: 1350 para 9h)
- ✅ `horas_total` = não alterado
- ✅ `status` = não alterado
- ✅ `atualizado_em` = data/hora atual

**Se tudo correto:** Proceda para COMMIT  
**Se algo errado:** Faça ROLLBACK e investigue

---

## ✅ PASSO 6: COMMIT ou ROLLBACK

### Se valores estão CORRETOS:
```sql
COMMIT;
```

### Se valores estão ERRADOS:
```sql
ROLLBACK;
```

Depois revise a lógica e tente novamente.

---

## 🔍 PASSO 7: SELECT FINAL (Validação Após COMMIT)

**DEPOIS de fazer COMMIT**, execute para confirmar persistência:

Substitua `ADRIANO_ID`:

```sql
SELECT
  a.id,
  a.data,
  a.horas_normal,
  a.horas_extra_50,
  a.horas_extra_100,
  a.valor_hora_base,
  a.valor_total,
  a.status,
  c.nome as colaborador,
  a.atualizado_em,
  a.atualizado_por
FROM apontamentos a
JOIN colaboradores c ON a.colaborador_id = c.id
WHERE a.colaborador_id = 'ADRIANO_ID'
  AND a.data IN ('2026-05-26', '2026-05-27')
ORDER BY a.data;
```

**O quê:** Confirma que dados foram persistidos no banco  
**Esperado:**
- Dados com novos valores (150, 1350, etc)
- `atualizado_em` = timestamp recente
- `atualizado_por` = seu user_id

---

## 📊 RESUMO DO IMPACTO

| Campo | Antes | Depois | Alterado? |
|-------|-------|--------|-----------|
| valor_hora_base | 0 | 150 | ✅ SIM |
| valor_total | 0,00 | 1.350,00* | ✅ SIM |
| horas_normais | 9 | 9 | ❌ NÃO |
| horas_extra_50 | - | - | ❌ NÃO |
| horas_extra_100 | - | - | ❌ NÃO |
| status | pendente | pendente | ❌ NÃO |
| data | 2026-05-26 | 2026-05-26 | ❌ NÃO |
| entrada | XX:XX | XX:XX | ❌ NÃO |
| saída | XX:XX | XX:XX | ❌ NÃO |

*Valor pode variar dependendo de horas_extra_50 e horas_extra_100

### Impacto Financeiro:
- **Apontamento 26/05:** +R$ 1.350,00 (9h × R$ 150)
- **Apontamento 27/05:** +R$ 1.350,00 (9h × R$ 150)
- **TOTAL:** +R$ 2.700,00

---

## 🛡️ RISCO ANALYSIS

**Risco Geral:** ✅ **BAIXO**

### Proteções Ativadas:
- ✅ Transação (COMMIT/ROLLBACK)
- ✅ RLS ativa (só usuários autorizados podem ALTER)
- ✅ Auditoria (atualizado_em, atualizado_por)
- ✅ Condição extra (valor_hora_base = 0) previne atualizar apontamentos já corretos
- ✅ Apenas 2 colunas alteradas (minimiza impacto)
- ✅ Horas não são alteradas (não afeta cálculos históricos)

### Cenários de Rollback:
| Cenário | Ação |
|---------|------|
| Valores calculados errados | ROLLBACK e investigar |
| UPDATE afetou linha incorreta | ROLLBACK e filtro de WHERE |
| Auditoria não funcionou | ROLLBACK e verificar auth |
| Dados não persistiram | ROLLBACK e tentar novamente |

---

## ⚠️ CHECKLIST ANTES DE EXECUTAR

- [ ] Você tem acesso ao Supabase SQL Editor
- [ ] Você executou PASSO 1 e tem o ID do Adriano
- [ ] Você executou PASSO 2 e confirmou que há 2 apontamentos com valor_total = 0
- [ ] Você executou PASSO 3 e confirmou que os cálculos estão corretos
- [ ] Você leu toda esta documentação
- [ ] Você tem autorização expressa para fazer UPDATE (do usuário principal)
- [ ] Você tem backup ou sabe como fazer ROLLBACK

---

## 📝 TEMPLATE SQL COMPLETO

Arquivo separado: `CORRECTION-SQL-TEMPLATE.sql`

Este arquivo contém todas as queries numeradas para executar na sequência correta.

---

## 🚀 PRÓXIMAS AÇÕES

1. **Preparação:**
   - [ ] Leia esta documentação completamente
   - [ ] Acesse Supabase console
   - [ ] Copie o template SQL

2. **Execução:**
   - [ ] Execute PASSO 1 (encontrar Adriano)
   - [ ] Substitua ADRIANO_ID em todas as queries
   - [ ] Execute PASSO 2 (verificar ANTES)
   - [ ] Execute PASSO 3 (simular cálculo)
   - [ ] Execute PASSO 4 (BEGIN + UPDATE)
   - [ ] Execute PASSO 5 (verificar DEPOIS)
   - [ ] Execute PASSO 6 (COMMIT se correto)
   - [ ] Execute PASSO 7 (confirmar final)

3. **Documentação:**
   - [ ] Anote os IDs dos apontamentos corrigidos
   - [ ] Anote os valores antes e depois
   - [ ] Anote a data/hora da execução
   - [ ] Guarde para auditoria

---

**Status:** ✅ Pronto para execução  
**Autorização necessária:** SIM (do usuário principal)  
**Risco:** BAIXO  
**Reversibilidade:** ALTA (transação com ROLLBACK)

