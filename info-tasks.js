/* Вкладка «Задания» на странице «Информация»: переключатель разделов
   («Прогресс по уровням» / «Задания») и сама таблица. На десктопе — полная
   матрица, на телефоне — выбор локации и компактные блоки (5 колонок
   в одну строку на экране 360px не помещаются). Обёрнуто в функцию, чтобы
   не конфликтовать с глобальными $ и fmt из info.js. */
(function(){
"use strict";
const D=window.TASKS_DATA,L=D.locations.map(l=>l.replace(/"([^"]*)"/g,"«$1»"));
const SEC_KEY="gameHelperInfoSection",LOC_KEY="gameHelperTasksLocation";
const R={exp:["Опыт","Опыт","exp"],bullets:["Пули","Пули","bul"],rep:["Репутация","Репут.","rep"],energy:["Затраты энергии","Энергия","en"],tokens:["Жетоны","Жетоны","tok"]};
const n0=v=>v.toLocaleString("ru-RU"),n2=v=>v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});
const gain=k=>L.map((_,i)=>D.total[k][i]/D.total.energy[i]);
const round2=v=>Math.round(v*100)/100;
const card=(led,title,body)=>'<div class="info-group"><div class="info-group-title"><i class="info-led" style="--led:'+led+'"></i><b>'+title+'</b></div>'+body+'</div>';

/* ---------- десктоп ---------- */
function block(cls,label,items){
 return items.map(([key,vals,f,best],i)=>{
  const r=best?vals.map(round2):vals,m=best?Math.max(...r):0;
  return '<tr class="'+cls+(i?'':' task-first')+'">'+(i?'':'<th scope="rowgroup" class="task-stage" rowspan="'+items.length+'">'+label+'</th>')
   +'<th scope="row" class="task-res res-'+R[key][2]+'"><i></i>'+R[key][0]+'</th>'
   +vals.map((v,j)=>'<td'+(best&&r[j]===m?' class="tok-best"':'')+'>'+f(v)+'</td>').join("")+'</tr>';
 }).join("");
}
function matrix(){
 let b="";
 D.stages.forEach((s,i)=>{b+=block("task-s"+(i%2),s.n,["exp","bullets","rep","energy"].map(k=>[k,s[k],n0]))});
 b+=block("task-reward","Награда за полное прохождение локации",["exp","bullets","rep","tokens"].map(k=>[k,D.reward[k],n0]));
 b+=block("task-total","Итого за все этапы",["exp","bullets","rep","energy"].map(k=>[k,D.total[k],n0]));
 b+=block("task-gain","Выгода (ресурс / затраты энергии)",["exp","bullets","rep"].map(k=>[k,gain(k),n2,true]));
 return '<div class="data-wrap"><table class="data-table tasks-matrix"><thead><tr><th>Этап</th><th>Ресурс</th>'+L.map(l=>'<th>'+l+'</th>').join("")+'</tr></thead><tbody>'+b+'</tbody></table></div>';
}

/* ---------- телефон ---------- */
let cur=0;
try{const s=Number(localStorage.getItem(LOC_KEY));if(s>=0&&s<L.length)cur=s}catch{}
function mobile(){
 const i=cur,ks=["exp","bullets","rep","energy"];
 const th=k=>'<th class="res-'+R[k][2]+'" title="'+R[k][0]+'">'+R[k][1]+'</th>';
 const tiles=(o,keys)=>'<div class="task-tiles">'+keys.map(k=>'<div class="res-'+R[k][2]+'"><small>'+R[k][0]+'</small><b>'+n0(o[k][i])+'</b></div>').join("")+'</div>';
 const chips='<div class="top100-tabs">'+L.map((l,j)=>'<button type="button" class="top100-tab'+(j===i?" active":"")+'" data-task-loc="'+j+'" style="--accent:#ffb74d">'+l+'</button>').join("")+'</div>';
 const stages='<table class="data-table tasks-table tasks-stages"><thead><tr><th>Этап</th>'+ks.map(th).join("")+'</tr></thead><tbody>'+D.stages.map(s=>'<tr><td>'+s.n+'</td>'+ks.map(k=>'<td>'+n0(s[k][i])+'</td>').join("")+'</tr>').join("")+'</tbody></table>';
 const g=["exp","bullets","rep"].map(gain),best=g.map(a=>Math.max(...a.map(round2)));
 const cmp='<table class="data-table tasks-table tasks-cmp"><thead><tr><th>Локация</th>'+["exp","bullets","rep"].map(th).join("")+'</tr></thead><tbody>'+L.map((l,j)=>'<tr'+(j===i?' class="task-cur"':'')+'><td>'+l+'</td>'+g.map((a,c)=>'<td'+(round2(a[j])===best[c]?' class="tok-best"':'')+'>'+n2(a[j])+'</td>').join("")+'</tr>').join("")+'</tbody></table>';
 return card("#ffb74d","Задания по этапам",chips+stages)
  +card("#54bfff","Награды и итоги — "+L[i],'<div class="task-sub">Награда за полное прохождение</div>'+tiles(D.reward,["exp","bullets","rep","tokens"])+'<div class="task-sub">Итого за все этапы</div>'+tiles(D.total,ks))
  +card("#27db88","Выгода: ресурс / затраты энергии",cmp);
}

const root=document.getElementById("tasksRoot");
function renderTasks(){
 root.innerHTML='<div class="tasks-desktop">'+card("#ffb74d","Задания по локациям",matrix())+'</div><div class="tasks-mobile">'+mobile()+'</div>';
}
function renderMobile(){root.querySelector(".tasks-mobile").innerHTML=mobile()}

/* ---------- переключатель разделов ---------- */
function setSection(k){
 document.querySelectorAll("[data-section]").forEach(b=>{const on=b.dataset.section===k;b.classList.toggle("active",on);b.setAttribute("aria-pressed",on)});
 document.querySelectorAll("[data-section-panel]").forEach(p=>{p.hidden=p.dataset.sectionPanel!==k});
}
document.addEventListener("click",e=>{
 const s=e.target.closest("[data-section]");
 if(s){setSection(s.dataset.section);try{localStorage.setItem(SEC_KEY,s.dataset.section)}catch{}return}
 const l=e.target.closest("[data-task-loc]");
 if(l){cur=Number(l.dataset.taskLoc);try{localStorage.setItem(LOC_KEY,cur)}catch{}renderMobile()}
});
renderTasks();
let sec="levels";
try{const s=localStorage.getItem(SEC_KEY);if(s==="levels"||s==="tasks")sec=s}catch{}
setSection(sec);
})();
