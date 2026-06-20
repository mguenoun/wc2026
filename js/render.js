// ─── LISTE DES MATCHS ────────────────────────────────────────────────────────

function renderMatchRow(m){
  var sel=selectedId===m.id;
  var row=document.createElement('div');
  row.className='match-row';
  if(sel){row.style.background=hex2rgba(m.color,0.1);row.style.borderLeft='3px solid '+m.color;row.style.paddingLeft='7px';}

  var bg=document.createElement('span');bg.className='grp-badge';bg.style.background=hex2rgba(m.color,0.15);bg.style.color=m.color;bg.textContent=m.grp?'Gr.'+m.grp:(m.phase||'');
  var mid=document.createElement('span');mid.className='match-id';mid.textContent=m.id.length>4?'':m.id;
  var tim=document.createElement('span');tim.className='match-time';tim.textContent=localTime(m);

  var teams=document.createElement('span');teams.className='match-teams';
  var _t1=m.t1||'?',_t2=m.t2||'?';
  var _f1=flagEmoji(m.t1),_f2=flagEmoji(m.t2);
  if(m.ko){
    var _r1=resolveKOTeam(m.t1),_r2=resolveKOTeam(m.t2);
    if(_r1)_t1+=' <span class="ko-res">('+_r1+')</span>';
    if(_r2)_t2+=' <span class="ko-res">('+_r2+')</span>';
  }
  teams.innerHTML=(_f1?_f1+' ':'')+_t1+'<span class="vs">–</span>'+(_f2?_f2+' ':'')+_t2;

  var sc=document.createElement('span');sc.className='match-score';sc.style.color=m.color;
  if(m.isLive){
    sc.innerHTML='<span style="font-size:12px;font-weight:900;color:#22c55e;animation:pulse 1.5s infinite">⚡ '+(m.score||'0–0')+'</span>'+
      (m.clockDisplay?'<span style="font-size:8px;color:#22c55e;display:block;text-align:center;line-height:1.2">'+m.clockDisplay+'</span>':'');
  }
  else if(m.isFT&&m.score){sc.textContent=m.score;sc.style.color='#e2e8f0';}
  else {
    var pred = predictions && predictions[m.id];
    if (pred) {
      var _scoreColor = pred.hasStats ? '#f59e0b' : '#64748b';
      var _wc = pred.probW >= pred.probL ? '#22c55e' : '#94a3b8';
      var _lc = pred.probL >= pred.probW ? '#f87171' : '#94a3b8';
      if (!pred.hasStats) { _wc = '#94a3b8'; _lc = '#94a3b8'; }
      sc.innerHTML =
        '<span style="display:block;font-size:10px;font-weight:700;color:' + _scoreColor + ';text-align:center;white-space:nowrap">🎯 ' + pred.score + '</span>' +
        '<span style="display:block;font-size:7px;text-align:center;letter-spacing:.02em;white-space:nowrap">' +
          '<span style="color:' + _wc + '">V' + pred.probW + '%</span>' +
          '<span style="color:#475569">·</span>' +
          '<span style="color:#64748b">N' + pred.probD + '%</span>' +
          '<span style="color:#475569">·</span>' +
          '<span style="color:' + _lc + '">D' + pred.probL + '%</span>' +
        '</span>';
      sc.title = (pred.hasStats ? 'Poisson' : 'Poisson (pas encore de stats)') + ' λ=' + pred.lambdaA + ' / ' + pred.lambdaB;
    } else {
      sc.innerHTML = '<span class="status-ns">–</span>';
    }
  }

  var city=document.createElement('span');city.className='match-city';
  city.textContent=m.city?(m.venue?'📍'+m.venue+' · '+m.city:'📍'+m.city):'';

  row.appendChild(bg);row.appendChild(mid);row.appendChild(tim);row.appendChild(teams);row.appendChild(sc);row.appendChild(city);

  if(m.last){var t=document.createElement('span');t.className='tag';t.style.background=hex2rgba(m.color,.2);t.style.color=m.color;t.textContent='J3';row.appendChild(t);}

  // Action icons
  var actions=document.createElement('div');actions.className='match-actions';
  actions.onclick=function(e){e.stopPropagation();};

  if(m.isLive||m.isFT){
    var btnInfo=document.createElement('button');btnInfo.className='action-btn';btnInfo.title='Stats du match';btnInfo.textContent='📊';btnInfo.style.color=m.color;
    btnInfo.onclick=function(){openMatchInfo(m);};
    actions.appendChild(btnInfo);
    if(ESPN_ID_MAP[m.id]){
      var _m=m, _eid=ESPN_ID_MAP[m.id];
      var btnLineup=document.createElement('button');
      btnLineup.className='action-btn';
      btnLineup.title='Compositions';
      btnLineup.textContent='👕';
      btnLineup.style.color=_m.color;
      btnLineup.addEventListener('click',function(e){
        e.stopPropagation();
        _currentMatch=_m;
        openLineupESPN(_eid);
      });
      actions.appendChild(btnLineup);
    }
    if(m.isFT){
      var ytQ=m.t1+' '+m.t2+' FIFA World Cup 2026 highlights';
      var btnYt=document.createElement('a');
      btnYt.href='https://www.youtube.com/results?search_query='+encodeURIComponent(ytQ);
      btnYt.target='_blank';btnYt.rel='noopener';
      btnYt.title='Résumé du match sur YouTube';
      btnYt.style.cssText='font-size:13px;padding:2px 4px;color:#22c55e;text-decoration:none;line-height:1;flex-shrink:0';
      btnYt.textContent='▶';
      actions.appendChild(btnYt);
    }
  }
  if(m.venue&&VENUE_COORDS[m.venue]){
    var btnMap=document.createElement('button');btnMap.className='action-btn';btnMap.title='Voir le stade';btnMap.textContent='🗺️';
    btnMap.onclick=function(){openMap(m);};
    actions.appendChild(btnMap);
  }
  if(actions.childNodes.length)row.appendChild(actions);

  row.addEventListener('click',function(){selectedId=selectedId===m.id?null:m.id;renderAll();});
  return row;
}

function renderDayBlock(dateLabel,matches,container){
  var isToday=matches[0]&&matches[0].dayKey===TODAY_STR;
  var block=document.createElement('div');block.className='day-block';
  var tlCol=document.createElement('div');tlCol.className='timeline-col';
  var dot=document.createElement('div');dot.className='tl-dot'+(isToday?' today':'');
  var line=document.createElement('div');line.className='tl-line';
  tlCol.appendChild(dot);tlCol.appendChild(line);
  var content=document.createElement('div');content.className='day-content';
  var hdr=document.createElement('div');hdr.className='day-header';
  var lbl=document.createElement('span');lbl.className='day-label'+(isToday?' today':'');lbl.textContent=dateLabel;
  var cnt=document.createElement('span');cnt.className='match-count';cnt.textContent=matches.length+' match'+(matches.length>1?'s':'');
  hdr.appendChild(lbl);hdr.appendChild(cnt);
  if(isToday){var tod=document.createElement('span');tod.className='today-tag';tod.textContent="AUJOURD'HUI";hdr.appendChild(tod);}
  var list=document.createElement('div');list.className='match-list';
  matches.forEach(function(m){list.appendChild(renderMatchRow(m));});
  content.appendChild(hdr);content.appendChild(list);
  block.appendChild(tlCol);block.appendChild(content);
  container.appendChild(block);
}

// ─── FILTRES GROUPES + TOGGLE VUE ────────────────────────────────────────────

var grpCalView = 'list'; // 'list' ou 'calendar'

function renderGrpFilters(){
  // Toggle liste / calendrier
  var tog=document.getElementById('grp-view-toggle');
  if(tog){
    tog.innerHTML='';
    [{v:'list',icon:'📋',lbl:'Liste'},{v:'calendar',icon:'📅',lbl:'Calendrier'}].forEach(function(o){
      var btn=document.createElement('button');btn.className='ko-sw-btn'+(grpCalView===o.v?' ko-sw-active':'');
      btn.textContent=o.icon+' '+o.lbl;
      btn.addEventListener('click',function(){grpCalView=o.v;renderAll();});
      tog.appendChild(btn);
    });
  }
  var c=document.getElementById('grp-filters');c.innerHTML='';
  var all=document.createElement('button');all.className='grp-btn';all.textContent='Tous';
  if(activeFilter==='all'){all.style.background='#0ea5e922';all.style.borderColor='#0ea5e9';all.style.color='#0ea5e9';}
  all.addEventListener('click',function(){activeFilter='all';renderAll();});c.appendChild(all);
  Object.entries(GC).forEach(function(e){var g=e[0],col=e[1];
    var btn=document.createElement('button');btn.className='grp-btn';btn.textContent='Gr.'+g;
    if(activeFilter===g){
      btn.style.background=hex2rgba(col,.18);btn.style.borderColor=col;btn.style.color=col;
    } else {
      btn.style.borderColor=hex2rgba(col,.35);btn.style.color=hex2rgba(col,.6);
    }
    btn.addEventListener('click',function(){activeFilter=g;renderAll();});c.appendChild(btn);
  });
}

function renderGroupsTimeline(){
  if(grpCalView==='calendar'){renderGroupsCalendar();return;}
  var c=document.getElementById('groups-timeline');c.innerHTML='';
  var filtered=activeFilter==='all'?allMatches.filter(function(m){return !m.ko;}):allMatches.filter(function(m){return m.grp===activeFilter;});
  groupByDate(filtered).forEach(function(e){renderDayBlock(e[0],e[1],c);});
}

// ─── VUE CALENDRIER GROUPES ──────────────────────────────────────────────────

function renderGroupsCalendar(){
  var c=document.getElementById('groups-timeline');c.innerHTML='';
  var filtered=activeFilter==='all'
    ?allMatches.filter(function(m){return !m.ko;})
    :allMatches.filter(function(m){return m.grp===activeFilter;});

  // Dates uniques triees
  var daySet={},days=[];
  filtered.forEach(function(m){if(m.dayKey&&!daySet[m.dayKey]){daySet[m.dayKey]=true;days.push(m.dayKey);}});
  days.sort();

  // Stades uniques dans l ordre chronologique de leur premier match
  var venueSet={},venues=[];
  filtered.slice().sort(function(a,b){return (a.dayKey||'')>(b.dayKey||'')?1:-1;})
    .forEach(function(m){if(m.venue&&!venueSet[m.venue]){venueSet[m.venue]=true;venues.push(m.venue);}});

  // Index [venue][dayKey]->[matches]
  var idx={};
  filtered.forEach(function(m){
    if(!idx[m.venue])idx[m.venue]={};
    if(!idx[m.venue][m.dayKey])idx[m.venue][m.dayKey]=[];
    idx[m.venue][m.dayKey].push(m);
  });

  var CW=108,VW=118;
  var DAY=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  var MON=['Jan','Fev','Mar','Avr','Mai','Jun','Jul','Aou','Sep','Oct','Nov','Dec'];
  var todayColIdx=-1;

  var wrap=document.createElement('div');
  wrap.style.cssText='overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:8px;';

  var tbl=document.createElement('table');
  tbl.style.cssText='border-collapse:collapse;table-layout:fixed;min-width:'+(VW+days.length*CW)+'px;';

  // En-tete : coin + colonnes dates
  var thead=document.createElement('thead');
  var hrow=document.createElement('tr');
  var corner=document.createElement('th');
  corner.style.cssText='position:sticky;left:0;z-index:3;background:#07101f;width:'+VW+'px;min-width:'+VW+'px;padding:3px 6px;font-size:8px;color:#334155;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);text-align:left;';
  corner.textContent='Stade · Ville';
  hrow.appendChild(corner);
  days.forEach(function(dk,i){
    var th=document.createElement('th');
    var isToday=dk===TODAY_STR;
    if(isToday)todayColIdx=i;
    var d=new Date(dk+'T12:00:00Z');
    th.style.cssText='width:'+CW+'px;min-width:'+CW+'px;padding:3px 2px;font-size:8px;font-weight:'+(isToday?'800':'600')+';'
      +'color:'+(isToday?'#fbbf24':'#475569')+';border-bottom:1px solid rgba(255,255,255,0.08);text-align:center;'
      +(isToday?'background:rgba(251,191,36,0.05);':'');
    th.textContent=DAY[d.getUTCDay()]+' '+d.getUTCDate()+' '+MON[d.getUTCMonth()];
    hrow.appendChild(th);
  });
  thead.appendChild(hrow);
  tbl.appendChild(thead);

  // Corps : une ligne par stade
  var tbody=document.createElement('tbody');
  venues.forEach(function(venue){
    var vc=VENUE_COORDS[venue];
    var city=vc?vc.city:(filtered.find(function(m){return m.venue===venue;})||{}).city||venue;
    var shortV=venue.replace(/^Estadio /,'').replace(/ Stadium$/,'').replace(/ Field$/,'').trim();
    var tr=document.createElement('tr');

    var vTd=document.createElement('td');
    vTd.style.cssText='position:sticky;left:0;z-index:2;background:#08101f;width:'+VW+'px;min-width:'+VW+'px;'
      +'padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.05);border-right:1px solid rgba(255,255,255,0.07);vertical-align:middle;';
    vTd.innerHTML='<div style="font-size:9px;font-weight:700;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:'+(VW-14)+'px" title="'+venue+'">'+shortV+'</div>'
      +'<div style="font-size:8px;color:#475569;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+city+'</div>';
    tr.appendChild(vTd);

    days.forEach(function(dk){
      var td=document.createElement('td');
      var isToday=dk===TODAY_STR;
      var matches=(idx[venue]&&idx[venue][dk])||[];
      td.style.cssText='width:'+CW+'px;min-width:'+CW+'px;padding:2px 3px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:top;'+(isToday?'background:rgba(251,191,36,0.03);':'');
      matches.forEach(function(m){
        var card=document.createElement('div');
        var isLive=m.isLive;
        var scoreStr=(m.score&&(m.isFT||isLive))?m.score:localTime(m);
        var scoreCol=isLive?'#22c55e':m.isFT?'#94a3b8':'#475569';
        var f1=flagEmoji(m.t1),f2=flagEmoji(m.t2);
        card.style.cssText='background:'+(isLive?'rgba(239,68,68,0.08)':'rgba(255,255,255,0.02)')+';'
          +'border:1px solid '+(isLive?'rgba(239,68,68,0.2)':'rgba(255,255,255,0.06)')+';'
          +'border-left:2px solid '+(m.color||'#334155')+';'
          +'border-radius:5px;padding:3px 4px;cursor:pointer;margin-bottom:2px;';
        card.innerHTML=
          '<div style="display:flex;justify-content:space-between;margin-bottom:2px;">'
            +'<span style="font-size:7px;font-weight:800;color:'+(m.color||'#475569')+'">Gr.'+m.grp+'</span>'
            +'<span style="font-size:7px;color:'+scoreCol+'">'+scoreStr+'</span>'
          +'</div>'
          +'<div style="font-size:9px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(f1?f1+' ':'')+m.t1+'</div>'
          +'<div style="font-size:9px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(f2?f2+' ':'')+m.t2+'</div>';
        card.addEventListener('click',function(){selectedId=selectedId===m.id?null:m.id;renderAll();if(selectedId)openMatchInfo(m);});
        td.appendChild(card);
      });
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  c.appendChild(wrap);

  // Scroll vers aujourd hui
  if(todayColIdx>=0){
    setTimeout(function(){wrap.scrollLeft=Math.max(0,VW+todayColIdx*CW-80);},50);
  }
}

// Ordre des phases KO et couleurs associées
var KO_PHASES=[
  {key:'16es', label:'16es de fin.', color:'#8b5cf6'},
  {key:'8es',  label:'8es de fin.',  color:'#f59e0b'},
  {key:'Quarts', label:'Quarts', color:'#ef4444'},
  {key:'Demis', label:'Demis', color:'#f97316'},
  {key:'Finale', label:'Finale', color:'#fbbf24'},
];

var koBracketView='list'; // 'list' ou 'bracket'
var _thirdAssign = null;  // Map : "3e X/Y/Z" → team, recalculée à chaque render KO

// Collecte et trie les 3e places de tous les groupes ayant joué au moins 1 match
function getAll3rd() {
  var all3rd = [];
  Object.keys(standings).forEach(function(g) {
    var s = standings[g];
    if (!s || !s.length) return;
    // Inclure dès qu'au moins 1 match du groupe est joué (même si la 3e n'a pas encore joué)
    var grpHasPlayed = s.some(function(r) { return r.played > 0; });
    if (!grpHasPlayed) return;
    var third = s.find(function(r) { return r.pos === 3; }) || s[2];
    if (!third) return;
    // Si le 2e a exactement les mêmes stats que le 3e → ex æquo, on les affiche ensemble
    var second = s.find(function(r) { return r.pos === 2; }) || s[1];
    var coTeam = (second && second.pts === third.pts && second.gd === third.gd && second.gf === third.gf)
      ? second.team : null;
    all3rd.push({ group: g, team: third.team, pts: third.pts, gd: third.gd, gf: third.gf, played: Math.max(third.played, coTeam && second ? second.played : 0), coTeam: coTeam });
  });
  all3rd.sort(function(a, b) { return (b.pts - a.pts) || (b.gd - a.gd) || (b.gf - a.gf); });
  return all3rd;
}

// Construit l'assignation globale des 3e places via matching bipartite
// Garantit que chaque équipe va dans un slot dont son groupe fait partie
function buildThirdAssign() {
  var assign = new Map();
  if (!standings || !allMatches) return assign;
  var all3rd = getAll3rd();
  var top8groups = all3rd.slice(0, 8).map(function(t) { return t.group; });
  var qualified = all3rd.filter(function(t) { return top8groups.indexOf(t.group) >= 0; });

  // Collecter tous les slots "3e X/Y/Z..." uniques dans les matchs KO
  var slots = [];
  allMatches.filter(function(m) { return m.ko; }).forEach(function(m) {
    [m.t1, m.t2].forEach(function(ts) {
      if (!ts) return;
      var rx = ts.match(/^3e ([A-L](?:\/[A-L])+)$/);
      if (rx && !slots.find(function(s) { return s.key === ts; }))
        slots.push({ key: ts, groups: rx[1].split('/') });
    });
  });

  // Matching bipartite (chemin augmentant) : slot → groupe qualifié
  var slotToGroup = {}, groupToSlot = {};
  function augment(slotKey, visited) {
    var slot = slots.find(function(s) { return s.key === slotKey; });
    if (!slot) return false;
    for (var i = 0; i < qualified.length; i++) {
      var g = qualified[i].group;
      if (slot.groups.indexOf(g) < 0 || visited[g]) continue;
      visited[g] = true;
      if (!groupToSlot[g] || augment(groupToSlot[g], visited)) {
        slotToGroup[slotKey] = g; groupToSlot[g] = slotKey; return true;
      }
    }
    return false;
  }
  slots.forEach(function(slot) { if (!slotToGroup[slot.key]) augment(slot.key, {}); });

  // Construire la Map finale slot → nom d'équipe (inclut le coTeam si ex æquo)
  Object.keys(slotToGroup).forEach(function(slotKey) {
    var entry = all3rd.find(function(t) { return t.group === slotToGroup[slotKey]; });
    if (entry) assign.set(slotKey, entry.coTeam ? entry.team + ' / ' + entry.coTeam : entry.team);
  });
  return assign;
}

// Onglet Meilleurs 3èmes
function renderThirds() {
  var c = document.getElementById('thirds-list');
  if (!c) return;
  if (!Object.keys(standings).length) {
    c.innerHTML = '<p style="color:#475569;font-size:11px;padding:12px">Disponible dès le début du tournoi.</p>';
    return;
  }
  var all3rd = getAll3rd();
  if (!all3rd.length) {
    c.innerHTML = '<p style="color:#475569;font-size:11px;padding:12px">Aucun match de groupe joué.</p>';
    return;
  }

  // Statut définitif : tous les matchs du groupe terminés
  var groupDone = {};
  Object.keys(standings).forEach(function(g) {
    var gMatches = allMatches.filter(function(m) { return m.grp === g && !m.ko; });
    groupDone[g] = gMatches.length >= 3 && gMatches.every(function(m) { return m.isFT; });
  });
  var allDone = all3rd.length === 12 && all3rd.every(function(t) { return groupDone[t.group]; });

  var html = '<div style="margin-bottom:6px;font-size:9px;color:' + (allDone ? '#22c55e' : '#f59e0b') + ';font-weight:700">' +
    (allDone ? '✓ Classement définitif' : '⏳ Classement provisoire — ' + all3rd.length + '/12 groupes joués') + '</div>';

  html += '<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;padding:4px 12px">';
  html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:8px;color:#475569;font-weight:700">' +
    '<span style="min-width:20px">#</span>' +
    '<span style="min-width:22px">Gr.</span>' +
    '<span style="flex:1">Équipe</span>' +
    '<span style="min-width:28px;text-align:center">MJ</span>' +
    '<span style="min-width:28px;text-align:center;color:#e2e8f0">Pts</span>' +
    '<span style="min-width:36px;text-align:center;color:#22c55e">DB</span>' +
    '<span style="min-width:28px;text-align:center;color:#0ea5e9">BP</span>' +
    '</div>';

  // Rangs d'affichage : standard compétition (1,1,3,3...) par LIGNES — un couple
  // coTeam n'occupe qu'une ligne car un seul des deux qualifiants restera.
  // La sélection top-8 reste sur l'index (i < 8), indépendamment des rangs affichés.
  var dispRanks = [];
  all3rd.forEach(function(t, i) {
    if (i === 0) { dispRanks[0] = 1; return; }
    var p = all3rd[i - 1];
    dispRanks[i] = (p.pts === t.pts && p.gd === t.gd && p.gf === t.gf) ? dispRanks[i - 1] : i + 1;
  });

  var sepInserted = false;
  all3rd.forEach(function(t, i) {
    var rank = dispRanks[i];
    var qualified = i < 8;
    var isInterExAequo = (i > 0 && dispRanks[i] === dispRanks[i - 1]) ||
                         (i < all3rd.length - 1 && dispRanks[i] === dispRanks[i + 1]);
    if (!qualified && !sepInserted) {
      html += '<div style="text-align:center;font-size:8px;color:#ef4444;padding:4px 0;letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.04)">— Non qualifiés —</div>';
      sepInserted = true;
    }
    var rankColor = rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7f32' : qualified ? '#22c55e' : '#475569';
    var grpColor = GC[t.group] || '#64748b';
    var isDone = groupDone[t.group];
    html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);' +
      (qualified ? 'background:rgba(34,197,94,0.04)' : '') + '">' +
      '<span style="min-width:20px;font-size:9px;font-weight:700;color:' + rankColor + '">' + rank + '</span>' +
      '<span style="min-width:22px;font-size:8px;font-weight:700;color:' + grpColor + '">Gr.' + t.group + '</span>' +
      '<span style="flex:1;font-size:10px;color:#e2e8f0">' + t.team +
        (isInterExAequo && !t.coTeam ? '<span style="font-size:7px;color:#f59e0b;margin-left:3px">ex æq.</span>' : '') +
        (t.coTeam ? '<span style="font-size:8px;color:#94a3b8;margin-left:3px">/ ' + t.coTeam + '</span><span style="font-size:7px;color:#f59e0b;margin-left:3px">ex æq.</span>' : '') +
        (qualified ? '<span style="font-size:8px;color:#22c55e;margin-left:4px">✓</span>' : '') +
        (!isDone ? '<span style="font-size:7px;color:#f59e0b;margin-left:3px">prov.</span>' : '') +
      '</span>' +
      '<span style="min-width:28px;text-align:center;font-size:9px;color:#475569">' + t.played + '</span>' +
      '<span style="min-width:28px;text-align:center;font-size:11px;font-weight:800;color:#e2e8f0">' + t.pts + '</span>' +
      '<span style="min-width:36px;text-align:center;font-size:10px;font-weight:700;color:#22c55e">' + (t.gd > 0 ? '+' : '') + t.gd + '</span>' +
      '<span style="min-width:28px;text-align:center;font-size:10px;font-weight:700;color:#0ea5e9">' + t.gf + '</span>' +
      '</div>';
  });

  html += '</div>';
  c.innerHTML = html;
}

// Résout le nom d'équipe réel pour un placeholder KO (standings ou résultat)
function resolveMatchWinner(matchId, wantLoser){
  var m=allMatches.find(function(x){return x.id===matchId;});
  if(!m||!m.isFT||!m.score)return null;
  var parts=m.score.split(' – ');
  var s1=parseInt(parts[0])||0,s2=parseInt(parts[1])||0;
  if(s1===s2)return null; // prolongations/tirs au but : score FT à égalité
  return wantLoser?(s1>s2?m.t2:m.t1):(s1>s2?m.t1:m.t2);
}

function resolveKOTeam(teamStr){
  if(!teamStr)return null;

  // "1er Gr.X" ou "2e Gr.X"
  var m1=teamStr.match(/^(1er|2e) Gr\.([A-L])$/);
  if(m1){
    var pos=m1[1]==='1er'?0:1;
    var grp=standings&&standings[m1[2]];
    if(!grp||!grp[pos])return null;
    var t=grp[pos];
    // Pour "2e Gr.X" : si 1er et 2e sont ex æquo, le slot "2e" montre le même couple que "1er"
    if(pos===1){
      var above=grp[0];
      if(above&&above.pts===t.pts&&above.gd===t.gd&&above.gf===t.gf)
        return above.team+' / '+t.team;
    }
    // Ex æquo vers le bas : 1er/2e (pos=0) ou 2e/3e (pos=1) ont les mêmes stats
    var adj=grp[pos+1];
    if(adj&&adj.pts===t.pts&&adj.gd===t.gd&&adj.gf===t.gf)return t.team+' / '+adj.team;
    return t.team;
  }

  // "3e A/B/C/D/F" — résolution globale via _thirdAssign (évite doublons)
  var m5=teamStr.match(/^3e ([A-L](?:\/[A-L])+)$/);
  if(m5) return (_thirdAssign && _thirdAssign.get(teamStr)) || null;

  // "V M73", "V QF1", "V SF1" etc.
  var m2=teamStr.match(/^V\s+(\S+)$/);
  if(m2)return resolveMatchWinner(m2[1],false);
  var m3=teamStr.match(/^Vainq\.\s+(\S+)$/);
  if(m3)return resolveMatchWinner(m3[1],false);
  var m4=teamStr.match(/^Perdant\s+(\S+)$/);
  if(m4)return resolveMatchWinner(m4[1],true);
  return null;
}

function renderKOTimeline(){
  _thirdAssign = buildThirdAssign();
  var c=document.getElementById('knockout-timeline');
  c.innerHTML='';
  var koMatches=allMatches.filter(function(m){return m.ko;});
  if(koBracketView==='list'){
    groupByDate(koMatches).forEach(function(e){renderDayBlock(e[0],e[1],c);});
  } else {
    renderKOBracket(c, koMatches);
  }
}

function setKOView(v){
  koBracketView=v;
  renderKOTimeline();
}

function renderKOBracket(container, koMatches){
  // Grouper par phase
  var byPhase={};
  KO_PHASES.forEach(function(p){byPhase[p.key]=[];});
  koMatches.forEach(function(m){
    if(byPhase[m.phase]!==undefined) byPhase[m.phase].push(m);
  });

  // Créer le wrapper scrollable
  var wrap=document.createElement('div');
  wrap.style.cssText='overflow-x:auto;padding-bottom:12px';

  var bracket=document.createElement('div');
  bracket.id='ko-bracket';
  bracket.style.cssText='display:flex;align-items:stretch;min-width:760px;gap:0';
  wrap.appendChild(bracket);
  container.appendChild(wrap);

  KO_PHASES.forEach(function(phase, pi){
    var matches=byPhase[phase.key]||[];

    // Colonne round
    var col=document.createElement('div');
    col.style.cssText='display:flex;flex-direction:column;flex-shrink:0';

    // En-tête phase
    var lbl=document.createElement('div');
    lbl.style.cssText='font-size:9px;font-weight:700;color:'+phase.color+';text-align:center;padding-bottom:8px;letter-spacing:.08em;text-transform:uppercase';
    lbl.textContent=phase.label;
    col.appendChild(lbl);

    // Conteneur cartes
    var cardsDiv=document.createElement('div');
    cardsDiv.id='ko-col-'+phase.key;
    cardsDiv.style.cssText='display:flex;flex-direction:column;justify-content:space-around;flex:1;gap:0';

    // Nombre de slots selon la phase
    var slots=phase.key==='32es'?16:phase.key==='16es'?8:phase.key==='Quarts'?4:phase.key==='Demis'?2:1;

    for(var s=0;s<slots;s++){
      var m=matches[s]||null;
      cardsDiv.appendChild(makeBracketCard(m, phase));
    }
    col.appendChild(cardsDiv);
    bracket.appendChild(col);

    // Colonne connecteur SVG (sauf après la finale)
    if(pi < KO_PHASES.length-1){
      var connCol=document.createElement('div');
      connCol.style.cssText='flex-shrink:0;width:24px';
      var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('id','ko-conn-'+phase.key);
      svg.setAttribute('width','24');
      svg.style.display='block';
      connCol.appendChild(svg);
      bracket.appendChild(connCol);
    }
  });

  // Trophée
  var troph=document.createElement('div');
  troph.style.cssText='display:flex;align-items:center;justify-content:center;width:32px;flex-shrink:0;padding-top:26px';
  troph.innerHTML='<span style="font-size:22px">🏆</span>';
  bracket.appendChild(troph);

  // Dessiner les connecteurs après rendu
  setTimeout(function(){drawBracketConnectors();},80);
}

function makeBracketCard(m, phase){
  var card=document.createElement('div');
  card.className='bkt-card'+(m&&m.phase==='Finale'?' bkt-final':'');
  card.style.margin='3px 0';

  if(!m){
    var headE=document.createElement('div');headE.className='bkt-head';
    headE.innerHTML='<span class="bkt-mid">—</span>';
    card.appendChild(headE);
    var r1e=document.createElement('div');r1e.className='bkt-team bkt-tbd';
    r1e.innerHTML='<div class="bkt-left"><span class="bkt-tn">À déterminer</span></div>';
    var r2e=document.createElement('div');r2e.className='bkt-team bkt-tbd';
    r2e.innerHTML='<div class="bkt-left"><span class="bkt-tn">À déterminer</span></div>';
    var fe=document.createElement('div');fe.className='bkt-foot';
    fe.innerHTML='<span class="bkt-venue">—</span><div class="bkt-icons"></div>';
    card.appendChild(r1e);card.appendChild(r2e);card.appendChild(fe);
    return card;
  }

  var isFT=m.isFT, isLive=m.isLive;
  var score=m.score||'';
  var parts=score?score.split(/[–\-]/).map(function(x){return x.trim();}):['',''];
  var s1=parts[0]||'', s2=parts[1]||'';
  var w1=isFT&&s1!==''&&parseInt(s1)>parseInt(s2);
  var w2=isFT&&s2!==''&&parseInt(s2)>parseInt(s1);
  var tbd1=!m.t1||/^(Vainq\.|V\s|Perdant|1er|2e|3e)/.test(m.t1);
  var tbd2=!m.t2||/^(Vainq\.|V\s|Perdant|1er|2e|3e)/.test(m.t2);

  // Noms résolus depuis classements ou résultats précédents
  var res1=resolveKOTeam(m.t1);
  var res2=resolveKOTeam(m.t2);

  // En-tête : numéro de match + date courte
  var head=document.createElement('div');head.className='bkt-head';
  var midSpan=document.createElement('span');midSpan.className='bkt-mid';midSpan.textContent=m.id||'';
  var dateSpan=document.createElement('span');dateSpan.className='bkt-date';
  dateSpan.textContent=m.date?m.date.replace(/^\S+\s+/,''):'';
  head.appendChild(midSpan);head.appendChild(dateSpan);

  // Icônes
  var iconsDiv=document.createElement('div');iconsDiv.className='bkt-icons';
  if(isFT||isLive){
    var eid=ESPN_ID_MAP&&ESPN_ID_MAP[m.id]?ESPN_ID_MAP[m.id]:'';
    var btnStats=document.createElement('button');
    btnStats.className='bkt-ico action-btn';btnStats.title='Stats';btnStats.textContent='📊';
    btnStats.onclick=(function(mid,espnId){return function(e){e.stopPropagation();_currentMatch=allMatches.find(function(x){return x.id===mid;});openMatchInfo(espnId);};})(m.id,eid);
    var btnCompo=document.createElement('button');
    btnCompo.className='bkt-ico action-btn';btnCompo.title='Compositions';btnCompo.textContent='👕';
    btnCompo.onclick=(function(mid,espnId){return function(e){e.stopPropagation();_currentMatch=allMatches.find(function(x){return x.id===mid;});openLineupESPN(espnId);};})(m.id,eid);
    iconsDiv.appendChild(btnStats);iconsDiv.appendChild(btnCompo);
  }
  if(m.venue&&VENUE_COORDS&&VENUE_COORDS[m.venue]){
    var btnMap=document.createElement('button');
    btnMap.className='bkt-ico action-btn';btnMap.title='Stade';btnMap.textContent='📍';
    btnMap.onclick=(function(mid){return function(e){e.stopPropagation();openMap(allMatches.find(function(x){return x.id===mid;}));};})(m.id);
    iconsDiv.appendChild(btnMap);
  }

  var venueShort=m.venue?m.venue.replace(' Stadium','').replace(' Field',''):'';
  var venueLabel=venueShort+(m.city?' · '+m.city:'');

  // Rangée équipe 1
  var row1=document.createElement('div');
  row1.className='bkt-team'+(w1?' bkt-win':'')+(tbd1?' bkt-tbd':'');
  var left1=document.createElement('div');left1.className='bkt-left';
  var tn1=document.createElement('span');tn1.className='bkt-tn';tn1.textContent=m.t1||'?';
  left1.appendChild(tn1);
  if(res1){var r1el=document.createElement('span');r1el.className='bkt-res';r1el.textContent='('+res1+')';left1.appendChild(r1el);}
  var sc1=document.createElement('span');sc1.className='bkt-sc';sc1.textContent=(isFT||isLive)?s1:'';
  row1.appendChild(left1);row1.appendChild(sc1);

  // Rangée équipe 2
  var row2=document.createElement('div');
  row2.className='bkt-team'+(w2?' bkt-win':'')+(tbd2?' bkt-tbd':'');
  var left2=document.createElement('div');left2.className='bkt-left';
  var tn2=document.createElement('span');tn2.className='bkt-tn';tn2.textContent=m.t2||'?';
  left2.appendChild(tn2);
  if(res2){var r2el=document.createElement('span');r2el.className='bkt-res';r2el.textContent='('+res2+')';left2.appendChild(r2el);}
  var sc2=document.createElement('span');sc2.className='bkt-sc';sc2.textContent=(isFT||isLive)?s2:'';
  row2.appendChild(left2);row2.appendChild(sc2);

  var foot=document.createElement('div');foot.className='bkt-foot';
  var venue=document.createElement('span');venue.className='bkt-venue';venue.textContent=venueLabel;
  foot.appendChild(venue);foot.appendChild(iconsDiv);

  card.appendChild(head);card.appendChild(row1);card.appendChild(row2);card.appendChild(foot);
  return card;
}

function drawBracketConnectors(){
  var pairs=[
    {svgId:'ko-conn-32es',   fromId:'ko-col-32es',   toId:'ko-col-16es'},
    {svgId:'ko-conn-16es',   fromId:'ko-col-16es',   toId:'ko-col-Quarts'},
    {svgId:'ko-conn-Quarts', fromId:'ko-col-Quarts', toId:'ko-col-Demis'},
    {svgId:'ko-conn-Demis',  fromId:'ko-col-Demis',  toId:'ko-col-Finale'},
  ];
  var ns='http://www.w3.org/2000/svg';
  pairs.forEach(function(pair){
    var svg=document.getElementById(pair.svgId);
    var from=document.getElementById(pair.fromId);
    var to=document.getElementById(pair.toId);
    if(!svg||!from||!to)return;
    var fC=Array.from(from.children);
    var tC=Array.from(to.children);
    var svgR=svg.getBoundingClientRect();
    var h=from.getBoundingClientRect().height;
    svg.setAttribute('height',h);
    svg.setAttribute('viewBox','0 0 24 '+h);
    svg.innerHTML='';
    for(var i=0;i<tC.length;i++){
      var c1=fC[2*i],c2=fC[2*i+1],ct=tC[i];
      if(!c1||!c2||!ct)continue;
      var r1=c1.getBoundingClientRect();
      var r2=c2.getBoundingClientRect();
      var rt=ct.getBoundingClientRect();
      var y1=r1.top+r1.height/2-svgR.top;
      var y2=r2.top+r2.height/2-svgR.top;
      var ym=rt.top+rt.height/2-svgR.top;
      [y1,y2].forEach(function(y){
        var path=document.createElementNS(ns,'path');
        path.setAttribute('d','M0,'+y.toFixed(1)+' H12 V'+ym.toFixed(1)+' H24');
        path.setAttribute('fill','none');
        path.setAttribute('stroke','rgba(255,255,255,0.1)');
        path.setAttribute('stroke-width','1');
        svg.appendChild(path);
      });
    }
  });
}

function renderKOLegend(){
  var c=document.getElementById('ko-legend');c.innerHTML='';
  [{label:'32es',color:'#8b5cf6',date:'28 Juin\u20133 Juil.'},{label:'16es',color:'#f59e0b',date:'4\u20137 Juil.'},{label:'Quarts',color:'#ef4444',date:'9\u201311 Juil.'},{label:'Demis',color:'#f97316',date:'14\u201315 Juil.'},{label:'Finale',color:'#fbbf24',date:'19 Juil.'}].forEach(function(p){
    var s=document.createElement('span');s.className='phase-badge';s.style.background=hex2rgba(p.color,.1);s.style.border='1px solid '+hex2rgba(p.color,.3);s.style.color=p.color;
    s.innerHTML=p.label+' <span style="opacity:.6">'+p.date+'</span>';c.appendChild(s);
  });
  // Switch Liste / Bracket dans la légende
  var koLegendBar=document.getElementById('ko-legend');
  koLegendBar.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center';
  var sw=document.createElement('div');
  sw.style.cssText='display:flex;gap:5px;margin-left:auto';
  var btnList=document.createElement('button');
  btnList.className='ko-sw-btn'+(koBracketView==='list'?' ko-sw-active':'');
  btnList.textContent='Liste';
  btnList.onclick=function(){setKOView('list');};
  var btnBkt=document.createElement('button');
  btnBkt.className='ko-sw-btn'+(koBracketView==='bracket'?' ko-sw-active':'');
  btnBkt.textContent='Bracket';
  btnBkt.onclick=function(){setKOView('bracket');};
  sw.appendChild(btnList);sw.appendChild(btnBkt);
  c.appendChild(sw);
}

function renderStandings(){
  var grid=document.getElementById('standings-grid');grid.innerHTML='';
  if(!Object.keys(standings).length){grid.innerHTML='<p style="color:#475569;font-size:11px;padding:12px">Classements disponibles d\u00e8s le d\u00e9but du tournoi.</p>';return;}
  Object.entries(GC).forEach(function(e){var g=e[0],col=e[1];
    if(!standings[g])return;
    var card=document.createElement('div');card.className='standing-card';card.style.borderColor=hex2rgba(col,.3);
    var hdr=document.createElement('div');hdr.className='standing-card-header';hdr.style.background=hex2rgba(col,.15);hdr.style.color=col;hdr.textContent='GROUPE '+g;card.appendChild(hdr);
    var grpPlayed=standings[g].some(function(r){return r.played>0;});
    // Calcul des rangs d'affichage (ex æquo : même rang, puis saut)
    var dispRanks=[];
    standings[g].forEach(function(r,i){
      if(i===0){dispRanks[0]=1;return;}
      var p=standings[g][i-1];
      dispRanks[i]=(p.pts===r.pts&&p.gd===r.gd&&p.gf===r.gf)?dispRanks[i-1]:i+1;
    });
    standings[g].forEach(function(r,i){
      var qualified=grpPlayed&&i<2;
      var isExAequo=i>0&&dispRanks[i]===dispRanks[i-1];
      var row=document.createElement('div');row.className='standing-row';
      var dot=document.createElement('div');dot.className='qualified-dot';dot.style.background=qualified?col:i===2&&grpPlayed?hex2rgba(col,.4):'#1e3a5f';
      var pos=document.createElement('span');pos.className='standing-pos';pos.style.color=qualified?col:'#475569';pos.textContent=dispRanks[i]+'.';
      var team=document.createElement('span');team.className='standing-team';team.textContent=r.team;
      if(isExAequo){var eq=document.createElement('span');eq.style.cssText='font-size:7px;color:#f59e0b;margin-left:3px';eq.textContent='ex æq.';team.appendChild(eq);}
      var pts=document.createElement('span');pts.className='standing-pts';pts.style.color=qualified?col:'#64748b';pts.textContent=r.pts;
      var stats=document.createElement('span');stats.className='standing-stats';stats.textContent=r.played+'J '+(r.gd>0?'+':'')+r.gd+' ('+r.gf+'B)';
      row.appendChild(dot);row.appendChild(pos);row.appendChild(team);row.appendChild(pts);row.appendChild(stats);card.appendChild(row);
    });
    grid.appendChild(card);
  });
}

// ─── KPI BAR ─────────────────────────────────────────────────────────────────

function renderKPIBar(){
  var el=document.getElementById('kpi-bar');
  if(!el)return;
  var isKO=activeView==='knockout';
  var src=allMatches.filter(function(m){return isKO?m.ko:!m.ko;});
  var total=src.length;
  var played=src.filter(function(m){return m.isFT;}).length;
  var live=src.filter(function(m){return m.isLive;}).length;
  var totalGoals=0;
  src.filter(function(m){return m.isFT&&m.score;}).forEach(function(m){
    var p=m.score.split(/[–\-]/);if(p.length===2){totalGoals+=(parseInt(p[0])||0)+(parseInt(p[1])||0);}
  });
  var avgGoals=played>0?(totalGoals/played).toFixed(2):'–';
  // Cartons : uniquement pour les matchs joués dans la phase affichée
  // fairplayData couvre les matchs de groupe (ESPN stats) ; KO = 0 jusqu'à première phase jouée
  var totalYC=0,totalRC=0;
  if(played>0&&!isKO){
    if(fairplayData&&fairplayData.length){
      fairplayData.forEach(function(t){totalYC+=t.yc||0;totalRC+=t.rc||0;});
    } else {
      Object.values(standings).forEach(function(tbl){
        tbl.forEach(function(r){totalYC+=r.yc||0;totalRC+=r.rc||0;});
      });
    }
  }
  var avgYC=played>0&&totalYC>0?(totalYC/played).toFixed(1):'–';
  var avgRC=played>0&&totalRC>0?(totalRC/played).toFixed(2):'–';
  var noCardData=played>0&&!isKO&&totalYC===0&&totalRC===0;
  var cardSubYC=noCardData?'<span class="kpi-sub">en attente</span>':'<span class="kpi-sub">moy. '+avgYC+'/m</span>';
  var cardSubRC=noCardData?'<span class="kpi-sub">en attente</span>':'<span class="kpi-sub">moy. '+avgRC+'/m</span>';
  el.innerHTML=
    '<div class="kpi-grid">'+
    (live>0?'<div class="kpi-card kpi-live"><div class="kpi-val" style="color:#22c55e;animation:pulse 1.5s infinite">⚡ '+live+'</div><div class="kpi-lbl">EN DIRECT</div></div>':'')+
    '<div class="kpi-card"><div class="kpi-val">'+total+'</div><div class="kpi-lbl">MATCHS</div></div>'+
    '<div class="kpi-card"><div class="kpi-val kpi-green">'+played+'</div><div class="kpi-lbl">JOUÉS</div></div>'+
    '<div class="kpi-card"><div class="kpi-val kpi-yellow">'+totalGoals+'</div><div class="kpi-lbl">BUTS <span class="kpi-sub">moy. '+avgGoals+'/m</span></div></div>'+
    '<div class="kpi-card"><div class="kpi-val" style="color:#fbbf24">🟨 '+totalYC+'</div><div class="kpi-lbl">JAUNES '+cardSubYC+'</div></div>'+
    '<div class="kpi-card"><div class="kpi-val" style="color:#ef4444">🟥 '+totalRC+'</div><div class="kpi-lbl">ROUGES '+cardSubRC+'</div></div>'+
    '</div>';
}

// ─── FAIR PLAY ────────────────────────────────────────────────────────────────

function renderFairPlay(){
  var c=document.getElementById('fairplay-list');
  if(!c)return;
  if(!fairplayLoaded){
    c.innerHTML='<p style="color:#475569;font-size:11px;padding:12px">Chargement…</p>';
    fetchFairPlay();
    return;
  }
  if(!fairplayData||!fairplayData.length){
    c.innerHTML='<p style="color:#475569;font-size:11px;padding:12px">Données non encore disponibles (stats ESPN requises).</p>';
    return;
  }
  var teams=fairplayData.map(function(t){return{team:t.team,yc:t.yc||0,rc:t.rc||0,fp:(t.yc||0)+3*(t.rc||0)};});
  teams.sort(function(a,b){return(a.fp-b.fp)||(a.yc-b.yc)||a.team.localeCompare(b.team);});
  var rows=[];
  rows.push('<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;padding:4px 12px">');
  rows.push('<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:9px;color:#475569;font-weight:700">'+
    '<span style="min-width:24px">#</span>'+
    '<span style="flex:1">Équipe</span>'+
    '<span style="min-width:44px;text-align:center">🟨 Jaunes</span>'+
    '<span style="min-width:44px;text-align:center">🟥 Rouges</span>'+
    '<span style="min-width:52px;text-align:center">Score FP</span>'+
    '</div>');
  teams.forEach(function(t,i){
    var top=i<5,last=i===teams.length-1;
    var scoreCol=t.fp===0?'#22c55e':t.fp<=3?'#fbbf24':'#ef4444';
    rows.push('<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:'+(last?'none':'1px solid rgba(255,255,255,0.03)')+';font-size:11px">'+
      '<span style="min-width:24px;font-size:9px;font-weight:700;color:#475569">'+(i+1)+'</span>'+
      '<span style="flex:1;color:'+(top?'#22c55e':'#e2e8f0')+';font-weight:'+(top?'700':'500')+'">'+t.team+'</span>'+
      '<span style="min-width:44px;text-align:center;color:#fbbf24;font-weight:700;font-size:12px">'+t.yc+'</span>'+
      '<span style="min-width:44px;text-align:center;color:#ef4444;font-weight:700;font-size:12px">'+t.rc+'</span>'+
      '<span style="min-width:52px;text-align:center;font-weight:900;font-size:14px;color:'+scoreCol+'">'+t.fp+'</span>'+
      '</div>');
  });
  rows.push('</div>');
  rows.push('<p style="font-size:9px;color:#475569;margin-top:10px;text-align:center">Score Fair Play = Jaunes + 3×Rouges · Plus bas = plus fair · Source : stats ESPN par joueur</p>');
  c.innerHTML=rows.join('');
}
