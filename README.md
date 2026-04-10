# Elaborador de Propostas — versão organizada

## Estrutura
- `index.html`: HTML principal limpo, sem CSS inline e sem scripts inline.
- `css/variables.css`: variáveis de tema.
- `css/base.css`: reset, body e estilos base.
- `css/layout.css`: header, layout, cards e grid/form.
- `css/components.css`: botões, badges, dashboard, wizard, escopo e tabelas.
- `css/pages/app.css`: preview, toast, autocomplete e blocos específicos da tela.
- `js/config/supabase.js`: conexão com Supabase.
- `js/core/app-core.js`: lógica principal da aplicação.
- `js/modules/*.js`: módulos separados que antes estavam inline no HTML.
- `original/`: cópia dos 3 arquivos enviados.

## Publicação
Pode subir esta pasta direto para GitHub e conectar na Vercel.

## Observações
- As chaves do Supabase continuam no front-end porque já estavam assim no projeto original.
- Em uma próxima etapa, o ideal é migrar as configs para variáveis de ambiente e revisar RLS no Supabase.
