// ==========================
// CORE GLOBAL
// ==========================

function Q(id){return document.getElementById(id)}

// ==========================
// NAVEGAÇÃO
// ==========================
function go(sec,el){
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('on'))
  if(el) el.classList.add('on')

  document.querySelectorAll('.sec').forEach(s=>s.style.display='none')

  const alvo = Q(sec)
  if(alvo) alvo.style.display='block'
}

// ==========================
// NOVA PROPOSTA
// ==========================
function newProposal(){
  console.log("Nova proposta")
}

// ==========================
// PLACEHOLDER FUNÇÕES (para não quebrar)
// ==========================
function abrirAjuda(){alert("Ajuda")}
function abrirFormulas(){alert("Fórmulas")}
function fecharAjuda(){}
function fecharFormulas(){}
function limparPropostasZero(){console.log("Limpar R$0")}
function toggleTheme(){document.body.classList.toggle('light')}
function exportJSON(){console.log("Export JSON")}
function importJSON(){console.log("Import JSON")}
function importP(){console.log("Import P")}
function abrirImportProposta(){console.log("Colar proposta")}

function rTplMgr(){console.log("Templates")}
function beInit(){console.log("Banco escopos")}
function rAnalise(){console.log("Análise")}
function rRegistro(){console.log("Pipeline")}

// ==========================
// PROTEGER LOGIN
// ==========================
window.protegerPagina = async function () {
  const { data } = await window.sbClient.auth.getUser()
  if (!data?.user) window.location.href = "/login.html"
}

// ==========================
// EXPOR GLOBAL (OBRIGATÓRIO)
// ==========================
window.Q = Q
window.go = go
window.newProposal = newProposal

window.abrirAjuda = abrirAjuda
window.abrirFormulas = abrirFormulas
window.fecharAjuda = fecharAjuda
window.fecharFormulas = fecharFormulas

window.limparPropostasZero = limparPropostasZero
window.toggleTheme = toggleTheme
window.exportJSON = exportJSON
window.importJSON = importJSON
window.importP = importP
window.abrirImportProposta = abrirImportProposta

window.rTplMgr = rTplMgr
window.beInit = beInit
window.rAnalise = rAnalise
window.rRegistro = rRegistro
