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

// Ordre des phases KO et couleurs associées
var KO_PHASES=[
  {key:'32es', label:'32èmes', color:'#8b5cf6'},
  {key:'16es', label:'16èmes', color:'#f59e0b'},
  {key:'Quarts', label:'Quarts', color:'#ef4444'},
  {key:'Demis', label:'Demis', color:'#f97316'},
  {key:'Finale', label:'Finale', color:'#fbbf24'},
];

var koBracketView='list'; // 'list' ou 'bracket'

function renderKOTimeline(){
  var c=document.getElementById('knockout-timeline');
  c.innerHTML='';

  // Switch Liste / Bracket
  var sw=document.createElement('div');
  sw.style.cssText='display:flex;gap:6px;margin-bottom:12px;justify-content:flex-end';
  sw.innerHTML='<button class="ko-sw-btn'+(koBracketView==='list'?' ko-sw-active':'')+'" onclick="setKOView('list')">☰ Liste</button>'+
    '<button class="ko-sw-btn'+(koBracketView==='bracket'?' ko-sw-active':'')+'" onclick="setKOView('bracket')">⊞ Bracket</button>';
  c.appendChild(sw);

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
    // Slot vide
    card.innerHTML='<div class="bkt-team bkt-tbd"><span class="bkt-tn">À déterminer</span></div>'+
      '<div class="bkt-team bkt-tbd"><span class="bkt-tn">À déterminer</span></div>'+
      '<div class="bkt-foot"><span class="bkt-venue">—</span><div class="bkt-icons"></div></div>';
    return card;
  }

  var isFT=m.isFT, isLive=m.isLive;
  var score=m.score||'';
  var parts=score?score.split(/[–\-]/).map(function(x){return x.trim();}):['',''];
  var s1=parts[0]||'', s2=parts[1]||'';
  var w1=isFT&&s1!==''&&parseInt(s1)>parseInt(s2);
  var w2=isFT&&s2!==''&&parseInt(s2)>parseInt(s1);
  var tbd1=!m.t1||m.t1.indexOf('Vainq')===0||m.t1.indexOf('V.')===0;
  var tbd2=!m.t2||m.t2.indexOf('Vainq')===0||m.t2.indexOf('V.')===0;

  // Icônes
  var icons='';
  if(isFT||isLive){
    var eid=ESPN_ID_MAP&&ESPN_ID_MAP[m.id]?ESPN_ID_MAP[m.id]:'';
    icons+='<button class="bkt-ico action-btn" title="Stats" onclick="event.stopPropagation();_currentMatch=allMatches.find(function(x){return x.id===''+m.id+''});openMatchInfo(''+eid+'')">📊</button>';
    icons+='<button class="bkt-ico action-btn" title="Compositions" onclick="event.stopPropagation();_currentMatch=allMatches.find(function(x){return x.id===''+m.id+''});openLineupESPN(''+eid+'')">👕</button>';
  }
  if(m.venue&&VENUE_COORDS&&VENUE_COORDS[m.venue]){
    icons+='<button class="bkt-ico action-btn" title="Stade" onclick="event.stopPropagation();openMap(allMatches.find(function(x){return x.id===''+m.id+''}))">📍</button>';
  }

  var venueShort=m.venue?m.venue.replace(' Stadium','').replace(' Field',''):'';
  var cityShort=m.city||'';
  var venueLabel=(venueShort?(venueShort+(cityShort?' · '+cityShort:'')):'');

  card.innerHTML=
    '<div class="bkt-team'+(w1?' bkt-win':'')+(tbd1?' bkt-tbd':'')+'">'+
      '<span class="bkt-tn">'+(m.t1||'?')+'</span>'+
      '<span class="bkt-sc">'+(isFT||isLive?s1:'')+'</span>'+
    '</div>'+
    '<div class="bkt-team'+(w2?' bkt-win':'')+(tbd2?' bkt-tbd':'')+'">'+
      '<span class="bkt-tn">'+(m.t2||'?')+'</span>'+
      '<span class="bkt-sc">'+(isFT||isLive?s2:'')+'</span>'+
    '</div>'+
    '<div class="bkt-foot">'+
      '<span class="bkt-venue">'+venueLabel+'</span>'+
      '<div class="bkt-icons">'+icons+'</div>'+
    '</div>';

  return card;
}

function drawBracketConnectors(){
  var pairs=[
    {svgId:'ko-conn-32',fromId:'ko-col-32',toId:'ko-col-16'},
    {svgId:'ko-conn-16',fromId:'ko-col-16',toId:'ko-col-QF'},
    {svgId:'ko-conn-QF',fromId:'ko-col-QF',toId:'ko-col-SF'},
    {svgId:'ko-conn-SF',fromId:'ko-col-SF',toId:'ko-col-FIN'},
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
