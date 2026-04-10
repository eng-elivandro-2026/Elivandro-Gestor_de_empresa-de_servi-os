// ============================================================
// app.js — Funções globais base do Sistema de Propostas
// Versão: V473_OFICIAL
// ============================================================

function Q(id) { return document.getElementById(id); }

function go(sec, el) {
  document.querySelectorAll('.nb').forEach(function(b){ b.classList.remove('on'); });
  if (el) el.classList.add('on');
  document.querySelectorAll('.sec').forEach(function(s){ s.style.display = 'none'; });
  var alvo = Q(sec);
  if (alvo) alvo.style.display = 'block';
}

function newProposal(el) { console.log("Nova proposta - implementar em módulo"); }
function abrirAjuda() {
  var m = Q('helpModal');
  if(m) m.style.display = 'flex';
}
function abrirFormulas() {
  var m = Q('formulasModal');
  if(m) m.style.display = 'flex';
}
function fecharAjuda() {
  var m = Q('helpModal');
  if(m) m.style.display = 'none';
}
function fecharFormulas() {
  var m = Q('formulasModal');
  if(m) m.style.display = 'none';
}
function limparPropostasZero() { console.log("Limpar R$0"); }
function toggleTheme() { document.body.classList.toggle('light'); }
function exportJSON() { console.log("Export JSON"); }
function importJSON(input) { console.log("Import JSON"); }
function importP(event) { console.log("Import P"); }
function abrirImportProposta() {
  var m = Q('pasteModal');
  if(m) m.style.display = 'flex';
}
function rTplMgr() { console.log("Templates"); }
function beInit() { console.log("Banco escopos"); }
function rAnalise() { console.log("Análise"); }
function rRegistro() { console.log("Pipeline"); }

// Expor globalmente
window.Q = Q;
window.go = go;
window.newProposal = newProposal;
window.abrirAjuda = abrirAjuda;
window.abrirFormulas = abrirFormulas;
window.fecharAjuda = fecharAjuda;
window.fecharFormulas = fecharFormulas;
window.limparPropostasZero = limparPropostasZero;
window.toggleTheme = toggleTheme;
window.exportJSON = exportJSON;
window.importJSON = importJSON;
window.importP = importP;
window.abrirImportProposta = abrirImportProposta;
window.rTplMgr = rTplMgr;
window.beInit = beInit;
window.rAnalise = rAnalise;
window.rRegistro = rRegistro;
