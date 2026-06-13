function openModal(title,html,refreshFn){
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-overlay').className='open';
  // Clear previous timer
  if(_modalRefreshTimer){ clearInterval(_modalRefreshTimer); _modalRefreshTimer=null; }
  // Start auto-refresh if match is live and a refresh function is provided
  if(refreshFn){
    _modalRefreshFn = refreshFn;
    _modalRefreshTimer = setInterval(function(){
      if(_currentMatch&&_currentMatch.isLive) refreshFn();
      else { clearInterval(_modalRefreshTimer); _modalRefreshTimer=null; }
    }, 30000);
  }
}
function closeModal(e){
  if(!e||e.target===document.getElementById('modal-overlay')){
    document.getElementById('modal-overlay').className='';
    if(_modalRefreshTimer){ clearInterval(_modalRefreshTimer); _modalRefreshTimer=null; }
  }
}

function infoBlock(label,value,color){
  return '<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px 10px;margin-bottom:6px">'+
    '<div style="font-size:8px;color:'+(color||'#475569')+';font-weight:700;letter-spacing:1px;margin-bottom:4px">'+label.toUpperCase()+'</div>'+
    '<div style="font-size:11px;color:#e2e8f0">'+value+'</div></div>';
}

function scoreRow(label,home,away,color){
  return '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#080f1e;border-radius:6px;margin-bottom:4px">'+
    '<span style="flex:1;font-size:10px;color:#64748b">'+label+'</span>'+
    '<span style="font-size:16px;font-weight:900;color:'+(color||'#e2e8f0')+';min-width:60px;text-align:center">'+home+' \u2013 '+away+'</span></div>';
}

// Match courant pour compositions
var _currentMatch = null;

function openMatchInfo(m){
  _currentMatch = m;
  var espnId = ESPN_ID_MAP[m.id] || null;
  openModal('Chargement…','<div style="text-align:center;padding:20px;color:#475569">⏳</div>');
  if(espnId){
    var doFetch = function(){
      fetch(ESPN_BASE+'/summary?event='+espnId)
        .then(function(r){ return r.json(); })
        .then(function(d){ renderESPNStats(m,d,espnId); })
        .catch(function(){ openMatchInfoFD(m); });
    };
    // Pass doFetch as refresh fn so modal auto-refreshes every 30s if live
    openModal('Chargement…','<div style="text-align:center;padding:20px;color:#475569">⏳</div>', m.isLive ? doFetch : null);
    doFetch();
  } else {
    openMatchInfoFD(m);
  }
}

function renderESPNStats(m,d,espnId){
  var header=d.header,comp=header&&header.competitions&&header.competitions[0];
  var status=comp&&comp.status&&comp.status.type;
  var comps=comp&&comp.competitors||[];
  var home=comps.find(function(c){return c.homeAway==='home';})||{};
  var away=comps.find(function(c){return c.homeAway==='away';})||{};
  document.getElementById('modal-title').textContent=m.t1+' – '+m.t2;
  var statusStr = status&&status.description||'';
  if(m.isLive && m.clockDisplay){
    statusStr = statusStr ? statusStr + ' · ' + m.clockDisplay : m.clockDisplay;
  }
  var html='<div style="text-align:center;padding:10px 0 8px">'+
    '<div style="font-size:34px;font-weight:900;color:#e2e8f0;letter-spacing:-1px">'+(home.score||'0')+' – '+(away.score||'0')+'</div>'+
    '<div style="font-size:10px;color:#64748b;margin-top:2px">'+statusStr+'</div></div>';
  // Stats
  var teams=d.boxscore&&d.boxscore.teams||[];
  if(teams.length===2){
    var s0=teams[0].statistics||[],s1=teams[1].statistics||[];
    var LABELS={'foulsCommitted':'Fautes','yellowCards':'Cartons jaunes','redCards':'Cartons rouges',
      'offsides':'Hors-jeux','cornerKicks':'Corners','saves':'Arrêts',
      'possessionPct':'Possession %','totalShots':'Tirs','shotsOnTarget':'Tirs cadrés'};
    var ORDER=['possessionPct','totalShots','shotsOnTarget','cornerKicks','foulsCommitted','yellowCards','redCards','offsides','saves'];
    html+='<div style="font-size:9px;color:#0ea5e9;font-weight:700;letter-spacing:1px;margin-bottom:6px">STATISTIQUES</div>';
    html+='<div style="background:#080f1e;border-radius:8px;padding:8px 10px;margin-bottom:10px">';
    ORDER.forEach(function(name){
      var st0=s0.find(function(x){return x.name===name;}),st1=s1.find(function(x){return x.name===name;});
      if(!st0&&!st1)return;
      var v0=parseFloat((st0&&st0.displayValue)||'0')||0;
      var v1=parseFloat((st1&&st1.displayValue)||'0')||0;
      var total=v0+v1||1,pct0=Math.round(v0/total*100);
      html+='<div style="display:flex;align-items:center;gap:5px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'+
        '<span style="min-width:26px;font-size:11px;font-weight:800;color:'+m.color+';text-align:right">'+v0+'</span>'+
        '<div style="flex:1;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden">'+
          '<div style="height:100%;width:'+pct0+'%;background:'+m.color+';border-radius:2px"></div></div>'+
        '<span style="font-size:9px;color:#64748b;min-width:90px;text-align:center">'+(LABELS[name]||name)+'</span>'+
        '<div style="flex:1;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;transform:scaleX(-1)">'+
          '<div style="height:100%;width:'+(100-pct0)+'%;background:#94a3b8;border-radius:2px"></div></div>'+
        '<span style="min-width:26px;font-size:11px;font-weight:800;color:#94a3b8">'+v1+'</span></div>';
    });
    html+='<div style="display:flex;justify-content:space-between;margin-top:5px;font-size:9px;font-weight:700">'+
      '<span style="color:'+m.color+'">'+m.t1+'</span><span style="color:#94a3b8">'+m.t2+'</span></div></div>';
  }
  // Buts + Assists
  var events=d.keyEvents||[];
  var goals=events.filter(function(e){return e.scoringPlay;});
  if(goals.length){
    // Comptage des assists (hors CSC)
    var assistCount={};
    goals.forEach(function(g){
      if(/own\s+goal/i.test(g.shortText||''))return;
      var am=(g.text||'').match(/Assisted by ([^.]+?)(?:\s+with|\s*\.)/i);
      if(am){var n=am[1].trim();assistCount[n]=(assistCount[n]||0)+1;}
    });

    html+='<div style="font-size:9px;color:#fbbf24;font-weight:700;letter-spacing:1px;margin-bottom:5px">BUTS</div>';
    html+='<div style="background:#080f1e;border-radius:6px;padding:6px 10px;margin-bottom:10px">';
    goals.forEach(function(g){
      var teamName=g.team&&g.team.displayName?normTeam(g.team.displayName):'';
      var gColor=teamName===m.t1?m.color:'#94a3b8';
      var type=g.type&&g.type.type||'';
      var isHeader=type==='goal---header';
      var isOwnGoal=/own\s+goal/i.test(g.shortText||'');
      // Nom du joueur nettoyé
      var playerName=(g.shortText||'')
        .replace(/\s+Own\s+Goal$/i,'')
        .replace(/\s+Goal\s*-\s*Header$/i,'')
        .replace(/\s+Goal$/i,'');
      // Icône type de but
      var icon=isOwnGoal
        ?'<span style="color:#ef4444;font-size:9px">\u26bd CSC</span> '
        :isHeader
          ?'<span style="color:#fbbf24;font-size:9px">\u26bd t\u00eate</span> '
          :'<span style="color:#22c55e;font-size:9px">\u26bd</span> ';
      // Assist
      var am=(g.text||'').match(/Assisted by ([^.]+?)(?:\s+with|\s*\.)/i);
      var assistHtml=am?'<span style="color:#475569;font-size:8px"> \u2192 '+am[1].trim()+'</span>':'';
      // Équipe
      var teamHtml=teamName?'<span style="color:'+gColor+';font-size:8px;margin-left:3px">('+teamName+')</span>':'';
      html+='<div style="font-size:10px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:6px">'+
        '<span style="color:#64748b;min-width:28px;font-size:9px">'+(g.clock&&g.clock.displayValue||'')+'</span>'+
        '<span style="flex:1;color:#e2e8f0">'+icon+playerName+teamHtml+assistHtml+'</span></div>';
    });
    html+='</div>';

    // Assists
    var assistEntries=Object.entries(assistCount).sort(function(a,b){return b[1]-a[1];});
    if(assistEntries.length){
      html+='<div style="font-size:9px;color:#0ea5e9;font-weight:700;letter-spacing:1px;margin-bottom:5px">PASSES D\u00c9CISIVES</div>';
      html+='<div style="background:#080f1e;border-radius:6px;padding:6px 10px;margin-bottom:10px">';
      assistEntries.forEach(function(ae){
        html+='<div style="font-size:10px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:6px;color:#e2e8f0">'+
          '<span style="color:#0ea5e9;font-size:9px;min-width:14px">\u2192</span>'+
          '<span style="flex:1">'+ae[0]+'</span>'+
          (ae[1]>1?'<span style="font-size:9px;color:#0ea5e9;font-weight:700">x'+ae[1]+'</span>':'')+
          '</div>';
      });
      html+='</div>';
    }
  }
  // Cartons — filtre corrigé : ESPN utilise "yellow-card" et "red-card" (avec tiret)
  var cards=events.filter(function(e){return e.type&&(e.type.type==='yellow-card'||e.type.type==='red-card');});
  if(cards.length){
    html+='<div style="font-size:9px;color:#ef4444;font-weight:700;letter-spacing:1px;margin-bottom:5px">CARTONS</div>';
    html+='<div style="background:#080f1e;border-radius:6px;padding:6px 10px;margin-bottom:10px">';
    cards.forEach(function(c){
      var isRed=c.type.type==='red-card';
      var playerName=(c.shortText||'')
        .replace(/\s+Red\s+Card$/i,'')
        .replace(/\s+Yellow\s+Card$/i,'');
      var cardIcon=isRed
        ?'<span style="font-size:11px">🟥</span>'
        :'<span style="font-size:11px">🟨</span>';
      html+='<div style="font-size:10px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:6px;color:#e2e8f0">'+
        '<span style="color:#64748b;min-width:28px;font-size:9px">'+(c.clock&&c.clock.displayValue||'')+'</span>'+
        cardIcon+
        '<span style="flex:1">'+playerName+'</span></div>';
    });
    html+='</div>';
  }
  // Remplacements
  var subs=events.filter(function(e){return e.type&&e.type.type==='substitution';});
  if(subs.length){
    html+='<div style="font-size:9px;color:#10b981;font-weight:700;letter-spacing:1px;margin-bottom:5px">REMPLACEMENTS</div>';
    html+='<div style="background:#080f1e;border-radius:6px;padding:6px 10px;margin-bottom:10px">';
    // Grouper par équipe
    var subsByTeam={};
    subs.forEach(function(s){
      var tm=(s.text||'').match(/^Substitution,\s*([^.]+)\./i);
      var teamName=tm?normTeam(tm[1].trim()):'';
      var pm=(s.text||'').match(/\.\s*(.+?)\s+replaces\s+(.+?)\.?$/i);
      if(!pm)return;
      var tin=pm[1].trim(),tout=pm[2].trim();
      var tColor=teamName===m.t1?m.color:'#94a3b8';
      if(!subsByTeam[teamName])subsByTeam[teamName]={color:tColor,subs:[]};
      subsByTeam[teamName].subs.push({tin:tin,tout:tout,clock:s.clock&&s.clock.displayValue||''});
    });
    Object.entries(subsByTeam).forEach(function(e){
      var teamName=e[0],td=e[1];
      html+='<div style="font-size:8px;font-weight:700;color:'+td.color+';letter-spacing:.5px;margin:5px 0 3px">'+teamName.toUpperCase()+'</div>';
      td.subs.forEach(function(s){
        html+='<div style="font-size:10px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:6px;color:#e2e8f0">'+
          '<span style="color:#64748b;min-width:28px;font-size:9px">'+s.clock+'</span>'+
          '<span style="color:#22c55e;font-size:10px">↑</span>'+
          '<span style="flex:1">'+s.tin+'</span>'+
          '<span style="color:#ef4444;font-size:10px">↓</span>'+
          '<span style="flex:1;color:#64748b">'+s.tout+'</span>'+
          '</div>';
      });
    });
    html+='</div>';
  }
  html+=infoBlock('Stade',(m.venue||'')+' · '+(m.city||''),'#0ea5e9');
  html+='<button id="btn-lineup-open" style="width:100%;margin-top:10px;background:#10b98122;border:1px solid #10b981;color:#10b981;border-radius:6px;padding:9px;font-size:11px;font-weight:700;cursor:pointer">Compositions des équipes</button>';
  window._pendingLineupId = espnId;
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('btn-lineup-open').addEventListener('click',function(){openLineupESPN(window._pendingLineupId);});
}

function openMatchInfoFD(m){
  var id=m.apiId||m.id;
  fetch(PROXY_BASE+'/fd/matches/'+id)
    .then(function(r){return r.json();})
    .then(function(d){
      var sc=d.score||{},ft=sc.fullTime||{},ht=sc.halfTime||{};
      var scoreFT=(ft.home!==null&&ft.home!==undefined?ft.home:'-')+' – '+(ft.away!==null&&ft.away!==undefined?ft.away:'-');
      var scoreHT=(ht.home!==null&&ht.home!==undefined?ht.home:'-')+' – '+(ht.away!==null&&ht.away!==undefined?ht.away:'-');
      var refs=(d.referees||[]).map(function(r){return r.name||'';}).filter(Boolean).join(', ')||'Non communique';
      document.getElementById('modal-title').textContent=m.t1+' – '+m.t2;
      document.getElementById('modal-body').innerHTML=
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">'+
        infoBlock('Score final','<span style="font-size:22px;font-weight:900;color:#e2e8f0">'+scoreFT+'</span>',m.color)+
        infoBlock('Mi-temps','<span style="font-size:16px;font-weight:800;color:#94a3b8">'+scoreHT+'</span>','#475569')+'</div>'+
        infoBlock('Stade',(m.venue||'')+' · '+(m.city||''),'#0ea5e9')+
        infoBlock('Arbitres',refs,'#8b5cf6');
    })
    .catch(function(){document.getElementById('modal-body').innerHTML='<p style="color:#ef4444;font-size:11px;padding:12px">Erreur.</p>';});
}
