function renderAll(){
  renderGrpFilters();renderGroupsTimeline();renderKOTimeline();renderKOLegend();renderStandings();
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
}

function scheduleRefresh(){
  var hasLive=allMatches.some(function(m){return m.isLive;});
  var delay=hasLive?30000:300000;
  setTimeout(async function(){
    // ESPN refresh rapide pour les scores en direct
    fetchESPNLiveScores();
    // football-data.org refresh complet (moins fréquent si pas de match en direct)
    if(!hasLive || Math.random() < 0.2){ // toutes les ~5 refreshes ESPN
      await fetchAll();
    }
    scheduleRefresh();
  },delay);
}

// Refresh ESPN toutes les 30s quand match en cours
function startESPNLiveRefresh(){
  setInterval(function(){
    if(allMatches.some(function(m){return m.isLive;})){
      fetchESPNLiveScores();
    }
  },30000);
}


// ─── FALLBACK ─────────────────────────────────────────────────────────────────
