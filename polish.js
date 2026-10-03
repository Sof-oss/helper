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

/* --- окно «Бонусы снаряжения» ---
   Подменяет renderGearInfo из app.js: карточки в две колонки с цветом по типу (бесплатные удары / оружие за жетоны),
   теги окрашены по смыслу, а сумма вынесена в закреплённую панель под списком, поэтому не перекрывает карточки.
   openGearInfo() вызывает renderGearInfo по имени, так что подмена подхватывается сама */
const GI_TYPE={knife:"free",pistol:"free",auto:"free",grenade:"paid",gl:"paid",gauss:"paid",freeNoCooldown:"cd",cooldown:"cd"};
const giTag=(k,v)=>{
 const pct=GEAR_BONUS_PCT.has(k),cls="t-"+(GI_TYPE[k]||"crit");
 return '<span class="gi-tag '+cls+'">'+GEAR_BONUS_LABELS[k]+' <b>+'+(pct?Math.round(v*100)+"%":fmt(v))+'</b></span>';
};
/* теги в порядке: удары, оружие за жетоны, прочее (крит, откат) */
function giTags(x,keysList){
 let out="";
 keysList.forEach(k=>{
  const v=(keys.includes(k)?x.bonuses&&x.bonuses[k]:x[k]);
  if(v)out+=giTag(k,v);
 });
 return out;
}
const GI_ALL=[...keys,...GEAR_EXTRA];
function giCard(x){
 const free=x.bonuses&&x.bonuses.knife!=null;
 return '<div class="gi-card '+(free?"free":"paid")+'"><div class="gi-head"><svg class="ic" aria-hidden="true"><use href="'+(free?"#i-sword":"#i-spark")+'"/></svg><b>'+x.name+'</b></div><div class="gi-tags">'+(giTags(x,GI_ALL)||'<span class="gi-tag">Нет бонусов</span>')+'</div></div>';
}
function giSection(title,list){
 return '<div class="gi-section"><span>'+title+'</span><small>'+list.length+'</small></div><div class="gi-grid">'+list.map(giCard).join("")+'</div>';
}
function giTotal(){
 const sum=gearTotalItem(),row=(label,ks)=>{const t=giTags(sum,ks);return t?'<div class="gi-total-row"><small>'+label+'</small><div class="gi-tags">'+t+'</div></div>':""};
 return '<div class="gi-total"><div class="gi-total-title"><svg class="ic" aria-hidden="true"><use href="#i-star"/></svg>Сумма всех бонусов</div>'
  +row("Бесплатные удары",["knife","pistol","auto"])
  +row("Оружие за жетоны",["grenade","gl","gauss"])
  +row("Крит и откат",GEAR_EXTRA)+'</div>';
}
window.renderGearInfo=function(){
 $("gearInfoBody").innerHTML='<div class="gi-scroll"><div class="gi-legend"><span class="t-free"><i style="--tc:#f0ae58"></i>Бесплатные удары</span><span class="t-paid"><i style="--tc:#54bfff"></i>Оружие за жетоны</span><span class="t-crit"><i style="--tc:#ff8a8f"></i>Крит</span><span class="t-cd"><i style="--tc:#27db88"></i>Откат</span></div>'
  +giSection("Комплекты",SETS)+giSection("Одиночные вещи",ITEMS)+'</div>'+giTotal();
};
})();
