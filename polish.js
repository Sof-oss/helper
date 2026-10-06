/* polish.js — дополнение к app.js (калькулятор), ES-модуль; порядок задаёт src/calculator.js.
   Не меняет логику расчёта: дорисовывает полосу урона и плитки снаряжения, следит за перерисовкой DOM */
import { SETS, ITEMS, keys, fmt, plural, GEAR_BONUS_LABELS, GEAR_BONUS_PCT, GEAR_EXTRA, gearBonusTags, gearTotalItem, setGearInfoRenderer } from "./app.js";
(function(){
"use strict";
const $=id=>document.getElementById(id);

/* Значки снаряжения: противогаз — комплекты, разгрузка — одиночные вещи.
   Одни и те же в списке снаряжения и в окне «Бонусы снаряжения» */
const svgIcon=(paths,extra)=>'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'+(extra||"")+'>'+paths+'</svg>';
const ICON_SET=svgIcon('<path d="M12 3.4c-3.6 0-6 2.5-6 6.3 0 2.7 1.1 4.9 2.9 6.3l1 3.2h4.2l1-3.2c1.8-1.4 2.9-3.6 2.9-6.3 0-3.8-2.4-6.3-6-6.3z"/><circle cx="9.3" cy="9.7" r="1.8"/><circle cx="14.7" cy="9.7" r="1.8"/><path d="M10.4 14.6h3.2M9.9 19.2v1.9h4.2v-1.9M6.3 12.4l-2.6 1M17.7 12.4l2.6 1"/>');
const ICON_ITEM=svgIcon('<path d="M8.6 3.4 6 5v4.4L4.5 11v9.6h15V11L18 9.4V5l-2.6-1.6C14.9 5.5 13.6 7 12 7s-2.9-1.5-3.4-3.6z"/><path d="M12 7v13.6M7 13.6h3M14 13.6h3M7 16.8h3M14 16.8h3"/>');

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
 /* значок как в окне бонусов: противогаз у комплектов, разгрузка у одиночных вещей;
    цвет значка по-прежнему показывает, к какому оружию бонусы */
 label.insertAdjacentHTML("afterbegin",(inp.dataset.type==="set"?ICON_SET:ICON_ITEM).replace('class="ic"','class="ic opt-ic"'));
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
   Заменяет вид окна из app.js (через setGearInfoRenderer): две группы со своей иконкой (комплекты — противогаз,
   вещи — разгрузка), внутри карточки три строки по оружию с полоской вклада, шкала общая
   для комплектов и вещей; крит и откат — чипами; сумма — плотными плитками.
   openGearInfo() в app.js вызывает то, что передано в setGearInfoRenderer */
/* семейства: имена совпадают с классами карточек в polish.css (.gi-card.free / .gi-card.paid),
   иначе не подставляется --ac и у платных комплектов пропадают рейка и полоски */
const GI_FAM={free:["knife","pistol","auto"],paid:["grenade","gl","gauss"]};
const GI_NAMES={free:"Бесплатные удары",paid:"Оружие за жетоны"};
const GI_ICON_SET=ICON_SET,GI_ICON_ITEM=ICON_ITEM;
const giFamily=x=>(x.bonuses&&x.bonuses.knife!=null)?"free":"paid";
/* общая шкала: максимум по каждому оружию среди всех комплектов и вещей */
const giMax={};["free","paid"].forEach(f=>GI_FAM[f].forEach(k=>{giMax[k]=Math.max(...[...SETS,...ITEMS].map(x=>(x.bonuses&&x.bonuses[k])||0))}));
const giVal=(k,v)=>GEAR_BONUS_PCT.has(k)?"+"+Math.round(v*100)+"%":"+"+fmt(v);
let giFilter="all";
function giCard(x,icon){
 const fam=giFamily(x),ks=GI_FAM[fam];
 /* сила — средняя доля от самого сильного предмета по трём видам оружия семейства (шкала общая для комплектов и вещей) */
 const power=ks.reduce((a,k)=>a+((x.bonuses&&x.bonuses[k])||0)/(giMax[k]||1),0)/ks.length;
 const pct=Math.round(power*100);
 const stats=ks.map(k=>'<div class="gi-stat"><small>'+GEAR_BONUS_LABELS[k]+'</small><b>'+giVal(k,(x.bonuses&&x.bonuses[k])||0)+'</b></div>').join("");
 const chips=GEAR_EXTRA.filter(k=>x[k]).map(k=>'<span class="gi-chip">'+GEAR_BONUS_LABELS[k]+' <b>'+giVal(k,x[k])+'</b></span>').join("");
 return '<div class="gi-card '+fam+'"><div class="gi-head">'+icon+'<b>'+x.name+'</b><span class="gi-power" title="Сила относительно самого сильного предмета">'+pct+'%</span></div>'
  +'<span class="gi-bar gi-power-bar"><i style="width:'+Math.max(3,pct)+'%"></i></span>'
  +'<div class="gi-stats">'+stats+'</div>'+(chips?'<div class="gi-chips">'+chips+'</div>':"")+'</div>';
}
/* внутри раздела — подгруппы по семейству оружия, чтобы оранжевые и синие карточки не чередовались */
function giSection(title,icon,list){
 if(!list.length)return "";
 const fams=["free","paid"].map(f=>[f,list.filter(x=>giFamily(x)===f)]).filter(([,l])=>l.length);
 return '<div class="gi-section">'+icon+title+' <b>'+list.length+'</b></div>'
  +fams.map(([f,l])=>'<div class="gi-sub '+f+'"><i aria-hidden="true"></i>'+GI_NAMES[f]+' <b>'+l.length+'</b></div><div class="gi-grid">'+l.map(x=>giCard(x,icon)).join("")+'</div>').join("");
}
function giTotal(count){
 const sum=gearTotalItem(),pill=(k,v)=>'<span class="gi-pill">'+GEAR_BONUS_LABELS[k]+' <b>'+giVal(k,v)+'</b></span>';
 const row=(label,ks)=>{const t=ks.filter(k=>sum[k]||(sum.bonuses&&sum.bonuses[k])).map(k=>pill(k,keys.includes(k)?sum.bonuses[k]:sum[k])).join("");return t?'<div class="gi-total-row"><small>'+label+'</small><div class="gi-pills">'+t+'</div></div>':""};
 return '<div class="gi-total"><div class="gi-total-title">Сумма всех бонусов · '+count+' '+plural(count,"предмет","предмета","предметов")+'</div>'
  +row(GI_NAMES.free,GI_FAM.free)+row(GI_NAMES.paid,GI_FAM.paid)+row("Крит и откат",GEAR_EXTRA)+'</div>';
}
function renderGearInfo(){
 const visible=x=>giFilter==="all"||giFamily(x)===giFilter;
 const sets=SETS.filter(visible),items=ITEMS.filter(visible),all=[...SETS,...ITEMS];
 const counts={all:all.length,free:all.filter(x=>giFamily(x)==="free").length,paid:all.filter(x=>giFamily(x)==="paid").length};
 const btn=(key,label)=>'<button type="button" class="gi-filter'+(giFilter===key?" active":"")+'" data-gear-filter="'+key+'" aria-pressed="'+(giFilter===key)+'">'+label+'</button>';
 $("gearInfoBody").innerHTML='<div class="gi-scroll">'
  +'<div class="gi-tools"><div class="gi-filters" role="group" aria-label="Фильтр снаряжения">'
  +btn("all","Все "+counts.all)+btn("free",GI_NAMES.free+" "+counts.free)+btn("paid","За жетоны "+counts.paid)
  +'</div><p class="gi-note">Полоска и % — сила предмета относительно самого сильного для того же оружия, среди комплектов и вещей вместе</p></div>'
  +giSection("Комплекты",GI_ICON_SET,sets)
  +giSection("Одиночные вещи",GI_ICON_ITEM,items)
  /* сумма идёт в общем потоке внизу списка, а не прилипает к окну */
  +giTotal(all.length)
  +'</div>';
}
setGearInfoRenderer(renderGearInfo);
/* фильтр: переключает список, сумма всегда считается по всем предметам */
document.addEventListener("click",e=>{
 const b=e.target.closest("[data-gear-filter]");
 if(!b)return;
 giFilter=b.dataset.gearFilter;
 renderGearInfo();
});
})();
