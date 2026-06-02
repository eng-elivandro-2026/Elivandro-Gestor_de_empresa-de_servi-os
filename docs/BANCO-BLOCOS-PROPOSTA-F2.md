# Banco de Blocos de Proposta — F2 (Carga inicial)

Carga inicial de **blocos reutilizáveis** de proposta técnica/comercial para o
Banco de Blocos (módulo Comercial → 🗂️ Banco de Escopos), implementado na F1.

## Arquivo de dados
- `data/banco-blocos-proposta-inicial.json` — **34 blocos**, todos com `status: "Ativo"`.
  - Inclui `PRA-001` (Prazo e Cronograma), adicionado na F3 para que os Templates de Proposta não fiquem com bloco ausente.

## Como importar
1. Abrir **Comercial → 🗂️ Banco de Escopos**.
2. Clicar em **Importar JSON** e selecionar `data/banco-blocos-proposta-inicial.json`.
3. Na confirmação:
   - **OK / Substituir** → substitui o banco atual pelos 33 blocos.
   - **Cancelar / Mesclar** → mescla com o banco atual. A importação **não duplica**
     blocos com o mesmo **código** já existente como **Ativo** (nem o mesmo `id`).
4. Os blocos aparecem na biblioteca **agrupados por Família**, com filtros por
   Família / Categoria / Tipo / Status e busca por código/título/conteúdo.

> Recomendado fazer um **Exportar JSON** antes de importar com "Substituir", como backup.

## Estrutura de cada bloco
Compatível com a importação da F1. Campos:

| Campo | Descrição |
|---|---|
| `codigo` | Código do bloco (ex.: `ED-05.001`). Único entre blocos Ativos. |
| `familia` | Sigla da família (ex.: `ED`, `PE`, `EXC`). Usada no agrupamento. |
| `categoria` | Categoria livre (ex.: `Serviços / Engenharia e Documentação`). |
| `tipo` | Tipo do bloco — alinhado ao catálogo da F1 (ver nota abaixo). |
| `ordem` | Ordem padrão (numérica) para sequenciar os blocos. |
| `titulo` | Título do bloco. |
| `descricao` | Descrição curta (resumo / cabeçalho da seção). |
| `conteudo` | Texto completo que entra na proposta (aceita quebras de linha). |
| `status` | `Ativo` em todos os blocos desta carga. |
| `observacoes_internas` | Observação interna — **não entra na proposta**. |
| `obs` | Espelho de `observacoes_internas` — campo usado pela importação real da F1. |

### Notas de compatibilidade (sem alterar a lógica da F1)
- A F1 armazena a observação interna no campo **`obs`**. Para garantir que a
  observação seja exibida após a importação **sem alterar o código**, cada bloco
  traz **`observacoes_internas`** (nome do schema) **e** **`obs`** (mesmo texto).
- Os valores de **`tipo`** seguem o catálogo da F1 (sem acento), por ex.
  `Texto tecnico`, `Material / Miscelanea`, `Condicao comercial`, `Exclusao`,
  `Entrega / Aceite`, `Obrigacao da contratada/contratante`, `Identificacao`,
  para que o filtro de Tipo funcione corretamente.
- Famílias não previstas no catálogo visual (ex.: `EXE`, `NOR`, `EP`, `ABT`,
  `LEV`, `ENT`) são tratadas com o próprio código como rótulo (a F1 lida com isso
  graciosamente).

## Texto dos blocos
- Genérico e reutilizável; **sem citar cliente, empresa ou pessoas**.
- Linguagem técnica, clara e comercialmente segura.
- Campos como prazo, validade, garantia e pagamento ficam como condição a
  preencher na negociação.

## Comportamento na proposta
- Ao **Adicionar na Proposta**, cada bloco entra como **cópia local editável**
  (na Etapa 3). Editar o texto na proposta **não altera** o bloco da biblioteca.

## Lista dos 34 blocos
OBJ-001, IE-03.001, EXE-001, TC-01.001, ID-001, ED-05.001, NOR-001, LAY-001,
FDP-001, EP-001, ABT-001, ED-06.001, LEV-001, ID-002, ENT-ED-001, PE-08.001,
LAY-PE-001, ID-003, MAT-PE-001, TC-PE-001, OBR-001, OBR-002, EXC-001, EXC-002,
EXC-ED-001, EXC-ED-002, EXC-PE-001, ENT-001, PRA-001, IMP-001, PAG-001, FOR-001,
VALD-001, GAR-001.

## Observações
- Esta fase é **somente dados/documentação**: não altera banco, migration, RLS,
  schema, cálculo financeiro nem a lógica da F1.
