# Curto BT — Aceite e Homologação (Etapa 7)

Registro do que foi validado **automaticamente neste ambiente** e do que
**depende de homologação com Supabase** e da **validação manual do
proprietário antes do deploy**. Nenhuma alteração é aplicada em produção
por este processo.

## 1. Validado automaticamente (aqui)

Rodar na raiz do repositório:

```
node test-curto-bt-engine.js   # 26 asserts  (Etapa 1 — motor base)
node test-curto-bt-aceite.js   # 41 asserts  (Etapa 7 — matriz matemática §11)
```

Resultado atual: **26 + 41 = 67 PASS, 0 FAIL**. Cobertura (grupo → status):

| Grupo (§11) | Cobertura automática | Status |
| --- | --- | --- |
| Matemática | transformador; rede infinita/finita (Icc, Scc); gerador; N cabos em série (acumulação); N motores (soma vetorial); faltas 3Φ / 2Φ (=Ik3·√3/2) / fase-retorno; corrente de pico (κ, limites); I²t aprovado/reprovado; PE (10/25/50); fatores cMax/cMin; entradas inválidas (schema, engine, tensão, seção, comprimento, material, tipo de falta) | ✅ |
| Regressão de cabos | Motor de `engenharia.html` (`compute/readInputs/render/recalc/snapshotForm/applySnapshot`, tabelas técnicas) **não foi tocado** em nenhuma etapa — só foram acrescentadas guardas em `_engReabrirCalculo` e `_engDuplicarCalculo`. Evidência: `git diff <base> -- pages/engenharia.html` não contém nenhuma função do motor. | ✅ (por diff) |
| Rollback | O módulo é **aditivo e contido**: iframe, motor, migration e testes são arquivos próprios; a navegação são 3 adições isoladas (router, permissões, catálogo G4B). Reverter as adições da Etapa 3 remove a feature da UI; `DROP TABLE curto_circuito_calculos` (rollback no rodapé da migration) remove os dados. Nenhum módulo/dado existente é afetado. | ✅ (por contenção) |
| Cálculo puro (aceite matemático) | idem "Matemática" | ✅ |

> ⚠️ Nota de calibração (decidida com o proprietário): os alvos originais do
> documento para T-01 (~20,3 kA) e T-02 (~4,26 kA) estavam **errados** e foram
> corrigidos para os valores fisicamente corretos (~31,9 kA e ~8,0 kA). O motor
> implementa a física IEC 60909 correta.

## 2. Depende de homologação com Supabase (NÃO testável aqui)

Estes fluxos exigem a **tabela `curto_circuito_calculos` criada** e uma
**sessão Supabase real** (auth + RLS). Devem ser executados em ambiente de
homologação, com pelo menos **dois usuários** e **duas empresas**.

| Grupo (§11) | Cenário obrigatório | Como validar |
| --- | --- | --- |
| Tenant | Usuário da empresa A não lê/abre/grava/atualiza estudo da empresa B por manipulação de UUID/payload | Logar em A; tentar `abrirNuvem(id_de_B)` — deve retornar vazio (RLS `select empresa`). Conferir que salvar sob empresa B com sessão A falha. |
| Autoria (D3) | Usuário B **não** edita nem exclui estudo criado por A, mesma empresa | Logar em B; abrir estudo de A (SELECT ok — leitura por empresa); tentar salvar (UPDATE) — deve falhar (RLS `update autor`). |
| Contexto (troca de empresa) | Trocar empresa com requisição em andamento nunca renderiza dados do tenant anterior | Abrir lista de nuvem em A, trocar para B rapidamente; a lista/cliente devem refletir só B (token de contexto). |
| Tipo (deep-link cruzado) | Clicar um estudo de curto na ficha do cliente abre no **módulo Curto BT**, não no wizard de cabos; e vice-versa | Na ficha do cliente, criar 1 cabo + 1 curto vinculados; clicar cada um e conferir o módulo de destino. Conferir que reabrir/duplicar um curto pelo Engenharia é recusado/redirecionado. |
| Permissão | Usuário sem acesso não abre a rota; ações respeitam o perfil | Logar com perfil sem `curto-circuito` (ex.: `financeiro`); o item não deve navegar (gate `podeAcessarModulo`). |
| Concorrência | Duas sessões não sobrescrevem silenciosamente a mesma versão | Abrir o mesmo estudo em 2 abas; salvar na 1ª; salvar na 2ª deve avisar **conflito** (filtro por `atualizado_em`). |
| Reidratação | Snapshot salvo volta exatamente ao mesmo estudo e reproduz o mesmo resultado | Salvar na nuvem, recarregar a página, abrir da lista; conferir que entradas e resultados batem. |
| Impressão (visual) | Memorial impresso contém todos os campos (cabeçalho/logo, unifilar, dados, hipóteses, impedâncias, desenvolvimento, resultados, advertências) e **nenhuma** referência a cabos | Clicar "🖨️ Memorial" e conferir o PDF/impressão do navegador (`window.print`). |
| Cliente obrigatório (D5) | Não é possível salvar na nuvem sem cliente | Tentar salvar sem selecionar cliente — deve bloquear. |

## 3. Pré-requisitos e passos antes do deploy (proprietário)

1. **D8 — homologação:** confirmar que existe um projeto Supabase/Vercel de
   homologação separado de produção. Testar a persistência **lá**, nunca em
   produção.
2. **D9 — banco vs migrations:** confirmar que o banco de homologação
   corresponde às migrations `001–067`. Se houver divergência, ela aparece ao
   aplicar a `068`.
3. **Aplicar a migration** `supabase/migrations/068_curto_circuito_calculos.sql`
   **manualmente** no SQL Editor do Supabase (padrão do projeto — o arquivo
   **não** é aplicado automaticamente). Rodar os `SELECT` de verificação do
   rodapé da migration (tabela, policies, índices criados).
4. **Executar a matriz da seção 2** em homologação, com 2 usuários e 2 empresas.
5. **Aprovação manual** do proprietário.
6. **Deploy** por produção somente após aprovação. Rollback: reverter os
   commits da feature e, se necessário, `DROP TABLE curto_circuito_calculos`.

## 4. Itens fora do escopo v1 (evolução futura)

Exclusão de estudo na nuvem (v2 — a policy de DELETE já existe, mas a UI não a
expõe); PDF programático (v1 usa `window.print()`); dark mode no iframe;
seletividade/arco elétrico/redes em malha/paralelismo de transformadores;
contribuição de motor em faltas bifásica/fase-retorno; impedância de cabo entre
motor e barramento. (Ver §12 do documento de requisitos.)
