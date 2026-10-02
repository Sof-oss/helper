/* polish.js — подключается после app.js (калькулятор).
   Не меняет логику расчёта: дорисовывает полосу урона и плитки снаряжения, следит за перерисовкой DOM */
(function(){
"use strict";
const $=id=>document.getElementById(id);

/* --- полоса: база / уровень / снаряжение / таланты --- */
const PARTS=["base","level","gear","talentOut"];
const num=id=>{const e=$(id);return e?parseInt(e.textContent.replace(/\D/g,""),10)||0:0};
document.querySelectorAll(".damage-card").forEach(card=>{
 const s=card.querySelector("strong[id^=result]"),bd=card.querySelector(".breakdown");
 if(!s||!bd)return;
 bd.insertAdjacentHTML("beforebegin",'<div class="dmg-bar" data-k="'+s.id.slice(6)+'" aria-hidden="true"><i class="s0"></i><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>');
});
function updateBars(){
 document.querySelectorAll(".dmg-bar").forEach(bar=>{
  const v=PARTS.map(p=>num(p+bar.dataset.k)),t=v.reduce((a,b)=>a+b,0)||1;
  [...bar.children].forEach((el,i)=>{el.style.width=(v[i]/t*100)+"%"});
 });
}
new MutationObserver(()=>requestAnimationFrame(updateBars)).observe(document.querySelector(".content"),{childList:true,subtree:true,characterData:true});
updateBars();

/* --- плитки снаряжения (render() в app.js пересоздаёт список, поэтому следим за ним) --- */
function chip(label){
 const inp=label.querySelector("input");
 if(!inp||label.dataset.chip)return;
 const x=(inp.dataset.type==="set"?SETS:ITEMS)[inp.dataset.index];
 if(!x)return;
 const b=x.bonuses||{},free=b.knife!=null,arr=free?[b.knife,b.pistol,b.auto]:[b.grenade,b.gl,b.gauss],ex=[];
 if(x.critChance||x.critDamage||x.critGaussChance||x.critGrenadeChance||x.critGaussDamage||x.critGrenadeDamage)ex.push("крит");
 if(x.cooldown||x.freeNoCooldown)ex.push("откат");
 label.querySelector("span").innerHTML="<b>"+x.name+"</b><small>+"+arr.join(" / +")+(ex.length?" · "+ex.join(", "):"")+"</small>";
 label.insertAdjacentHTML("afterbegin",'<svg class="ic opt-ic" aria-hidden="true"><use href="'+(free?"#i-sword":"#i-spark")+'"/></svg>');
 label.classList.add(free?"opt-free":"opt-paid");
 label.dataset.chip="1";
 label.title=gearBonusTags(x).map(t=>t.label+" "+t.value).join(", ");
}
["sets","items"].forEach(id=>{
 const el=$(id),run=()=>el.querySelectorAll(".option").forEach(chip);
 run();
 new MutationObserver(run).observe(el,{childList:true});
});

/* --- кнопки в боковой панели талантов (их рисует app.js) --- */
const ts=$("talentSidebar");
function fixTalentButtons(){
 const r=ts.querySelector("[data-reset-talents]"),h=ts.querySelector(".talent-hide[data-close-talents]");
 if(r&&!r.querySelector("svg"))r.innerHTML='<svg class="ic" aria-hidden="true"><use href="#i-reset"/></svg>Сбросить таланты';
 if(h&&h.textContent!=="Скрыть")h.textContent="Скрыть";
}
new MutationObserver(fixTalentButtons).observe(ts,{childList:true});
fixTalentButtons();

/* --- окно таланта: не «моргает» при прокачке ---
   renderTalents() в app.js пересоздаёт содержимое окна при каждом клике, и анимация появления проигрывается заново.
   Первое открытие анимируем, а пока окно уже открыто, ставим .rerender (анимация выключена, см. polish.css).
   Закрытие (содержимое пустое) сбрасывает флаги */
const dov=$("talentDetailOverlay");
if(dov){
 let wasOpen=false;
 new MutationObserver(()=>{
  if(dov.childElementCount){
   if(wasOpen)dov.classList.add("rerender");
   else wasOpen=true;
  }else{
   wasOpen=false;
   dov.classList.remove("rerender");
  }
 }).observe(dov,{childList:true});
}
})();
