// ─── MAP STADE ───────────────────────────────────────────────────────────────
// Affichage OpenStreetMap + lien Google Maps pour un stade

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
