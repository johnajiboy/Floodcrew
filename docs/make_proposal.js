const fs=require('fs');
const D=require('docx');
const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,ShadingType,AlignmentType,LevelFormat,BorderStyle}=D;

const title='FloodCrew: Project Proposal';
const sub='A smart helper that tells a council where to send its crews and gritters, and warns the public, during floods, snow and black ice.';
const by='John Ajiboye · MSc AI with Data Analytics, Teesside University · Intelligent Decision Support Systems · November 2026';

const B=[
['h','1. The problem'],
['p','When a river floods or roads freeze, a council has only a few crews and gritters. Staff must decide quickly where to send them, often using guesswork or waiting for an official warning, which can be too late. A care home, school or hospital road can be left unprotected. Drivers and people walking also often find a flooded or icy road only when they reach it.'],
['h','2. Aim'],
['p','To build a smart system that helps a council **protect the most vulnerable places before bad weather hits**, send its crews and gritters to the right places, and **keep the public informed**.'],
['h','3. Objectives'],
['ol',['Predict river levels 6 hours ahead and which roads will freeze overnight.',
'Give every place and road a risk score (how likely × how bad).',
'Suggest the best job for each crew and gritter automatically.',
'Let the officer approve the big decisions and try "what if" scenarios.',
'Send the public alerts for their street and a safer route.',
'Test the system fairly against what councils do today.']],
['h','4. The proposed solution'],
['p','How FloodCrew works:'],
['chart'],
['parts',[['Officer dashboard','Map, ready-made plan, approvals and what-if','FFFFFF','000000'],['Crew phone page','Each job and the reason for it, plus status updates','FFFFFF','000000'],['Public alerts page','Alerts by postcode, flooded and icy roads on a map, safer route','FFFFFF','000000']]],
['h','5. Who will use it'],
['table',[['User','What they get'],['Emergency officer','A ready-made plan, with only the important moves to approve'],['Crew lead','Jobs on a phone, with the reason for each'],['Public (drivers, walkers, residents)','Alerts for their street and a safer way to travel']],[30]],
['h','6. Why it is an intelligent decision support system'],
['table',[['IDSS part','In FloodCrew'],['Data','Environment Agency river levels and rainfall; weather forecasts for ice'],['Models (AI)','Machine learning predicts river levels and road temperature'],['Knowledge base','Rules: risk = likelihood × impact; extra weight for care homes, schools, hospital routes'],['Optimiser','Hungarian algorithm gives each crew the best job, counting travel time'],['User interface','Dashboard, crew page and public alerts page'],['Human in control','Officer approves risky moves; every action is logged and can be undone']],[30]],
['h','7. Tools and data'],
['ul',['**Data:** Environment Agency open data (free) and Open-Meteo weather forecasts. Simulated River Tees data is used first while real data is collected.',
'**Build:** Python (scikit-learn, SciPy, FastAPI) and a web app.']],
['h','8. How it will be tested'],
['p','The models are trained on older data and tested on newer data they have never seen. FloodCrew is compared with today\'s practice: sending crews when the official warning comes, and gritting at fixed times. Early results on simulated data:'],
['table',[['Test','FloodCrew','Today\'s method'],['River level prediction error','About 3 cm','About 9 cm'],['Protected sites reached before flooding (5 crews)','12 of 13','7 of 13'],['Road temperature prediction error','0.85 °C','2.90 °C'],['Icy roads gritted in time (1 gritter)','79%','50%'],['Gritting runs used (2 gritters)','412','436']],[52,24]],
['h','9. Expected benefits'],
['ul',['Vulnerable places protected earlier.','Better use of a small number of crews and gritters.','Fewer people driving or walking into danger.','Clear, explainable decisions with a full record.']],
['h','10. Risks and limits'],
['ul',['Results so far use simulated data; real data is the next step.','Flood levels and gritting routes are estimates until the council\'s real ones are used.','Public alerts need officer approval to avoid false alarms. The system supports official warnings and does not replace them.']],
];

// ---------- HTML ----------
const SC=['3E2F6E','5B45A8','7B66C9','CFC3F2'],TC=['FFFFFF','FFFFFF','FFFFFF','000000'];
const md=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');
let h='';
for(const [t,v,w] of B){
 if(t=='h')h+=`<h2>${v}</h2>`;
 if(t=='p')h+=`<p>${md(v)}</p>`;
 if(t=='ol'||t=='ul')h+=`<${t}>${v.map(x=>`<li>${md(x)}</li>`).join('')}</${t}>`;
 if(t=='table'){h+='<table>'+v.map((r,i)=>'<tr>'+r.map((c,j)=>i?`<td${j==0&&w?` style="width:${w[0]}%"`:''}>${md(c)}</td>`:`<th${w&&w[j]?` style="width:${w[j]}%"`:''}>${md(c)}</th>`).join('')+'</tr>').join('')+'</table>';}
 if(t=='flow')h+='<div class="flow">'+v.map((s,i)=>(i?'<div class="ar">▶</div>':'')+`<div class="box" style="background:#${SC[i]};color:#${TC[i]}"><small>${s[0]}</small><strong>${md(s[1])}</strong><span>${md(s[2])}</span></div>`).join('')+'</div>';
 if(t=='chart')h+='<div class="chart">'+fs.readFileSync(__dirname+'/chart.svg','utf8')+'</div><p style="margin-top:2pt">It follows Simon\'s decision model (intelligence, design, choice, review) and has three parts:</p>';
 if(t=='parts')h+='<div class="parts">'+v.map(c=>`<div class="part"><strong>${c[0]}</strong><span>${c[1]}</span></div>`).join('')+'</div>';
}
const css=`@page{size:A4;margin:14mm 15mm 13mm}*{box-sizing:border-box}
body{font-family:Helvetica,Arial,sans-serif;font-size:9.8pt;line-height:1.4;color:#000;margin:0}
h1{font-size:19pt;margin:0 0 3pt;color:#000}
.sub{font-size:10.5pt;margin:0 0 4pt}
.by{font-size:7.8pt;margin-bottom:6pt;border-bottom:2pt solid #000;padding-bottom:5pt}
h2{font-size:11pt;color:#000;margin:9pt 0 3pt}
p{margin:0 0 4pt}ul,ol{margin:0 0 4pt;padding-left:16pt}li{margin:0 0 1.5pt}
table{width:100%;border-collapse:collapse;font-size:8.6pt;margin:3pt 0 4pt}
th{background:#F2F2F2;color:#000;text-align:left;padding:3pt 6pt;border-bottom:1pt solid #000}
td{padding:3pt 6pt;border-bottom:.5pt solid #999;vertical-align:top}
.flow{display:flex;margin:4pt 0 5pt}.box{flex:1;border-radius:5pt;padding:6pt 7pt}
.box small{display:block;font-size:6.8pt;text-transform:uppercase;letter-spacing:.5pt;font-weight:700;opacity:.9}
.box strong{display:block;font-size:10pt;margin:1pt 0}.box span{display:block;font-size:7.8pt;line-height:1.3}
.ar{width:14pt;display:flex;align-items:center;justify-content:center;color:#7B66C9;font-size:8pt}
.chart svg{width:100%;height:auto;display:block;margin:3pt 0 2pt}.parts{display:flex;gap:7pt;margin:2pt 0 5pt}.part{flex:1;border:1pt solid #000;padding:5pt 7pt}.part strong{display:block;font-size:9pt}.part span{display:block;font-size:7.8pt;line-height:1.3}
@media screen{html{background:#f4f4f4}body{max-width:820px;margin:24px auto;background:#fff;padding:40px 48px;border-radius:10px;box-shadow:0 2px 14px rgba(62,47,110,.08);font-size:15px}table{font-size:13px}.box span,.part span{font-size:12px}.box strong{font-size:15px}.part strong{font-size:14px}.by{font-size:12px}.sub{font-size:16px}
@media(max-width:640px){body{margin:0;padding:22px 18px;border-radius:0}.flow,.parts{flex-direction:column}.ar{height:18px;width:auto;transform:rotate(90deg)}}}`;
fs.writeFileSync('index.html',`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style></head><body><h1>${title}</h1><p class="sub">${sub}</p><div class="by">${by}</div>${h}</body></html>`);

// ---------- DOCX ----------
const P='000000',L='F2F2F2',LB='999999',F='Arial',S=19,W=10206;
const runs=t=>t.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(s=>s.startsWith('**')?new TextRun({text:s.slice(2,-2),bold:true,font:F,size:S}):new TextRun({text:s,font:F,size:S}));
const bd={style:BorderStyle.SINGLE,size:4,color:LB},nb={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
const kids=[
 new Paragraph({children:[new TextRun({text:title,font:F,size:36,bold:true,color:'000000'})],spacing:{after:40}}),
 new Paragraph({children:[new TextRun({text:sub,font:F,size:21,color:'000000'})],spacing:{after:40}}),
 new Paragraph({children:[new TextRun({text:by,font:F,size:15,color:'000000'})],border:{bottom:{style:BorderStyle.SINGLE,size:12,color:P,space:4}},spacing:{after:60}})];
for(const [t,v,w] of B){
 if(t=='h')kids.push(new Paragraph({children:[new TextRun({text:v,bold:true,font:F,size:22,color:'000000'})],spacing:{before:160,after:50},keepNext:true}));
 if(t=='p')kids.push(new Paragraph({children:runs(v),spacing:{after:70,line:252}}));
 if(t=='ol'||t=='ul')v.forEach(x=>kids.push(new Paragraph({children:runs(x),numbering:{reference:t,level:0},spacing:{after:25,line:252}})));
 if(t=='table'){
  const n=v[0].length;let ws;
  if(n==2){ws=[Math.round(W*w[0]/100)];ws.push(W-ws[0]);}else{ws=[Math.round(W*w[0]/100),Math.round(W*w[1]/100)];ws.push(W-ws[0]-ws[1]);}
  kids.push(new Table({width:{size:W,type:WidthType.DXA},columnWidths:ws,rows:v.map((r,i)=>new TableRow({children:r.map((c,j)=>new TableCell({width:{size:ws[j],type:WidthType.DXA},margins:{top:40,bottom:40,left:90,right:90},shading:i==0?{type:ShadingType.CLEAR,fill:L,color:'auto'}:undefined,borders:{top:nb,left:nb,right:nb,bottom:bd},children:[new Paragraph({children:[new TextRun({text:c,font:F,size:17,bold:i==0,color:'000000'})]})]}))}))}));
  kids.push(new Paragraph({children:[],spacing:{after:40}}));}
 if(t=='flow'){
  const bw=2200,aw=469;const cells=[];
  v.forEach((s,i)=>{if(i)cells.push(new TableCell({width:{size:aw,type:WidthType.DXA},verticalAlign:'center',borders:{top:nb,bottom:nb,left:nb,right:nb},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'→',font:F,size:22,color:'7B66C9'})]})]}));
   const fb={style:BorderStyle.SINGLE,size:4,color:SC[i]};cells.push(new TableCell({width:{size:bw,type:WidthType.DXA},margins:{top:80,bottom:80,left:100,right:100},shading:{type:ShadingType.CLEAR,fill:SC[i],color:'auto'},borders:{top:fb,bottom:fb,left:fb,right:fb},children:[
    new Paragraph({children:[new TextRun({text:s[0].toUpperCase(),font:F,size:13,bold:true,color:TC[i]})]}),
    new Paragraph({children:[new TextRun({text:s[1],font:F,size:19,bold:true,color:TC[i]})]}),
    new Paragraph({children:[new TextRun({text:s[2],font:F,size:15,color:TC[i]})]})]}));});
  kids.push(new Table({width:{size:4*bw+3*aw,type:WidthType.DXA},columnWidths:[bw,aw,bw,aw,bw,aw,bw],rows:[new TableRow({children:cells})]}));
  kids.push(new Paragraph({children:[],spacing:{after:60}}));}
 if(t=='chart'){kids.push(new Paragraph({children:[new D.ImageRun({type:'png',data:fs.readFileSync('chart.png'),transformation:{width:680,height:181}})],spacing:{after:40}}));kids.push(new Paragraph({children:runs('It follows Simon\'s decision model (intelligence, design, choice, review) and has three parts:'),spacing:{after:60}}));}
 if(t=='parts'){const pw=3296,gw=159;const cells=[];
  v.forEach((c,i)=>{if(i)cells.push(new TableCell({width:{size:gw,type:WidthType.DXA},borders:{top:nb,bottom:nb,left:nb,right:nb},children:[new Paragraph({children:[]})]}));
   cells.push(new TableCell({width:{size:pw,type:WidthType.DXA},margins:{top:70,bottom:70,left:100,right:100},shading:{type:ShadingType.CLEAR,fill:c[2],color:'auto'},borders:{top:{style:BorderStyle.SINGLE,size:6,color:'000000'},bottom:{style:BorderStyle.SINGLE,size:6,color:'000000'},left:{style:BorderStyle.SINGLE,size:6,color:'000000'},right:{style:BorderStyle.SINGLE,size:6,color:'000000'}},children:[
    new Paragraph({children:[new TextRun({text:c[0],font:F,size:18,bold:true,color:'000000'})]}),
    new Paragraph({children:[new TextRun({text:c[1],font:F,size:15,color:'000000'})]})]}));});
  kids.push(new Table({width:{size:3*pw+2*gw,type:WidthType.DXA},columnWidths:[pw,gw,pw,gw,pw],rows:[new TableRow({children:cells})]}));
  kids.push(new Paragraph({children:[],spacing:{after:60}}));}
}
const doc=new Document({creator:'John Ajiboye',title,styles:{default:{document:{run:{font:F,size:S}}}},
 numbering:{config:[{reference:'ul',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:300,hanging:220}}}}]},
  {reference:'ol',levels:[{level:0,format:LevelFormat.DECIMAL,text:'%1.',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:300,hanging:260}}}}]}]},
 sections:[{properties:{page:{margin:{top:800,bottom:760,left:850,right:850}}},children:kids}]});
Packer.toBuffer(doc).then(b=>fs.writeFileSync('FloodCrew-Proposal.docx',b));
