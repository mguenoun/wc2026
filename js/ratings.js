// ─── RATINGS & STATS JOUEURS ─────────────────────────────────────────────────
// Formule v8 : suppression xG/xA (inflation vs SofaScore/FotMob confirmée)

function getRole(pos){
  var p=(pos||'').toUpperCase().split('-')[0];
  var m={
    'G':'GK','GK':'GK',
    'CD':'DEF','CB':'DEF','SW':'DEF',
    'RB':'FB','LB':'FB','RWB':'FB','LWB':'FB',
    'DM':'DM','CDM':'DM',
    'CM':'CM','RM':'CM','LM':'CM',
    'AM':'AM','CAM':'AM','SS':'AM',
    'CF':'FW','ST':'FW','F':'FW','FW':'FW','LW':'FW','RW':'FW','RF':'FW','LF':'FW','WF':'FW'
  };
  return m[p]||'CM';
}

function calcRating(raw, role, minutes){
  if(!minutes||minutes<1)return null;

  // Per90 atténué : normalise seulement à 20% de l'écart
  // 90min→1.0 | 60min→1.06 | 45min→1.10 | 30min→1.13
  var p90=1+(90/minutes-1)*0.2;

  // progCarries plafonné à 6 avant normalisation
  var progCarriesCapped=Math.min(raw.progCarries||0,6);

  var n={
    passes:      raw.passes      *p90,
    totalPass:   raw.totalPass   *p90,
    duelsWon:    raw.duelsWon    *p90,
    duels:       raw.duels       *p90,
    tackles:     (raw.tackles||0)       *p90,
    intercept:   (raw.interceptions||0) *p90,
    clearances:  (raw.clearances||0)    *p90,
    ballRec:     (raw.ballRecovery||0)  *p90,
    crosses:     (raw.crosses||0)       *p90,
    progCarries: progCarriesCapped      *p90,
    shots:       (raw.shotsOnTarget||0),  // absolu
  };

  var ev={
    goals:raw.goals,  assists:raw.assists,
    saves:raw.saves,  cs:raw.cleanSheet,
    yellow:raw.yellow,red:raw.red,
  };

  var passPct=n.totalPass>=15?(n.passes/n.totalPass-0.75):0;
  var duelPct=n.duels>=3?(n.duelsWon/n.duels-0.50):0;

  var base=6.3;
  var score=0;
  var offScore=0;  // contribution offensive plafonnée
  var volScore=0;  // contribution volume/défensive plafonnée

  if(role==='GK'){
    score+=ev.saves*0.35;
    score+=ev.cs*0.30;
    score+=passPct*0.25;
    offScore+=ev.goals*2.0+ev.assists*1.0;
    score+=Math.min(offScore,2.5);
    score+=ev.yellow*-0.3+ev.red*-1.0;

  }else if(role==='DEF'){
    volScore+=n.tackles*0.15;
    volScore+=n.intercept*0.12;
    volScore+=n.clearances*0.10;
    volScore+=n.ballRec*0.06;
    volScore+=duelPct*0.80;
    volScore+=passPct*0.50;
    score+=Math.min(volScore,1.8);
    score+=ev.cs*0.35;
    offScore+=ev.goals*1.8+ev.assists*1.0+n.shots*0.15;
    score+=Math.min(offScore,2.5);
    score+=ev.yellow*-0.35+ev.red*-1.0;

  }else if(role==='FB'){
    volScore+=n.tackles*0.10;
    volScore+=n.intercept*0.10;
    volScore+=n.clearances*0.06;
    volScore+=duelPct*0.65;
    volScore+=passPct*0.40;
    volScore+=n.crosses*0.15;
    volScore+=n.progCarries*0.08;
    score+=Math.min(volScore,1.8);
    score+=ev.cs*0.25;
    offScore+=ev.goals*1.6+ev.assists*1.0+n.shots*0.12;
    score+=Math.min(offScore,2.5);
    score+=ev.yellow*-0.30+ev.red*-1.0;

  }else if(role==='DM'){
    volScore+=n.tackles*0.18;
    volScore+=n.intercept*0.15;
    volScore+=n.ballRec*0.12;
    volScore+=n.clearances*0.06;
    volScore+=duelPct*0.75;
    volScore+=passPct*0.60;
    score+=Math.min(volScore,1.5);
    offScore+=ev.goals*1.5+ev.assists*1.0+n.shots*0.12;
    score+=Math.min(offScore,2.5);
    score+=ev.yellow*-0.30+ev.red*-1.0;

  }else if(role==='CM'){
    volScore+=passPct*0.45;
    volScore+=duelPct*0.45;
    volScore+=n.tackles*0.10;
    volScore+=n.intercept*0.08;
    volScore+=n.ballRec*0.08;
    volScore+=n.progCarries*0.07;
    score+=Math.min(volScore,1.2);
    offScore+=ev.goals*1.4+ev.assists*0.90+n.shots*0.15;
    score+=Math.min(offScore,2.5);
    score+=ev.yellow*-0.30+ev.red*-1.0;

  }else if(role==='AM'){
    volScore+=n.shots*0.20;
    volScore+=n.progCarries*0.08;
    volScore+=passPct*0.30;
    volScore+=n.tackles*0.06;
    volScore+=n.ballRec*0.05;
    score+=Math.min(volScore,1.8);
    offScore+=ev.goals*1.4+ev.assists*0.90;
    score+=Math.min(offScore,2.5);
    if(n.shots<0.5)score-=0.15;
    score+=ev.yellow*-0.30+ev.red*-1.0;

  }else{ // FW
    offScore+=ev.goals*1.5;
    offScore+=n.shots*0.22;
    offScore+=ev.assists*0.80;
    score+=Math.min(offScore,2.8);
    volScore+=n.progCarries*0.08;
    volScore+=n.ballRec*0.05;
    volScore+=n.tackles*0.06;
    score+=Math.min(volScore,0.6);
    if(n.shots<0.5)score-=0.20;
    score+=ev.yellow*-0.30+ev.red*-1.0;
  }

  return Math.round(Math.max(4.0,Math.min(9.5,base+score))*10)/10;
}

function ratingColor(r){
  return r>=7.5?'#22c55e':r>=6.5?'#0ea5e9':r>=6.0?'#f59e0b':'#ef4444';
}

// Charger les stats de tous les joueurs d'un match via ESPN Core API
async function loadMatchPlayerStats(eid, rosters){
  // Essai 1 : stats pré-calculées en KV par le pipeline Worker (rapide)
  try{
    var rc=await fetch(PROXY_BASE+'/data/stats/'+eid);
    if(rc.ok){
      var dc=await rc.json();
      if(dc.stats&&Object.keys(dc.stats).length>0)return dc.stats;
    }
  }catch(_){}

  // Fallback : calcul à la volée depuis ESPN Core (~25-50 requêtes, lent)
  var namesByTeam=[];
  rosters.forEach(function(team){
    var map={};
    team.roster.forEach(function(p){
      map[p.jersey]={
        name:p.athlete&&p.athlete.displayName||'?',
        pos:p.position&&p.position.abbreviation||'',
        fullName:p.athlete&&p.athlete.displayName||''
      };
    });
    namesByTeam.push({teamName:normTeam(team.team.displayName),map:map});
  });

  var ESPN_CORE='https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world';
  var d1=await fetch(ESPN_CORE+'/events/'+eid+'/competitions/'+eid+'/competitors')
    .then(function(r){return r.json();});

  var playerStats={};
  var teamIdx=0;

  for(var i=0;i<d1.items.length;i++){
    var comp=await fetch(d1.items[i].$ref.replace('http://','https://'))
      .then(function(r){return r.json();});
    var roster=await fetch(comp.roster.$ref.replace('http://','https://'))
      .then(function(r){return r.json();});
    var teamInfo=namesByTeam[teamIdx++]||{teamName:'?',map:{}};

    await Promise.all(roster.entries.map(function(e){
      var info=teamInfo.map[e.jersey]||{name:'#'+e.jersey,pos:'',fullName:''};
      var role=getRole(info.pos);
      return fetch(e.statistics.$ref.replace('http://','https://'))
        .then(function(r){return r.json();})
        .then(function(s){
          var gs=function(cat,name){
            var c=(s.splits&&s.splits.categories||[]).find(function(x){return x.name===cat;});
            return c&&c.stats&&c.stats.find(function(x){return x.name===name;})?
              c.stats.find(function(x){return x.name===name;}).value:0;
          };
          var minutes=gs('general','minutes');
          var raw={
            goals:    gs('offensive','totalGoals'),
            assists:  gs('offensive','goalAssists'),
            passes:   gs('offensive','accuratePasses'),
            totalPass:gs('offensive','totalPasses'),
            shotsOnTarget:gs('offensive','shotsOnTarget'),
            progCarries:  gs('offensive','progressiveCarries'),
            crosses:      gs('offensive','accurateCrosses'),
            duelsWon: gs('general','duelsWon')||gs('general','groundDuelsWon'),
            duels:    gs('general','duels')||gs('general','groundDuels'),
            saves:    gs('goalKeeping','saves'),
            cleanSheet:gs('goalKeeping','cleanSheet'),
            tackles:  gs('defensive','effectiveTackles'),
            interceptions:gs('defensive','interceptions'),
            clearances:   gs('defensive','effectiveClearance'),
            ballRecovery: gs('defensive','ballRecovery'),
            yellow:   gs('general','yellowCards'),
            red:      gs('general','redCards'),
          };
          playerStats[info.fullName]={
            rating:  calcRating(raw,role,minutes),
            minutes: minutes,
            goals:   raw.goals,
            assists: raw.assists,
            saves:   raw.saves,
            yellow:  raw.yellow,
            red:     raw.red,
            starter: e.starter,
            subbedIn:  e.subbedIn,
            subbedOut: e.subbedOut,
            team: teamInfo.teamName,
            pos:  info.pos,
            role: role,
          };
        });
    }));
  }
  return playerStats;
}
