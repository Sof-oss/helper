const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString("ru-RU");

/* режет массив строк на n колонок рядом (последняя может быть короче), чтобы 135 талантов не тянулись одним столбцом */
function chunkRows(rows,n){
 if(n<=1)return[rows];
 const size=Math.ceil(rows.length/n),chunks=[];
 for(let i=0;i<n;i++)chunks.push(rows.slice(i*size,(i+1)*size));
 return chunks;
}
const INFO_MILESTONE_STEP=10;
/* цвет заметки под ПДА по её тексту: новичок зелёный, ветеран оранжевый, учёный бирюзовый */
function infoNoteColor(note){
 if(note.includes("ветерана"))return"#ffb74d";
 if(note.includes("ученого")||note.includes("учёного"))return"#26c6da";
 return"#6fcf97";
}
function infoTableMarkup(rows,headers){
 return '<table class="data-table info-table"><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join("")+'</tr></thead><tbody>'+rows.map(([lvl,step,totalSum])=>'<tr'+(lvl%INFO_MILESTONE_STEP===0?' class="info-milestone"':"")+'><td>'+lvl+'</td><td>'+fmt(step)+'</td><td>'+fmt(totalSum)+'</td></tr>').join("")+'</tbody></table>';
}
function infoGroupMarkup(title,ledColor,body,notes,modClass){
 return '<div class="info-group'+(modClass?" info-group-"+modClass:"")+'"'+(modClass?' data-info-group="'+modClass+'"':"")+'><div class="info-group-title"><i class="info-led" style="--led:'+ledColor+'"></i><b>'+title+'</b></div>'+body+(notes&&notes.length?'<ul class="info-notes">'+notes.map(n=>'<li style="color:'+infoNoteColor(n)+'">'+n+'</li>').join("")+'</ul>':"")+'</div>';
}

/* вкладки для мобильной версии (#infoTabs, styles.css), на десктопе скрыты. Классы те же, что у вкладок «Топ-100» */
const INFO_TAB_KEY="gameHelperInfoTab";
const INFO_TABS=[
 {key:"talents",label:"Таланты",accent:"#ffb74d"},
 {key:"pda",label:"ПДА",accent:"#9fdc9f"},
 {key:"char",label:"Персонаж",accent:"#54bfff"}
];
let currentInfoTab="talents";
try{const saved=localStorage.getItem(INFO_TAB_KEY);if(INFO_TABS.some(t=>t.key===saved))currentInfoTab=saved}catch{}

function renderInfoTabs(){
 $("infoTabs").innerHTML=INFO_TABS.map(t=>'<button type="button" class="top100-tab'+(t.key===currentInfoTab?" active":"")+'" data-info-tab="'+t.key+'" style="--accent:'+t.accent+'">'+t.label+'</button>').join("");
}
function applyInfoActiveTab(){$("infoGroups").dataset.active=currentInfoTab}

function renderInfo(){
 const talentChunks=chunkRows(TALENT_LEVELS,3).map(rows=>infoTableMarkup(rows,["Уровень","Урон","Всего"])).join("");
 $("infoGroups").innerHTML=
  infoGroupMarkup("Таланты","#ffb74d",'<div class="info-subcols">'+talentChunks+'</div>',null,"talents")+
  infoGroupMarkup("Опыт ПДА","#9fdc9f",infoTableMarkup(PDA_LEVELS,["Уровень","Опыт","Всего"]),PDA_LEVEL_NOTES,"pda")+
  infoGroupMarkup("Опыт персонажа","#54bfff",infoTableMarkup(CHAR_LEVELS,["Уровень","Опыт","Всего"]),null,"char");
 renderInfoTabs();
 applyInfoActiveTab();
}

document.addEventListener("click",e=>{
 const btn=e.target.closest("[data-info-tab]");
 if(!btn)return;
 currentInfoTab=btn.dataset.infoTab;
 try{localStorage.setItem(INFO_TAB_KEY,currentInfoTab)}catch{}
 renderInfoTabs();
 applyInfoActiveTab();
});

renderInfo();
