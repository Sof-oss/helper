const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString("ru-RU");
const TOP100_TAB_KEY="gameHelperTop100Tab";
const TOP100_PERIOD_KEY="gameHelperTop100Period";
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const escAttr=s=>esc(s).replace(/"/g,"&quot;");

/* разделы рейтинга: ключ, вкладка, подпись колонки, данные, цвет.
   Порядок = порядок вкладок. sortLevel: клик по «Ур.» сортирует по уровню (повторный клик сбрасывает) */
const TOP100_TABS=[
 {key:"reputation",label:"Репутация",metric:"Репутация",data:()=>window.TOP100_REPUTATION,accent:"#f48fb1",sortLevel:true},
 {key:"bosses",label:"Боссы",metric:"Боссы",data:()=>window.TOP100_BOSSES,accent:"#ff8a65"},
 {key:"stashes",label:"Тайники",metric:"Тайники",data:()=>window.TOP100_STASHES,accent:"#26c6da"},
 {key:"talents",label:"Таланты",metric:"Таланты",data:()=>window.TOP100_TALENTS,accent:"#ffb74d"},
 {key:"collections",label:"Коллекции",metric:"Коллекции",data:()=>window.TOP100_COLLECTIONS,accent:"#c9a6ff"},
 {key:"expeditions",label:"Экспедиции",metric:"Экспедиции",data:()=>window.TOP100_EXPEDITIONS,accent:"#9fdc9f"},
 {key:"defense",label:"Защита лагеря",metric:"Защита лагеря",data:()=>window.TOP100_DEFENSE,accent:"#54bfff"}
];

/* группировки приходят из общей выгрузки (top100-data.js, собирает build-top100.js):
   TOP100_FACTIONS — группировки текущего рейтинга с цветами, TOP100_GROUPS — ник -> группировка.
   Новая группировка в рейтинге сама получает плашку и цвет, пропавшая — исчезает */
const FACTIONS=(Array.isArray(window.TOP100_FACTIONS)?window.TOP100_FACTIONS:[]).map(f=>({key:f.name,label:f.name,color:f.color}));
const FACTION_BY_KEY=new Map(FACTIONS.map(f=>[f.key,f]));
const GROUPS=window.TOP100_GROUPS||{};
const norm=s=>String(s).toLowerCase().replace(/ё/g,"е");
const factionOf=nick=>FACTION_BY_KEY.get(GROUPS[nick])||null;
const NO_FACTION="—"; // «—» в выгрузке = без группировки, своей группировкой быть не может

let currentTop100Tab=TOP100_TABS[0].key;
try{const saved=localStorage.getItem(TOP100_TAB_KEY);if(TOP100_TABS.some(t=>t.key===saved))currentTop100Tab=saved}catch{}
const currentTab=()=>TOP100_TABS.find(t=>t.key===currentTop100Tab)||TOP100_TABS[0];

/* сортировка по уровню (только для вкладок с sortLevel), поиск и фильтр по отряду (общие для всех вкладок) */
let levelSortDesc=false,deltaSortDesc=false,top100Query="",top100Faction="";

/* период изменений: список отдаёт top100-data.js (TOP100_PERIODS), выбор помним между визитами.
   Если выбранного периода в данных нет (например, пока не накопилась история), берём первый */
let top100Period="last";
try{top100Period=localStorage.getItem(TOP100_PERIOD_KEY)||"last"}catch{}
const periodList=()=>Array.isArray(window.TOP100_PERIODS)?window.TOP100_PERIODS:[];
const currentPeriod=()=>{const l=periodList();return l.find(p=>p.key===top100Period)||l[0]||null};
/* изменения выбранного периода; со старым top100-data.js (без периодов) работают прежние TOP100_DELTA / TOP100_RANK */
function periodChanges(){
 const p=currentPeriod(),all=window.TOP100_CHANGES;
 if(p&&all&&all[p.key])return all[p.key];
 return{delta:window.TOP100_DELTA,rank:window.TOP100_RANK};
}
/* «за неделю», «с прошлого обновления» — для подсказок у стрелок */
function periodPhrase(){
 const p=currentPeriod();
 return p?p.label.charAt(0).toLowerCase()+p.label.slice(1):"с прошлого обновления";
}

/* ☢ вместо медалей для 1–3 мест, цвет по месту */
function rankCell(rank){
 if(rank>3)return '<span class="top100-rank-num">'+rank+'</span>';
 return '<span class="top100-medal top100-medal-'+rank+'" title="'+rank+' место">☢</span><span class="top100-rank-num">'+rank+'</span>';
}
const dotMarkup=(f,cls)=>f?'<i class="'+cls+'" style="--f:'+escAttr(f.color)+'" title="'+escAttr(f.label)+'"></i>':"";

/* изменение места за выбранный период (TOP100_CHANGES -> rank): данных может не быть */
function rankMoveMarkup(nick,tabKey){
 const r=periodChanges().rank,d=r&&r[tabKey];
 if(!d||!(nick in d))return "";
 const v=d[nick];
 if(v===null)return '<i class="t100-move new" title="Не было в списке ('+periodPhrase()+')">new</i>';
 if(!v)return "";
 return '<i class="t100-move '+(v>0?"up":"down")+'" title="Место ('+periodPhrase()+'): '+(v>0?"+":"")+v+'">'+(v>0?"▲":"▼")+Math.abs(v)+'</i>';
}
/* прирост метрики за выбранный период (TOP100_CHANGES -> delta) */
function metricDeltaMarkup(nick,tabKey){
 const r=periodChanges().delta,d=r&&r[tabKey];
 if(!d||!(nick in d))return "";
 const v=d[nick];
 if(v===null||v===undefined)return "";
 if(!v)return '<span class="t100-delta same">без изменений</span>';
 return '<span class="t100-delta '+(v>0?"up":"down")+'">'+(v>0?"▲":"▼")+" "+fmt(Math.abs(v))+'</span>';
}

/* rank — реальное место. plain — без медалей и подсветки (при сортировке по уровню места вразброс) */
function top100RowMarkup(row,rank,plain,tabKey){
 const[nick,level,value,inactive]=row;
 const podium=!plain&&rank<=3;
 return '<tr class="'+(podium?"top100-podium top100-podium-"+rank:"")+(inactive?" top100-inactive":"")+'"><td class="top100-rank"><div class="top100-rank-in">'+(plain?'<span class="top100-rank-num">'+rank+'</span>':rankCell(rank))+rankMoveMarkup(nick,tabKey)+'</div></td><td class="top100-nick">'+dotMarkup(factionOf(nick),"t100-dot")+esc(nick)+'</td><td>'+level+'</td><td class="top100-value">'+fmt(value)+metricDeltaMarkup(nick,tabKey)+'</td></tr>';
}

/* строки после поиска и фильтра; место = 5-й элемент, если в выгрузке был пропуск, иначе индекс+1 */
function top100Entries(tab){
 const q=norm(top100Query).trim();
 return tab.data().map((r,i)=>({row:r,rank:r[4]||i+1})).filter(e=>{
  if(q&&!norm(e.row[0]).includes(q))return false;
  if(!top100Faction)return true;
  const f=factionOf(e.row[0]);
  return top100Faction===NO_FACTION?!f:!!f&&f.key===top100Faction;
 });
}

function top100TableMarkup(tab){
 const entries=top100Entries(tab);
 const sorted=!!tab.sortLevel&&levelSortDesc;
 /* сортировка по приросту работает там, где у раздела есть данные за выбранный период; нет прироста = 0 */
 const pd=periodChanges().delta,deltaMap=pd&&pd[tab.key];
 const hasDelta=!!deltaMap&&Object.keys(deltaMap).length>0;
 const deltaSorted=hasDelta&&deltaSortDesc;
 if(sorted)entries.sort((a,b)=>b.row[1]-a.row[1]||a.rank-b.rank);
 else if(deltaSorted)entries.sort((a,b)=>(deltaMap[b.row[0]]||0)-(deltaMap[a.row[0]]||0)||a.rank-b.rank);
 const metricTh=hasDelta
  ?'<th class="top100-sort'+(deltaSorted?" active":"")+'" data-top100-sort="delta" role="button" tabindex="0" aria-pressed="'+deltaSorted+'" title="Сортировать по приросту">'+tab.metric+'<i aria-hidden="true">▼</i></th>'
  :'<th>'+tab.metric+'</th>';
 const levelTh=tab.sortLevel
  ?'<th class="top100-sort'+(sorted?" active":"")+'" data-top100-sort="level" role="button" tabindex="0" aria-pressed="'+sorted+'" title="Сортировать по уровню">Ур.<i aria-hidden="true">▼</i></th>'
  :'<th>Ур.</th>';
 const body=entries.length?entries.map(e=>top100RowMarkup(e.row,e.rank,sorted||deltaSorted,tab.key)).join(""):'<tr class="t100-empty"><td colspan="4">Никого не нашли. Попробуй другой ник или сбрось фильтр</td></tr>';
 return '<div class="data-wrap top100-scroll" style="--accent:'+tab.accent+'"><table class="data-table top100-table'+(tab.sortLevel?" top100-sortable":"")+'"><thead><tr><th>#</th><th>Ник</th>'+levelTh+metricTh+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}

/* в свёрнутом виде (телефон) заголовок фильтра показывает, что выбрано */
function factionCounts(){
 const rows=currentTab().data(),count={};
 rows.forEach(r=>{const f=factionOf(r[0]),k=f?f.key:NO_FACTION;count[k]=(count[k]||0)+1});
 return{rows:rows.length,count:count};
}
function renderFactionSummary(){
 const el=$("top100FactionSummary");if(!el)return;
 const{rows,count}=factionCounts(),cur=FACTIONS.find(f=>f.key===top100Faction);
 el.textContent=cur?cur.label+' '+(count[cur.key]||0):(top100Faction===NO_FACTION?"Прочие "+(count[NO_FACTION]||0):"Все "+rows);
}
function renderFactions(){
 const{rows,count}=factionCounts();
 const chip=(key,label,color,n)=>'<button type="button" class="t100-chip'+(top100Faction===key?" active":"")+'" data-t100-faction="'+escAttr(key)+'" style="--f:'+escAttr(color)+'" aria-pressed="'+(top100Faction===key)+'"><i></i>'+esc(label)+'<small>'+n+'</small></button>';
 $("top100Factions").innerHTML=chip("","Все","#54bfff",rows)+FACTIONS.map(f=>chip(f.key,f.label,f.color,count[f.key]||0)).join("")+chip(NO_FACTION,"Прочие","#8196a9",count[NO_FACTION]||0);
 renderFactionSummary();
}

let tabsRendered=false;
function renderTop100Tabs(){
 $("top100Tabs").innerHTML=TOP100_TABS.map(t=>'<button type="button" class="top100-tab'+(t.key===currentTop100Tab?" active":"")+'" data-top100-tab="'+t.key+'" style="--accent:'+t.accent+'">'+t.label+'</button>').join("");
 /* при загрузке активная вкладка сразу на месте, при смене раздела — плавно */
 centerActiveTab(tabsRendered);tabsRendered=true;
}
/* вкладки на телефоне идут одной строкой: показываем, что строку можно прокрутить, и держим активную на виду.
   В пререндере (build.js) у элементов нет размеров — тогда ничего не делаем */
function updateTabsFade(){
 const t=$("top100Tabs");
 if(!t||typeof t.scrollWidth!=="number")return;
 const max=t.scrollWidth-t.clientWidth;
 t.classList.toggle("fade-l",t.scrollLeft>2);
 t.classList.toggle("fade-r",max>2&&t.scrollLeft<max-2);
}
function centerActiveTab(smooth){
 const t=$("top100Tabs");
 if(!t||typeof t.scrollWidth!=="number")return;
 const a=t.querySelector(".top100-tab.active");
 if(a&&t.scrollWidth>t.clientWidth){
  const left=t.scrollLeft+a.getBoundingClientRect().left-t.getBoundingClientRect().left-(t.clientWidth-a.offsetWidth)/2;
  if(smooth&&t.scrollTo)t.scrollTo({left,behavior:"smooth"});else t.scrollLeft=left;
 }
 updateTabsFade();
}
function renderTop100Table(){$("top100TableWrap").innerHTML=top100TableMarkup(currentTab())}

/* кнопки периодов и подпись, за какие именно даты показаны изменения.
   Без периодов в данных (первый запуск, старый top100-data.js) блок скрыт */
function renderPeriod(){
 const box=$("top100Period"),btns=$("top100PeriodBtns"),range=$("top100PeriodRange");
 if(!box||!btns||!range)return;
 const list=periodList(),cur=currentPeriod();
 box.hidden=!cur;
 if(!cur)return;
 /* один период — выбирать не из чего: кнопку и «Изменения:» не показываем, остаётся только подпись с датами */
 const single=list.length<2;
 btns.hidden=single;
 const title=box.querySelector(".t100-period-title");if(title)title.hidden=single;
 box.classList.toggle("single",single);
 btns.innerHTML=list.map(p=>'<button type="button" class="t100-pbtn'+(p===cur?" active":"")+'" data-t100-period="'+esc(p.key)+'" aria-pressed="'+(p===cur)+'">'+esc(p.label)+'</button>').join("");
 const to=window.TOP100_UPDATED?String(window.TOP100_UPDATED).slice(0,16):"";
 range.innerHTML=cur.from
  ?'Показаны изменения с <b>'+esc(cur.from)+'</b>'+(to?' по <b>'+esc(to)+'</b>':"")+(cur.partial?'<small>Данных за полный период пока нет: считаем с самой ранней сохранённой даты</small>':"")
  :'Показаны изменения <b>'+esc(cur.label.toLowerCase())+'</b>';
 /* коротко: «05.10 15:20 → 19:29», полная фраза — в подсказке и для экранного диктора */
 const full=range.textContent;
 range.title=full;range.setAttribute("aria-label",full);
 if(cur.from){
  const f=shortStamp(cur.from),t=to?shortStamp(to):null;
  range.innerHTML=(t&&f.day===t.day?esc(f.day)+' <b>'+esc(f.time)+'</b> → <b>'+esc(t.time)+'</b>'
   :'<b>'+esc(f.day+" "+f.time)+'</b>'+(t?' → <b>'+esc(t.day+" "+t.time)+'</b>':""))
   +(cur.partial?'<i class="t100-partial" aria-hidden="true">*</i>':"");
 }else range.innerHTML='<b>'+esc(cur.label)+'</b>';
}
/* «05.10.2026 15:20(:52)» → {day:"05.10", time:"15:20"} */
function shortStamp(s){
 const m=String(s).match(/^(\d\d\.\d\d)\.\d{4}\s+(\d\d:\d\d)/);
 return m?{day:m[1],time:m[2]}:{day:String(s),time:""};
}

/* поиск, период и фильтр по отрядам вставляются между вкладками и таблицей один раз, top100.html менять не нужно */
function ensureShell(){
 if($("top100Search"))return;
 $("top100Tabs").insertAdjacentHTML("afterend",
  '<div class="t100-tools"><div class="t100-period" id="top100Period" role="group" aria-label="За какой период показывать изменения" hidden><span class="t100-period-title">Изменения</span><div class="t100-period-btns" id="top100PeriodBtns"></div><p class="t100-period-range" id="top100PeriodRange" aria-live="polite"></p></div>'
  +'<label class="t100-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="top100Search" type="search" placeholder="Поиск по нику" autocomplete="off" aria-label="Поиск по нику"></label>'
  +'<button type="button" class="t100-factions-toggle" id="top100FactionsToggle" aria-expanded="false" aria-controls="top100Factions">Отряды: <b id="top100FactionSummary">Все</b><svg class="t100-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>'
  +'<div class="t100-factions" id="top100Factions"></div></div>');
 $("top100Search").addEventListener("input",e=>{top100Query=e.target.value;renderTop100Table()});
}
function renderTop100(){ensureShell();renderTop100Tabs();renderPeriod();renderFactions();renderTop100Table()}

function toggleSort(kind,refocus){
 if(kind==="delta"){deltaSortDesc=!deltaSortDesc;levelSortDesc=false}
 else{levelSortDesc=!levelSortDesc;deltaSortDesc=false}
 renderTop100Table();
 if(refocus){const th=document.querySelector('[data-top100-sort="'+kind+'"]');if(th)th.focus()}
}

document.addEventListener("click",e=>{
 const sort=e.target.closest("[data-top100-sort]");
 if(sort){toggleSort(sort.dataset.top100Sort,false);return}
 /* смена периода: пересчитываются стрелки и прирост, вкладка, поиск и фильтр остаются */
 const per=e.target.closest("[data-t100-period]");
 if(per){
  top100Period=per.dataset.t100Period;
  try{localStorage.setItem(TOP100_PERIOD_KEY,top100Period)}catch{}
  renderPeriod();renderTop100Table();
  const again=document.querySelector('[data-t100-period="'+top100Period+'"]');
  if(again)again.focus();
  return;
 }
 /* на телефоне список отрядов открывается по кнопке */
 const toggle=e.target.closest("#top100FactionsToggle");
 if(toggle){
  const list=$("top100Factions"),open=list&&list.classList.toggle("open");
  toggle.setAttribute("aria-expanded",open?"true":"false");
  return;
 }
 const chip=e.target.closest("[data-t100-faction]");
 if(chip){
  const v=chip.dataset.t100Faction;
  top100Faction=v&&top100Faction===v?"":v;
  renderFactions();renderTop100Table();
  /* после выбора отряда список прячется, чтобы сразу был виден рейтинг */
  const list=$("top100Factions"),btn=$("top100FactionsToggle");
  if(list&&window.matchMedia&&window.matchMedia("(max-width:760px)").matches){list.classList.remove("open");if(btn)btn.setAttribute("aria-expanded","false")}
  return;
 }
 const btn=e.target.closest("[data-top100-tab]");
 if(!btn)return;
 /* смена раздела проходит через View Transition, если браузер умеет */
 const swap=()=>{
  currentTop100Tab=btn.dataset.top100Tab;
  levelSortDesc=false;deltaSortDesc=false; // сортировка не переносится на другую вкладку
  try{localStorage.setItem(TOP100_TAB_KEY,currentTop100Tab)}catch{}
  renderTop100();
 };
 window.__vt?window.__vt(swap):swap();
});
document.addEventListener("keydown",e=>{
 if(e.key!=="Enter"&&e.key!==" ")return;
 const sort=e.target.closest&&e.target.closest("[data-top100-sort]");
 if(!sort)return;
 e.preventDefault();
 toggleSort(sort.dataset.top100Sort,true);
});

/* дату отдаёт top100-data.js, в разметке только заглушка */
const updatedEl=$("top100Updated");
if(updatedEl&&window.TOP100_UPDATED){
 /* в шапке коротко «05.10 19:29», полная дата — в подсказке */
 const st=shortStamp(window.TOP100_UPDATED),box=$("top100UpdatedBox");
 updatedEl.textContent=st.time?st.day+" "+st.time:window.TOP100_UPDATED;
 if(box)box.title="Обновлено: "+window.TOP100_UPDATED+" (МСК)";
}

renderTop100();
{
 const t=$("top100Tabs");
 if(t&&typeof window.addEventListener==="function"){
  t.addEventListener("scroll",updateTabsFade,{passive:true});
  window.addEventListener("resize",updateTabsFade);
 }
}
