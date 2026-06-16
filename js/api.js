async function fetchESPNScores(){
  // Fetcher uniquement les dates qui ont des matchs déjà commencés (isFT ou isLive)
  // Logique robuste au rechargement de page : pas de fenêtre glissante, pas de perte de scores
  var datesToFetch={};
  allMatches.forEach(function(m){
    if(m.isFT||m.isLive)datesToFetch[m.dayKey.replace(/-/g,'')]=1;
  });
  // Si rien n'est encore joué (tout début de tournoi), prendre hier + aujourd'hui
  if(!Object.keys(datesToFetch).length){
    var today=new Date();
    for(var i=-1;i<=0;i++){
      var d=new Date(today);d.setDate(d.getDate()+i);
      datesToFetch[d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')]=1;
    }
  }
  var events=[];
  var dates=Object.keys(datesToFetch).sort();
  for(var i=0;i<dates.length;i++){
    var ds=dates[i];
    try{
      var r=await fetch(ESPN_BASE+'/scoreboard?dates='+ds);
      if(!r.ok)continue;
      var data=await r.json();
      if(data.events&&data.events.length)events=events.concat(data.events);
    }catch(e){console.warn('[ESPN scoreboard] '+ds+':',e.message);}
  }
  return events;
}

// Applique les données ESPN aux allMatches (scores, statuts, clock)
function processESPNScores(events){
  if(!events||!events.length)return false;
  var mapped=0;
  events.forEach(function(e){
    // Retrouver le match via ESPN_ID_MAP
    var matchId=null;
    Object.entries(ESPN_ID_MAP).forEach(function(entry){if(entry[1]===e.id)matchId=entry[0];});
    if(!matchId){
      // Tentative de mapping auto par date+équipes
      var eDate=e.date?e.date.slice(0,10):null;
      if(eDate){
        var found=allMatches.find(function(m){
          if(m.dayKey!==eDate)return false;
          var eName=(e.name||'').toLowerCase();
          return eName.includes((m.t1||'').toLowerCase().slice(0,4))||eName.includes((m.t2||'').toLowerCase().slice(0,4));
        });
        if(found){ESPN_ID_MAP[found.id]=e.id;matchId=found.id;}
      }
    }
    if(!matchId)return;
    var m=allMatches.find(function(m){return m.id===matchId;});
    if(!m)return;
    var state=e.status&&e.status.type&&e.status.type.state;
    if(state!=='in'&&state!=='post')return; // ignorer les matchs pas encore commencés
    // Ne jamais écraser un score FT déjà acquis par une entrée sans score (ex: match hors fenêtre)
    if(m.isFT&&state==='post'&&m.score)return;
    var comp=e.competitions&&e.competitions[0];
    var comps=comp&&comp.competitors||[];
    var home=comps.find(function(c){return c.homeAway==='home';})||{};
    var away=comps.find(function(c){return c.homeAway==='away';})||{};
    var newScore=(home.score||'0')+' \u2013 '+(away.score||'0');
    var isLive=state==='in';
    var isFT=state==='post';
    var clock=e.status&&e.status.displayClock||'';
    var period=e.status&&e.status.period||0;
    var clockDisplay='';
    if(isLive&&clock){
      if(clock.indexOf("'")>=0){clockDisplay=clock;}
      else{var mins=parseInt(clock.split(':')[0])||0;
        if(period<=2)clockDisplay=mins+"'";
        else clockDisplay='Prolong. '+mins+"'";}
    }
    m.score=newScore;m.isLive=isLive;m.isFT=isFT;m.clockDisplay=clockDisplay;
    if(isFT)m.status='FINISHED';
    if(isLive)m.status='IN_PLAY';
    mapped++;
  });
  return mapped>0;
}

async function fetchAll(){
  setStatus('loading','Actualisation…');
  document.getElementById('refresh-btn').textContent='蘵 …';
  if(PROXY_BASE.includes('REMPLACER')){setStatus('error','Proxy non configuré');loadFallback();renderAll();document.getElementById('loading').classList.add('hidden');showView(activeView);document.getElementById('refresh-btn').textContent='蘵 Actualiser';return;}

  loadFallback(); // base statique : remet tous les matchs à score:null

  // ── 1. Données matchs depuis cache KV worker (rapide, pré-agrégé) ──────────
  var fdOk=false;
  try{
    var r1=await fetch(PROXY_BASE+'/data/matches');
    if(r1.ok){
      var d1=await r1.json();
      if(d1.matches&&d1.matches.length){processMatches(d1.matches);fdOk=true;}
    }
  }catch(e){console.warn('[WC2026] /data/matches:',e.message);}

  // Fallback direct FD si cache KV vide (premier déploiement ou reset)
  if(!fdOk){
    try{
      var r1b=await fetch(PROXY_BASE+'/fd/competitions/WC/matches');
      if(r1b.ok){var d1b=await r1b.json();processMatches(d1b.matches||[]);fdOk=true;}
      else console.warn('[WC2026] FD matches fallback:',r1b.status);
    }catch(e){console.warn('[WC2026] FD matches fallback:',e.message);}
  }

  // ── 2. ESPN : dates récentes avec matchs joués ou en cours ──────────────────
  // Logique identique à fetchESPNScores() mais bornée aux 4 derniers jours :
  // données plus anciennes servies par KV, pas besoin de re-fetcher ESPN pour elles.
  // L'ensemble des dates est calculé dynamiquement à partir de l'état des matchs.
  var espnOk=false;
  var espnDatesMap={};
  var cutoff=new Date();cutoff.setDate(cutoff.getDate()-3);
  allMatches.forEach(function(m){
    if((m.isFT||m.isLive)&&new Date(m.dayKey)>=cutoff)
      espnDatesMap[m.dayKey.replace(/-/g,'')]=1;
  });
  // Toujours inclure aujourd'hui pour détecter les matchs live démarrant dans la journée
  var _now=new Date();
  espnDatesMap[_now.getFullYear()+String(_now.getMonth()+1).padStart(2,'0')+String(_now.getDate()).padStart(2,'0')]=1;
  var espnDates=Object.keys(espnDatesMap).sort();
  for(var _i=0;_i<espnDates.length;_i++){
    try{
      var rE=await fetch(ESPN_BASE+'/scoreboard?dates='+espnDates[_i]);
      if(rE.ok){var dE=await rE.json();if(dE.events&&dE.events.length){processESPNScores(dE.events);espnOk=true;}}
    }catch(e){console.warn('[WC2026] ESPN '+espnDates[_i]+':',e.message);}
  }

  // ── 3. Classements depuis cache KV worker ─────────────────────────────────
  var standOk=false;
  try{
    var r2=await fetch(PROXY_BASE+'/data/standings');
    if(r2.ok){var d2=await r2.json();if(d2.standings&&d2.standings.length){processStandings(d2.standings);standOk=true;}}
  }catch(e){console.warn('[WC2026] /data/standings:',e.message);}

  // Fallback direct FD si cache KV classements vide
  if(!standOk){
    try{
      var r2b=await fetch(PROXY_BASE+'/fd/competitions/WC/standings');
      if(r2b.ok){var d2b=await r2b.json();processStandings(d2b.standings||[]);}
      else console.warn('[WC2026] FD standings fallback:',r2b.status);
    }catch(e){console.warn('[WC2026] FD standings fallback:',e.message);}
  }

  if(!Object.keys(standings).length)computeStandingsFromMatches();

  var src=espnOk?'KV+ESPN':(fdOk?'KV':'statique');
  setStatus('ok','En ligne ✓ ('+src+')');
  var now=new Date();
  document.getElementById('last-update').textContent='Mis à jour '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  renderAll();fetchScorers();fetchESPNIds();
  document.getElementById('loading').classList.add('hidden');
  showView(activeView);
  document.getElementById('refresh-btn').textContent='蘵 Actualiser';
}
function setStatus(state,label){
  var dot=document.getElementById('conn-dot'),lbl=document.getElementById('conn-label');
  dot.className='status-dot';
  if(state==='loading')dot.classList.add('loading');
  if(state==='ok')dot.style.background='#22c55e';
  if(state==='error')dot.style.background='#ef4444';
  lbl.textContent=label;
}

function processMatches(matches){
  var apiByKey={};
  matches.forEach(function(m){
    var d=m.utcDate?m.utcDate.slice(0,10):'';
    var home=normTeam((m.homeTeam&&m.homeTeam.name)||'');
    var away=normTeam((m.awayTeam&&m.awayTeam.name)||'');
    apiByKey[d+'|'+home]=m;
    apiByKey[d+'|'+away]=m;
  });
  allMatches=allMatches.map(function(sm){
    var apiM=apiByKey[sm.dayKey+'|'+sm.t1]||apiByKey[sm.dayKey+'|'+sm.t2];
    // Fallback J-1 : matchs "00h00 heure locale" dont utcDate FD est la veille
    if(!apiM){
      var prev=new Date(sm.dayKey);prev.setDate(prev.getDate()-1);
      var prevKey=prev.toISOString().slice(0,10);
      apiM=apiByKey[prevKey+'|'+sm.t1]||apiByKey[prevKey+'|'+sm.t2];
    }
    if(!apiM)return sm;
    var isLive=['IN_PLAY','PAUSED'].includes(apiM.status);
    var isFT=apiM.status==='FINISHED';
    var score=null;
    if(isFT&&apiM.score&&apiM.score.fullTime){var s=apiM.score.fullTime;if(s.home!==null&&s.away!==null)score=s.home+' \u2013 '+s.away;}
    if(isLive){var sl=apiM.score&&apiM.score.fullTime;score=(sl&&sl.home!=null?sl.home:0)+' \u2013 '+(sl&&sl.away!=null?sl.away:0);}
    var t1u=sm.ko?normTeam((apiM.homeTeam&&(apiM.homeTeam.shortName||apiM.homeTeam.name))||sm.t1):sm.t1;
    var t2u=sm.ko?normTeam((apiM.awayTeam&&(apiM.awayTeam.shortName||apiM.awayTeam.name))||sm.t2):sm.t2;
    return Object.assign({},sm,{t1:t1u,t2:t2u,score:score,status:apiM.status,isLive:isLive,isFT:isFT,apiId:apiM.id});
  });
}

function processStandings(data){
  standings={};
  data.forEach(function(s){
    if(s.type==='TOTAL'&&s.group&&s.table&&s.table.length){
      var grp=s.group.replace('GROUP_','').replace('Group ','').trim();
      if(!GC[grp])return;
      standings[grp]=s.table.map(function(r){return{pos:r.position,team:r.team.shortName||r.team.name,played:r.playedGames,won:r.won,draw:r.draw,lost:r.lost,gf:r.goalsFor,ga:r.goalsAgainst,gd:r.goalDifference,pts:r.points};});
    }
  });
}

function humanPhase(s){var m={'GROUP_STAGE':'Groupe','ROUND_OF_32':'32es','ROUND_OF_16':'16es','QUARTER_FINALS':'Quarts','SEMI_FINALS':'Demis','THIRD_PLACE':'3e Place','FINAL':'Finale'};return m[s]||s;}
function phaseColor(s){var m={'ROUND_OF_32':'#8b5cf6','ROUND_OF_16':'#f59e0b','QUARTER_FINALS':'#ef4444','SEMI_FINALS':'#f97316','THIRD_PLACE':'#64748b','FINAL':'#fbbf24'};return m[s]||'#94a3b8';}

function computeStandingsFromMatches(){
  standings={};
  var byGrp={};
  allMatches.filter(function(m){return !m.ko;}).forEach(function(m){if(!byGrp[m.grp])byGrp[m.grp]=new Set();byGrp[m.grp].add(m.t1);byGrp[m.grp].add(m.t2);});
  var stats={};
  Object.entries(byGrp).forEach(function(e){var g=e[0],teams=e[1];stats[g]={};teams.forEach(function(t){stats[g][t]={played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0};});});
  allMatches.filter(function(m){return !m.ko&&m.isFT&&m.score;}).forEach(function(m){
    var parts=m.score.split(' \u2013 ');if(parts.length!==2)return;
    var g1=parseInt(parts[0]),g2=parseInt(parts[1]);if(isNaN(g1)||isNaN(g2))return;
    var g=m.grp;if(!stats[g]||!stats[g][m.t1]||!stats[g][m.t2])return;
    stats[g][m.t1].played++;stats[g][m.t1].gf+=g1;stats[g][m.t1].ga+=g2;
    stats[g][m.t2].played++;stats[g][m.t2].gf+=g2;stats[g][m.t2].ga+=g1;
    if(g1>g2){stats[g][m.t1].won++;stats[g][m.t1].pts+=3;stats[g][m.t2].lost++;}
    else if(g1<g2){stats[g][m.t2].won++;stats[g][m.t2].pts+=3;stats[g][m.t1].lost++;}
    else{stats[g][m.t1].draw++;stats[g][m.t1].pts++;stats[g][m.t2].draw++;stats[g][m.t2].pts++;}
  });
  Object.entries(stats).forEach(function(e){
    var grp=e[0],teams=e[1];
    var table=Object.entries(teams).map(function(te){var t=te[0],s=te[1];return Object.assign({team:t},s,{gd:s.gf-s.ga});});
    table.sort(function(a,b){return(b.pts-a.pts)||(b.gd-a.gd)||(b.gf-a.gf);});
    table.forEach(function(r,i){r.pos=i+1;});
    standings[grp]=table;
  });
}

// Auto-découverte des IDs ESPN pour les matchs non encore mappés
function fetchESPNIds(){
  var today = new Date();
  var dates = [];
  for(var i=-1; i<=2; i++){
    var d = new Date(today);
    d.setDate(d.getDate()+i);
    var y=d.getFullYear(),mo=String(d.getMonth()+1).padStart(2,'0'),dy=String(d.getDate()).padStart(2,'0');
    dates.push(''+y+mo+dy);
  }
  dates.forEach(function(dateStr){
    fetch(ESPN_BASE+'/scoreboard?dates='+dateStr)
      .then(function(r){return r.json();})
      .then(function(data){
        data.events&&data.events.forEach(function(e){
          // Chercher le match correspondant par date + équipes
          var eDate = dateStr.slice(0,4)+'-'+dateStr.slice(4,6)+'-'+dateStr.slice(6,8);
          var match = allMatches.find(function(m){
            if(m.dayKey!==eDate) return false;
            var eName=e.name.toLowerCase();
            return eName.includes(m.t1.toLowerCase().slice(0,4))||
                   eName.includes(m.t2.toLowerCase().slice(0,4));
          });
          if(match&&!ESPN_ID_MAP[match.id]){
            ESPN_ID_MAP[match.id]=e.id;

          }
        });
      })
      .catch(function(){});
  });
}

// Mise à jour des scores en direct via ESPN (plus rapide que football-data.org)
function fetchESPNLiveScores(){
  var today = new Date();
  var y=today.getFullYear(),mo=String(today.getMonth()+1).padStart(2,'0'),dy=String(today.getDate()).padStart(2,'0');
  var dateStr=''+y+mo+dy;
  fetch(ESPN_BASE+'/scoreboard?dates='+dateStr)
    .then(function(r){return r.json();})
    .then(function(data){
      if(!data.events||!data.events.length)return;
      var updated=false;
      data.events.forEach(function(e){
        var status=e.status&&e.status.type&&e.status.type.state; // 'pre','in','post'
        if(status!=='in'&&status!=='post')return;
        // Find matching match in allMatches by ESPN ID
        var matchId=null;
        Object.entries(ESPN_ID_MAP).forEach(function(entry){
          if(entry[1]===e.id)matchId=entry[0];
        });
        if(!matchId)return;
        var m=allMatches.find(function(m){return m.id===matchId;});
        if(!m)return;
        var comps=e.competitions&&e.competitions[0]&&e.competitions[0].competitors||[];
        var home=comps.find(function(c){return c.homeAway==='home';})||{};
        var away=comps.find(function(c){return c.homeAway==='away';})||{};
        var newScore=(home.score||'0')+' – '+(away.score||'0');
        var isLive=status==='in';
        var isFT=status==='post';
        // Get official clock from ESPN — displayClock already contains e.g. "34:00", "45'+2'"
        var clock=e.status&&e.status.displayClock||'';
        var period=e.status&&e.status.period||0;
        var clockDisplay='';
        if(isLive&&clock){
          // displayClock can be "34:00" (mm:ss) or "45'+2'" (already formatted)
          if(clock.indexOf("'")>=0){
            // Already formatted with apostrophe e.g. "90'+2'" — use as-is
            clockDisplay=clock;
          } else {
            // Format mm:ss → extract minutes only
            var mins=parseInt(clock.split(':')[0])||0;
            if(period===1) clockDisplay=mins+"'";
            else if(period===2) clockDisplay=mins+"'";
            else if(period>=3) clockDisplay='Prolong. '+mins+"'";
          }
        }
        if(m.score!==newScore||m.isLive!==isLive||m.isFT!==isFT||m.clockDisplay!==clockDisplay){
          m.score=newScore;
          m.isLive=isLive;
          m.isFT=isFT;
          m.clockDisplay=clockDisplay;
          if(isFT)m.status='FINISHED';
          if(isLive)m.status='IN_PLAY';
          updated=true;
        }
      });
      // Always re-render timeline to update minute counter
      if(allMatches.some(function(m){return m.isLive;})){
        renderGroupsTimeline();
        renderKOTimeline();
      }
      if(updated){
        computeStandingsFromMatches();
        renderStandings();
      }
    })
    .catch(function(){});
}

function fetchScorers(){
  fetch(PROXY_BASE+'/data/scorers')
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(data){
      if(data.scorers&&data.scorers.length){scorers=data.scorers;if(activeView==='scorers')renderScorers();return;}
      // Fallback direct FD si cache KV vide
      return fetch(PROXY_BASE+'/fd/competitions/WC/scorers?limit=20')
        .then(function(r2){return r2.json();})
        .then(function(d2){scorers=d2.scorers||[];if(activeView==='scorers')renderScorers();});
    })
    .catch(function(e){console.warn('[WC2026] scorers:',e.message);});
}


// ─── MODAL ────────────────────────────────────────────────────────────────────
var _modalRefreshTimer = null;
var _modalRefreshFn   = null;
