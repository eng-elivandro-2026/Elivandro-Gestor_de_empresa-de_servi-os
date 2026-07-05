// ════════════════════════════════════════════════════════════
// Conteúdo de AJUDA compartilhado (Portal do Colaborador + RH).
// Fonte ÚNICA: editar aqui reflete nos dois lugares.
// Estilos inline com var(--..., fallback) para funcionar nas duas paletas.
// Exposto como window.AJUDA_HTML (string).
// ════════════════════════════════════════════════════════════
(function () {
  // Cores por papel (com fallback caso a paleta não tenha a variável)
  var C = {
    verde:   'var(--green,#3fb950)',
    azul:    'var(--blue,#58a6ff)',
    vermelho:'var(--red,#f85149)',
    roxo:    'var(--purple,#bc8cff)',
    laranja: 'var(--orange,#e8590c)',
    escuro:  '#475569'
  };

  function passo(n, cor, papel, titulo, desc) {
    return ''
      + '<div style="display:flex;gap:.6rem;align-items:flex-start;background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-left:4px solid ' + cor + ';border-radius:8px;padding:.6rem .75rem;margin-bottom:.5rem">'
        + '<div style="flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:' + cor + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem">' + n + '</div>'
        + '<div>'
          + '<div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;margin-bottom:.2rem">'
            + '<span style="font-weight:800;color:var(--text,#e6edf3);font-size:.9rem">' + titulo + '</span>'
            + '<span style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:' + cor + ';border:1px solid ' + cor + ';border-radius:20px;padding:.05rem .45rem;white-space:nowrap">' + papel + '</span>'
          + '</div>'
          + '<div style="font-size:.78rem;color:var(--text2,#8b949e);line-height:1.45">' + desc + '</div>'
        + '</div>'
      + '</div>';
  }

  function faq(p, r) {
    return ''
      + '<div style="margin-bottom:.55rem">'
        + '<div style="font-weight:700;color:var(--text,#e6edf3);font-size:.8rem">' + p + '</div>'
        + '<div style="font-size:.76rem;color:var(--text2,#8b949e);line-height:1.45;margin-top:.1rem">' + r + '</div>'
      + '</div>';
  }

  function etiqueta(txt, cor) {
    return '<div style="display:inline-block;font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#fff;background:' + cor + ';border-radius:6px;padding:.22rem .55rem;margin:1rem 0 .6rem">' + txt + '</div>';
  }

  // ── Fragmento: FLUXO em 6 passos (relevante para os dois portais) ──
  var fluxo = ''
    + '<div style="font-size:1rem;font-weight:800;color:var(--text,#e6edf3);margin-bottom:.15rem">Como funciona: do apontamento ao boletim</div>'
    + '<div style="font-size:.74rem;color:var(--text3,#6e7681);margin-bottom:.8rem">O caminho das horas até o documento assinado.</div>'
    + passo('1', C.verde, 'Colaborador', 'Registra as horas',
        'No portal, escolhe a empresa (se atende mais de uma), seleciona o projeto, informa data/horário/intervalos e descreve o que fez. O sistema calcula horas e valor. Status: <b>PENDENTE</b>.')
    + passo('2', C.azul, 'Gestor', 'Analisa o apontamento',
        'Em <b>RH &rarr; Apontamentos</b>, aprova (vira <b>APROVADO</b>) ou rejeita com motivo (vira <b>REJEITADO</b>).')
    + passo('3', C.vermelho, 'Colaborador', 'Corrige e reenvia',
        'Se rejeitado, vê o motivo e o botão <b>"Corrigir e Reenviar"</b>. Edita e reenvia &rarr; volta a <b>PENDENTE</b>. O histórico fica registrado. (As etapas 2 e 3 se repetem até aprovar.)')
    + passo('4', C.roxo, 'Gestor', 'Gera o boletim',
        'Em <b>Boletins &rarr; Gerar Documento</b>, escolhe colaborador, período e empresa. Junta os apontamentos aprovados num documento (<b>Relatório de Medição de Serviços</b> para MEI/PJ, ou <b>Registro de Jornada</b> para CLT). Status: <b>AGUARDANDO PRESTADOR</b>.')
    + passo('5', C.laranja, 'Prestador e Empresa', 'Assinam com PIN',
        'O prestador assina com PIN de 4 dígitos (gera hash SHA-256 + data/hora). Depois a empresa assina com PIN. Enquanto faltar assinatura, o documento sai com o aviso <b>"SEM VALIDADE"</b>.')
    + passo('6', C.escuro, 'Concluído', 'Boletim válido com QR Code',
        'Com as duas assinaturas, o boletim vira <b>VÁLIDO</b> e ganha um <b>QR Code</b> de validação pública. Pode ser impresso ou salvo em PDF.');

  // ── Fragmento: cabeçalho do FAQ ──
  var faqHeader = ''
    + '<div style="border-top:1px solid var(--border,#30363d);margin-top:.9rem;padding-top:.4rem"></div>'
    + '<div style="font-size:.92rem;font-weight:800;color:var(--text,#e6edf3);margin-top:.4rem">Perguntas frequentes</div>';

  // ── Fragmento: conteúdo do COLABORADOR (etiqueta 🟢 + FAQs) ──
  var colaborador = ''
    + etiqueta('🟢 Para colaboradores', C.verde)
    + faq('Como registro minhas horas?', 'No portal, toque em "Registrar Horas de Hoje", escolha o projeto, preencha horário e descrição, e salve.')
    + faq('Esqueci / quero criar meu PIN, como faço?', 'Vá em <b>Perfil &rarr; Criar/Redefinir PIN de Assinatura</b> e defina 4 dígitos.')
    + faq('Meu apontamento foi rejeitado, o que faço?', 'Abra o apontamento, leia o motivo na caixa vermelha, toque em "Corrigir e Reenviar", ajuste e reenvie.')
    + faq('Por que aparece "SEM VALIDADE" no meu boletim?', 'Porque ainda falta alguma assinatura (sua ou da empresa). Quando as duas forem feitas, o alerta some e o documento fica válido.')
    + faq('Onde vejo meus boletins para assinar?', 'Na aba <b>Boletins</b> do portal. Os que precisam da sua assinatura aparecem com o selo "Assinar".')
    + faq('Por que minha entrada e saída já vêm preenchidas?', 'Porque o gestor configurou seu regime de trabalho com seu horário padrão. Se o horário daquele dia foi diferente, você pode ajustar antes de salvar.')
    + faq('O que é o "tipo do dia"?', 'É a classificação daquele dia: Dia útil (seg-sex), Sábado, Domingo ou Feriado. Isso define se há acréscimos no cálculo das horas. Vem preenchido automaticamente pela data — só ajuste se estiver errado.');

  // ── Fragmento: conteúdo do GESTOR (configurar regime + etiqueta 🔵 + FAQs) ──
  var gestor = ''
    + etiqueta('🔵 Para gestores — Regime de trabalho', C.azul)
    + '<div style="font-weight:800;color:var(--text,#e6edf3);font-size:.86rem;margin-bottom:.35rem">Como configurar o regime de trabalho de um colaborador</div>'
    + '<ol style="margin:0;padding-left:1.15rem;font-size:.78rem;color:var(--text2,#8b949e);line-height:1.55">'
      + '<li>Acesse <b>RH / Equipes &rarr; Colaboradores</b> e clique no colaborador.</li>'
      + '<li>Clique em <b>⚙️ Regime de trabalho</b> no cabeçalho do perfil.</li>'
      + '<li>Escolha o <b>Tipo de escala</b> (5x2 Administrativo, 6x2, 12x36 etc.) — os horários são preenchidos automaticamente.</li>'
      + '<li>Configure o <b>Intervalo de refeição</b>: se desconta almoço, escolha 30min, 1h ou 1h30. Se não desconta, escolha "Não descontar".</li>'
      + '<li>Ajuste o <b>horário de entrada e saída</b> de cada dia da semana se necessário.</li>'
      + '<li>Configure os <b>Acréscimos (%)</b>: percentual de extra para além da jornada, sábado, domingo, feriado e folga trabalhada.</li>'
      + '<li>Para colaboradores <b>MEI/PJ</b>: marque <b>"Aplicar % de extras"</b> se quiser que horas extras sejam calculadas.</li>'
      + '<li>Configure o <b>Adicional noturno</b> se o colaborador trabalha entre 22h e 05h.</li>'
      + '<li>Defina a <b>Vigência</b> (data de início — pode ser retroativa).</li>'
      + '<li>Clique em <b>Salvar regime</b>.</li>'
      + '<li>Após salvar: clique em <b>🔄 Recalcular pendentes</b> ou <b>Recalcular todos</b> para aplicar o regime aos apontamentos já registrados.</li>'
    + '</ol>'
    + etiqueta('🔵 Para gestores', C.azul)
    + faq('Como aprovo ou rejeito um apontamento?', 'Em <b>RH &rarr; Apontamentos</b>, use os botões Aprovar ou Rejeitar. Ao rejeitar, escreva o motivo (mínimo 10 caracteres).')
    + faq('Como gero um boletim?', 'Em <b>RH &rarr; Boletins &rarr; Gerar Documento</b>. Escolha colaborador, período e empresa. O sistema junta os apontamentos aprovados.')
    + faq('O apontamento aparece R$ 0,00, por quê?', 'O colaborador está sem valor/hora cadastrado. Cadastre em <b>Colaboradores &rarr; editar &rarr; Valor/Hora</b>, depois edite e salve o apontamento para recalcular.')
    + faq('Como assino o boletim como empresa?', 'Abra o boletim em <b>RH &rarr; Boletins</b> e assine com seu PIN de gestor. (Crie o PIN no próprio modal se ainda não tiver.)')
    + faq('Como cancelo / excluo um boletim?', 'Abra o boletim e use "Cancelar Documento": OK cancela mantendo histórico, ou Cancelar exclui em definitivo.')
    + faq('Como vejo o histórico de um apontamento rejeitado?', 'No apontamento, toque em "Histórico" (📜) para ver todo o ciclo de rejeição/reenvio com datas e responsáveis.')
    + faq('Como o sistema calcula as horas extras?', 'O sistema usa o horário configurado no regime do colaborador como limite da jornada normal. O que passar desse horário vira hora extra automaticamente, com o percentual que você configurou (50% ou 100%).')
    + faq('Posso mudar o regime de um colaborador no meio do contrato?', 'Sim. Configure o novo regime com a data de vigência correta. Após salvar, use o botão Recalcular para atualizar os apontamentos já registrados.')
    + faq('Colaborador MEI/PJ tem extras calculados?', 'Depende da configuração. No regime do colaborador, marque ou desmarque a opção Aplicar % de extras. Se desmarcado, o sistema calcula apenas horas totais &times; valor da hora, sem split de extras.')
    + faq('O valor da hora pode ser diferente por apontamento?', 'Sim. No modal de novo apontamento, o valor da hora vem pré-preenchido com o valor cadastrado no colaborador, mas pode ser alterado para aquele dia específico.');

  // Envolve o conteúdo montado num container com font-family herdada.
  function wrap(inner){ return '<div style="font-family:inherit">' + inner + '</div>'; }

  // Fragmentos expostos p/ montagem por portal (Opção A — filtragem por papel).
  window.AJUDA = { fluxo: fluxo, faqHeader: faqHeader, colaborador: colaborador, gestor: gestor, wrap: wrap };
  // Back-compat: string completa (fluxo + FAQ colaborador + gestor).
  window.AJUDA_HTML = wrap(fluxo + faqHeader + colaborador + gestor);
})();
