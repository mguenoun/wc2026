// ─── MAP STADE ───────────────────────────────────────────────────────────────
// Affichage OpenStreetMap + lien Google Maps pour un stade (modal)

// ─── VUE STADES ──────────────────────────────────────────────────────────────

function haversineKm(lat1,lon1,lat2,lon2){
  var R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

var _stadesMap=null;
var _stadesMarkers={};

function renderStadesMap(){
  var panel=document.getElementById('stades-info-panel');
  // Initialise Leaflet une seule fois
  if(!_stadesMap){
    var mapDiv=document.getElementById('stades-map-leaflet');
    if(!mapDiv||typeof L==='undefined')return;
    _stadesMap=L.map('stades-map-leaflet',{scrollWheelZoom:false,zoomControl:true})
               .setView([38,-97],3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'© <a href="https://openstreetmap.org">OSM</a>',maxZoom:18
    }).addTo(_stadesMap);

    Object.entries(VENUE_COORDS).forEach(function(e){
      var name=e[0],v=e[1];
      var matchCount=allMatches.filter(function(m){return m.venue===name;}).length;
      var marker=L.circleMarker([v.lat,v.lng],{
        radius:8,fillColor:'#0ea5e9',color:'#fff',weight:1.5,opacity:1,fillOpacity:.85
      }).addTo(_stadesMap);
      _stadesMarkers[name]=marker;
      var mc=allMatches.filter(function(x){return x.venue===name;}).length;
      marker.bindTooltip('<b>'+v.city+'</b><br><span style="font-size:10px;color:#94a3b8">'+name+'</span><br><span style="font-size:9px;color:#475569">'+v.cap.toLocaleString('fr-FR')+' places · '+mc+' matchs</span>',{direction:'top',offset:[0,-8],className:'stade-lbl'});
      marker.on('click',function(){_showStadeInfo(name,v,panel);});
    });
  } else {
    setTimeout(function(){_stadesMap.invalidateSize();},100);
  }

  // Liste triée par capacité
  var list=document.getElementById('stades-list');
  if(list&&!list.dataset.built){
    list.dataset.built='1';
    var sorted=Object.entries(VENUE_COORDS).sort(function(a,b){return b[1].cap-a[1].cap;});
    var html='<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;padding:4px 12px;">';
    html+='<div style="display:flex;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:8px;color:#475569;font-weight:700">'
      +'<span style="min-width:20px">#</span>'
      +'<span style="flex:1">Ville · Stade</span>'
      +'<span style="min-width:56px;text-align:right">Capacité</span>'
      +'<span style="min-width:40px;text-align:right">Matchs</span></div>';
    sorted.forEach(function(e,i){
      var name=e[0],v=e[1];
      var mc=allMatches.filter(function(m){return m.venue===name;}).length;
      var rc=i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#cd7f32':'#475569';
      html+='<div class="scorer-row" style="cursor:pointer" onclick="_showStadeInfo(\''+name.replace(/'/g,"\\'")+'\',VENUE_COORDS[\''+name.replace(/'/g,"\\'")+'\'],document.getElementById(\'stades-info-panel\'));document.getElementById(\'stades-map-leaflet\').scrollIntoView({behavior:\'smooth\'})">'
        +'<span class="scorer-rank" style="color:'+rc+'">'+(i+1)+'</span>'
        +'<span class="scorer-name"><b style="color:#e2e8f0">'+v.city+'</b>'
          +'<span style="font-size:9px;color:#64748b;font-weight:400;margin-left:4px">'+name+'</span></span>'
        +'<span style="font-size:11px;font-weight:800;color:#0ea5e9;min-width:56px;text-align:right">'+v.cap.toLocaleString('fr-FR')+'</span>'
        +'<span style="font-size:10px;color:#64748b;min-width:40px;text-align:right">'+mc+'</span>'
        +'</div>';
    });
    html+='</div>';
    list.innerHTML=html;
  }
}

function _showStadeInfo(name,v,panel){
  if(!panel)return;
  // Highlight marker
  Object.entries(_stadesMarkers).forEach(function(e){
    e[1].setStyle({radius:e[0]===name?11:8,fillColor:e[0]===name?'#f59e0b':'#0ea5e9',weight:e[0]===name?2:1.5});
  });
  _stadesMap.flyTo([v.lat,v.lng],6,{duration:0.8});

  var matchCount=allMatches.filter(function(m){return m.venue===name;}).length;
  var mapsUrl='https://www.google.com/maps/search/?api=1&query='+v.q;

  // Distances vers tous les autres stades
  var dists=Object.entries(VENUE_COORDS)
    .filter(function(e){return e[0]!==name;})
    .map(function(e){return {name:e[0],city:e[1].city,km:haversineKm(v.lat,v.lng,e[1].lat,e[1].lng)};})
    .sort(function(a,b){return a.km-b.km;});

  var distHtml=dists.slice(0,5).map(function(d){
    return '<span style="display:inline-flex;align-items:center;gap:4px;margin:2px 0;font-size:9px;color:#94a3b8">'
      +'<span style="color:#0ea5e9;font-weight:700">'+d.km.toLocaleString('fr-FR')+' km</span>'
      +'<span style="color:#475569">→</span>'+d.city+'</span>';
  }).join('<br>');

  panel.innerHTML=
    '<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px 14px;margin-top:10px;">'
    +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;">'
      +'<div>'
        +'<div style="font-size:13px;font-weight:800;color:#e2e8f0">'+v.city+'</div>'
        +'<div style="font-size:10px;color:#64748b;margin-top:2px">📍 '+name+'</div>'
      +'</div>'
      +'<a href="'+mapsUrl+'" target="_blank" style="font-size:10px;color:#0ea5e9;text-decoration:none;flex-shrink:0">Maps ↗</a>'
    +'</div>'
    +'<div style="display:flex;gap:16px;margin-bottom:10px;">'
      +'<div style="text-align:center">'
        +'<div style="font-size:18px;font-weight:900;color:#0ea5e9">'+v.cap.toLocaleString('fr-FR')+'</div>'
        +'<div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">PLACES</div>'
      +'</div>'
      +'<div style="text-align:center">'
        +'<div style="font-size:18px;font-weight:900;color:#f59e0b">'+matchCount+'</div>'
        +'<div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">MATCHS</div>'
      +'</div>'
    +'</div>'
    +'<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;">'
      +'<div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px;margin-bottom:5px">STADES LES PLUS PROCHES</div>'
      +distHtml
    +'</div>'
    +'</div>';
  panel.classList.remove('hidden');
}

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
