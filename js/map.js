function openMap(m){
  var c=VENUE_COORDS[m.venue];
  if(!c)return;
  var lat=c.lat, lng=c.lng;
  var osmUrl='https://www.openstreetmap.org/export/embed.html?bbox='+(lng-0.01)+'%2C'+(lat-0.008)+'%2C'+(lng+0.01)+'%2C'+(lat+0.008)+'&layer=mapnik&marker='+lat+'%2C'+lng;
  var mapsUrl='https://www.google.com/maps/search/?api=1&query='+c.q;
  openModal(m.venue+' · '+m.city,
    '<div style="border-radius:8px;overflow:hidden;margin-bottom:10px">'+
    '<iframe width="100%" height="280" frameborder="0" scrolling="no" style="border:0;border-radius:8px" src="'+osmUrl+'"></iframe></div>'+
    '<a href="'+mapsUrl+'" target="_blank" style="display:block;text-align:center;font-size:10px;color:#0ea5e9;text-decoration:none;padding:6px">'+
    'Ouvrir dans Google Maps ↗</a>'
  );
}


// ─── RENDER ───────────────────────────────────────────────────────────────────
function renderMatchRow(m){
  var sel=selectedId===m.id;
  var row=document.createElement('div');
  row.className='match-row';
  if(sel){row.style.background=hex2rgba(m.color,0.1);row.style.borderLeft='3px solid '+m.color;row.style.paddingLeft='7px';}

  var bg=document.createElement('span');bg.className='grp-badge';bg.style.background=hex2rgba(m.color,0.15);bg.style.color=m.color;bg.textContent=m.grp?'Gr.'+m.grp:(m.phase||'');
  var mid=document.createElement('span');mid.className='match-id';mid.textContent=m.id.length>4?'':m.id;
  var tim=document.createElement('span');tim.className='match-time';tim.textContent=m.time||'';

  var teams=document.createElement('span');teams.className='match-teams';
  var _t1=m.t1||'?',_t2=m.t2||'?';
  if(m.ko){
    var _r1=resolveKOTeam(m.t1),_r2=resolveKOTeam(m.t2);
    if(_r1)_t1+=' <span class="ko-res">('+_r1+')</span>';
    if(_r2)_t2+=' <span class="ko-res">('+_r2+')</span>';
  }
  teams.innerHTML=_t1+'<span class="vs">\u2013</span>'+_t2;

  var sc=document.createElement('span');sc.className='match-score';sc.style.color=m.color;
  if(m.isLive){
    sc.innerHTML='<span style="font-size:12px;font-weight:900;color:#22c55e;animation:pulse 1.5s infinite">\u26a1 '+(m.score||'0\u20130')+'</span>'+
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
        '<span style="display:block;font-size:10px;font-weight:700;color:' + _scoreColor + ';text-align:center;white-space:nowrap">\ud83c\udfaf\u00a0' + pred.score + '</span>' +
        '<span style="display:block;font-size:7px;text-align:center;letter-spacing:.02em;white-space:nowrap">' +
          '<span style="color:' + _wc + '">V' + pred.probW + '%</span>' +
          '<span style="color:#475569">\u00b7</span>' +
          '<span style="color:#64748b">N' + pred.probD + '%</span>' +
          '<span style="color:#475569">\u00b7</span>' +
          '<span style="color:' + _lc + '">D' + pred.probL + '%</span>' +
        '</span>';
      sc.title = (pred.hasStats ? 'Poisson' : 'Poisson (pas encore de stats)') + ' \u03bb=' + pred.lambdaA + ' / ' + pred.lambdaB;
    } else {
      sc.innerHTML = '<span class="status-ns">\u2013</span>';
    }
  }

  var city=document.createElement('span');city.className='match-city';
  city.textContent=m.city?(m.venue?'\ud83d\udccd'+m.venue+' \u00b7 '+m.city:'\ud83d\udccd'+m.city):'';

  row.appendChild(bg);row.appendChild(mid);row.appendChild(tim);row.appendChild(teams);row.appendChild(sc);row.appendChild(city);

  if(m.last){var t=document.createElement('span');t.className='tag';t.style.background=hex2rgba(m.color,.2);t.style.color=m.color;t.textContent='J3';row.appendChild(t);}

  // Action icons
  var actions=document.createElement('div');actions.className='match-actions';
  actions.onclick=function(e){e.stopPropagation();};

  if(m.isLive||m.isFT){
    // Stats button
    var btnInfo=document.createElement('button');btnInfo.className='action-btn';btnInfo.title='Stats du match';btnInfo.textContent='\ud83d\udcca';btnInfo.style.color=m.color;
    btnInfo.onclick=function(){openMatchInfo(m);};
    actions.appendChild(btnInfo);
    // Lineup button (only if ESPN ID exists)
    if(ESPN_ID_MAP[m.id]){
      var _m=m, _eid=ESPN_ID_MAP[m.id];
      var btnLineup=document.createElement('button');
      btnLineup.className='action-btn';
      btnLineup.title='Compositions';
      btnLineup.textContent='\ud83d\udc55';
      btnLineup.style.color=_m.color;
      btnLineup.addEventListener('click',function(e){
        e.stopPropagation();
        _currentMatch=_m;
        openLineupESPN(_eid);
      });
      actions.appendChild(btnLineup);
    }
    // YouTube highlights link (matchs termin\u00e9s uniquement)
    if(m.isFT){
      var ytQ=m.t1+' '+m.t2+' FIFA World Cup 2026 highlights';
      var btnYt=document.createElement('a');
      btnYt.href='https://www.youtube.com/results?search_query='+encodeURIComponent(ytQ);
      btnYt.target='_blank';btnYt.rel='noopener';
      btnYt.title='R\u00e9sum\u00e9 du match sur YouTube';
      btnYt.style.cssText='font-size:13px;padding:2px 4px;color:#22c55e;text-decoration:none;line-height:1;flex-shrink:0';
      btnYt.textContent='\u25b6';
      actions.appendChild(btnYt);
    }
  }
  if(m.venue&&VENUE_COORDS[m.venue]){
    var btnMap=document.createElement('button');btnMap.className='action-btn';btnMap.title='Voir le stade';btnMap.textContent='\ud83d\uddfa\ufe0f';
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
