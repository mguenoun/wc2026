// ─── TERRAIN SVG ──────────────────────────────────────────────────────────────

function posToLine(pos){
  if(!pos)return 3;
  var p=pos.toUpperCase().split('-')[0];
  var map={'G':0,'GK':0,'RB':1,'LB':1,'CD':1,'CB':1,'SW':1,'RWB':2,'LWB':2,'DM':2,'CDM':2,'CM':3,'RM':3,'LM':3,'AM':4,'CAM':4,'SS':4,'CF':5,'ST':5,'F':5,'FW':5,'LW':5,'RW':5,'RF':5,'LF':5,'WF':5};
  return map[p]!==undefined?map[p]:3;
}

function renderPitch(r0,r1,col0,col1,cardMap,playerStats){
  var W=420,H=640,R=13;
  var svg='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
  // Filtre halo pour lisibilité des ratings
  svg+='<defs><filter id="rh" x="-50%" y="-50%" width="200%" height="200%">'+
    '<feMorphology in="SourceAlpha" operator="dilate" radius="1.2" result="exp"/>'+
    '<feFlood flood-color="rgba(0,0,0,0.85)" result="col"/>'+
    '<feComposite in="col" in2="exp" operator="in" result="sh"/>'+
    '<feMerge><feMergeNode in="sh"/><feMergeNode in="SourceGraphic"/></feMerge>'+
    '</filter></defs>';
  var ls='stroke:#1e5c2e;stroke-width:1;fill:none;';
  svg+='<rect width="'+W+'" height="'+H+'" fill="#0d2e1a" rx="8"/>';
  svg+='<rect x="15" y="12" width="'+(W-30)+'" height="'+(H-24)+'" style="'+ls+'"/>';
  svg+='<line x1="15" y1="'+(H/2)+'" x2="'+(W-15)+'" y2="'+(H/2)+'" style="'+ls+'"/>';
  svg+='<circle cx="'+(W/2)+'" cy="'+(H/2)+'" r="48" style="'+ls+'"/>';
  svg+='<circle cx="'+(W/2)+'" cy="'+(H/2)+'" r="3" fill="#1e5c2e"/>';
  var bw=180,bh=62,sw=90,sh=26;
  svg+='<rect x="'+((W-bw)/2)+'" y="12" width="'+bw+'" height="'+bh+'" style="'+ls+'"/>';
  svg+='<rect x="'+((W-sw)/2)+'" y="12" width="'+sw+'" height="'+sh+'" style="'+ls+'"/>';
  svg+='<rect x="'+((W-bw)/2)+'" y="'+(H-12-bh)+'" width="'+bw+'" height="'+bh+'" style="'+ls+'"/>';
  svg+='<rect x="'+((W-sw)/2)+'" y="'+(H-12-sh)+'" width="'+sw+'" height="'+sh+'" style="'+ls+'"/>';

  function renderTeam(roster,color,side){
    var starters=roster.roster.filter(function(p){return p.starter;}).sort(function(a,b){return a.formationPlace-b.formationPlace;});
    var byLine={};
    starters.forEach(function(p){var l=posToLine(p.position&&p.position.abbreviation||'');if(!byLine[l])byLine[l]=[];byLine[l].push(p);});
    // ESPN : formationPlace croissant = droite du terrain
    // side=0 (équipe haut, vue de dos) : sa droite = gauche écran → tri croissant
    // side=1 (équipe bas, vue de face) : sa droite = droite écran → tri décroissant
    Object.values(byLine).forEach(function(arr){
      arr.sort(function(a,b){return side===0?a.formationPlace-b.formationPlace:b.formationPlace-a.formationPlace;});
    });
    var lines=Object.keys(byLine).map(Number).sort(function(a,b){return a-b;});
    var fieldLines=lines.filter(function(l){return l!==0;});
    var nField=fieldLines.length;
    var GK_Y=side===0?40:H-40, DEF_Y=side===0?95:H-95, ATT_Y=side===0?H/2-55:H/2+55;
    var out='';
    lines.forEach(function(lk){
      var players=byLine[lk];
      var yPx;
      if(lk===0){yPx=GK_Y;}
      else{var li=fieldLines.indexOf(lk);var t=nField>1?li/(nField-1):0.5;yPx=Math.round(DEF_Y+t*(ATT_Y-DEF_Y));}
      players.forEach(function(p,i){
        var xPx=Math.round(((i+1)/(players.length+1))*W);
        var fullName=p.athlete&&p.athlete.displayName||'';
        var nm=fullName.split(' ');
        var sn=nm.length>1?nm[nm.length-1]:nm[0];
        if(sn.length>9)sn=sn.slice(0,8)+'.';
        var label='#'+p.jersey+' '+sn;
        var ps=playerStats&&playerStats[fullName];
        var rating=ps&&ps.rating;
        var card=cardMap&&cardMap[fullName];
        var minTxt=(ps&&ps.subbedOut&&ps.minutes>0&&ps.minutes<90)?ps.minutes+"'":(ps&&ps.subbedIn&&ps.minutes>0)?ps.minutes+"'":'';
        // Cercle couleur équipe
        out+='<circle cx="'+xPx+'" cy="'+yPx+'" r="'+R+'" fill="'+color+'" opacity=".92"/>';
        // Rating dans le cercle (texte coloré)
        if(rating&&rating>0){
          var rc=ratingColor(rating);
          out+='<text x="'+xPx+'" y="'+(yPx+2.5)+'" text-anchor="middle" font-size="7.5" font-weight="800" fill="'+rc+'" font-family="system-ui" filter="url(#rh)">'+rating.toFixed(1)+'</text>';
        }
        // Nom + numéro sous le cercle
        out+='<text x="'+xPx+'" y="'+(yPx+R+9)+'" text-anchor="middle" font-size="7.5" fill="#e2e8f0" font-family="system-ui" font-weight="600">'+label+'</text>';
        // Minutes si remplacé
        if(minTxt)out+='<text x="'+xPx+'" y="'+(yPx+R+18)+'" text-anchor="middle" font-size="6.5" fill="#64748b" font-family="system-ui">'+minTxt+'</text>';
        // Badge carton
        if(card==='yellow')out+='<rect x="'+(xPx+8)+'" y="'+(yPx-R-3)+'" width="6" height="8" rx="1" fill="#fbbf24"/>';
        if(card==='red')   out+='<rect x="'+(xPx+8)+'" y="'+(yPx-R-3)+'" width="6" height="8" rx="1" fill="#ef4444"/>';
        // Icône remplacement
        if(p.subbedOut)out+='<text x="'+(xPx-R-1)+'" y="'+(yPx-R+4)+'" font-size="8" fill="#ef4444">↓</text>';
        if(p.subbedIn) out+='<text x="'+(xPx-R-1)+'" y="'+(yPx-R+4)+'" font-size="8" fill="#22c55e">↑</text>';
      });
    });
    return out;
  }

  var n0=normTeam(r0.team.displayName),n1=normTeam(r1.team.displayName);
  svg+='<text x="'+(W/2)+'" y="9" text-anchor="middle" font-size="8.5" font-weight="700" fill="'+col0+'" font-family="system-ui">'+n0+' · '+r0.formation+'</text>';
  svg+='<text x="'+(W/2)+'" y="'+(H-3)+'" text-anchor="middle" font-size="8.5" font-weight="700" fill="'+col1+'" font-family="system-ui">'+n1+' · '+r1.formation+'</text>';
  svg+=renderTeam(r0,col0,0);
  svg+=renderTeam(r1,col1,1);
  svg+='</svg>';
  return svg;
}

// ─── LISTE ENRICHIE ───────────────────────────────────────────────────────────

function renderPlayerList(roster, color, teamInfo, cardMap, playerStats){
  var starters=roster.roster.filter(function(p){return p.starter;});
  var bench=roster.roster.filter(function(p){return !p.starter;});
  function playerRow(p,dimmed){
    var info=teamInfo.map[p.jersey]||{name:'?',pos:'',fullName:''};
    var s=playerStats&&playerStats[info.fullName]||{};
    var rating=s.rating;
    var card=cardMap&&cardMap[info.fullName];
    var minDisplay=s.minutes>0?s.minutes+"'":'–';
    var rColor=rating?ratingColor(rating):'#475569';
    return '<div style="display:flex;align-items:center;gap:4px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:10px'+(dimmed?';opacity:.55':'')+'">'+
      '<span style="min-width:16px;color:#475569;font-size:9px;text-align:right">'+(p.jersey||'')+'</span>'+
      '<span style="flex:1;color:#e2e8f0">'+(p.athlete&&p.athlete.displayName||'')+'</span>'+
      '<span style="font-size:8px;color:#475569;background:rgba(255,255,255,0.05);border-radius:3px;padding:1px 3px;min-width:26px;text-align:center">'+normPos(info.pos)+'</span>'+
      (s.goals?'<span style="font-size:9px;color:#22c55e">⚽</span>':'')+
      (s.assists?'<span style="font-size:9px;color:#0ea5e9">→</span>':'')+
      (s.saves?'<span style="font-size:8px;color:#94a3b8">SV:'+s.saves+'</span>':'')+
      (card||'')+
      '<span style="font-size:8px;color:#475569;min-width:24px;text-align:right">'+minDisplay+'</span>'+
      (rating!==null&&rating!==undefined
        ?'<span style="font-size:9px;font-weight:800;color:'+rColor+';min-width:26px;text-align:right">'+rating.toFixed(1)+'</span>'
        :'<span style="font-size:9px;color:#475569;min-width:26px;text-align:right">–</span>')+
      '</div>';
  }
  var h='<div style="font-size:8px;font-weight:700;letter-spacing:1px;color:'+color+';margin-bottom:4px">TITULAIRES</div>';
  starters.forEach(function(p){h+=playerRow(p,false);});
  if(bench.length){
    h+='<div style="font-size:8px;font-weight:700;letter-spacing:1px;color:#475569;margin:6px 0 4px">REMPLAÇANTS</div>';
    bench.forEach(function(p){h+=playerRow(p,true);});
  }
  return h;
}

function openLineupESPN(espnId){
  var m=_currentMatch;
  document.getElementById('modal-overlay').className='open';
  document.getElementById('modal-title').textContent='Compositions';
  document.getElementById('modal-body').innerHTML='<div style="text-align:center;padding:20px;color:#475569">⏳ Chargement…</div>';
  fetch(PROXY_BASE+'/data/summary/'+espnId)
    .then(function(r){return r.json();})
    .then(function(d){
      var rosters=d.rosters||[];
      if(!rosters.length){document.getElementById('modal-body').innerHTML='<p style="color:#475569;font-size:11px;padding:12px">Compositions non disponibles.</p>';return;}
      var r0=rosters[0],r1=rosters[1];
      var col0=m?m.color:'#0ea5e9',col1='#94a3b8';
      var name0=normTeam(r0.team.displayName),name1=normTeam(r1.team.displayName);

      // Cartons depuis keyEvents
      var cardMap={};
      (d.keyEvents||[]).forEach(function(e){
        if(e.type&&e.type.type==='yellow-card')cardMap[(e.shortText||'').replace(/\s+Yellow\s+Card$/i,'')]='yellow';
        if(e.type&&e.type.type==='red-card')cardMap[(e.shortText||'').replace(/\s+Red\s+Card$/i,'')]='red';
      });

      // Map jersey → info par équipe
      var namesByTeam=[];
      rosters.forEach(function(team){
        var map={};
        team.roster.forEach(function(p){map[p.jersey]={name:p.athlete&&p.athlete.displayName||'?',pos:p.position&&p.position.abbreviation||'',fullName:p.athlete&&p.athlete.displayName||''};});
        namesByTeam.push({teamName:normTeam(team.team.displayName),map:map});
      });

      // Onglets
      var html='<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:10px">'+
        '<button id="tab-pitch" style="flex:1;padding:7px;font-size:10px;font-weight:700;color:#0ea5e9;border:none;background:transparent;border-bottom:2px solid #0ea5e9;cursor:pointer">⚽ Terrain</button>'+
        '<button id="tab-list" style="flex:1;padding:7px;font-size:10px;font-weight:700;color:#475569;border:none;background:transparent;border-bottom:2px solid transparent;cursor:pointer">☰ Liste</button>'+
        '</div>';

      // Phase 1 : terrain sans ratings
      html+='<div id="view-pitch" style="text-align:center;overflow-y:auto">'+renderPitch(r0,r1,col0,col1,cardMap,null)+'</div>';

      // Vue liste — affichée immédiatement sans ratings (chargés après)
      html+='<div id="view-list" style="display:none">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="list-grid">'+
        '<div>'+renderPlayerList(r0,col0,namesByTeam[0],cardMap,null)+'</div>'+
        '<div>'+renderPlayerList(r1,col1,namesByTeam[1],cardMap,null)+'</div>'+
        '</div></div>';

      document.getElementById('modal-title').textContent=name0+' – '+name1;
      document.getElementById('modal-body').innerHTML=html;

      // Onglets
      function _resetModalTabs(){
        ['tab-pitch','tab-list'].forEach(function(id){var b=document.getElementById(id);if(b){b.style.color='#475569';b.style.borderBottomColor='transparent';}});
        ['view-pitch','view-list'].forEach(function(id){var v=document.getElementById(id);if(v)v.style.display='none';});
      }
      document.getElementById('tab-pitch').addEventListener('click',function(){
        _resetModalTabs();document.getElementById('view-pitch').style.display='';
        this.style.color='#0ea5e9';this.style.borderBottomColor='#0ea5e9';
      });
      document.getElementById('tab-list').addEventListener('click',function(){
        _resetModalTabs();document.getElementById('view-list').style.display='';
        this.style.color='#0ea5e9';this.style.borderBottomColor='#0ea5e9';
      });

      // Phase 2 : charger ratings en arrière-plan
      loadMatchPlayerStats(espnId, rosters).then(function(playerStats){
        // Mettre à jour le terrain
        var pitchEl=document.getElementById('view-pitch');
        if(pitchEl)pitchEl.innerHTML=renderPitch(r0,r1,col0,col1,cardMap,playerStats);
        // Mettre à jour la liste
        var gridEl=document.getElementById('list-grid');
        if(gridEl)gridEl.innerHTML=
          '<div>'+renderPlayerList(r0,col0,namesByTeam[0],cardMap,playerStats)+'</div>'+
          '<div>'+renderPlayerList(r1,col1,namesByTeam[1],cardMap,playerStats)+'</div>';
        // Match maintenant en KV → rafraîchir fair play + KPI cartons
        fetchFairPlay();
      }).catch(function(e){console.warn('Ratings load error:',e.message);});
    })
    .catch(function(e){document.getElementById('modal-body').innerHTML='<p style="color:#ef4444;font-size:11px;padding:12px">Erreur: '+e.message+'</p>';});
}

// ─── CLASSEMENT JOUEURS ───────────────────────────────────────────────────────
