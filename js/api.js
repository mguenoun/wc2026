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
    // Si ESPN dit state=in, on le croit : le guard de kickoff bloque les matchs KO
    // dont les horaires dans fallback.js peuvent ne pas correspondre aux UTC réels.
    if(state==='in'&&m.utcDate){
      if(Date.now()<new Date(m.utcDate).getTime()-30*60*1000)return;
    }
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
    if(period>=5){var _hs=parseInt(home.shootoutScore)||0,_as=parseInt(away.shootoutScore)||0;if(_hs||_as)m.penScore=_hs+'-'+_as;}
    var clockDisplay='';
    if(isLive&&clock){
      if(clock.indexOf("'")>=0){clockDisplay=clock;}
      else{var mins=parseInt(clock.split(':')[0])||0;
        if(period>=5)clockDisplay='Tirs au but';else if(period>=3)clockDisplay='Prolong. '+mins+"'";else clockDisplay=mins+"'";
      }
    }
    m.score=newScore;m.isLive=isLive;m.isFT=isFT;m.clockDisplay=clockDisplay;
    if(m.t1&&/^(1er|2e|3e|Vainq\.|V\s)/.test(m.t1)){var _ht=home.team&&(home.team.shortDisplayName||home.team.displayName)||'';if(_ht)m.t1=normTeam(_ht);}if(m.t2&&/^(1er|2e|3e|Vainq\.|V\s)/.test(m.t2)){var _at=away.team&&(away.team.shortDisplayName||away.team.displayName)||'';if(_at)m.t2=normTeam(_at);}
    if(isFT){m.status='FINISHED';var _wt=home.winner?normTeam(home.team&&(home.team.shortDisplayName||home.team.displayName)||''):(away.winner?normTeam(away.team&&(away.team.shortDisplayName||away.team.displayName)||''):null);if(_wt)m.winnerTeam=_wt;}
    if(isLive)m.status='IN_PLAY';
    mapped++;
  });
  return mapped>0;
}

// Persistance localStorage des matchs KO une fois résolus (noms d'équipes + résultat)
// Permet à processMatches (FD) de matcher les matchs KO par vrai nom d'équipe
// sans dépendre de la fenêtre ESPN.
function saveKOCache(){
  var cache={};
  allMatches.forEach(function(m){
    if(!m.ko)return;
    var real1=m.t1&&!/^(1er|2e|3e|Vainq\.|V\s|Perdant)/.test(m.t1);
    var real2=m.t2&&!/^(1er|2e|3e|Vainq\.|V\s|Perdant)/.test(m.t2);
    if(!real1&&!real2)return;
    var e={};
    if(real1)e.t1=m.t1;if(real2)e.t2=m.t2;
    if(m.score)e.score=m.score;
    if(m.isFT)e.isFT=true;
    if(m.winnerTeam)e.winnerTeam=m.winnerTeam;
    if(m.penScore)e.penScore=m.penScore;
    if(m.status)e.status=m.status;
    cache[m.id]=e;
  });
  try{localStorage.setItem('wc2026_ko',JSON.stringify(cache));}catch(_){}
}
function restoreKOCache(){
  try{
    var cache=JSON.parse(localStorage.getItem('wc2026_ko')||'{}');
    allMatches.forEach(function(m){
      if(!m.ko||!cache[m.id])return;
      var c=cache[m.id];
      if(c.t1)m.t1=c.t1;if(c.t2)m.t2=c.t2;
      if(c.score)m.score=c.score;
      if(c.isFT)m.isFT=c.isFT;
      if(c.winnerTeam)m.winnerTeam=c.winnerTeam;
      if(c.penScore)m.penScore=c.penScore;
      if(c.status)m.status=c.status;
    });
  }catch(_){}
}

// Fetch ESPN scoreboard J-1 + aujourd'hui directement depuis le browser (pas de KV)
// ESPN sert uniquement les scores en direct/récents ; l'historique KO vient de FD (processMatches)
async function fetchESPNEvents(){
  var allEvents=[];
  var today=new Date();
  for(var i=-1;i<=0;i++){
    var d=new Date(today);d.setDate(d.getDate()+i);
    var ds=d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
    try{
      var r=await fetch(ESPN_BASE+'/scoreboard?dates='+ds);
      if(r.ok){var data=await r.json();if(data.events)allEvents.push.apply(allEvents,data.events);}
    }catch(_){}
  }
  return allEvents;
}

var _fetchAllActive=false;
async function fetchAll(){
  if(_fetchAllActive)return; // éviter les appels concurrent
  _fetchAllActive=true;
  setStatus('loading','Actualisation…');
  document.getElementById('refresh-btn').textContent='蘵 …';
  if(PROXY_BASE.includes('REMPLACER')){setStatus('error','Proxy non configuré');loadFallback();renderAll();document.getElementById('loading').classList.add('hidden');showView(activeView);document.getElementById('refresh-btn').textContent='蘵 Actualiser';return;}

  loadFallback(); // base statique : remet tous les matchs à score:null
  restoreKOCache(); // noms réels + résultats KO déjà résolus (localStorage)
  playersLoaded = false; // forcer un re-fetch des stats joueurs au prochain visit

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

  // ── 2. ESPN direct depuis le browser (J-1 + aujourd'hui, pas de KV) ─────────
  var espnOk=false;
  try{
    var espnEvents=await fetchESPNEvents();
    if(espnEvents.length){processESPNScores(espnEvents);espnOk=true;}
  }catch(e){console.warn('[WC2026] ESPN direct:',e.message);}

  // ── 3. FD direct pour tout match KO passé sans résultat (sans fenêtre de temps)
  // Déclenché seulement si des matchs KO passés restent non résolus après KV + ESPN.
  // Appelle /fd/competitions/WC/matches qui retourne TOUS les matchs WC.
  try{
    var _today2=new Date().toISOString().slice(0,10);
    var _unresolvedKO=allMatches.some(function(m){return m.ko&&m.dayKey<_today2&&(!m.isFT||!m.score);});
    if(_unresolvedKO){
      var r1c=await fetch(PROXY_BASE+'/fd/competitions/WC/matches');
      if(r1c.ok){var d1c=await r1c.json();if(d1c.matches&&d1c.matches.length)processMatches(d1c.matches);}
    }
  }catch(e){console.warn('[WC2026] FD direct KO:',e.message);}

  saveKOCache(); // persiste noms réels + résultats KO pour les prochains rechargements

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
  buildPredictions();

  var src=espnOk?'KV+ESPN direct':(fdOk?'KV':'statique');
  setStatus('ok','En ligne ✓ ('+src+')');
  var now=new Date();
  document.getElementById('last-update').textContent='Mis à jour '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  renderAll();fetchScorers();fetchFairPlay();
  if(activeView==='players')fetchPlayerRankings();
  document.getElementById('loading').classList.add('hidden');
  showView(activeView);
  document.getElementById('refresh-btn').textContent='蘵 Actualiser';
  _fetchAllActive=false;
}
function setStatus(state,label){
  var dot=document.getElementById('conn-dot'),lbl=document.getElementById('conn-label');
  dot.className='status-dot';
  if(state==='loading')dot.classList.add('loading');
  if(state==='ok')dot.style.background='#22c55e';
  if(state==='error')dot.style.background='#ef4444';
  lbl.textContent=label;
}

function processMatches(matches, inputMatches){
  var apiByKey={};
  matches.forEach(function(m){
    var d=m.utcDate?m.utcDate.slice(0,10):'';
    var home=normTeam((m.homeTeam&&m.homeTeam.name)||'');
    var away=normTeam((m.awayTeam&&m.awayTeam.name)||'');
    apiByKey[d+'|'+home]=m;
    apiByKey[d+'|'+away]=m;
  });
  // Index par stage+date pour le fallback KO sans nom d'équipe (labels "2e Gr.A"…)
  var phaseToStage={'16es':'ROUND_OF_32','8es':'ROUND_OF_16','Quarts':'QUARTER_FINALS','Demis':'SEMI_FINALS','3e Place':'THIRD_PLACE','Finale':'FINAL'};
  var fdByStageDate={};
  matches.forEach(function(m){
    if(!m.stage||!m.utcDate)return;
    var key=m.stage+'|'+m.utcDate.slice(0,10);
    if(!fdByStageDate[key])fdByStageDate[key]=[];
    fdByStageDate[key].push(m);
  });
  var matchedFdIds={};
  var base=inputMatches||allMatches;
  var result=base.map(function(sm){
    // Recherche par nom : dayKey, J-1 (UTC minuit), J+1 (UTC lendemain pour soirée tardive)
    var _dP=new Date(sm.dayKey+'T12:00Z');_dP.setUTCDate(_dP.getUTCDate()-1);var _dPStr=_dP.toISOString().slice(0,10);
    var _dN=new Date(sm.dayKey+'T12:00Z');_dN.setUTCDate(_dN.getUTCDate()+1);var _dNStr=_dN.toISOString().slice(0,10);
    var apiM=apiByKey[sm.dayKey+'|'+sm.t1]||apiByKey[sm.dayKey+'|'+sm.t2]
            ||apiByKey[_dPStr+'|'+sm.t1]||apiByKey[_dPStr+'|'+sm.t2]
            ||apiByKey[_dNStr+'|'+sm.t1]||apiByKey[_dNStr+'|'+sm.t2];
    if(apiM&&sm.ko)matchedFdIds[apiM.id]=true; // réserver ce match FD pour ce slot
    // Fallback KO : uniquement si labels encore présents (pas de nom réel connu)
    // FD retourne tout l'historique sans fenêtre ; on cherche par stage+date UTC (±1j)
    if(!apiM&&sm.ko){
      var fdStage=phaseToStage[sm.phase];
      if(fdStage){
        var d0=sm.dayKey;
        var dPN=new Date(d0+'T12:00Z');dPN.setUTCDate(dPN.getUTCDate()-1);var dPNStr=dPN.toISOString().slice(0,10);
        var dNN=new Date(d0+'T12:00Z');dNN.setUTCDate(dNN.getUTCDate()+1);var dNNStr=dNN.toISOString().slice(0,10);
        var tryDates=[d0,dNNStr,dPNStr]; // dayKey d'abord, puis J+1 (soirée→UTC lendemain), puis J-1
        for(var _di=0;_di<tryDates.length&&!apiM;_di++){
          var cands=(fdByStageDate[fdStage+'|'+tryDates[_di]]||[]).filter(function(c){return !matchedFdIds[c.id];});
          if(!cands.length)continue;
          if(cands.length===1){apiM=cands[0];}
          else{
            // Plusieurs dans le même bucket UTC : trier par heure et apparier par position locale
            cands.sort(function(a,b){return a.utcDate<b.utcDate?-1:1;});
            var daySlots=base.filter(function(s){return s.ko&&s.phase===sm.phase&&s.dayKey===d0;});
            daySlots.sort(function(a,b){return a.time<b.time?-1:1;});
            var pos=daySlots.findIndex(function(s){return s.id===sm.id;});
            if(pos>=0&&pos<cands.length)apiM=cands[pos];
          }
        }
        if(apiM)matchedFdIds[apiM.id]=true;
      }
    }
    if(!apiM)return sm;
    var isLive=['IN_PLAY','PAUSED'].includes(apiM.status);
    var isFT=apiM.status==='FINISHED';
    var score=null,penScore=null;
    if(isFT&&apiM.score&&apiM.score.fullTime){
      var s=apiM.score.fullTime;
      var pen=apiM.score.penalties;
      if(pen&&pen.home!==null&&pen.away!==null){
        penScore=pen.home+'-'+pen.away;
        // FD WC2026 stocke le total (régl + TAB) dans fullTime.
        // On cherche regularTime ou extraTime pour le score avant TAB.
        // Sinon on soustrait : si fullTime >= penalties, score régl = fullTime - pen.
        var preShoot=apiM.score.regularTime||apiM.score.extraTime;
        if(preShoot&&preShoot.home!==null&&preShoot.away!==null){
          score=preShoot.home+' – '+preShoot.away;
        } else if(s.home!==null&&s.away!==null){
          var rh=s.home-pen.home,ra=s.away-pen.away;
          score=(rh>=0&&ra>=0?rh+' – '+ra:s.home+' – '+s.away);
        }
      } else if(s.home!==null&&s.away!==null){
        score=s.home+' – '+s.away;
      }
    }
    if(isLive){var sl=apiM.score&&apiM.score.fullTime;score=(sl&&sl.home!=null?sl.home:0)+' \u2013 '+(sl&&sl.away!=null?sl.away:0);}
    var t1u=sm.ko?normTeam((apiM.homeTeam&&(apiM.homeTeam.shortName||apiM.homeTeam.name))||sm.t1):sm.t1;
    var t2u=sm.ko?normTeam((apiM.awayTeam&&(apiM.awayTeam.shortName||apiM.awayTeam.name))||sm.t2):sm.t2;
    var fdWinner=apiM.score&&apiM.score.winner;
    var winnerTeam=(isFT&&fdWinner==='HOME_TEAM')?t1u:(isFT&&fdWinner==='AWAY_TEAM')?t2u:null;
    return Object.assign({},sm,{t1:t1u,t2:t2u,score:score,status:apiM.status,isLive:isLive,isFT:isFT,apiId:apiM.id,utcDate:apiM.utcDate||null,winnerTeam:winnerTeam||sm.winnerTeam||null,penScore:penScore||sm.penScore||null});
  });
  if(!inputMatches) allMatches=result;
  return result;
}

function processStandings(data){
  standings={};
  data.forEach(function(s){
    if(s.type==='TOTAL'&&s.group&&s.table&&s.table.length){
      var grp=s.group.replace('GROUP_','').replace('Group ','').trim();
      if(!GC[grp])return;
      standings[grp]=s.table.map(function(r){return{pos:r.position,team:normTeam(r.team.shortName||r.team.name),played:r.playedGames,won:r.won,draw:r.draw,lost:r.lost,gf:r.goalsFor,ga:r.goalsAgainst,gd:r.goalDifference,pts:r.points,yc:r.yellowCards||0,rc:r.redCards||0};});
    }
  });
}

function humanPhase(s){var m={'GROUP_STAGE':'Groupe','ROUND_OF_32':'32es','ROUND_OF_16':'16es','QUARTER_FINALS':'Quarts','SEMI_FINALS':'Demis','THIRD_PLACE':'3e Place','FINAL':'Finale'};return m[s]||s;}
function phaseColor(s){var m={'ROUND_OF_32':'#8b5cf6','ROUND_OF_16':'#f59e0b','QUARTER_FINALS':'#ef4444','SEMI_FINALS':'#f97316','THIRD_PLACE':'#64748b','FINAL':'#fbbf24'};return m[s]||'#94a3b8';}

function computeStandingsFromMatches(inputMatches){
  var src=inputMatches||allMatches;
  var byGrp={};
  src.filter(function(m){return !m.ko;}).forEach(function(m){if(!byGrp[m.grp])byGrp[m.grp]=new Set();byGrp[m.grp].add(m.t1);byGrp[m.grp].add(m.t2);});
  var stats={};
  Object.entries(byGrp).forEach(function(e){var g=e[0],teams=e[1];stats[g]={};teams.forEach(function(t){stats[g][t]={played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0};});});
  src.filter(function(m){return !m.ko&&m.isFT&&m.score;}).forEach(function(m){
    var parts=m.score.split(' \u2013 ');if(parts.length!==2)return;
    var g1=parseInt(parts[0]),g2=parseInt(parts[1]);if(isNaN(g1)||isNaN(g2))return;
    var g=m.grp;if(!stats[g]||!stats[g][m.t1]||!stats[g][m.t2])return;
    stats[g][m.t1].played++;stats[g][m.t1].gf+=g1;stats[g][m.t1].ga+=g2;
    stats[g][m.t2].played++;stats[g][m.t2].gf+=g2;stats[g][m.t2].ga+=g1;
    if(g1>g2){stats[g][m.t1].won++;stats[g][m.t1].pts+=3;stats[g][m.t2].lost++;}
    else if(g1<g2){stats[g][m.t2].won++;stats[g][m.t2].pts+=3;stats[g][m.t1].lost++;}
    else{stats[g][m.t1].draw++;stats[g][m.t1].pts++;stats[g][m.t2].draw++;stats[g][m.t2].pts++;}
  });
  var result={};
  Object.entries(stats).forEach(function(e){
    var grp=e[0],teams=e[1];
    var table=Object.entries(teams).map(function(te){var t=te[0],s=te[1];return Object.assign({team:t},s,{gd:s.gf-s.ga});});
    table.sort(function(a,b){return(b.pts-a.pts)||(b.gd-a.gd)||(b.gf-a.gf);});
    table.forEach(function(r,i){r.pos=i+1;});
    result[grp]=table;
  });
  if(!inputMatches) standings=result;
  return result;
}


// Mise à jour des scores en direct via ESPN (plus rapide que football-data.org)
async function fetchESPNLiveScores(){
  try{
    var events=await fetchESPNEvents();
    if(!events.length)return;
    var updated=false;
    events.forEach(function(e){
      var status=e.status&&e.status.type&&e.status.type.state;
      if(status!=='in'&&status!=='post')return;
      var matchId=null;
      Object.entries(ESPN_ID_MAP).forEach(function(entry){if(entry[1]===e.id)matchId=entry[0];});
      if(!matchId)return;
      var m=allMatches.find(function(x){return x.id===matchId;});
      if(!m)return;
      var comps=e.competitions&&e.competitions[0]&&e.competitions[0].competitors||[];
      var home=comps.find(function(c){return c.homeAway==='home';})||{};
      var away=comps.find(function(c){return c.homeAway==='away';})||{};
      var newScore=(home.score||'0')+' – '+(away.score||'0');
      var isLive=status==='in',isFT=status==='post';
      var clock=e.status&&e.status.displayClock||'';
      var period=e.status&&e.status.period||0;
      if(period>=5){var _hs=parseInt(home.shootoutScore)||0,_as=parseInt(away.shootoutScore)||0;if(_hs||_as)m.penScore=_hs+'-'+_as;}
      var clockDisplay='';
      if(isLive&&clock){
        if(clock.indexOf("'")>=0){clockDisplay=clock;}
        else{var mins=parseInt(clock.split(':')[0])||0;
          if(period>=5)clockDisplay='Tirs au but';else clockDisplay=(period>=3?'Prolong. ':'')+mins+"'";
        }
      }
      if(m.score!==newScore||m.isLive!==isLive||m.isFT!==isFT||m.clockDisplay!==clockDisplay){
        m.score=newScore;m.isLive=isLive;m.isFT=isFT;m.clockDisplay=clockDisplay;
        if(m.t1&&/^(1er|2e|3e|Vainq\.|V\s)/.test(m.t1)){var _ht=home.team&&(home.team.shortDisplayName||home.team.displayName)||'';if(_ht)m.t1=normTeam(_ht);}if(m.t2&&/^(1er|2e|3e|Vainq\.|V\s)/.test(m.t2)){var _at=away.team&&(away.team.shortDisplayName||away.team.displayName)||'';if(_at)m.t2=normTeam(_at);}
        if(isFT){m.status='FINISHED';var _wt=home.winner?normTeam(home.team&&(home.team.shortDisplayName||home.team.displayName)||''):(away.winner?normTeam(away.team&&(away.team.shortDisplayName||away.team.displayName)||''):null);if(_wt)m.winnerTeam=_wt;}
        if(isLive)m.status='IN_PLAY';
        updated=true;
      }
    });
    if(allMatches.some(function(m){return m.isLive;})){
      if(activeView==='groups'&&typeof grpCalView!=='undefined'&&grpCalView==='calendar'){patchCalendarLive();}else{renderGroupsTimeline();}
      renderKOTimeline();renderKPIBar();
    }
    if(updated){computeStandingsFromMatches();buildPredictions();renderStandings();}
  }catch(e){console.warn('[WC2026] fetchESPNLiveScores:',e.message);}
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


var fairplayData=[], fairplayLoaded=false;
function fetchFairPlay(){
  fairplayLoaded=false;
  fetch(PROXY_BASE+'/stats/fairplay')
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(data){
      fairplayData=data.fairplay||[];
      fairplayLoaded=true;
      if(activeView==='fairplay')renderFairPlay();
      if(activeView==='groups'||activeView==='knockout')renderKPIBar();
    })
    .catch(function(e){console.warn('[WC2026] fairplay:',e.message);fairplayLoaded=true;});
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
var _modalRefreshTimer = null;
var _modalRefreshFn   = null;
