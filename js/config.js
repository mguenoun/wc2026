// ─── CONFIG ───────────────────────────────────────────────────────────────────
const WORKER_PROD    = 'https://wc2026.mguenoun.workers.dev';
const WORKER_STAGING = 'https://wc2026-staging.mguenoun.workers.dev';

// Auto-détection par hostname — aucun build step requis
// localhost / *.pages.dev → staging   |   github.io → prod
const PROXY_BASE = (function() {
  if (typeof location === 'undefined') return WORKER_PROD;
  var h = location.hostname;
  if (h === 'mguenoun.github.io')           return WORKER_PROD;
  if (h.endsWith('.pages.dev'))             return WORKER_STAGING;
  if (h === 'localhost' || h === '127.0.0.1') return WORKER_STAGING;
  return WORKER_PROD;
})();
const DISPLAY_TZ = 'Africa/Casablanca';
var USER_TZ = (function(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone;}catch(e){return DISPLAY_TZ;}})();
const TODAY_STR  = new Date().toLocaleDateString('en-CA', {timeZone: DISPLAY_TZ});

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

const ESPN_ID_MAP = {
  // Journée 1
  'M1':'760415','M2':'760414','M7':'760416','M19':'760417',
  'M8':'760420','M13':'760419','M14':'760418','M20':'760421',
  // Journée 2
  'M25':'760422','M31':'760425','M26':'760423','M32':'760424',
  'M43':'760428','M37':'760426','M44':'760429','M38':'760427',
  'M49':'760432','M50':'760430','M55':'760433','M56':'760431',
  'M61':'760435','M67':'760437','M68':'760434','M62':'760436',
  // Journée 3
  'M4':'760438','M10':'760439','M9':'760440','M3':'760441',
  'M16':'760442','M21':'760445','M15':'760444','M22':'760443',
  'M33':'760447','M27':'760448','M30':'760446','M34':'760449',
  'M43b':'760453','M39':'760451','M44b':'760450','M40':'760452',
  'M57':'760456','M51':'760457','M52':'760454','M58':'760455',
  'M63':'760461','M69':'760458','M70':'760460','M64':'760459',
  // Journée 3 simultanés
  'M11':'760463','M12':'760462','M17':'760465','M18':'760464',
  'M5':'760467','M6':'760466','M29':'760468','M28':'760473',
  'M35':'760471','M36':'760472','M23':'760470','M24':'760469',
  'M53':'760475','M54':'760474','M47':'760479','M48':'760478',
  'M41':'760476','M42':'760477','M71':'760485','M72':'760480',
  'M65':'760481','M66':'760482','M59':'760484','M60':'760483',
  // 32es de finale
  'M73':'760486','M76':'760487','M74':'760489','M75':'760488',
  'M78':'760490','M77':'760491','M79':'760492','M80':'760495',
  'M82':'760493','M81':'760494','M84':'760497','M83':'760496',
  'M85':'760498','M88':'760499','M86':'760500','M87':'760501',
  // 16es de finale
  'M89':'760502','M90':'760503',
};

const VENUE_COORDS = {
  'Estadio Azteca':          {lat:19.3029,  lng:-99.1505,  q:'Estadio+Azteca+Mexico+City',           cap:87523, city:'Mexico City'},
  'Estadio Akron':           {lat:20.6867,  lng:-103.4667, q:'Estadio+Akron+Guadalajara+Mexico',      cap:48071, city:'Guadalajara'},
  'Estadio BBVA':            {lat:25.6694,  lng:-100.2436, q:'Estadio+BBVA+Monterrey+Mexico',         cap:53460, city:'Monterrey'},
  'BMO Field':               {lat:43.6333,  lng:-79.4183,  q:'BMO+Field+Toronto+Canada',              cap:45500, city:'Toronto'},
  'BC Place':                {lat:49.2767,  lng:-123.1117, q:'BC+Place+Vancouver+Canada',             cap:54500, city:'Vancouver'},
  'MetLife Stadium':         {lat:40.8135,  lng:-74.0745,  q:'MetLife+Stadium+East+Rutherford+NJ',    cap:87157, city:'New York'},
  'Gillette Stadium':        {lat:42.0909,  lng:-71.2643,  q:'Gillette+Stadium+Foxborough+MA',        cap:70000, city:'Boston'},
  'NRG Stadium':             {lat:29.6847,  lng:-95.4107,  q:'NRG+Stadium+Houston+TX',               cap:72220, city:'Houston'},
  'AT&T Stadium':            {lat:32.7479,  lng:-97.0945,  q:'ATT+Stadium+Arlington+TX',             cap:92967, city:'Dallas'},
  'Lincoln Financial Field': {lat:39.9008,  lng:-75.1675,  q:'Lincoln+Financial+Field+Philadelphia+PA',cap:69328,city:'Philadelphia'},
  'Mercedes-Benz Stadium':   {lat:33.7553,  lng:-84.4006,  q:'Mercedes-Benz+Stadium+Atlanta+GA',     cap:75000, city:'Atlanta'},
  'Hard Rock Stadium':       {lat:25.9580,  lng:-80.2389,  q:'Hard+Rock+Stadium+Miami+Gardens+FL',   cap:67518, city:'Miami'},
  "Levi's Stadium":          {lat:37.4033,  lng:-121.9694, q:'Levis+Stadium+Santa+Clara+CA',         cap:70909, city:'San Francisco'},
  'SoFi Stadium':            {lat:33.9535,  lng:-118.3392, q:'SoFi+Stadium+Inglewood+CA',            cap:70240, city:'Los Angeles'},
  'Lumen Field':             {lat:47.5952,  lng:-122.3316, q:'Lumen+Field+Seattle+WA',               cap:69000, city:'Seattle'},
  'Arrowhead Stadium':       {lat:39.0489,  lng:-94.4839,  q:'Arrowhead+Stadium+Kansas+City+MO',     cap:76640, city:'Kansas City'},
};

// ─── DRAPEAUX ─────────────────────────────────────────────────────────────────

var FLAG = {
  'Mexique':'MX','Afrique du Sud':'ZA','Corée du Sud':'KR','Tchéquie':'CZ',
  'Canada':'CA','Bosnie-H.':'BA','Bosnia-H.':'BA','Bosnie':'BA','Qatar':'QA','Suisse':'CH',
  'Brésil':'BR','Maroc':'MA','Haïti':'HT','Écosse':'GB-SCT',
  'USA':'US','Paraguay':'PY','Australie':'AU','Turquie':'TR',
  'Allemagne':'DE','Curaçao':'CW','Côte d’Ivoire':'CI',"Côte d'Ivoire":'CI','Équateur':'EC',
  'Pays-Bas':'NL','Japon':'JP','Suède':'SE','Tunisie':'TN',
  'Belgique':'BE','Égypte':'EG','Iran':'IR','Nv-Zélande':'NZ',
  'Espagne':'ES','Cap-Vert':'CV','Arabie S.':'SA','Uruguay':'UY',
  'France':'FR','Sénégal':'SN','Irak':'IQ','Norvège':'NO',
  'Argentine':'AR','Algérie':'DZ','Autriche':'AT','Jordanie':'JO',
  'Portugal':'PT','Congo RD':'CD','Ouzbékistan':'UZ','Colombie':'CO',
  'Angleterre':'GB-ENG','Croatie':'HR','Ghana':'GH','Panama':'PA',
};


function flagEmoji(name) {
  var code = FLAG[name] || (TEAM_MAP[name] && FLAG[TEAM_MAP[name]]);
  if (!code) return '';
  var src = 'https://flagcdn.com/20x15/' + code.toLowerCase() + '.png';
  return '<img src="' + src + '" width="13" height="10" style="vertical-align:middle;border-radius:1px;margin-right:2px" alt="" loading="lazy">';
}

const GC = {A:'#0ea5e9',B:'#06b6d4',C:'#10b981',D:'#f59e0b',E:'#ef4444',F:'#f97316',G:'#8b5cf6',H:'#ec4899',I:'#14b8a6',J:'#a855f7',K:'#22c55e',L:'#f43f5e'};

const TEAM_MAP = {
  'Mexico':'Mexique','South Africa':'Afrique du Sud','Korea Republic':'Cor\u00e9e du Sud','South Korea':'Cor\u00e9e du Sud','Czechia':'Tch\u00e9quie','Czech Republic':'Tch\u00e9quie',
  'Canada':'Canada','Bosnia and Herzegovina':'Bosnie-H.','Bosnia & Herzegovina':'Bosnie-H.','Bosnia-Herzegovina':'Bosnie-H.','Qatar':'Qatar','Switzerland':'Suisse',
  'Brazil':'Br\u00e9sil','Morocco':'Maroc','Haiti':'Ha\u00efti','Scotland':'\u00c9cosse',
  'United States':'USA','USA':'USA','Paraguay':'Paraguay','Australia':'Australie','T\u00fcrkiye':'Turquie','Turkey':'Turquie','Turkiye':'Turquie',
  'Germany':'Allemagne','Curacao':'Cura\u00e7ao','Cura\u00e7ao':'Cura\u00e7ao',"C\u00f4te d'Ivoire":"C\u00f4te d\u2019Ivoire",'Ivory Coast':"C\u00f4te d\u2019Ivoire",'Ecuador':'\u00c9quateur',
  'Netherlands':'Pays-Bas','Japan':'Japon','Sweden':'Su\u00e8de','Tunisia':'Tunisie',
  'Belgium':'Belgique','Egypt':'\u00c9gypte','Iran':'Iran','New Zealand':'Nv-Z\u00e9lande',
  'Spain':'Espagne','Cape Verde':'Cap-Vert','Saudi Arabia':'Arabie S.','Uruguay':'Uruguay',
  'France':'France','Senegal':'S\u00e9n\u00e9gal','Iraq':'Irak','Norway':'Norv\u00e8ge',
  'Argentina':'Argentine','Algeria':'Alg\u00e9rie','Austria':'Autriche','Jordan':'Jordanie',
  'Portugal':'Portugal','DR Congo':'Congo RD','Congo DR':'Congo RD','Uzbekistan':'Ouzb\u00e9kistan','Colombia':'Colombie',
  'England':'Angleterre','Croatia':'Croatie','Ghana':'Ghana','Panama':'Panama',
};

function normTeam(n){ return TEAM_MAP[n] || n; }

const POS_MAP = {
  'GK':'Gardien','G':'Gardien',
  'CB':'D. Central','LB':'D. Gauche','RB':'D. Droit',
  'LWB':'P. D. Gauche','RWB':'P. D. Droit',
  'CDM':'Mil. Défensif','DM':'Mil. Défensif',
  'CM':'Milieu','MF':'Milieu','MID':'Milieu',
  'CAM':'Mil. Offensif',
  'LM':'Mil. Gauche','RM':'Mil. Droit',
  'LW':'Ailier Gauche','RW':'Ailier Droit',
  'CF':'Avant-Centre','ST':'Attaquant',
  'F':'Attaquant','FW':'Attaquant',
  'D':'Défenseur','DF':'Défenseur',
};
function normPos(p){ return POS_MAP[p] || p; }

// Calcule la minute approximative d'un match en cours
function liveMinute(m){
  if(!m.isLive) return null;
  var now = new Date();
  var kickoffUTC;
  if(m.utcDate){
    kickoffUTC = new Date(m.utcDate);
  } else {
    if(!m.time || !m.dayKey) return null;
    var timeParts = m.time.match(/(\d+)h(\d+)/);
    if(!timeParts) return null;
    var h = parseInt(timeParts[1]), min = parseInt(timeParts[2]);
    var dateParts = m.dayKey.split('-');
    kickoffUTC = new Date(Date.UTC(
      parseInt(dateParts[0]), parseInt(dateParts[1])-1, parseInt(dateParts[2]),
      h-1, min
    ));
  }
  var elapsedMs = now - kickoffUTC;
  var elapsedMin = Math.floor(elapsedMs / 60000);
  if(elapsedMin < 0) return null;
  if(elapsedMin <= 45) return elapsedMin + "'";
  if(elapsedMin <= 60) return 'Mi-temps';
  if(elapsedMin <= 105) return (elapsedMin - 15) + "'";
  if(elapsedMin <= 120) return 'Prolongations';
  return '90+';
}
// Retourne l'heure du match dans le fuseau de l'utilisateur (si utcDate disponible)
function localTime(m){
  if(m.utcDate){
    return new Date(m.utcDate).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:USER_TZ});
  }
  return m.time||'';
}
function hex2rgba(h,a){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return 'rgba('+r+','+g+','+b+','+a+')';}
function frDate(s){var d=new Date(s);return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',timeZone:DISPLAY_TZ}).replace(/^\w/,function(c){return c.toUpperCase();});}
function frTime(s){var d=new Date(s);return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:DISPLAY_TZ});}
function dayKey(s){var d=new Date(s);return d.toLocaleDateString('en-CA',{timeZone:DISPLAY_TZ});}

var allMatches=[], standings={}, scorers=[], selectedId=null, activeFilter='all', activeView='knockout';

function groupByDate(arr){
  var map=new Map();
  var sorted=arr.slice().sort(function(a,b){var dk=a.dayKey.localeCompare(b.dayKey);if(dk!==0)return dk;return (a.time||'').localeCompare(b.time||'');});
  sorted.forEach(function(m){var k=m.dateLabel;if(!map.has(k))map.set(k,[]);map.get(k).push(m);});
  return Array.from(map.entries());
}


// ─── API ──────────────────────────────────────────────────────────────────────

// Charge les scores depuis ESPN sur une fenêtre de dates autour d'aujourd'hui
