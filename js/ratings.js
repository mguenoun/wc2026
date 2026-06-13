// ─── RATINGS & STATS JOUEURS ─────────────────────────────────────────────────

function getRole(pos){
  var p=(pos||'').toUpperCase().split('-')[0];
  var m={'G':'GK','GK':'GK','CD':'DEF','CB':'DEF','SW':'DEF','RB':'FB','LB':'FB','RWB':'FB','LWB':'FB','DM':'DM','CDM':'DM','CM':'CM','RM':'CM','LM':'CM','AM':'AM','CAM':'AM','SS':'AM','CF':'FW','ST':'FW','F':'FW','FW':'FW','LW':'FW','RW':'FW','RF':'FW','LF':'FW','WF':'FW'};
  return m[p]||'CM';
}

var RATING_WEIGHTS={
  GK: {goals:1.5,assists:0.8,xG:0.1,xA:0.1,passPct:0.3,duelEff:0.1,saves:0.5,goalsPrev:0.6,cleanSheet:0.5,yellow:-0.5,red:-1.5},
  DEF:{goals:1.5,assists:0.9,xG:0.2,xA:0.2,passPct:0.6,duelEff:0.9,saves:0,goalsPrev:0,cleanSheet:0.3,yellow:-0.6,red:-1.5},
  FB: {goals:1.3,assists:1.1,xG:0.3,xA:0.6,passPct:0.5,duelEff:0.7,saves:0,goalsPrev:0,cleanSheet:0.2,yellow:-0.5,red:-1.5},
  DM: {goals:1.2,assists:1.0,xG:0.3,xA:0.4,passPct:0.7,duelEff:0.8,saves:0,goalsPrev:0,cleanSheet:0.1,yellow:-0.5,red:-1.5},
  CM: {goals:1.2,assists:1.0,xG:0.5,xA:0.5,passPct:0.5,duelEff:0.5,saves:0,goalsPrev:0,cleanSheet:0,yellow:-0.5,red:-1.5},
  AM: {goals:1.2,assists:1.1,xG:0.6,xA:0.7,passPct:0.4,duelEff:0.4,saves:0,goalsPrev:0,cleanSheet:0,yellow:-0.5,red:-1.5},
  FW: {goals:1.4,assists:0.9,xG:0.8,xA:0.4,passPct:0.2,duelEff:0.4,saves:0,goalsPrev:0,cleanSheet:0,yellow:-0.5,red:-1.5},
};

function calcRating(raw, role, minutes){
  if(!minutes||minutes<1)return null;
  var w=RATING_WEIGHTS[role]||RATING_WEIGHTS.CM;
  var p90=90/minutes;
  // Stats de volume normalisées per90
  var passes=raw.passes*p90, totalPass=raw.totalPass*p90;
  var duelsWon=raw.duelsWon*p90, duels=raw.duels*p90;
  var rating=6.0;
  rating+=raw.goals*w.goals; rating+=raw.assists*w.assists;
  rating+=raw.xG*w.xG; rating+=raw.xA*w.xA;
  if(totalPass>=15)rating+=(passes/totalPass-0.75)*w.passPct;
  if(duels>=3)rating+=(duelsWon/duels-0.5)*w.duelEff;
  rating+=raw.saves*w.saves; rating+=raw.goalsPrev*w.goalsPrev; rating+=raw.cleanSheet*w.cleanSheet;
  rating+=raw.yellow*w.yellow; rating+=raw.red*w.red;
  return Math.round(Math.max(4.0,Math.min(9.5,rating))*10)/10;
}

function ratingColor(r){return r>=7.5?'#22c55e':r>=6.5?'#0ea5e9':r>=6.0?'#f59e0b':'#ef4444';}

// Charger les stats de tous les joueurs d'un match via ESPN core API
async function loadMatchPlayerStats(eid, rosters){
  var namesByTeam=[];
  rosters.forEach(function(team){
    var map={};
    team.roster.forEach(function(p){map[p.jersey]={name:p.athlete&&p.athlete.displayName||'?',pos:p.position&&p.position.abbreviation||'',fullName:p.athlete&&p.athlete.displayName||''};});
    namesByTeam.push({teamName:normTeam(team.team.displayName),map:map});
  });
  var ESPN_CORE='https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world';
  var d1=await fetch(ESPN_CORE+'/events/'+eid+'/competitions/'+eid+'/competitors').then(function(r){return r.json();});
  var playerStats={};
  var teamIdx=0;
  for(var i=0;i<d1.items.length;i++){
    var item=d1.items[i];
    var comp=await fetch(item.$ref.replace('http://','https://')).then(function(r){return r.json();});
    var roster=await fetch(comp.roster.$ref.replace('http://','https://')).then(function(r){return r.json();});
    var teamInfo=namesByTeam[teamIdx++]||{teamName:'?',map:{}};
    await Promise.all(roster.entries.map(function(e){
      var info=teamInfo.map[e.jersey]||{name:'#'+e.jersey,pos:'',fullName:''};
      var role=getRole(info.pos);
      return fetch(e.statistics.$ref.replace('http://','https://')).then(function(r){return r.json();}).then(function(s){
        var gs=function(cat,name){var c=(s.splits&&s.splits.categories||[]).find(function(x){return x.name===cat;});return c&&c.stats&&c.stats.find(function(x){return x.name===name;})?c.stats.find(function(x){return x.name===name;}).value:0;};
        var minutes=gs('general','minutes');
        var raw={goals:gs('offensive','totalGoals'),assists:gs('offensive','goalAssists'),xG:gs('offensive','expectedGoals'),xA:gs('offensive','expectedAssists'),passes:gs('offensive','accuratePasses'),totalPass:gs('offensive','totalPasses'),duelsWon:gs('general','duelsWon')||gs('general','groundDuelsWon'),duels:gs('general','duels')||gs('general','groundDuels'),saves:gs('goalKeeping','saves'),goalsPrev:gs('goalKeeping','goalsPrevented'),cleanSheet:gs('goalKeeping','cleanSheet'),yellow:gs('general','yellowCards'),red:gs('general','redCards')};
        playerStats[info.fullName]={rating:calcRating(raw,role,minutes),minutes:minutes,goals:raw.goals,assists:raw.assists,saves:raw.saves,yellow:raw.yellow,red:raw.red,starter:e.starter,subbedIn:e.subbedIn,subbedOut:e.subbedOut,team:teamInfo.teamName,pos:info.pos,role:role};
      });
    }));
  }
  return playerStats;
}
