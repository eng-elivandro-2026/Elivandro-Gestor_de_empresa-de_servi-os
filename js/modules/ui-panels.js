function togVisaoGeral(){
  var b=Q('visaoGeralBody'), ch=Q('visaoGeralChevron');
  if(!b||!ch) return;
  var open=b.style.display!=='none';
  b.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲';
}
function togRanking(){
  var b=Q('rankingBody'), ch=Q('rankingChevron');
  if(!b||!ch) return;
  var open=b.style.display!=='none';
  b.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲';
}
