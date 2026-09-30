const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString("ru-RU");
const TOP100_TAB_KEY="gameHelperTop100Tab";

/* Разделы рейтинга: ключ, подпись вкладки, подпись колонки-показателя,
   данные и акцентный цвет (перекликается с блоками вкладки «Информация»:
   таланты — янтарный, экспедиции — зелёный, защита лагеря — синий; остальные — свои оттенки).
   Порядок в массиве — это порядок вкладок на странице.
   sortLevel:true — колонку «Ур.» этой вкладки можно кликнуть, чтобы отсортировать
   игроков по уровню от большего к меньшему (повторный клик возвращает исходный порядок). */
const TOP100_TABS=[
 {key:"reputation",label:"Репутация",metric:"Репутация",data:()=>window.TOP100_REPUTATION,accent:"#f48fb1",sortLevel:true},
 {key:"bosses",label:"Боссы",metric:"Боссы",data:()=>window.TOP100_BOSSES,accent:"#ff8a65"},
 {key:"stashes",label:"Тайники",metric:"Тайники",data:()=>window.TOP100_STASHES,accent:"#26c6da"},
 {key:"talents",label:"Таланты",metric:"Таланты",data:()=>window.TOP100_TALENTS,accent:"#ffb74d"},
 {key:"collections",label:"Коллекции",metric:"Коллекции",data:()=>window.TOP100_COLLECTIONS,accent:"#c9a6ff"},
 {key:"expeditions",label:"Экспедиции",metric:"Экспедиции",data:()=>window.TOP100_EXPEDITIONS,accent:"#9fdc9f"},
 {key:"defense",label:"Защита лагеря",metric:"Защита лагеря",data:()=>window.TOP100_DEFENSE,accent:"#54bfff"}
];

let currentTop100Tab=TOP100_TABS[0].key;
try{const saved=localStorage.getItem(TOP100_TAB_KEY);if(TOP100_TABS.some(t=>t.key===saved))currentTop100Tab=saved}catch{}

/* Включена ли сортировка по уровню (действует только на вкладках с sortLevel) */
let levelSortDesc=false;

/* Значки 1–3 места вместо медалей — радиационный символ в цвете места,
   в духе логотипа сайта (☢), а не игровые иконки из исходных картинок. */
function rankCell(rank){
 if(rank>3)return '<span class="top100-rank-num">'+rank+'</span>';
 return '<span class="top100-medal top100-medal-'+rank+'" title="'+rank+' место">☢</span><span class="top100-rank-num">'+rank+'</span>';
}

/* rank — настоящее место игрока в рейтинге. plain — без медалей и подсветки
   призёров: при сортировке по уровню места идут вразнобой, и медали были бы не к месту. */
function top100RowMarkup(row,rank,plain){
 const[nick,level,value,inactive]=row;
 const nickHtml=nick.replace(/</g,"&lt;");
 const podium=!plain&&rank<=3;
 return '<tr class="'+(podium?"top100-podium top100-podium-"+rank:"")+(inactive?" top100-inactive":"")+'"><td class="top100-rank">'+(plain?'<span class="top100-rank-num">'+rank+'</span>':rankCell(rank))+'</td><td class="top100-nick">'+nickHtml+'</td><td>'+level+'</td><td class="top100-value">'+fmt(value)+'</td></tr>';
}

function top100TableMarkup(tab){
 /* место = пятый элемент строки, если в выгрузке был пропуск, иначе индекс+1 */
 let entries=tab.data().map((r,i)=>({row:r,rank:r[4]||i+1}));
 const sorted=!!tab.sortLevel&&levelSortDesc;
 if(sorted)entries.sort((a,b)=>b.row[1]-a.row[1]||a.rank-b.rank);
 const levelTh=tab.sortLevel
  ?'<th class="top100-sort'+(sorted?" active":"")+'" data-top100-sort="level" role="button" tabindex="0" aria-pressed="'+sorted+'" title="Сортировать по уровню">Ур.<i aria-hidden="true">▼</i></th>'
  :'<th>Ур.</th>';
 return '<div class="data-wrap top100-scroll" style="--accent:'+tab.accent+'"><table class="data-table top100-table'+(tab.sortLevel?" top100-sortable":"")+'"><thead><tr><th>#</th><th>Ник</th>'+levelTh+'<th>'+tab.metric+'</th></tr></thead><tbody>'+entries.map(e=>top100RowMarkup(e.row,e.rank,sorted)).join("")+'</tbody></table></div>';
}

function renderTop100Tabs(){
 $("top100Tabs").innerHTML=TOP100_TABS.map(t=>'<button type="button" class="top100-tab'+(t.key===currentTop100Tab?" active":"")+'" data-top100-tab="'+t.key+'" style="--accent:'+t.accent+'">'+t.label+'</button>').join("");
}
function renderTop100Table(){
 const tab=TOP100_TABS.find(t=>t.key===currentTop100Tab)||TOP100_TABS[0];
 $("top100TableWrap").innerHTML=top100TableMarkup(tab);
}
function renderTop100(){renderTop100Tabs();renderTop100Table()}

function toggleLevelSort(refocus){
 levelSortDesc=!levelSortDesc;
 renderTop100Table();
 if(refocus){const th=document.querySelector("[data-top100-sort]");if(th)th.focus()}
}

document.addEventListener("click",e=>{
 const sort=e.target.closest("[data-top100-sort]");
 if(sort){toggleLevelSort(false);return}
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

renderTop100();
