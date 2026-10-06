/* Карточки игроков на странице «Топ-100».
   Открываются кликом по нику в рейтинге, кнопкой «Найти игрока» или по ссылке /top100#p=<ID>.
   Данные — top100-players.json (собирает build-players.js при обновлении рейтинга),
   скачиваются один раз при первом открытии карточки, поэтому сам рейтинг грузится так же быстро.
   Использует общие с top100.js TOP100_TABS, esc, escAttr, fmt, norm, top100Period */
(function(){
"use strict";
/* пререндер в build.js гоняет скрипты без браузера — там карточкам делать нечего */
if(typeof window.fetch!=="function"||!document.body)return;

const URL_DATA="top100-players.json"+(window.TOP100_HISTORY&&window.TOP100_HISTORY.id?"?v="+encodeURIComponent(window.TOP100_HISTORY.id):"");
const DAY=864e5;
const PERIODS=[
 {key:"last",label:"С прошлого обновления"},
 {key:"d1",label:"За сутки",ms:DAY},
 {key:"d7",label:"За неделю",ms:7*DAY},
 {key:"d30",label:"За месяц",ms:30*DAY},
 {key:"all",label:"За всё время"}
];
const TAB=Object.fromEntries(TOP100_TABS.map(t=>[t.key,t]));
const BOSS_COLOR="#ff8a65";

let data=null,loading=null,idByNick=null,searchList=null;
let cur=null,metric=null,period=null,lastFocus=null;

function load(){
 if(data)return Promise.resolve(data);
 if(!loading)loading=fetch(URL_DATA).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(d=>{
  data=d;idByNick={};searchList=[];
  for(const id of Object.keys(d.players)){const p=d.players[id];idByNick[p.n]=id;searchList.push({id:id,n:p.n,q:norm(p.n),rep:p.v[d.metrics.indexOf("reputation")]||0})}
  searchList.sort((a,b)=>b.rep-a.rep);
  return d;
 }).catch(e=>{loading=null;throw e});
 return loading;
}

/* цвет группировки: из выгрузки, иначе стабильный оттенок по названию */
function factionColor(g){
 if(!g)return"#8196a9";
 if(data&&data.factions&&data.factions[g])return data.factions[g];
 let h=0;for(const c of g)h=(h*31+c.charCodeAt(0))%360;
 return"hsl("+h+" 55% 62%)";
}
const dateFmt=ms=>new Date(ms).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Europe/Moscow"});
const stamp=ms=>new Date(ms).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Moscow"}).replace(",","");
const dateShort=ms=>new Date(ms).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",timeZone:"Europe/Moscow"});
const signed=v=>(v>0?"+":v<0?"−":"")+fmt(Math.abs(v));

/* значение показателя mi (индекс в metrics, -1 = уровень) на дату di: последняя известная точка не позже di */
function valueAt(p,mi,di){
 let v=null;
 for(const pt of p.s){if(pt[0]>di)break;const x=pt[2+mi];if(x!==null&&x!==undefined)v=x}
 return v;
}
/* индекс снимка-базы для периода (как в рейтинге: самый свежий снимок, которому уже не меньше срока) */
function baseIndex(per){
 const d=data.dates,last=d.length-1;
 if(last<1)return null;
 if(per.key==="last")return last-1;
 if(per.key==="all")return 0;
 const target=d[last]-per.ms;let b=null;
 for(let i=0;i<last;i++)if(d[i]<=target)b=i;
 return b;
}
/* периоды, для которых есть база; одинаковая база у разных периодов — дубль, оставляем первый */
function availablePeriods(){
 const seen=new Set();
 return PERIODS.filter(per=>{const b=baseIndex(per);if(b===null||seen.has(b))return false;seen.add(b);return true});
}

/* ---------- окно ---------- */
let root=null;
function ensureRoot(){
 if(root)return root;
 document.body.insertAdjacentHTML("beforeend",'<div class="pc-overlay" id="pcOverlay" hidden><div class="pc-dialog" role="dialog" aria-modal="true" aria-labelledby="pcTitle" tabindex="-1">'
  +'<div class="pc-bar"><label class="pc-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="pcSearch" type="search" placeholder="Найти игрока по нику" autocomplete="off" aria-label="Найти игрока по нику" aria-controls="pcSuggest"></label>'
  +'<button type="button" class="pc-icon-btn" id="pcShare" title="Скопировать ссылку на карточку" aria-label="Скопировать ссылку на карточку" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg></button>'
  +'<button type="button" class="pc-icon-btn" id="pcClose" title="Закрыть" aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>'
  +'<ul class="pc-suggest" id="pcSuggest" role="listbox" hidden></ul></div>'
  +'<div class="pc-body" id="pcBody"></div></div></div>');
 root=document.getElementById("pcOverlay");
 root.addEventListener("click",e=>{
  if(e.target===root){close();return}
  if(e.target.closest("#pcClose")){close();return}
  if(e.target.closest("#pcShare")){share();return}
  const s=e.target.closest("[data-pc-id]");
  if(s){open(s.dataset.pcId);return}
  const m=e.target.closest("[data-pc-metric]");
  if(m){metric=m.dataset.pcMetric;renderCard();return}
  const per=e.target.closest("[data-pc-period]");
  if(per){period=per.dataset.pcPeriod;renderCard();return}
 });
 const inp=document.getElementById("pcSearch");
 inp.addEventListener("input",()=>suggest(inp.value));
 inp.addEventListener("keydown",e=>{
  const list=document.getElementById("pcSuggest"),items=[...list.querySelectorAll("[data-pc-id]")];
  if(!items.length)return;
  const i=items.indexOf(document.activeElement);
  if(e.key==="ArrowDown"){e.preventDefault();items[0].focus()}
  if(e.key==="Enter"){e.preventDefault();open(items[0].dataset.pcId)}
  if(i<0)return;
 });
 document.getElementById("pcSuggest").addEventListener("keydown",e=>{
  const items=[...e.currentTarget.querySelectorAll("[data-pc-id]")],i=items.indexOf(document.activeElement);
  if(e.key==="ArrowDown"&&i<items.length-1){e.preventDefault();items[i+1].focus()}
  if(e.key==="ArrowUp"){e.preventDefault();(i>0?items[i-1]:document.getElementById("pcSearch")).focus()}
 });
 return root;
}
function suggest(q){
 const list=document.getElementById("pcSuggest"),nq=norm(q).trim();
 if(!nq||!searchList){list.hidden=true;list.innerHTML="";return}
 const found=searchList.filter(x=>x.q.includes(nq)).slice(0,8);
 list.innerHTML=found.length?found.map(x=>{const p=data.players[x.id];return'<li><button type="button" role="option" data-pc-id="'+escAttr(x.id)+'"><i class="t100-dot" style="--f:'+escAttr(factionColor(p.g))+'"'+(p.g?"":' data-none')+'></i><span>'+esc(x.n)+'</span><small>'+(p.g?esc(p.g)+" · ":"")+'ур. '+p.l+'</small></button></li>'}).join(""):'<li class="pc-suggest-empty">Никого не нашли</li>';
 list.hidden=false;
}

function show(){
 ensureRoot();
 if(root.hidden){lastFocus=document.activeElement;root.hidden=false;document.documentElement.classList.add("pc-lock")}
}
function close(){
 if(!root||root.hidden)return;
 root.hidden=true;document.documentElement.classList.remove("pc-lock");cur=null;
 if(/^#p=/.test(location.hash))history.replaceState(null,"",location.pathname+location.search);
 if(lastFocus&&lastFocus.focus)lastFocus.focus();
}
function share(){
 const url=location.origin+location.pathname+"#p="+encodeURIComponent(cur);
 const btn=document.getElementById("pcShare");
 const done=()=>{btn.classList.add("ok");btn.title="Ссылка скопирована";setTimeout(()=>{btn.classList.remove("ok");btn.title="Скопировать ссылку на карточку"},1600)};
 if(navigator.share&&matchMedia("(pointer:coarse)").matches)navigator.share({title:data.players[cur].n+" — Сердце Зоны",url:url}).catch(()=>{});
 else if(navigator.clipboard)navigator.clipboard.writeText(url).then(done,()=>prompt("Ссылка на карточку:",url));
 else prompt("Ссылка на карточку:",url);
}

/* открыть: id игрока, либо null — только поиск */
function open(id,opts){
 show();
 const body=document.getElementById("pcBody");
 if(!data)body.innerHTML='<div class="pc-loading"><i></i>Загружаем карточки игроков…</div>';
 load().then(()=>{
  const sl=document.getElementById("pcSuggest");sl.hidden=true;
  if(id&&!data.players[id]){id=null}
  cur=id;
  document.getElementById("pcShare").hidden=!id;
  if(!id){
   body.innerHTML='<div class="pc-empty"><b>Карточки игроков</b><p>Найдите любого игрока по нику: показатели, места во всех рейтингах, прирост и история группировок.</p></div>';
   const inp=document.getElementById("pcSearch");inp.focus();return;
  }
  document.getElementById("pcSearch").value="";
  if(!metric)metric=(opts&&opts.metric)||"reputation";
  if(!period){const tp=typeof top100Period==="string"?top100Period:"last";period=PERIODS.some(p=>p.key===tp)?tp:"last"}
  renderCard();
  history.replaceState(null,"","#p="+encodeURIComponent(id));
  root.querySelector(".pc-dialog").focus({preventScroll:true});
  root.querySelector(".pc-dialog").scrollTop=0;
 }).catch(()=>{body.innerHTML='<div class="pc-empty"><b>Не удалось загрузить карточки</b><p>Проверьте соединение и попробуйте ещё раз.</p></div>'});
}

/* ---------- графики ---------- */
function series(p,mi){
 const pts=[];
 for(const pt of p.s){const v=pt[2+mi];if(v!==null&&v!==undefined)pts.push([data.dates[pt[0]],v])}
 return pts;
}
function spark(pts,color){
 if(pts.length<2)return'<svg class="pc-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="M0 24H100" stroke="'+color+'" stroke-opacity=".35" stroke-dasharray="3 3"/></svg>';
 const t0=pts[0][0],t1=pts[pts.length-1][0]||t0+1,vs=pts.map(p=>p[1]),mn=Math.min(...vs),mx=Math.max(...vs);
 const X=t=>((t-t0)/((t1-t0)||1))*100,Y=v=>mx===mn?14:26-((v-mn)/(mx-mn))*22;
 const d=pts.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)).join("");
 return'<svg class="pc-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="'+d+'V28H0Z" fill="'+color+'" fill-opacity=".14"/><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
}
function bigChart(pts,color,label){
 if(pts.length<2)return'<div class="pc-chart-empty">График появится после следующих обновлений рейтинга — пока известна одна точка.</div>';
 const W=600,H=180,PL=8,PR=8,PT=14,PB=24;
 const t0=pts[0][0],t1=pts[pts.length-1][0],vs=pts.map(p=>p[1]),mn=Math.min(...vs),mx=Math.max(...vs);
 const X=t=>PL+((t-t0)/((t1-t0)||1))*(W-PL-PR),Y=v=>mx===mn?(PT+H-PB)/2:H-PB-((v-mn)/(mx-mn))*(H-PT-PB);
 const d=pts.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)).join("");
 const dots=pts.map(p=>'<circle cx="'+X(p[0]).toFixed(1)+'" cy="'+Y(p[1]).toFixed(1)+'" r="3"><title>'+dateFmt(p[0])+": "+fmt(p[1])+'</title></circle>').join("");
 return'<svg class="pc-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+escAttr(label)+': от '+fmt(vs[0])+' до '+fmt(vs[vs.length-1])+'" style="--c:'+color+'">'
  +'<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+Y(mx)+'" y2="'+Y(mx)+'" class="pc-grid"/><line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+Y(mn)+'" y2="'+Y(mn)+'" class="pc-grid"/>'
  +'<path d="'+d+'L'+X(t1).toFixed(1)+' '+(H-PB)+'L'+X(t0).toFixed(1)+' '+(H-PB)+'Z" class="pc-area"/><path d="'+d+'" class="pc-line"/>'+dots
  +'<text x="'+PL+'" y="'+(H-6)+'">'+dateShort(t0)+'</text><text x="'+(W-PR)+'" y="'+(H-6)+'" text-anchor="end">'+dateShort(t1)+'</text>'
  +'<text x="'+(W-PR)+'" y="'+(Y(mx)-4)+'" text-anchor="end" class="pc-val">'+fmt(mx)+'</text>'+(mx!==mn?'<text x="'+(W-PR)+'" y="'+(Y(mn)-4)+'" text-anchor="end" class="pc-val">'+fmt(mn)+'</text>':"")+'</svg>';
}

/* ---------- карточка ---------- */
/* показатель по ключу: индекс в metrics, у уровня -1 (в ряду он стоит перед показателями); -2 — нет такого */
const metricIndex=k=>k==="level"?-1:data.metrics.indexOf(k)>=0?data.metrics.indexOf(k):-2;
const metaOf=k=>k==="level"?{label:"Уровень",accent:"#e7f0f8"}:TAB[k]||{label:k,accent:"#54bfff"};
const cur_=(p,mi)=>mi<0?p.l:p.v[mi];
function renderCard(){
 const p=data.players[cur];if(!p)return;
 const M=data.metrics,last=data.dates.length-1;
 const pers=availablePeriods();
 if(!pers.some(x=>x.key===period))period=pers.length?pers[0].key:null;
 const per=PERIODS.find(x=>x.key===period),bi=per?baseIndex(per):null;
 const color=factionColor(p.g);

 const delta=mi=>{
  if(bi===null)return null;
  const was=valueAt(p,mi,bi);
  if(was===null)return undefined; // в начале периода данных нет
  return cur_(p,mi)-was;
 };
 const deltaMarkup=dv=>dv===null?"":dv===undefined?'<span class="pc-delta new">нет данных</span>':dv?'<span class="pc-delta '+(dv>0?"up":"down")+'">'+(dv>0?"▲ ":"▼ ")+fmt(Math.abs(dv))+'</span>':'<span class="pc-delta same">без изменений</span>';

 const order=TOP100_TABS.map(t=>t.key).filter(k=>M.includes(k)).concat("level");
 const tiles=order.map(k=>{
  const mi=metricIndex(k),t=metaOf(k),rank=mi>=0?p.r[mi]:null;
  return'<button type="button" class="pc-tile'+(k===metric?" active":"")+'" data-pc-metric="'+k+'" aria-pressed="'+(k===metric)+'" style="--c:'+t.accent+'">'
   +'<span class="pc-tile-top"><span class="pc-tile-lbl">'+esc(t.label)+'</span>'+(rank?'<span class="pc-rank'+(rank<=100?" top":"")+'" title="Место в рейтинге">#'+fmt(rank)+'</span>':"")+'</span>'
   +'<b>'+fmt(cur_(p,mi))+'</b>'+deltaMarkup(delta(mi))+spark(series(p,mi),t.accent)+'</button>';
 }).join("");

 /* выбранный показатель крупно */
 if(metricIndex(metric)<-1)metric="reputation";
 const mi=metricIndex(metric),t=metaOf(metric),pts=series(p,mi);
 let perDay="";
 if(pts.length>1){const days=(pts[pts.length-1][0]-pts[0][0])/DAY;if(days>=1)perDay='<span>В среднем <b>'+signed(Math.round((pts[pts.length-1][1]-pts[0][1])/days))+'</b> в сутки</span>'}
 const rank=mi>=0?p.r[mi]:null;
 const chart='<section class="pc-section pc-chart-box" style="--c:'+t.accent+'"><div class="pc-sec-head"><h3>'+esc(t.label)+'</h3><div class="pc-chart-meta">'
  +(mi<0?'':rank?'<span>Место <b>'+fmt(rank)+'</b>'+(rank<=100?' · в топ-100':"")+'</span>':'<span>Не в рейтинге</span>')+perDay+'</div></div>'+bigChart(pts,t.accent,t.label)+'</section>';

 /* боссы */
 let bosses="";
 if(data.bosses&&data.bosses.length){
  const mx=Math.max(1,...p.b);
  bosses='<section class="pc-section"><div class="pc-sec-head"><h3>Боссы</h3><span class="pc-sub">Всего <b>'+fmt(p.v[M.indexOf("bosses")])+'</b></span></div><ul class="pc-bars">'
   +data.bosses.map((b,i)=>({b:b,v:p.b[i]})).sort((a,b)=>b.v-a.v).map(x=>'<li><span>'+esc(x.b)+'</span><i style="--w:'+(x.v/mx*100).toFixed(1)+'%"></i><b>'+fmt(x.v)+'</b></li>').join("")+'</ul></section>';
 }

 /* группировки и ники */
 const gh=p.gh||[];
 let fac;
 if(!gh.length)fac='<li class="pc-tl-item"><i style="--f:'+escAttr(color)+'"></i><div><b>'+(p.g?esc(p.g):"Без группировки")+'</b><small>по последней выгрузке</small></div></li>';
 else fac=gh.slice().reverse().map((g,i,arr)=>{
  const from=data.dates[g[0]],isFirst=i===arr.length-1,to=i?data.dates[arr[i-1][0]]:null;
  /* когда вступил в первую известную группировку, неизвестно — знаем только, что уже был в ней на эту дату */
  const since=isFirst?(g[1]?"как минимум с ":"на ")+dateFmt(from):"с "+dateFmt(from);
  return'<li class="pc-tl-item'+(i?"":" now")+'"><i style="--f:'+escAttr(factionColor(g[1]))+'"></i><div><b>'+(g[1]?esc(g[1]):"Без группировки")+'</b><small>'+since+(to?" по "+dateFmt(to):" · сейчас")+'</small></div></li>';
 }).join("");
 const nicks=(p.nh||[]).length?'<p class="pc-nicks">Смена ника: '+p.nh.map(x=>esc(x[1])+" → "+esc(x[2])+' <small>('+dateFmt(data.dates[x[0]])+')</small>').join("; ")+'</p>':"";
 const faction='<section class="pc-section"><div class="pc-sec-head"><h3>Членство в группировках</h3></div><ul class="pc-tl">'+fac+'</ul>'+nicks+'</section>';

 const periodBtns=pers.length>0?'<div class="pc-periods" role="group" aria-label="Прирост за период">'+pers.map(x=>'<button type="button" class="top100-tab'+(x.key===period?" active":"")+'" data-pc-period="'+x.key+'" aria-pressed="'+(x.key===period)+'">'+x.label+'</button>').join("")+'</div>':"";
 const fromTxt=bi!==null?'<p class="pc-period-note">Прирост с '+stamp(data.dates[bi])+' по '+stamp(data.dates[last])+' (МСК)</p>':'<p class="pc-period-note">Прирост появится после следующего обновления рейтинга</p>';

 document.getElementById("pcBody").innerHTML=
  '<header class="pc-head" style="--f:'+escAttr(color)+'"><div class="pc-avatar" aria-hidden="true">'+esc((p.n.replace(/[^\p{L}\p{N}]/gu,"")[0]||"?").toUpperCase())+'</div><div class="pc-head-text">'
  +'<h2 id="pcTitle">'+esc(p.n)+'</h2><div class="pc-tags">'
  +'<span class="pc-faction"><i></i>'+(p.g?esc(p.g):"Без группировки")+'</span><span class="pc-tag">Ур. <b>'+p.l+'</b></span>'
  +(p.z?'<span class="pc-tag">В Зоне <b>'+esc(p.z)+'</b></span>':"")+(p.off?'<span class="pc-tag off">Нет сигнала</span>':"")
  +'</div></div></header>'
  +periodBtns+fromTxt+'<div class="pc-tiles">'+tiles+'</div>'+chart
  +'<div class="pc-cols">'+bosses+faction+'</div>'
  +'<p class="pc-foot">История копится с '+dateFmt(data.dates[0])+' при каждом обновлении рейтинга. Данные на '+esc(data.updated||"")+' (МСК)</p>';
}

/* ---------- входы ---------- */
/* клик по нику в рейтинге: карточка открывается сразу на показателе текущей вкладки */
document.addEventListener("click",e=>{
 const b=e.target.closest("[data-t100-player]");
 if(!b)return;
 e.preventDefault();
 const nick=b.dataset.t100Player,tab=typeof currentTop100Tab==="string"?currentTop100Tab:null;
 metric=tab;period=null;
 show();
 if(!data)document.getElementById("pcBody").innerHTML='<div class="pc-loading"><i></i>Загружаем карточки игроков…</div>';
 load().then(()=>open(idByNick[nick]||null)).catch(()=>open(null));
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&root&&!root.hidden)close()});
/* кнопка «Найти игрока» рядом с поиском рейтинга */
const tools=document.querySelector(".t100-tools");
if(tools&&!document.getElementById("pcOpenSearch")){
 tools.insertAdjacentHTML("beforeend",'<button type="button" class="t100-find" id="pcOpenSearch"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.6-3.6 3.4-5.6 7-5.6s6.4 2 7 5.6"/></svg>Карточка игрока</button>');
 document.getElementById("pcOpenSearch").addEventListener("click",()=>{period=null;metric=null;open(null)});
}
/* ссылка /top100#p=ID */
function fromHash(){const m=location.hash.match(/^#p=(.+)$/);if(m){period=null;metric=null;open(decodeURIComponent(m[1]))}}
window.addEventListener("hashchange",fromHash);
fromHash();
})();
