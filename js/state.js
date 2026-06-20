var VIEWS=['groups','standings','thirds','knockout','scorers','keepers','players','fairplay'];

function renderAll(){
  renderGrpFilters();renderGroupsTimeline();renderKOLegend();
  if(koBracketView!=='bracket'){renderKOTimeline();}
  renderStandings();
  renderKPIBar();
  if(activeView==='thirds')renderThirds();
}

function showView(v){
  var kpiViews=['groups','knockout'];
  var kpiBar=document.getElementById('kpi-bar');
  if(kpiBar)kpiBar.classList.toggle('hidden',kpiViews.indexOf(v)<0);
  VIEWS.forEach(function(id){document.getElementById('view-'+id).classList.toggle('hidden',id!==v);});
  document.querySelectorAll('.tab-btn').forEach(function(b,i){b.classList.toggle('active',VIEWS[i]===v);});
}

function switchView(v){
  activeView=v;showView(v);
  if(v==='scorers')renderScorers();
  if(v==='keepers'&&!keepersLoaded)fetchKeepers();
  if(v==='players'&&!playersLoaded)fetchPlayerRankings();
  if(v==='thirds')renderThirds();
  if(v==='fairplay'){if(!fairplayLoaded)fetchFairPlay();else renderFairPlay();}
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

// Affichage dynamique du fuseau horaire détecté
(function(){
  var el=document.getElementById('tz-label');
  if(!el)return;
  try{
    var offsetMin=-new Date().getTimezoneOffset();
    var sign=offsetMin>=0?'+':'-';
    var absH=Math.floor(Math.abs(offsetMin)/60);
    var absM=Math.abs(offsetMin)%60;
    var gmt='GMT'+sign+absH+(absM?':'+String(absM).padStart(2,'0'):'');
    var tz=USER_TZ===DISPLAY_TZ?'Maroc':USER_TZ.replace('_',' ').split('/').pop();
    el.textContent='\u{1F550} '+tz+' ('+gmt+')';
    if(USER_TZ!==DISPLAY_TZ)el.title='Heures affichées dans votre fuseau local ('+USER_TZ+')';
  }catch(e){}
})();

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
