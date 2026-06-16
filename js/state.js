function renderAll(){
  renderGrpFilters();renderGroupsTimeline();renderKOLegend();
  // Ne reconstruire le timeline KO que si on est en vue liste (évite d'écraser le bracket)
  if(koBracketView!=='bracket'){renderKOTimeline();}
  renderStandings();
}

function showView(v){
  ['groups','standings','knockout','scorers','keepers','players'].forEach(function(id){document.getElementById('view-'+id).classList.toggle('hidden',id!==v);});
  document.querySelectorAll('.tab-btn').forEach(function(b,i){b.classList.toggle('active',['groups','standings','knockout','scorers','keepers','players'][i]===v);});
}

function switchView(v){
  activeView=v;showView(v);
  if(v==='scorers')renderScorers();
  if(v==='keepers'&&!keepersLoaded)fetchKeepers();
  if(v==='players'&&!playersLoaded)fetchPlayerRankings();
  // Si retour sur KO en mode bracket → re-rendre le bracket
  if(v==='knockout'&&koBracketView==='bracket'){
    var c=document.getElementById('knockout-timeline');
    c.innerHTML='';
    renderKOBracket(c,allMatches.filter(function(m){return m.ko;}));
  }
}

function scheduleRefresh(){
  var hasLive=allMatches.some(function(m){return m.isLive;});
  var delay=hasLive?30000:300000;
  setTimeout(async function(){
    if(hasLive){
      // Match en cours : ESPN live d'abord (rapide), puis fetchAll séquentiel
      await fetchESPNLiveScores();
      if(Math.random()<0.2)await fetchAll(); // fetchAll complet ~1x/5 = toutes les 2,5min
    } else {
      await fetchAll(); // Hors match : refresh complet toutes les 5min
    }
    scheduleRefresh();
  },delay);
}

// ─── INITIALISATION ───────────────────────────────────────────────────────────
loadFallback();
fetchAll();
scheduleRefresh();

// Refresh du minuteur sur la liste toutes les 30s (seulement si match en cours)
setInterval(function(){
  if(allMatches.some(function(m){return m.isLive;})){
    renderGroupsTimeline();
    renderKOTimeline();
  }
}, 30000);
