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

  var html = ''
    + '<div style="font-family:inherit">'
    + '<div style="font-size:1rem;font-weight:800;color:var(--text,#e6edf3);margin-bottom:.15rem">Como funciona: do apontamento ao boletim</div>'
    + '<div style="font-size:.74rem;color:var(--text3,#6e7681);margin-bottom:.8rem">O caminho das horas até o documento assinado.</div>'

    // ── FLUXO EM 6 PASSOS ──
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
        'Com as duas assinaturas, o boletim vira <b>VÁLIDO</b> e ganha um <b>QR Code</b> de validação pública. Pode ser impresso ou salvo em PDF.')

    // ── FAQ ──
    + '<div style="border-top:1px solid var(--border,#30363d);margin-top:.9rem;padding-top:.4rem"></div>'
    + '<div style="font-size:.92rem;font-weight:800;color:var(--text,#e6edf3);margin-top:.4rem">Perguntas frequentes</div>'

    + etiqueta('🟢 Para colaboradores', C.verde)
    + faq('Como registro minhas horas?', 'No portal, toque em "Registrar Horas de Hoje", escolha o projeto, preencha horário e descrição, e salve.')
    + faq('Esqueci / quero criar meu PIN, como faço?', 'Vá em <b>Perfil &rarr; Criar/Redefinir PIN de Assinatura</b> e defina 4 dígitos.')
    + faq('Meu apontamento foi rejeitado, o que faço?', 'Abra o apontamento, leia o motivo na caixa vermelha, toque em "Corrigir e Reenviar", ajuste e reenvie.')
    + faq('Por que aparece "SEM VALIDADE" no meu boletim?', 'Porque ainda falta alguma assinatura (sua ou da empresa). Quando as duas forem feitas, o alerta some e o documento fica válido.')
    + faq('Onde vejo meus boletins para assinar?', 'Na aba <b>Boletins</b> do portal. Os que precisam da sua assinatura aparecem com o selo "Assinar".')

    + etiqueta('🔵 Para gestores', C.azul)
    + faq('Como aprovo ou rejeito um apontamento?', 'Em <b>RH &rarr; Apontamentos</b>, use os botões Aprovar ou Rejeitar. Ao rejeitar, escreva o motivo (mínimo 10 caracteres).')
    + faq('Como gero um boletim?', 'Em <b>RH &rarr; Boletins &rarr; Gerar Documento</b>. Escolha colaborador, período e empresa. O sistema junta os apontamentos aprovados.')
    + faq('O apontamento aparece R$ 0,00, por quê?', 'O colaborador está sem valor/hora cadastrado. Cadastre em <b>Colaboradores &rarr; editar &rarr; Valor/Hora</b>, depois edite e salve o apontamento para recalcular.')
    + faq('Como assino o boletim como empresa?', 'Abra o boletim em <b>RH &rarr; Boletins</b> e assine com seu PIN de gestor. (Crie o PIN no próprio modal se ainda não tiver.)')
    + faq('Como cancelo / excluo um boletim?', 'Abra o boletim e use "Cancelar Documento": OK cancela mantendo histórico, ou Cancelar exclui em definitivo.')
    + faq('Como vejo o histórico de um apontamento rejeitado?', 'No apontamento, toque em "Histórico" (📜) para ver todo o ciclo de rejeição/reenvio com datas e responsáveis.')

    + '</div>';

  window.AJUDA_HTML = html;
})();
