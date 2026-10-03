/* вкладка «Задания» на странице «Информация».
   ПК: кнопками выбирается этап, данные показаны таблицами «ресурс × локация» —
   так видно все локации сразу, без прокрутки вбок и без повторов названий ресурсов.
   Телефон: выбирается локация, этапы идут строками, итоги — плитками.
   Всё в функции, чтобы не пересекаться с $ и fmt из info.js */
(function(){
"use strict";
const D=window.TASKS_DATA,L=D.locations.map(l=>l.replace(/"([^"]*)"/g,"«$1»"));
const SEC_KEY="gameHelperInfoSection",LOC_KEY="gameHelperTasksLocation",STAGE_KEY="gameHelperTasksStage";
const R={exp:["Опыт","Опыт","exp"],bullets:["Пули","Пули","bul"],rep:["Репутация","Репут.","rep"],energy:["Затраты энергии","Энергия","en"],tokens:["Жетоны","Жетоны","tok"]};
const n0=v=>v.toLocaleString("ru-RU"),n2=v=>v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});
const gain=k=>L.map((_,i)=>D.total[k][i]/D.total.energy[i]);
const round2=v=>Math.round(v*100)/100;
const card=(led,title,body)=>'<div class="info-group"><div class="info-group-title"><i class="info-led" style="--led:'+led+'"></i><b>'+title+'</b></div>'+body+'</div>';

/* таблица «ресурсы строками, локации колонками»: одинаковая на ПК и в сравнении на телефоне.
   highlight — подсветить лучшее значение в каждой строке (для выгоды) */
function locTable(head,items,keys,fmt,highlight){
 const body=keys.map(k=>{
  const vals=items[k]||[],r=highlight?vals.map(round2):vals,best=highlight?Math.max.apply(null,r):null;
  return '<tr><th scope="row" class="task-res res-'+R[k][2]+'"><i></i>'+R[k][0]+'</th>'
   +vals.map((v,j)=>'<td'+(highlight&&r[j]===best?' class="tok-best"':'')+'>'+fmt(v)+'</td>').join("")+'</tr>';
 }).join("");
 return '<div class="data-wrap"><table class="data-table tasks-table tasks-loc"><thead><tr><th>'+head+'</th>'
  +L.map(l=>'<th>'+l+'</th>').join("")+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}
const gainRows={exp:gain("exp"),bullets:gain("bullets"),rep:gain("rep")};

/* ---------- ПК ---------- */
let curStage=0;
try{const s=Number(localStorage.getItem(STAGE_KEY));if(s>=0&&s<D.stages.length)curStage=s}catch{}
function stageChips(){
 return '<div class="top100-tabs tasks-pick">'+D.stages.map((s,j)=>'<button type="button" class="top100-tab'+(j===curStage?" active":"")
  +'" data-task-stage="'+j+'" style="--accent:#ffb74d">Этап '+s.n+'</button>').join("")+'</div>';
}
function desktop(){
 const st=D.stages[curStage];
 return card("#ffb74d","Задания по этапам",stageChips()+locTable("Этап "+st.n,st,["exp","bullets","rep","energy"],n0))
  +card("#54bfff","Награды и итоги",
    '<div class="task-sub">Награда за полное прохождение локации</div>'+locTable("Ресурс",D.reward,["exp","bullets","rep","tokens"],n0)
    +'<div class="task-sub">Итого за все этапы</div>'+locTable("Ресурс",D.total,["exp","bullets","rep","energy"],n0))
  +card("#27db88","Выгода: ресурс на единицу затраченной энергии",locTable("Ресурс",gainRows,["exp","bullets","rep"],n2,true));
}

/* ---------- телефон ---------- */
let cur=0;
try{const s=Number(localStorage.getItem(LOC_KEY));if(s>=0&&s<L.length)cur=s}catch{}
/* на телефоне та же выгода, но локации строками: 6 колонок в экран не влезают */
function mobCmp(){
 const ks=["exp","bullets","rep"],cols=ks.map(gain),best=cols.map(a=>Math.max.apply(null,a.map(round2)));
 const th=k=>'<th class="res-'+R[k][2]+'" title="'+R[k][0]+'">'+R[k][1]+'</th>';
 return '<table class="data-table tasks-table tasks-cmp"><thead><tr><th>Локация</th>'+ks.map(th).join("")+'</tr></thead><tbody>'
  +L.map((l,j)=>'<tr'+(j===cur?' class="task-cur"':'')+'><td>'+l+'</td>'+cols.map((a,c)=>'<td'+(round2(a[j])===best[c]?' class="tok-best"':'')+'>'+n2(a[j])+'</td>').join("")+'</tr>').join("")+'</tbody></table>';
}
function mobile(){
 const i=cur,ks=["exp","bullets","rep","energy"];
 const th=k=>'<th class="res-'+R[k][2]+'" title="'+R[k][0]+'">'+R[k][1]+'</th>';
 const tiles=(o,keys)=>'<div class="task-tiles">'+keys.map(k=>'<div class="res-'+R[k][2]+'"><small>'+R[k][0]+'</small><b>'+n0(o[k][i])+'</b></div>').join("")+'</div>';
 const chips='<div class="top100-tabs tasks-pick">'+L.map((l,j)=>'<button type="button" class="top100-tab'+(j===i?" active":"")+'" data-task-loc="'+j+'" style="--accent:#ffb74d">'+l+'</button>').join("")+'</div>';
 const stages='<table class="data-table tasks-table tasks-stages"><thead><tr><th>Этап</th>'+ks.map(th).join("")+'</tr></thead><tbody>'
  +D.stages.map(s=>'<tr><td>'+s.n+'</td>'+ks.map(k=>'<td>'+n0(s[k][i])+'</td>').join("")+'</tr>').join("")+'</tbody></table>';
 return card("#ffb74d","Задания по этапам",chips+stages)
  +card("#54bfff","Награды и итоги — "+L[i],'<div class="task-sub">Награда за полное прохождение</div>'+tiles(D.reward,["exp","bullets","rep","tokens"])
    +'<div class="task-sub">Итого за все этапы</div>'+tiles(D.total,ks))
  +card("#27db88","Выгода: ресурс на единицу энергии",mobCmp());
}

const root=document.getElementById("tasksRoot");
function renderTasks(){
 root.innerHTML='<div class="tasks-desktop">'+desktop()+'</div><div class="tasks-mobile">'+mobile()+'</div>';
}
/* в сборке DOM-заглушка, поэтому querySelector может ничего не вернуть */
function renderPart(sel,html){const el=root.querySelector?root.querySelector(sel):null;if(el)el.innerHTML=html}

/* переключатель разделов «Прогресс по уровням» / «Задания» */
function setSection(k){
 document.querySelectorAll("[data-section]").forEach(b=>{const on=b.dataset.section===k;b.classList.toggle("active",on);b.setAttribute("aria-pressed",on)});
 document.querySelectorAll("[data-section-panel]").forEach(p=>{p.hidden=p.dataset.sectionPanel!==k});
}
document.addEventListener("click",e=>{
 const s=e.target.closest("[data-section]");
 if(s){
  /* смена раздела проходит через View Transition, если браузер умеет */
  const swap=()=>{setSection(s.dataset.section);try{localStorage.setItem(SEC_KEY,s.dataset.section)}catch{}};
  window.__vt?window.__vt(swap):swap();
  return;
 }
 const l=e.target.closest("[data-task-loc]");
 if(l){cur=Number(l.dataset.taskLoc);try{localStorage.setItem(LOC_KEY,cur)}catch{}renderPart(".tasks-mobile",mobile());return}
 const st=e.target.closest("[data-task-stage]");
 if(st){curStage=Number(st.dataset.taskStage);try{localStorage.setItem(STAGE_KEY,curStage)}catch{}renderPart(".tasks-desktop",desktop())}
});
renderTasks();
let sec="levels";
try{const s=localStorage.getItem(SEC_KEY);if(s==="levels"||s==="tasks")sec=s}catch{}
setSection(sec);
})();
