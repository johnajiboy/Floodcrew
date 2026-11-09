(function(){
var C={red:'#E0592A',amber:'#E8A317',green:'#3E9C6B',route:'#7A5CC9',prop:'#B7791F',ice:'#3B82F6'};
var LOOKS={
 c1:{skin:'#8D5A3B',hair:'#1E1A1C',back:'long',top:'short',shirt:'#5B45A0',bg:'#EAE3FA'},
 c2:{skin:'#F0C9A4',hair:'#7A4A26',back:'none',top:'short',shirt:'#7A5CC9',bg:'#E3EAFB'},
 c3:{skin:'#B9835A',hair:'#141214',back:'long',top:'short',shirt:'#6D5BB0',bg:'#F1EAFB'},
 c4:{skin:'#E2B48C',hair:'#3A2A20',back:'none',top:'short',shirt:'#3E2F6E',bg:'#F6EEF9'},
 c5:{skin:'#5E3B26',hair:'#9A7FD9',back:'none',top:'wrap',shirt:'#5B45A0',bg:'#EEE8F8'}
};
var HP={none:'M0 0',short:'M12.4 16.5 C12.2 9.8 15.6 7.4 20 7.4 C24.6 7.4 27.9 10 27.6 16.5 C26 13.2 23.2 11.8 20 11.8 C16.8 11.8 14 13.2 12.4 16.5 Z',long:'M11 18 C10.6 9.2 14.8 6.8 20 6.8 C25.2 6.8 29.4 9.2 29 18 L29.5 30 L10.5 30 Z',wrap:'M11.6 15.2 C11 8 15 5.2 20 5.2 C25 5.2 29 8 28.4 15.2 C25.6 12.4 14.4 12.4 11.6 15.2 Z'};
function face(id,size){var L=LOOKS[id];return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" fill="'+L.bg+'"/><path d="'+HP[L.back]+'" fill="'+L.hair+'"/><path d="M5 41 C7 31 13 27.5 20 27.5 C27 27.5 33 31 35 41 Z" fill="'+L.shirt+'"/><rect x="17" y="22" width="6" height="7" rx="2" fill="'+L.skin+'"/><circle cx="12.5" cy="17.6" r="1.7" fill="'+L.skin+'"/><circle cx="27.5" cy="17.6" r="1.7" fill="'+L.skin+'"/><circle cx="20" cy="17" r="7.5" fill="'+L.skin+'"/><path d="'+HP[L.top]+'" fill="'+L.hair+'"/><path d="M15.6 14.9 Q17 14.1 18.4 14.8 M21.6 14.8 Q23 14.1 24.4 14.9" stroke="'+L.hair+'" stroke-width=".9" fill="none" stroke-linecap="round"/><ellipse cx="17" cy="17" rx=".95" ry="1.1" fill="#24181A"/><ellipse cx="23" cy="17" rx=".95" ry="1.1" fill="#24181A"/><circle cx="17.3" cy="16.6" r=".3" fill="#fff"/><circle cx="23.3" cy="16.6" r=".3" fill="#fff"/><path d="M20 17.6 Q19.3 19.2 20.4 19.4" stroke="#00000033" stroke-width=".7" fill="none"/><circle cx="15.6" cy="19.6" r="1.2" fill="#E5737355"/><circle cx="24.4" cy="19.6" r="1.2" fill="#E5737355"/><path d="M17.2 20.6 Q20 23.2 22.8 20.6" stroke="#6E2E2A" stroke-width=".95" fill="#fff" stroke-linecap="round"/></svg>';}
var ST={'On site':['#DCF3E6','#14532D','#2E9E62'],'En route':['#DCE7FB','#1E3A8A','#3B6FE0'],'Standby':['#ECEFF2','#334155','#9AA1AC'],'Assigned':['#FBEFD6','#7A4A06','#E8A317']};
var NAMES={c1:['Amara Okafor','AO'],c2:['Liam Hart','LH'],c3:['Priya Nair','PN'],c4:['Tom Reid','TR'],c5:['Zainab Bello','ZB']};
var DEPOT_OFF={c1:[-24,-6],c2:[-22,0],c3:[0,26],c4:[0,-24],c5:[22,0]};

/* ---------- scenarios ---------- */
var MODES={};
MODES.flood={
 start:780,end:238,unit:'Crew',onLabel:'On site',rep:'Replay · sample flood event',
 legend:['High risk','Rising','Stable','Crew route'],
 intro:'Press Play to replay the flood. The system reads river levels, forecasts risk and plans crews.',
 sites:{care:{x:236,y:546,label:'Care home',name:'Yarm care home',prot:1},school:{x:520,y:226,label:'School',name:'Thornaby school',prot:1},stock:{x:410,y:322,label:'Riverside',name:'Stockton riverside'},depot:{x:775,y:350,label:'Depot',name:'Middlesbrough depot',dep:1}},
 sensors:[
  {name:'Yarm',x:168,y:528,peakT:165,peak:1.18,w:75,zone:[185,520,80,52]},
  {name:'Stockton',x:352,y:352,peakT:180,peak:1.0,w:80,zone:[350,362,88,54]},
  {name:'Thornaby',x:612,y:240,peakT:190,peak:0.86,w:85,zone:[620,235,70,42]},
  {name:'Middlesbrough',x:842,y:138,peakT:200,peak:0.62,w:90,zone:null}],
 val:function(g,t){return 0.45+(g.peak-0.45)*Math.exp(-Math.pow((t-g.peakT)/g.w,2));},
 risk:function(g,t){var f=this.val(g,t);return f>=0.9?'red':f>=0.72?'amber':'green';},
 label:function(g,t){var r=(this.val(g,t+5)-this.val(g,t))/5*60*40;return g.name.slice(0,5)+' '+(r>=0?'+':'')+r.toFixed(1)+'cm/h';},
 zoneCol:function(r){return C[r];},
 crews:function(){return{
  c1:{at:'stock',status:'On site',job:'Pump deployment, Stockton riverside'},
  c2:{at:'depot',status:'Standby',job:'Standby at depot'},
  c3:{at:'school',status:'On site',job:'Flood barrier, Thornaby school',why:'Protected site. Thornaby gauge rising slowly.'},
  c4:{at:'depot',status:'Standby',job:'Standby at depot'},
  c5:{at:'depot',status:'Standby',job:'Loading pumps at depot'}};},
 events:[
  {t:4,run:function(){log('Auto','400 sandbags pre-positioned at Middlesbrough depot. Low risk: no crew moved.');S.brief='Levels normal but rain is heavy upstream. Pre-positioning sandbags at the depot.';}},
  {t:30,run:function(){send('c2','care',40,'Sandbag wall, Yarm care home','Yarm gauge rising. Care home in flood zone.');log('Auto','Crew 2 sent from depot to Yarm care home. Low risk: no protected site left uncovered.');S.brief='Yarm is rising fastest. Crew 2 sent automatically: it was on standby, so nothing is left uncovered.';}},
  {t:62,run:function(){send('c4','stock',35,'Support pumps, Stockton riverside','Stockton gauge rising. 210 homes in flood zone.');log('Auto','Crew 4 sent from depot to support Crew 1 at Stockton. Low risk.');S.brief='Stockton now rising too. Crew 4 sent to support Crew 1. Yarm forecast to pass flood level within 3 hours.';}},
  {t:96,run:function(){S.pending={id:'c3',to:'care',since:S.t,title:'Move Crew 3 from Thornaby school to Yarm care home',why:'Yarm is forecast to exceed flood level (+8 cm/h, 140 homes, 1 care home). Crew 2 alone cannot finish the wall in time. This leaves Thornaby school uncovered.',conf:64,
   ok:function(){send('c3','care',45,'Sandbag wall, Yarm care home','Approved by officer. Yarm rising fast, care home at risk.',true);S.phAlert='New job: go to Yarm care home. Approved by duty officer at '+hhmm(S.t)+'.';log('Officer','Approved: Crew 3 to Yarm care home. Crew lead notified.');send('c5','school',40,'Cover Thornaby school','Auto-filled: Crew 3 moved, protected site uncovered.');log('Auto','Crew 5 sent from depot to cover Thornaby school. Low risk: fills an uncovered site.');S.brief='Crew 3 heading to Yarm. Crew 5 auto-sent to keep Thornaby school covered.';},
   no:function(){log('Officer','Rejected: Crew 3 stays at Thornaby school.');send('c5','care',50,'Sandbag support, Yarm care home','Alternative after officer rejected moving Crew 3.');log('Auto','Alternative plan: Crew 5 sent from depot to Yarm. Low risk: no site uncovered.');S.brief='Plan adjusted: Crew 3 stays at the school, Crew 5 goes to Yarm instead (arrives later).';}};
   log('Waiting','High-risk move sent to officer for approval: Crew 3 to Yarm.');S.brief='Recommending Crew 3 to Yarm. This uncovers a protected site, so it needs your approval.';}},
  {t:126,run:function(){if(S.pending)log('Escalated','Approval waiting 30 min. Reminder sent to duty manager. Move not carried out.');}},
  {t:40,run:function(){pubAuto('Flood warning: River Tees at Yarm','Official Environment Agency warning. Riverside paths in Yarm closed.','Official',C.red);}},
  {t:108,run:function(){draft('Avoid Yarm High Street from 15:30','Flooding expected near the river. Drivers: use the A19 via Eaglescliffe. Pedestrians: riverside path and underpass closed.','FloodCrew forecast, not yet an official warning. A false alarm causes panic, so the officer checks it.',C.red);}},
  {t:212,run:function(){pubAuto('Levels falling at Stockton','Riverside path in Stockton still closed until crews finish.','FloodCrew',C.amber);}},
  {t:205,run:function(){S.brief='Peak has passed at Yarm and Stockton. Levels falling. Crews can stand down once sites are secure.';log('Auto','Forecast updated: levels falling at all gauges.');}}
 ],
 route:{fromTo:'Stockton → Yarm, driving',normal:'M410 322 C360 360 300 420 236 546',safe:'M410 322 L385 300 L335 480 L300 590 L236 566',okTxt:'No warnings on your route yet.',safeTxt:'Rerouted: avoids flooded Yarm High Street. Via A19 and Eaglescliffe (+6 min).'},
 summary:function(){return 'Yarm care home was '+(S.crews.c3.at==='care'||S.crews.c5.at==='care'?'reinforced before the peak.':'covered by Crew 2 only.');}
};
MODES.winter={
 start:1140,end:298,unit:'Gritter',onLabel:'Gritting',rep:'Replay · sample freezing night',
 legend:['Ice likely (≤0.5°C)','Near freezing','Above freezing','Gritter route'],
 intro:'Press Play to replay a freezing night. The system reads road temperature forecasts, predicts black ice and plans gritting routes.',
 sites:{hosp:{x:760,y:470,label:'Hospital route',name:'the hospital route',prot:1},bus:{x:440,y:300,label:'Bus route',name:'Stockton bus route'},hill:{x:430,y:560,label:'Steep hill',name:'Ingleby Barwick hill'},school:{x:250,y:560,label:'School road',name:'Yarm school road',prot:1},depot:{x:775,y:350,label:'Salt depot',name:'Middlesbrough salt depot',dep:1}},
 sensors:[
  {name:'Hill',x:470,y:520,s0:3.2,min:-1.6,fall:130,zone:[430,560,90,48]},
  {name:'Hosp',x:800,y:430,s0:3.8,min:-0.4,fall:220,zone:[760,470,85,46]},
  {name:'Bus',x:480,y:262,s0:4.2,min:0.9,fall:240,zone:[440,300,80,44]},
  {name:'Yarm',x:210,y:520,s0:3.5,min:-0.3,fall:200,zone:[250,560,80,44]}],
 val:function(g,t){return g.s0-(g.s0-g.min)*Math.min(1,t/g.fall);},
 risk:function(g,t){var v=this.val(g,t);return v<=0.5?'red':v<=2.5?'amber':'green';},
 label:function(g,t){return g.name+' '+this.val(g,t).toFixed(1)+'°C';},
 zoneCol:function(r){return r==='red'?C.ice:'#93C5FD';},
 crews:function(){return{
  c1:{at:'depot',status:'Standby',job:'Loaded with salt, ready at depot'},
  c2:{at:'depot',status:'Standby',job:'Loaded with salt, ready at depot'},
  c3:{at:'depot',status:'Standby',job:'Loaded with salt, ready at depot',why:'Waiting for the evening forecast.'},
  c4:{at:'depot',status:'Standby',job:'Loaded with salt, ready at depot'},
  c5:{at:'depot',status:'Standby',job:'Loaded with salt, ready at depot'}};},
 events:[
  {t:6,run:function(){log('Auto','Salt depot checked: 820 t of rock salt. Brine pre-wet loaded on all 5 gritters.');S.brief='Dry and cold. Road temperatures forecast to drop below zero after 23:00, with a shower around 21:30.';}},
  {t:30,run:function(){send('c3','hosp',40,'Grit the hospital route','Priority 1 route. Road forecast to reach -0.4°C after a shower: black ice risk.');S.phAlert='Run started: hospital route (priority 1).';log('Auto','Gritter 3 started the hospital route. Low risk: priority 1 route, precautionary run.');S.brief='Black ice likely after the shower. Starting priority 1: the hospital route.';}},
  {t:52,run:function(){send('c2','bus',35,'Grit the Stockton bus route','Priority 2 route. Buses run until midnight.');log('Auto','Gritter 2 started the Stockton bus route. Low risk.');S.brief='Hospital route under way. Bus routes next, before the last buses.';}},
  {t:76,run:function(){send('c1','school',45,'Grit Yarm school road','Protected route for the morning school run.');log('Auto','Gritter 1 started Yarm school road. Low risk: fills an untreated protected route.');}},
  {t:118,run:function(){S.pending={id:'c3',to:'hill',since:S.t,title:'Divert Gritter 3 from the hospital route to Ingleby Barwick hill',why:'A snow band has arrived early. The steep hill is at -0.8°C and buses and ambulances use it. The hospital route is about 60% treated and would be left unfinished.',conf:58,
   ok:function(){send('c3','hill',30,'Grit Ingleby Barwick hill','Diverted by officer: snow on a steep hill at -0.8°C.',true);S.phAlert='Diversion: go to Ingleby Barwick hill now. Approved by duty officer at '+hhmm(S.t)+'.';log('Officer','Approved: Gritter 3 diverted to Ingleby Barwick hill. Driver notified.');send('c5','hosp',35,'Finish the hospital route','Auto-filled: Gritter 3 diverted, priority 1 route unfinished.');log('Auto','Gritter 5 sent to finish the hospital route. Low risk: fills an unfinished priority route.');S.brief='Gritter 3 heading to the hill. Gritter 5 auto-sent to finish the hospital route.';},
   no:function(){log('Officer','Rejected: Gritter 3 finishes the hospital route first.');send('c4','hill',45,'Grit Ingleby Barwick hill','Alternative after officer kept Gritter 3 on the hospital route.');log('Auto','Alternative plan: Gritter 4 sent from depot to the hill. Low risk: nothing left unfinished.');S.brief='Plan adjusted: hospital route finished first; Gritter 4 goes to the hill (arrives later).';}};
   log('Waiting','High-risk move sent to officer: divert Gritter 3 away from the hospital route.');S.brief='Snow arrived early on the hill. Recommending a diversion, but it leaves the hospital route unfinished, so it needs your approval.';}},
  {t:150,run:function(){if(S.pending)log('Escalated','Approval waiting 30 min. Reminder sent to duty manager. Diversion not carried out.');}},
  {t:36,run:function(){pubAuto('Gritting under way','Hospital route being gritted now. Other roads may be icy after 23:00.','Gritting',C.ice);}},
  {t:124,run:function(){draft('Ingleby Barwick hill: snow and ice','Not yet gritted. Drivers: avoid if you can. Pedestrians: use the lower footpath and take care.','New FloodCrew warning from sensor data. Telling people to avoid a road needs the officer.',C.red);}},
  {t:262,run:function(){pubAuto('Main routes gritted','Pavements and side streets may still be icy. Walk with care.','Gritting',C.green);}},
  {t:250,run:function(){log('Auto','Priority routes treated. Second run scheduled for 04:00 if road temperatures stay below zero.');S.brief='Main routes treated. Watching temperatures for a second run before the morning rush.';}}
 ],
 route:{fromTo:'Stockton → Ingleby Barwick, driving',normal:'M440 300 C440 380 435 470 430 560',safe:'M440 300 L520 310 L560 470 L520 590 L430 590',okTxt:'No warnings on your route yet.',safeTxt:'Rerouted: avoids the icy, ungritted hill. Via gritted main road (+4 min).'},
 summary:function(){return 'Ingleby Barwick hill was '+(S.crews.c3.at==='hill'||S.crews.c4.at==='hill'?'gritted after the snow band arrived.':'still waiting for treatment.');}
};

var M=MODES.flood,mode='flood',S,timer=null,speed=2,ptab='crew';
function $(id){return document.getElementById(id);}
function init(){
 var cr=M.crews(),crews={};
 Object.keys(cr).forEach(function(k,i){var n=NAMES[k];crews[k]=Object.assign({id:k,name:n[0],ini:n[1],crew:M.unit+' '+(i+1)},cr[k]);});
 S={t:0,running:false,fired:{},log:[],pending:null,ended:false,crews:crews,phAlert:null,brief:M.intro,alerts:[],draft:null,pubBanner:null,pubNew:false,routeSafe:false};
 $('end').classList.add('hidden');
 $('repTxt').textContent=M.rep;$('repDot').style.background=mode==='flood'?'#E0592A':C.ice;
 ['lg1','lg2','lg3','lg4'].forEach(function(id,i){$(id).textContent=M.legend[i];});
 $('phRole').textContent=mode==='flood'?'Crew 3 lead':'Gritter 3 driver';$('phOn').textContent=M.onLabel;
 setRun(false);render();
}
function hhmm(t){var m=(M.start+Math.round(t))%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
function disp(s){return s==='On site'?M.onLabel:s;}
function pos(c){
 var o=DEPOT_OFF[c.id];
 if(c.move){var a=pt(c.move.from,c),b=M.sites[c.move.to],p=c.move.waiting?0:Math.min(1,(S.t-c.move.start)/c.move.dur);return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p};}
 return pt(c.at,c);
}
function pt(site,c){var s=M.sites[site],o=s.dep?DEPOT_OFF[c.id]:[0,0];return {x:s.x+o[0],y:s.y+o[1]};}
function log(kind,text){S.log.unshift({t:S.t,kind:kind,text:text});}
function send(id,to,dur,job,why,waitForPhone){var c=S.crews[id];c.move={from:c.move?c.move.to:c.at,to:to,start:S.t,dur:dur,waiting:!!waitForPhone};if(c.move.from===to){c.move=null;return;}c.status=waitForPhone?'Assigned':'En route';c.job=job;c.why=why;}
function pubAuto(title,body,src,col){S.alerts.unshift({t:S.t,title:title,body:body,src:src,col:col});S.pubBanner=title+': '+body;S.pubNew=ptab!=='pub';log('Auto','Public alert published automatically: "'+title+'". Low risk: '+(src==='Official'?'matches an official warning.':'confirmed status update.'));}
function draft(title,body,why,col){S.draft={title:title,body:body,why:why,col:col,since:S.t};log('Waiting','Public alert drafted for officer approval: "'+title+'".');}
function pubDecide(ok){var d=S.draft;if(!d)return;S.draft=null;
 if(ok){S.alerts.unshift({t:S.t,title:d.title,body:d.body,src:'FloodCrew',col:d.col});S.pubBanner=d.title+': '+d.body;S.pubNew=ptab!=='pub';S.routeSafe=true;log('Officer','Public alert approved and published: "'+d.title+'". Safe routes updated.');}
 else log('Officer','Public alert discarded: "'+d.title+'".');render();}
function decide(ok){var p=S.pending;if(!p)return;S.pending=null;(ok?p.ok:p.no)();render();}

function tick(){
 if(!S.running)return;
 S.t+=speed;
 M.events.forEach(function(e,i){if(!S.fired[i]&&S.t>=e.t){S.fired[i]=1;e.run();}});
 var c3=S.crews.c3;if(c3.move&&c3.move.waiting&&S.t-c3.move.start>=12){c3.move.waiting=false;c3.move.start=S.t;c3.status='En route';S.phAlert=null;log('Auto',c3.crew+' accepted the job (auto-accepted for the demo after 12 min).');}
 Object.keys(S.crews).forEach(function(k){var c=S.crews[k];if(c.move&&!c.move.waiting&&S.t-c.move.start>=c.move.dur){c.at=c.move.to;c.move=null;c.status='On site';log('Crew',c.crew+(mode==='flood'?' arrived at ':' now gritting ')+M.sites[c.at].name+'.');}});
 if(S.t>=M.end)finish();
 render();
}
function finish(){setRun(false);S.ended=true;
 var auto=S.log.filter(function(e){return e.kind==='Auto';}).length,off=S.log.filter(function(e){return e.kind==='Officer';}).length;
 $('endTxt').innerHTML='The system made <b>'+auto+' automatic decisions</b> and asked the officer <b>'+off+' time'+(off===1?'':'s')+'</b>. Every action is in the event log with its reason. '+M.summary();
 $('end').classList.remove('hidden');}
function setRun(on){S.running=on;$('playTxt').textContent=on?'Pause':'Play';$('playIcon').textContent=on?'❚❚':'▶';$('play').setAttribute('aria-label',on?'Pause':'Play');
 if(on&&!timer)timer=setInterval(tick,450);if(!on&&timer){clearInterval(timer);timer=null;}}

function render(){
 var t=S.t;$('clock').textContent=hhmm(t);
 $('aiStatus').textContent=S.running?'Plan updated at '+hhmm(Math.floor(t/15)*15):(S.t>0?'Paused':'Waiting to start');
 $('brief').textContent=S.brief;
 var z='',g='';
 M.sensors.forEach(function(G){var r=M.risk(G,t),col=C[r];
  if(G.zone&&r!=='green'){var zc=M.zoneCol(r);z+='<ellipse cx="'+G.zone[0]+'" cy="'+G.zone[1]+'" rx="'+G.zone[2]+'" ry="'+G.zone[3]+'" fill="'+zc+'" fill-opacity=".14" stroke="'+zc+'" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="6 5"/>';}
  var lab=M.label(G,t),w=lab.length*7+16;
  g+=(r==='red'?'<circle class="pulse" cx="'+G.x+'" cy="'+G.y+'" r="14" fill="'+col+'"/>':'<circle cx="'+G.x+'" cy="'+G.y+'" r="18" fill="'+col+'" fill-opacity=".18"/>')+
   '<circle cx="'+G.x+'" cy="'+G.y+'" r="8.5" fill="'+col+'" stroke="#fff" stroke-width="3"/>'+
   '<rect x="'+(G.x-w/2)+'" y="'+(G.y-38)+'" width="'+w+'" height="20" rx="10" fill="'+(r==='red'?'#B6431C':r==='amber'?'#8A5A08':'#2E7350')+'"/>'+
   '<text x="'+G.x+'" y="'+(G.y-24)+'" fill="#fff" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">'+lab+'</text>';});
 $('zones').innerHTML=z;$('gauges').innerHTML=g;
 var s='';Object.keys(M.sites).forEach(function(k){var x=M.sites[k];var w=x.label.length*7+18;
  s+='<rect x="'+(x.x-w/2)+'" y="'+(x.y+22)+'" width="'+w+'" height="20" rx="6" fill="'+(x.dep?'#3E2F6E':'#fff')+'" stroke="'+(x.prot?'#6D4AC4':x.dep?'#3E2F6E':'#B9B3C9')+'" stroke-width="1.5"/><text x="'+x.x+'" y="'+(x.y+36)+'" font-size="11" font-weight="600" text-anchor="middle" fill="'+(x.dep?'#fff':x.prot?'#4C2F9E':'#4A435A')+'">'+x.label+'</text>';});
 $('sites').innerHTML=s;
 var r='';Object.keys(S.crews).forEach(function(k){var c=S.crews[k];if(c.move){var a=pt(c.move.from,c),b=M.sites[c.move.to],p=pos(c);
   r+='<line x1="'+a.x+'" y1="'+a.y+'" x2="'+p.x+'" y2="'+p.y+'" stroke="'+C.route+'" stroke-width="4" stroke-linecap="round"/><line x1="'+p.x+'" y1="'+p.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="'+C.route+'" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 8"/>';}});
 if(S.pending){var a=pos(S.crews[S.pending.id]),b=M.sites[S.pending.to];r+='<path d="M'+a.x+' '+a.y+' Q '+((a.x+b.x)/2)+' '+(Math.min(a.y,b.y)+40)+' '+b.x+' '+b.y+'" fill="none" stroke="'+C.prop+'" stroke-width="3" stroke-dasharray="9 7" stroke-linecap="round"/>';}
 $('routes').innerHTML=r;
 var cg='';Object.keys(S.crews).forEach(function(k){var c=S.crews[k],p=pos(c),col=ST[c.status][2];
  cg+='<g><circle cx="'+p.x+'" cy="'+p.y+'" r="18" fill="'+col+'"/><circle cx="'+p.x+'" cy="'+p.y+'" r="15.5" fill="#fff"/><svg x="'+(p.x-15)+'" y="'+(p.y-15)+'" width="30" height="30" viewBox="0 0 40 40"><clipPath id="cl'+k+'"><circle cx="20" cy="20" r="20"/></clipPath><g clip-path="url(#cl'+k+')">'+face(k,40).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')+'</g></svg></g>';});
 $('crewsG').innerHTML=cg;
 var P=S.pending,D=S.draft;$('apCount').textContent=String((P?1:0)+(D?1:0));
 $('apEmpty').classList.toggle('hidden',!!(P||D));$('pubCard').classList.toggle('hidden',!D);
 if(D){$('pubTitle').textContent=D.title+'. '+D.body;$('pubWhy').textContent='Why it needs you: '+D.why;$('pubWait').textContent='waiting '+Math.round(t-D.since)+' min';}$('apCard').classList.toggle('hidden',!P);
 if(P){$('apTitle').textContent=P.title;$('apWhy').textContent=P.why;$('apConf').textContent=P.conf+'%';$('apBar').style.width=P.conf+'%';$('apWait').textContent='waiting '+Math.round(t-P.since)+' min';}
 var cl='',act=0;Object.keys(S.crews).forEach(function(k){var c=S.crews[k],st=ST[c.status];if(c.status!=='Standby')act++;
  cl+='<div class="crew"><span class="av" style="width:40px;height:40px">'+face(k,40)+'<span class="st" style="background:'+st[2]+'"></span></span><span style="flex:1;min-width:0"><div class="n">'+c.name+'</div><div class="s">'+c.crew+' · '+c.job+'</div></span><span class="badge" style="background:'+st[0]+';color:'+st[1]+'">'+disp(c.status)+'</span></div>';});
 $('crewList').innerHTML=cl;$('crewCount').textContent=act+' deployed · '+(5-act)+' standby';
 var KC={Auto:['#EFE9FB','#3E2F6E'],Officer:['#E6ECF8','#1E3A8A'],Waiting:['#FBE8D6','#8A3A0E'],Escalated:['#FBE8D6','#8A3A0E'],Crew:['#DCF3E6','#14532D']};
 $('log').innerHTML=S.log.length?S.log.map(function(e){var k=KC[e.kind];return '<div class="ev"><div class="h"><span class="badge" style="background:'+k[0]+';color:'+k[1]+'">'+e.kind+'</span><span class="mono" style="font-size:11px;color:#5E566F">'+hhmm(e.t)+'</span></div>'+e.text+'</div>';}).join(''):'<div class="empty">No events yet.</div>';
 var c3=S.crews.c3,st3=ST[c3.status];
 $('phStatus').textContent=disp(c3.status);$('phStatus').style.background=st3[0];$('phStatus').style.color=st3[1];
 $('phJob').textContent=c3.job;$('phWhy').textContent=c3.why?'Why: '+c3.why:'';
 var al=$('phAlert');if(S.phAlert){al.textContent=S.phAlert;al.classList.remove('hidden');}else al.classList.add('hidden');
 document.querySelectorAll('.sbig').forEach(function(b){b.classList.toggle('on',b.dataset.st===c3.status);});
 var R=M.route,base='<path d="M0 430 L300 390 L520 310 L1000 340 M270 700 L335 480 L385 300 L420 0 M610 700 L650 430 L705 210 L725 0 M0 190 L400 215 L700 165 L1000 95" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M90 700 C140 610 120 550 190 510 C260 470 250 410 330 370 C400 335 430 290 500 278 C580 265 600 238 660 208 C720 178 780 182 840 138 C880 108 900 70 1000 48" fill="none" stroke="#C3D4E6" stroke-width="18" stroke-linecap="round"/>';
 var dots='';M.sensors.forEach(function(G){dots+='<circle cx="'+G.x+'" cy="'+G.y+'" r="11" fill="'+C[M.risk(G,t)]+'" stroke="#fff" stroke-width="4"/>';});
 var rt=S.routeSafe?'<path d="'+R.normal+'" fill="none" stroke="#9AA1AC" stroke-width="6" stroke-dasharray="4 10" stroke-linecap="round"/><path d="'+R.safe+'" fill="none" stroke="#2E9E62" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>':'<path d="'+R.normal+'" fill="none" stroke="#7A5CC9" stroke-width="10" stroke-linecap="round"/>';
 $('pubMap').innerHTML=base+z+rt+dots;
 $('pubFromTo').textContent=R.fromTo;
 $('pubRoute').innerHTML=S.routeSafe?'<span style="color:#14532D;font-weight:600">'+R.safeTxt+'</span>':'<span style="color:#4A435A">'+R.okTxt+'</span>';
 $('pubList').innerHTML=S.alerts.length?S.alerts.map(function(a){return '<div class="job" style="flex-direction:row;gap:10px;padding:10px"><span class="dot" style="background:'+a.col+';margin-top:5px"></span><span style="display:flex;flex-direction:column;gap:3px"><span style="font-size:13px;font-weight:600">'+a.title+'</span><span style="font-size:12px;color:#4A435A;line-height:1.4">'+a.body+'</span><span class="mono" style="font-size:10px;color:#5E566F">'+hhmm(a.t)+' · '+a.src+'</span></span></div>';}).join(''):'<div class="empty" style="font-size:12px">No alerts in your area.</div>';
 var pb=$('pubBanner');if(S.pubBanner){pb.textContent=S.pubBanner;pb.classList.remove('hidden');}else pb.classList.add('hidden');
 $('pubDot').classList.toggle('hidden',!S.pubNew);
}
$('phAv').innerHTML='<span class="av" style="width:44px;height:44px;display:block;box-shadow:0 0 0 3px #fff">'+face('c3',44)+'</span>';
document.querySelectorAll('.sbig').forEach(function(b){b.onclick=function(){var c=S.crews.c3,st=b.dataset.st;
 if(st==='En route'&&c.move&&c.move.waiting){c.move.waiting=false;c.move.start=S.t;c.status='En route';S.phAlert=null;log('Crew',c.crew+' accepted and is heading to '+M.sites[c.move.to].name+'.');}
 else if(st==='On site'&&c.move&&!c.move.waiting){c.at=c.move.to;c.move=null;c.status='On site';log('Crew',c.crew+' marked '+M.onLabel.toLowerCase()+' at '+M.sites[c.at].name+'.');}
 else if(st==='Done'&&!c.move&&c.status==='On site'){c.status='Standby';c.job='Job complete, awaiting next task';c.why='Marked done by '+(mode==='flood'?'crew lead.':'driver.');log('Crew',c.crew+' finished the job and is available.');}
 render();};});
$('play').onclick=function(){if(S.ended)init();setRun(!S.running);render();};
$('reset').onclick=function(){init();};
$('again').onclick=function(){init();setRun(true);};
$('approve').onclick=function(){decide(true);};$('publish').onclick=function(){pubDecide(true);};$('discard').onclick=function(){pubDecide(false);};
document.querySelectorAll('.pt').forEach(function(b){b.onclick=function(){ptab=b.dataset.p;document.querySelectorAll('.pt').forEach(function(x){x.classList.toggle('sel',x===b);});$('scrCrew').classList.toggle('hidden',ptab!=='crew');$('scrPub').classList.toggle('hidden',ptab!=='pub');$('phCap').textContent=ptab==='crew'?"Crew lead's phone (tap the buttons)":'What drivers and pedestrians see';if(ptab==='pub')S.pubNew=false;render();};});$('reject').onclick=function(){decide(false);};
document.querySelectorAll('.sp').forEach(function(b){b.onclick=function(){speed=+b.dataset.s;document.querySelectorAll('.sp').forEach(function(x){x.classList.toggle('sel',x===b);});};});
document.querySelectorAll('.md').forEach(function(b){b.onclick=function(){if(b.dataset.m===mode)return;mode=b.dataset.m;M=MODES[mode];document.querySelectorAll('.md').forEach(function(x){x.classList.toggle('sel',x===b);});init();};});
init();
})();
