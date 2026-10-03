/* вкладка «Задания» на странице «Информация».
   Три таблицы: награда за прохождение локации, итог (все этапы + награда) и выгода.
   Строки — ресурсы с иконками, столбцы — локации: все локации видно сразу.
   Всё в функции, чтобы не пересекаться с $ и fmt из info.js */
(function(){
"use strict";
const D=window.TASKS_DATA,L=D.locations.map(l=>l.replace(/"([^"]*)"/g,"«$1»"));
const SEC_KEY="gameHelperInfoSection";
/* короткие подписи показываются на телефоне, длинные — на компьютере */
const R={
 exp:{full:"Опыт",short:"Опыт",cls:"exp"},
 bullets:{full:"Пули",short:"Пули",cls:"bul"},
 rep:{full:"Репутация",short:"Репутация",cls:"rep"},
 energy:{full:"Затраты энергии",short:"Энергия",cls:"en"},
 tokens:{full:"Жетоны",short:"Жетоны",cls:"tok"}
};
/* иконки: три игровые картинки, для опыта — нарисованный значок «XP» */
const ICON={
 exp:'<svg class="res-xp" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.2" y="5.2" width="19.6" height="13.6" rx="3.2"/><text x="12" y="16.1" text-anchor="middle">XP</text></svg>',
 bullets:'<img src="assets/common_currency-BGqetmZE.webp" alt="" loading="lazy" decoding="async">',
 rep:'<img src="assets/reputation-DqOMMtrl.webp" alt="" loading="lazy" decoding="async">',
 energy:'<img src="assets/energy-5drpfC6V.webp" alt="" loading="lazy" decoding="async">',
 tokens:'<img src="assets/rare_currency-D0tYVDkc.webp" alt="" loading="lazy" decoding="async">'
};
const n0=v=>v.toLocaleString("ru-RU"),n2=v=>v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});
const gain=k=>L.map((_,i)=>D.total[k][i]/D.total.energy[i]);
const round2=v=>Math.round(v*100)/100;
const card=(led,title,body)=>'<div class="info-group"><div class="info-group-title"><i class="info-led" style="--led:'+led+'"></i><b>'+title+'</b></div>'+body+'</div>';

/* итог за все этапы плюс награда за полное прохождение: столько ресурсов даёт локация целиком */
const combined={};
["exp","bullets","rep"].forEach(k=>{combined[k]=L.map((_,i)=>D.total[k][i]+D.reward[k][i])});
combined.tokens=D.reward.tokens.slice();
combined.energy=D.total.energy.slice();
const gainRows={exp:gain("exp"),bullets:gain("bullets"),rep:gain("rep")};

const shortLoc=l=>l.split(/[ «]/)[0];
function locHead(){
 return L.map(l=>'<th><span class="loc-full">'+l+'</span><span class="loc-short">'+shortLoc(l)+'</span></th>').join("");
}
function row(k,vals,fmt,highlight){
 const r=highlight?vals.map(round2):vals,best=highlight?Math.max.apply(null,r):null;
 return '<tr class="res-'+R[k].cls+'"><th scope="row"><i class="res-ico">'+ICON[k]+'</i>'
  +'<span class="lbl-full">'+R[k].full+'</span><span class="lbl-short">'+R[k].short+'</span></th>'
  +vals.map((v,j)=>'<td'+(highlight&&r[j]===best?' class="best"':'')+'>'+fmt(v)+'</td>').join("")+'</tr>';
}
/* ПК: ресурсы строками, локации столбцами — все локации видно сразу */
function locTable(keys,items,fmt,highlight){
 return '<div class="data-wrap"><table class="data-table tasks-v2"><thead><tr><th class="th-corner">Ресурс</th>'+locHead()+'</tr></thead><tbody>'
  +keys.map(k=>row(k,items[k]||[],fmt,highlight)).join("")+'</tbody></table></div>';
}
/* телефон: то же самое, но локации строками, а ресурсы — столбцами с иконками:
   пять колонок с числами в экран не влезают, а так всё видно без прокрутки вбок */
function locTableNarrow(keys,items,fmt,highlight){
 const head=keys.map(k=>'<th class="res-'+R[k].cls+'" title="'+R[k].full+'"><i class="res-ico">'+ICON[k]+'</i><span class="t-only">'+R[k].full+'</span></th>').join("");
 /* лучшее значение считаем по каждому ресурсу среди локаций — как и в широкой таблице */
 const bests={};
 if(highlight)keys.forEach(k=>{bests[k]=Math.max.apply(null,L.map((_,j)=>round2((items[k]||[])[j])))});
 const body=L.map((l,i)=>{
  const cells=keys.map(k=>{
   const v=(items[k]||[])[i];
   return '<td'+(highlight&&round2(v)===bests[k]?' class="best"':'')+'>'+fmt(v)+'</td>';
  }).join("");
  return '<tr><th scope="row">'+l+'</th>'+cells+'</tr>';
 }).join("");
 return '<div class="data-wrap"><table class="data-table tasks-v2 tasks-v2-n"><thead><tr><th class="th-corner">Локация</th>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}

function block(led,title,keys,items,fmt,highlight,note){
 return card(led,title,
  '<div class="tasks-wide">'+locTable(keys,items,fmt,highlight)+'</div>'
  +'<div class="tasks-narrow">'+locTableNarrow(keys,items,fmt,highlight)+'</div>'
  +(note?'<p class="tasks-note">'+note+'</p>':""));
}

function tasksBody(){
 return block("#ffb74d","Награда за полное прохождение локации",["exp","bullets","rep","tokens"],D.reward,n0)
  +block("#54bfff","Итого за все этапы + награда за прохождение",["exp","bullets","rep","tokens","energy"],combined,n0,null,
    "Затраты энергии — сколько уйдёт на все этапы локации; остальные строки — что получишь за них и за полное прохождение.")
  +block("#27db88","Выгода: ресурс на единицу затраченной энергии",["exp","bullets","rep"],gainRows,n2,true,
    "Зелёным отмечено самое выгодное значение в строке.");
}

const root=document.getElementById("tasksRoot");
function renderTasks(){root.innerHTML=tasksBody()}

/* переключатель разделов «Прогресс по уровням» / «Задания» */
function setSection(k){
 document.querySelectorAll("[data-section]").forEach(b=>{const on=b.dataset.section===k;b.classList.toggle("active",on);b.setAttribute("aria-pressed",on)});
 document.querySelectorAll("[data-section-panel]").forEach(p=>{p.hidden=p.dataset.sectionPanel!==k});
}
document.addEventListener("click",e=>{
 const s=e.target.closest("[data-section]");
 if(!s)return;
 /* смена раздела проходит через View Transition, если браузер умеет */
 const swap=()=>{setSection(s.dataset.section);try{localStorage.setItem(SEC_KEY,s.dataset.section)}catch{}};
 window.__vt?window.__vt(swap):swap();
});
renderTasks();
let sec="levels";
try{const s=localStorage.getItem(SEC_KEY);if(s==="levels"||s==="tasks")sec=s}catch{}
setSection(sec);
})();
