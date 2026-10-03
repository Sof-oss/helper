const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString("ru-RU");
const TOP100_TAB_KEY="gameHelperTop100Tab";
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

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

/* отряды определяются по тегу в нике (ё = е, регистр не важен, «Cвобода» с латинской C тоже).
   Цвета группировок сняты с их эмблем (вики S.T.A.L.K.E.R.) и осветлены под тёмный интерфейс:
   наёмники — сталь/тёмно-синий, долг — красный щит, свобода — зелёный, учёные — лазурь,
   монолит — янтарная нашивка. WINX — местная группировка сервера. */
const FACTIONS=[
 {key:"merc",label:"Наёмник",re:/наемник/,color:"#5f8ac9"},
 {key:"dolg",label:"Д.О.Л.Г",re:/д\s*\.\s*о\s*\.\s*л\s*\.\s*г/,color:"#d9483f"},
 {key:"svoboda",label:"Свобода",re:/[сc]вобода/,color:"#4fb058"},
 {key:"science",label:"Учёные",re:/ученые/,color:"#57c4f0"},
 {key:"monolith",label:"Монолит",re:/монолит/,color:"#d9a52c"},
 /* «[Вольный сталкер]» — тег одиночек: жёлтый знак радиации на нашивке.
    Скобка в шаблоне обязательна, иначе под правило попадает «Д.О.Л.Г Вольный стрелок» */
 {key:"volny",label:"Вольный сталкер",re:/\[\s*вольн/i,color:"#e0c94d"},
 {key:"winx",label:"WINX",re:/winx/,color:"#b98ae0"}
];
const norm=s=>String(s).toLowerCase().replace(/ё/g,"е");
const factionOf=nick=>{const n=norm(nick);return FACTIONS.find(f=>f.re.test(n))||null};
const NO_FACTION="none";

let currentTop100Tab=TOP100_TABS[0].key;
try{const saved=localStorage.getItem(TOP100_TAB_KEY);if(TOP100_TABS.some(t=>t.key===saved))currentTop100Tab=saved}catch{}
const currentTab=()=>TOP100_TABS.find(t=>t.key===currentTop100Tab)||TOP100_TABS[0];

/* сортировка по уровню (только для вкладок с sortLevel), поиск и фильтр по отряду (общие для всех вкладок) */
let levelSortDesc=false,top100Query="",top100Faction="";

/* ☢ вместо медалей для 1–3 мест, цвет по месту */
function rankCell(rank){
 if(rank>3)return '<span class="top100-rank-num">'+rank+'</span>';
 return '<span class="top100-medal top100-medal-'+rank+'" title="'+rank+' место">☢</span><span class="top100-rank-num">'+rank+'</span>';
}
const dotMarkup=(f,cls)=>f?'<i class="'+cls+'" style="--f:'+f.color+'" title="'+f.label+'"></i>':"";

/* изменение места к прошлой неделе (top100-data.js -> TOP100_RANK): данных может не быть */
function rankMoveMarkup(nick,tabKey){
 const d=window.TOP100_RANK&&window.TOP100_RANK[tabKey];
 if(!d||!(nick in d))return "";
 const v=d[nick];
 if(v===null)return '<i class="t100-move new" title="Впервые в списке">new</i>';
 if(!v)return "";
 return '<i class="t100-move '+(v>0?"up":"down")+'" title="Место за неделю: '+(v>0?"+":"")+v+'">'+(v>0?"▲":"▼")+Math.abs(v)+'</i>';
}
/* прирост метрики за неделю (TOP100_DELTA, есть только там, где игра отдаёт колонку «Δ …») */
function metricDeltaMarkup(nick,tabKey){
 const d=window.TOP100_DELTA&&window.TOP100_DELTA[tabKey];
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
 if(sorted)entries.sort((a,b)=>b.row[1]-a.row[1]||a.rank-b.rank);
 const levelTh=tab.sortLevel
  ?'<th class="top100-sort'+(sorted?" active":"")+'" data-top100-sort="level" role="button" tabindex="0" aria-pressed="'+sorted+'" title="Сортировать по уровню">Ур.<i aria-hidden="true">▼</i></th>'
  :'<th>Ур.</th>';
 const body=entries.length?entries.map(e=>top100RowMarkup(e.row,e.rank,sorted,tab.key)).join(""):'<tr class="t100-empty"><td colspan="4">Никого не нашли. Попробуй другой ник или сбрось фильтр</td></tr>';
 return '<div class="data-wrap top100-scroll" style="--accent:'+tab.accent+'"><table class="data-table top100-table'+(tab.sortLevel?" top100-sortable":"")+'"><thead><tr><th>#</th><th>Ник</th>'+levelTh+'<th>'+tab.metric+'</th></tr></thead><tbody>'+body+'</tbody></table></div>';
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
 const chip=(key,label,color,n)=>'<button type="button" class="t100-chip'+(top100Faction===key?" active":"")+'" data-t100-faction="'+key+'" style="--f:'+color+'" aria-pressed="'+(top100Faction===key)+'"><i></i>'+label+'<small>'+n+'</small></button>';
 $("top100Factions").innerHTML=chip("","Все","#54bfff",rows)+FACTIONS.map(f=>chip(f.key,f.label,f.color,count[f.key]||0)).join("")+chip(NO_FACTION,"Прочие","#8196a9",count[NO_FACTION]||0);
 renderFactionSummary();
}

function renderTop100Tabs(){
 $("top100Tabs").innerHTML=TOP100_TABS.map(t=>'<button type="button" class="top100-tab'+(t.key===currentTop100Tab?" active":"")+'" data-top100-tab="'+t.key+'" style="--accent:'+t.accent+'">'+t.label+'</button>').join("");
}
function renderTop100Table(){$("top100TableWrap").innerHTML=top100TableMarkup(currentTab())}

/* поиск и фильтр по отрядам вставляются между вкладками и таблицей один раз, top100.html менять не нужно */
function ensureShell(){
 if($("top100Search"))return;
 $("top100Tabs").insertAdjacentHTML("afterend",
  '<div class="t100-tools"><label class="t100-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="top100Search" type="search" placeholder="Поиск по нику" autocomplete="off" aria-label="Поиск по нику"></label>'
  +'<button type="button" class="t100-factions-toggle" id="top100FactionsToggle" aria-expanded="false" aria-controls="top100Factions">Отряды: <b id="top100FactionSummary">Все</b><svg class="t100-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>'
  +'<div class="t100-factions" id="top100Factions"></div></div>');
 $("top100Search").addEventListener("input",e=>{top100Query=e.target.value;renderTop100Table()});
}
function renderTop100(){ensureShell();renderTop100Tabs();renderFactions();renderTop100Table()}

function toggleLevelSort(refocus){
 levelSortDesc=!levelSortDesc;
 renderTop100Table();
 if(refocus){const th=document.querySelector("[data-top100-sort]");if(th)th.focus()}
}

document.addEventListener("click",e=>{
 const sort=e.target.closest("[data-top100-sort]");
 if(sort){toggleLevelSort(false);return}
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
  levelSortDesc=false; // сортировка не переносится на другую вкладку
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
 toggleLevelSort(true);
});

/* дату отдаёт top100-data.js, в разметке только заглушка */
const updatedEl=$("top100Updated");
if(updatedEl&&window.TOP100_UPDATED)updatedEl.textContent=window.TOP100_UPDATED;

renderTop100();
