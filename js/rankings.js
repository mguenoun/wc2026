keepersLoaded=false;

async function fetchKeepers(){
  var c=document.getElementById('keepers-list');
  if(!c)return;
  c.innerHTML='<p style="color:#475569;font-size:11px;padding:16px">⏳ Calcul en cours…</p>';
  var played=allMatches.filter(function(m){return m.isFT&&ESPN_ID_MAP[m.id];});
  if(!played.length){c.innerHTML='<p style="color:#475569;font-size:11px;padding:16px">Données disponibles dès le premier match joué.</p>';return;}
  var keeperStats={};
  for(var i=0;i<played.length;i++){
    var match=played[i];var eid=ESPN_ID_MAP[match.id];
    try{
      var summary=await fetch(ESPN_BASE+'/summary?event='+eid).then(function(r){return r.json();});
      var rosters=summary.rosters||[];
      var playerStats=await loadMatchPlayerStats(eid,rosters);
      rosters.forEach(function(roster){
        var gk=roster.roster&&roster.roster.find(function(p){return p.starter&&p.position&&p.position.abbreviation==='G';});
        if(!gk)return;
        var gkName=gk.athlete&&gk.athlete.displayName||'';if(!gkName)return;
        var teamName=normTeam(roster.team&&roster.team.displayName||'');
        var ps=playerStats[gkName]||{};
        var score=match.score||'';
        var parts=score.split('–').map(function(x){return parseInt(x.trim())||0;});
        var isHome=roster.homeAway==='home';
        var ga=parts.length===2?(isHome?parts[1]:parts[0]):0;
        if(!keeperStats[gkName])keeperStats[gkName]={team:teamName,saves:0,ga:0,cleanSheets:0,minutes:0,matches:0};
        keeperStats[gkName].saves+=ps.saves||0;
        keeperStats[gkName].ga+=ga;
        keeperStats[gkName].minutes+=ps.minutes||90;
        keeperStats[gkName].matches++;
        if(ga===0)keeperStats[gkName].cleanSheets++;
      });
    }catch(e){}
  }
  var ranking=Object.entries(keeperStats)
    .map(function(e){return Object.assign({name:e[0]},e[1]);})
    .sort(function(a,b){return (a.ga-b.ga)||(b.saves-a.saves);});
  if(!ranking.length){c.innerHTML='<p style="color:#475569;font-size:11px;padding:16px">Aucune donnée disponible.</p>';return;}
  var html='<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;padding:4px 12px;">';
  html+='<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:8px;color:#475569;font-weight:700">'+
    '<span style="min-width:20px">#</span>'+
    '<span style="flex:1">Gardien</span>'+
    '<span style="min-width:28px;text-align:center">MJ</span>'+
    '<span style="min-width:32px;text-align:center;color:#22c55e">SV</span>'+
    '<span style="min-width:32px;text-align:center;color:#ef4444">Enc.</span>'+
    '<span style="min-width:32px;text-align:center;color:#0ea5e9">CS</span>'+
    '</div>';
  ranking.forEach(function(k,i){
    var rankColor=i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#cd7f32':'#475569';
    html+='<div class="scorer-row">'+
      '<span class="scorer-rank" style="color:'+rankColor+'">'+(i+1)+'</span>'+
      '<span class="scorer-name">'+k.name+'<span style="font-size:9px;color:#64748b;font-weight:400;margin-left:4px">('+k.team+')</span></span>'+
      '<span style="font-size:10px;color:#64748b;min-width:28px;text-align:center">'+k.matches+'</span>'+
      '<span style="font-size:12px;font-weight:800;color:#22c55e;min-width:32px;text-align:center">'+k.saves+'</span>'+
      '<span style="font-size:12px;font-weight:800;color:#ef4444;min-width:32px;text-align:center">'+k.ga+'</span>'+
      '<span style="font-size:12px;font-weight:800;color:#0ea5e9;min-width:32px;text-align:center">'+k.cleanSheets+'</span>'+
      '</div>';
  });
  html+='</div>';c.innerHTML=html;keepersLoaded=true;
}



// ─── MODAL ────────────────────────────────────────────────────────────────────
var _modalRefreshTimer = null;
var _modalRefreshFn   = null;

function renderScorers(){
  var c=document.getElementById('scorers-list');if(!c)return;c.innerHTML='';
  if(!scorers.length){c.innerHTML='<p style="color:#475569;font-size:11px;padding:16px">Aucun buteur enregistré pour l’instant.</p>';return;}
  var html='<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;padding:4px 12px;">';
  html+='<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:8px;color:#475569;font-weight:700">'+
    '<span style="min-width:20px">#</span><span style="flex:1">Joueur</span>'+
    '<span style="min-width:36px;text-align:center;color:#22c55e">⚽ Buts</span>'+
    '<span style="min-width:36px;text-align:center;color:#0ea5e9">→ Ast.</span></div>';
  for(var i=0;i<scorers.length;i++){
    var s=scorers[i];var player=s.player||{};var team=s.team||{};
    var goals=s.goals||0;var assists=s.assists||0;var penalties=s.penalties||0;
    var rank=i+1;var rankColor=rank===1?'#fbbf24':rank===2?'#94a3b8':rank===3?'#cd7f32':'#475569';
    html+='<div class="scorer-row">'+
      '<span class="scorer-rank" style="color:'+rankColor+'">'+rank+'</span>'+
      '<span class="scorer-name">'+(player.name||'?')+
        '<span style="font-size:9px;color:#64748b;font-weight:400;margin-left:4px">('+normTeam(team.shortName||team.name||'')+')</span>'+
        (penalties?'<span style="font-size:8px;color:#f59e0b;margin-left:4px">('+penalties+' pen.)</span>':'')+
        '</span>'+
      '<span style="font-size:12px;font-weight:800;color:#22c55e;min-width:36px;text-align:center">⚽ '+goals+'</span>'+
      (assists?'<span style="font-size:11px;font-weight:700;color:#0ea5e9;min-width:36px;text-align:center">→ '+assists+'</span>':'<span style="min-width:36px"></span>')+
      '</div>';
  }
  html+='</div>';c.innerHTML=html;
}

var playersLoaded=false;

async function fetchPlayerRankings(){
  var c=document.getElementById('players-list');
  if(!c)return;
  c.innerHTML='<p style="color:#475569;font-size:11px;padding:16px">⏳ Calcul en cours…</p>';
  var played=allMatches.filter(function(m){return m.isFT&&ESPN_ID_MAP[m.id];});
  if(!played.length){c.innerHTML='<p style="color:#475569;font-size:11px;padding:16px">Données disponibles dès le premier match joué.</p>';return;}

  var aggregated={}; // fullName → {team, role, totalRating, totalMinutes, goals, assists, matches}

  for(var i=0;i<played.length;i++){
    var match=played[i];
    var eid=ESPN_ID_MAP[match.id];
    try{
      var summary=await fetch(ESPN_BASE+'/summary?event='+eid).then(function(r){return r.json();});
      var rosters=summary.rosters||[];
      if(!rosters.length)continue;
      var stats=await loadMatchPlayerStats(eid,rosters);
      Object.entries(stats).forEach(function(entry){
        var name=entry[0],s=entry[1];
        if(!s.rating||!s.minutes||s.minutes<1)return;
        if(s.role==='GK')return; // GK dans onglet dédié
        if(!aggregated[name])aggregated[name]={team:s.team,role:s.role,totalRating:0,totalMinutes:0,goals:0,assists:0,saves:0,matches:0};
        var a=aggregated[name];
        // Rating pondéré par minutes
        a.totalRating+=s.rating*s.minutes;
        a.totalMinutes+=s.minutes;
        a.goals+=s.goals||0;
        a.assists+=s.assists||0;
        a.saves+=s.saves||0;
        a.matches++;
      });
    }catch(e){console.warn('fetchPlayerRankings match',eid,e.message);}
  }

  // Calculer rating moyen pondéré, filtrer joueurs avec moins de 45 min au total
  var ranking=Object.entries(aggregated)
    .filter(function(e){return e[1].totalMinutes>=45;})
    .map(function(e){
      var a=e[1];
      return {name:e[0],team:a.team,role:a.role,rating:Math.round(a.totalRating/a.totalMinutes*10)/10,minutes:a.totalMinutes,goals:a.goals,assists:a.assists,saves:a.saves,matches:a.matches};
    })
    .sort(function(a,b){return b.rating-a.rating;});

  if(!ranking.length){c.innerHTML='<p style="color:#475569;font-size:11px;padding:16px">Aucune donnée disponible.</p>';return;}

  var html='<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;padding:4px 12px;">';
  // En-tête
  html+='<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:8px;color:#475569;font-weight:700">'+
    '<span style="min-width:20px">#</span>'+
    '<span style="flex:1">Joueur</span>'+
    '<span style="min-width:30px;text-align:center">MJ</span>'+
    '<span style="min-width:30px;text-align:center;color:#22c55e">⚽</span>'+
    '<span style="min-width:30px;text-align:center;color:#0ea5e9">→</span>'+
    '<span style="min-width:36px;text-align:center">★ Note</span>'+
    '</div>';
  ranking.forEach(function(p,i){
    var rankColor=i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#cd7f32':'#475569';
    var rc=ratingColor(p.rating);
    var roleLabel={'GK':'Gard.','DEF':'Def.','FB':'Lat.','DM':'M.Def','CM':'Mil.','AM':'M.Off','FW':'Att.'}[p.role]||p.role;
    html+='<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'+
      '<span style="min-width:20px;font-size:9px;font-weight:700;color:'+rankColor+'">'+(i+1)+'</span>'+
      '<span style="flex:1;font-size:10px;color:#e2e8f0">'+p.name+
        '<span style="font-size:8px;color:#475569;margin-left:4px">('+p.team+')</span>'+
        '<span style="font-size:7px;color:#334155;margin-left:3px;background:rgba(255,255,255,0.05);border-radius:2px;padding:1px 3px">'+roleLabel+'</span>'+
      '</span>'+
      '<span style="min-width:30px;text-align:center;font-size:9px;color:#475569">'+p.matches+'</span>'+
      (p.goals?'<span style="min-width:30px;text-align:center;font-size:10px;font-weight:700;color:#22c55e">'+p.goals+'</span>':'<span style="min-width:30px"></span>')+
      (p.assists?'<span style="min-width:30px;text-align:center;font-size:10px;font-weight:700;color:#0ea5e9">'+p.assists+'</span>':'<span style="min-width:30px"></span>')+
      '<span style="min-width:36px;text-align:right;font-size:11px;font-weight:800;color:'+rc+'">'+p.rating.toFixed(1)+'</span>'+
      '</div>';
  });
  html+='</div>';
  c.innerHTML=html;
  playersLoaded=true;
}

function renderGrpFilters(){
  var c=document.getElementById('grp-filters');c.innerHTML='';
  var all=document.createElement('button');all.className='grp-btn';all.textContent='Tous';
  if(activeFilter==='all'){all.style.background='#0ea5e922';all.style.borderColor='#0ea5e9';all.style.color='#0ea5e9';}
  all.addEventListener('click',function(){activeFilter='all';renderAll();});c.appendChild(all);
  Object.entries(GC).forEach(function(e){var g=e[0],col=e[1];
    var btn=document.createElement('button');btn.className='grp-btn';btn.textContent='Gr.'+g;
    // Actif : couleur pleine ; inactif : couleur atténuée visible
    if(activeFilter===g){
      btn.style.background=hex2rgba(col,.18);btn.style.borderColor=col;btn.style.color=col;
    } else {
      btn.style.borderColor=hex2rgba(col,.35);btn.style.color=hex2rgba(col,.6);
    }
    btn.addEventListener('click',function(){activeFilter=g;renderAll();});c.appendChild(btn);
  });
}

function renderGroupsTimeline(){
  var c=document.getElementById('groups-timeline');c.innerHTML='';
  var filtered=activeFilter==='all'?allMatches.filter(function(m){return !m.ko;}):allMatches.filter(function(m){return m.grp===activeFilter;});
  groupByDate(filtered).forEach(function(e){renderDayBlock(e[0],e[1],c);});
}

function renderKOTimeline(){
  var c=document.getElementById('knockout-timeline');c.innerHTML='';
  groupByDate(allMatches.filter(function(m){return m.ko;})).forEach(function(e){renderDayBlock(e[0],e[1],c);});
}

function renderKOLegend(){
  var c=document.getElementById('ko-legend');c.innerHTML='';
  [{label:'32es',color:'#8b5cf6',date:'28 Juin\u20133 Juil.'},{label:'16es',color:'#f59e0b',date:'4\u20137 Juil.'},{label:'Quarts',color:'#ef4444',date:'9\u201311 Juil.'},{label:'Demis',color:'#f97316',date:'14\u201315 Juil.'},{label:'Finale',color:'#fbbf24',date:'19 Juil.'}].forEach(function(p){
    var s=document.createElement('span');s.className='phase-badge';s.style.background=hex2rgba(p.color,.1);s.style.border='1px solid '+hex2rgba(p.color,.3);s.style.color=p.color;
    s.innerHTML=p.label+' <span style="opacity:.6">'+p.date+'</span>';c.appendChild(s);
  });
}

function renderStandings(){
  var grid=document.getElementById('standings-grid');grid.innerHTML='';
  if(!Object.keys(standings).length){grid.innerHTML='<p style="color:#475569;font-size:11px;padding:12px">Classements disponibles d\u00e8s le d\u00e9but du tournoi.</p>';return;}
  Object.entries(GC).forEach(function(e){var g=e[0],col=e[1];
    if(!standings[g])return;
    var card=document.createElement('div');card.className='standing-card';card.style.borderColor=hex2rgba(col,.3);
    var hdr=document.createElement('div');hdr.className='standing-card-header';hdr.style.background=hex2rgba(col,.15);hdr.style.color=col;hdr.textContent='GROUPE '+g;card.appendChild(hdr);
    var grpPlayed=standings[g].some(function(r){return r.played>0;});
    standings[g].forEach(function(r,i){
      var qualified=grpPlayed&&i<2;
      var row=document.createElement('div');row.className='standing-row';
      var dot=document.createElement('div');dot.className='qualified-dot';dot.style.background=qualified?col:i===2&&grpPlayed?hex2rgba(col,.4):'#1e3a5f';
      var pos=document.createElement('span');pos.className='standing-pos';pos.style.color=qualified?col:'#475569';pos.textContent=r.pos+'.';
      var team=document.createElement('span');team.className='standing-team';team.textContent=r.team;
      var pts=document.createElement('span');pts.className='standing-pts';pts.style.color=qualified?col:'#64748b';pts.textContent=r.pts;
      var stats=document.createElement('span');stats.className='standing-stats';stats.textContent=r.played+'J '+(r.gd>0?'+':'')+r.gd;
      row.appendChild(dot);row.appendChild(pos);row.appendChild(team);row.appendChild(pts);row.appendChild(stats);card.appendChild(row);
    });
    grid.appendChild(card);
  });
}

var keepersLoaded=false;

async function fetchKeepers(){
  var c=document.getElementById('keepers-list');
  if(!c)return;
  c.innerHTML='<p style="color:#475569;font-size:11px;padding:16px">⏳ Calcul en cours…</p>';
  var played=allMatches.filter(function(m){return m.isFT&&ESPN_ID_MAP[m.id];});
  if(!played.length){c.innerHTML='<p style="color:#475569;font-size:11px;padding:16px">Données disponibles dès le premier match joué.</p>';return;}
  var keeperStats={};
  for(var i=0;i<played.length;i++){
    var match=played[i];var eid=ESPN_ID_MAP[match.id];
    try{
      var r=await fetch(ESPN_BASE+'/summary?event='+eid);
      var d=await r.json();
      var bsTeams=d.boxscore&&d.boxscore.teams||[];
      var savesMap={};
      bsTeams.forEach(function(bt){
        var saveStat=bt.statistics&&bt.statistics.find(function(s){return s.name==='saves';});
        savesMap[bt.team&&bt.team.displayName||'']=saveStat?parseInt(saveStat.displayValue)||0:0;
      });
      var rosters=d.rosters||[];
      rosters.forEach(function(roster){
        var teamName=roster.team&&roster.team.displayName||'';
        var gk=roster.roster&&roster.roster.find(function(p){return p.starter&&p.position&&p.position.abbreviation==='G';});
        if(!gk)return;
        var gkName=gk.athlete&&gk.athlete.displayName||'';if(!gkName)return;
        var score=match.score||'';
        var parts=score.split('–').map(function(x){return parseInt(x.trim())||0;});
        var isHome=roster.homeAway==='home';
        var ga=parts.length===2?(isHome?parts[1]:parts[0]):0;
        var saves=savesMap[teamName]||0;
        if(!keeperStats[gkName])keeperStats[gkName]={team:normTeam(teamName),saves:0,ga:0,matches:0};
        keeperStats[gkName].saves+=saves;keeperStats[gkName].ga+=ga;keeperStats[gkName].matches++;
      });
    }catch(e){}
  }
  var ranking=Object.entries(keeperStats)
    .map(function(e){return Object.assign({name:e[0]},e[1]);})
    .sort(function(a,b){return (a.ga-b.ga)||(b.saves-a.saves);});
  if(!ranking.length){c.innerHTML='<p style="color:#475569;font-size:11px;padding:16px">Aucune donnée disponible.</p>';return;}
  var html='<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;padding:4px 12px;">';
  html+='<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:8px;color:#475569;font-weight:700">'+
    '<span style="min-width:20px">#</span><span style="flex:1">Gardien</span>'+
    '<span style="min-width:36px;text-align:center">MJ</span>'+
    '<span style="min-width:36px;text-align:center;color:#22c55e">Arrêts</span>'+
    '<span style="min-width:36px;text-align:center;color:#ef4444">Enc.</span></div>';
  ranking.forEach(function(k,i){
    var rankColor=i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#cd7f32':'#475569';
    html+='<div class="scorer-row">'+
      '<span class="scorer-rank" style="color:'+rankColor+'">'+(i+1)+'</span>'+
      '<span class="scorer-name">'+k.name+'<span style="font-size:9px;color:#64748b;font-weight:400;margin-left:4px">('+k.team+')</span></span>'+
      '<span style="font-size:10px;color:#64748b;min-width:36px;text-align:center">'+k.matches+'</span>'+
      '<span style="font-size:12px;font-weight:800;color:#22c55e;min-width:36px;text-align:center">'+k.saves+'</span>'+
      '<span style="font-size:12px;font-weight:800;color:#ef4444;min-width:36px;text-align:center">'+k.ga+'</span>'+
      '</div>';
  });
  html+='</div>';c.innerHTML=html;keepersLoaded=true;
}
