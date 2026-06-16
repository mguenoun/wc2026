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

var _refreshTick=0;
function scheduleRefresh(){
  // Toujours 30s — hasLive évalué au moment du tick, pas au moment de l'appel
  setTimeout(async function(){
    _refreshTick++;
    var hasLive=allMatches.some(function(m){return m.isLive;});
    if(hasLive){
      await fetchESPNLiveScores();          // ESPN live toutes les 30s
      if(_refreshTick%5===0)await fetchAll(); // fetchAll complet toutes les 2,5min
    } else if(_refreshTick%10===0){
      await fetchAll();                       // fetchAll toutes les 5min hors match
    }
    scheduleRefresh();
  },30000);
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
