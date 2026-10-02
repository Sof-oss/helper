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

/* отряды определяются по тегу в нике (ё = е, регистр не важен, «Cвобода» с латинской C тоже) */
const FACTIONS=[
 {key:"merc",label:"Наёмник",re:/наемник/,color:"#ffb74d"},
 {key:"dolg",label:"Д.О.Л.Г",re:/д\s*\.\s*о\s*\.\s*л\s*\.\s*г/,color:"#ff6b6f"},
 {key:"svoboda",label:"Свобода",re:/[сc]вобода/,color:"#9fdc9f"},
 {key:"science",label:"Учёные",re:/ученые/,color:"#54bfff"},
 {key:"winx",label:"WINX",re:/winx/,color:"#c9a6ff"}
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

/* rank — реальное место. plain — без медалей и подсветки (при сортировке по уровню места вразброс) */
function top100RowMarkup(row,rank,plain){
 const[nick,level,value,inactive]=row;
 const podium=!plain&&rank<=3;
 return '<tr class="'+(podium?"top100-podium top100-podium-"+rank:"")+(inactive?" top100-inactive":"")+'"><td class="top100-rank">'+(plain?'<span class="top100-rank-num">'+rank+'</span>':rankCell(rank))+'</td><td class="top100-nick">'+dotMarkup(factionOf(nick),"t100-dot")+esc(nick)+'</td><td>'+level+'</td><td class="top100-value">'+fmt(value)+'</td></tr>';
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
 const body=entries.length?entries.map(e=>top100RowMarkup(e.row,e.rank,sorted)).join(""):'<tr class="t100-empty"><td colspan="4">Никого не нашли. Попробуй другой ник или сбрось фильтр</td></tr>';
 return '<div class="data-wrap top100-scroll" style="--accent:'+tab.accent+'"><table class="data-table top100-table'+(tab.sortLevel?" top100-sortable":"")+'"><thead><tr><th>#</th><th>Ник</th>'+levelTh+'<th>'+tab.metric+'</th></tr></thead><tbody>'+body+'</tbody></table></div>';
}

/* подиум: первые три места текущей вкладки, прячется при поиске и фильтре */
function renderPodium(){
 const tab=currentTab(),el=$("top100Podium"),on=!top100Query.trim()&&!top100Faction;
 el.hidden=!on;
 if(!on)return;
 el.style.setProperty("--accent",tab.accent);
 el.innerHTML=tab.data().slice(0,3).map((r,i)=>{
  const[nick,level,value,off]=r;
  return '<div class="t100-pc p'+(i+1)+(off?" off":"")+'"><div class="t100-head"><span class="top100-medal top100-medal-'+(i+1)+'" title="'+(i+1)+' место">☢</span><b class="t100-place">'+(i+1)+'</b></div><span class="t100-nick">'+dotMarkup(factionOf(nick),"t100-dot")+esc(nick)+'</span><div class="t100-lvl">Ур. '+level+'</div><div class="t100-val">'+fmt(value)+'</div><div class="t100-metric">'+tab.metric+'</div></div>';
 }).join("");
}

function renderFactions(){
 const rows=currentTab().data(),count={};
 rows.forEach(r=>{const f=factionOf(r[0]),k=f?f.key:NO_FACTION;count[k]=(count[k]||0)+1});
 const chip=(key,label,color,n)=>'<button type="button" class="t100-chip'+(top100Faction===key?" active":"")+'" data-t100-faction="'+key+'" style="--f:'+color+'" aria-pressed="'+(top100Faction===key)+'"><i></i>'+label+'<small>'+n+'</small></button>';
 $("top100Factions").innerHTML=chip("","Все","#54bfff",rows.length)+FACTIONS.map(f=>chip(f.key,f.label,f.color,count[f.key]||0)).join("")+chip(NO_FACTION,"Прочие","#8196a9",count[NO_FACTION]||0);
}

function renderTop100Tabs(){
 $("top100Tabs").innerHTML=TOP100_TABS.map(t=>'<button type="button" class="top100-tab'+(t.key===currentTop100Tab?" active":"")+'" data-top100-tab="'+t.key+'" style="--accent:'+t.accent+'">'+t.label+'</button>').join("");
}
function renderTop100Table(){$("top100TableWrap").innerHTML=top100TableMarkup(currentTab())}

/* подиум и поиск вставляются между вкладками и таблицей один раз, top100.html менять не нужно */
function ensureShell(){
 if($("top100Podium"))return;
 $("top100Tabs").insertAdjacentHTML("afterend",
  '<div class="t100-podium" id="top100Podium"></div>'+
  '<div class="t100-tools"><label class="t100-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="top100Search" type="search" placeholder="Поиск по нику" autocomplete="off" aria-label="Поиск по нику"></label><div class="t100-factions" id="top100Factions"></div></div>');
 $("top100Search").addEventListener("input",e=>{top100Query=e.target.value;renderPodium();renderTop100Table()});
}
function renderTop100(){ensureShell();renderTop100Tabs();renderFactions();renderPodium();renderTop100Table()}

function toggleLevelSort(refocus){
 levelSortDesc=!levelSortDesc;
 renderTop100Table();
 if(refocus){const th=document.querySelector("[data-top100-sort]");if(th)th.focus()}
}

document.addEventListener("click",e=>{
 const sort=e.target.closest("[data-top100-sort]");
 if(sort){toggleLevelSort(false);return}
 const chip=e.target.closest("[data-t100-faction]");
 if(chip){
  const v=chip.dataset.t100Faction;
  top100Faction=v&&top100Faction===v?"":v;
  renderFactions();renderPodium();renderTop100Table();
  return;
 }
 const btn=e.target.closest("[data-top100-tab]");
 if(!btn)return;
 currentTop100Tab=btn.dataset.top100Tab;
 levelSortDesc=false; // сортировка не переносится на другую вкладку
 try{localStorage.setItem(TOP100_TAB_KEY,currentTop100Tab)}catch{}
 renderTop100();
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
