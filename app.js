const SETS=[
{name:"Первый день в зоне",bonuses:{knife:5,pistol:5,auto:5}},
{name:"Любитель прогулок",bonuses:{grenade:6,gl:11,gauss:36}},
{name:"Марафонец",bonuses:{knife:9,pistol:10,auto:11}},
{name:"Полевой",bonuses:{grenade:16,gl:34,gauss:108}},
{name:"Болотник",bonuses:{knife:14,pistol:14,auto:16}},
{name:"Омон",bonuses:{grenade:30,gl:62,gauss:198}},
{name:"КХК-01",bonuses:{grenade:41,gl:85,gauss:270},critGaussChance:.01,critGaussDamage:100},
{name:"Рубеж-М",bonuses:{grenade:50,gl:102,gauss:324},critChance:.02,critDamage:50},
{name:"Научный сотрудник",bonuses:{knife:18,pistol:19,auto:22}},
{name:"Копатель",bonuses:{grenade:22,gl:45,gauss:144},critGrenadeChance:.01,critGrenadeDamage:75},
{name:"Жестянка",bonuses:{grenade:60,gl:124,gauss:396},critChance:.03,critDamage:75}
];
const ITEMS=[
{name:"Футболка «Сердце Зоны»",bonuses:{grenade:1,gl:2,gauss:7}},
{name:"Кожаная куртка",bonuses:{grenade:3,gl:7,gauss:22}},
{name:"Бандитский плащ",bonuses:{grenade:2,gl:5,gauss:14}},
{name:"Комбинезон «Рассвет»",bonuses:{knife:12,pistol:12,auto:14},cooldown:.03,freeNoCooldown:.01}
];
const state={sets:new Set(),items:new Set(),talents:{}};
const keys=["knife","pistol","auto","grenade","gl","gauss"];
const TALENT_ASSETS={TALENT_0001:"TALENT_0001-sfcxbYqa.webp",TALENT_0002:"TALENT_0002-DJDfGX4a.webp",TALENT_0003:"TALENT_0003-DmaMfCbv.webp",TALENT_0004:"TALENT_0004-CA2yMivx.webp",TALENT_0005:"TALENT_0005-CgjISMXn.webp",TALENT_0006:"TALENT_0006-ClsyoGm3.webp",TALENT_0007:"TALENT_0007-DAY6ZOOP.webp",TALENT_0008:"TALENT_0008-y6cx_aDt.webp",TALENT_0009:"TALENT_0009-Bp-oNrB8.webp",TALENT_0010:"TALENT_0010-BlkwiBNG.webp",TALENT_0011:"TALENT_0011-waaRueAG.webp",TALENT_0012:"TALENT_0012-DJYHMNfz.webp",TALENT_0013:"TALENT_0013-CW8z33mi.webp",TALENT_0014:"TALENT_0014-D0Z0I1wp.webp",TALENT_0015:"TALENT_0015-NxBLj8iX.webp",TALENT_0016:"TALENT_0016-C10xeuwP.webp",TALENT_0017:"TALENT_0017-B6yciWom.webp",TALENT_0018:"TALENT_0018-Bl6lQcmT.webp",TALENT_0019:"TALENT_0019-CK1oIt-A.webp",TALENT_0020:"TALENT_0020-fFMuuMjC.webp",TALENT_0021:"TALENT_0021-BoNRfcSz.webp",TALENT_0022:"TALENT_0022-BPLJgAH0.webp",TALENT_0023:"TALENT_0023-BiqFfm_b.webp",TALENT_0024:"TALENT_0024-BfcgPQN4.webp",TALENT_0025:"TALENT_0025-CadiUFM_.webp",TALENT_0026:"TALENT_0026-BYzW7dE1.webp",TALENT_0027:"TALENT_0027-CioKjBsV.webp"};
const $=id=>document.getElementById(id),STORAGE_KEY="gameHelperState",MAX_TALENT_POINTS=TALENTS.length*5;
const cap=k=>k[0].toUpperCase()+k.slice(1);

function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({sets:[...state.sets],items:[...state.items],level:$("level").value,talents:state.talents}))}catch{}}
function loadState(){try{const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(!data)return;state.sets.clear();state.items.clear();state.talents={};(Array.isArray(data.sets)?data.sets:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<SETS.length).forEach(i=>state.sets.add(i));(Array.isArray(data.items)?data.items:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<ITEMS.length).forEach(i=>state.items.add(i));if(data.level!==undefined)$("level").value=data.level;if(data.talents&&typeof data.talents==="object")Object.entries(data.talents).forEach(([id,v])=>{if(TALENTS.some(t=>t[0]===id))state.talents[id]=Math.max(0,Math.min(5,Number(v)||0))})}catch{}}
const num=id=>Math.max(0,Number($(id).value)||0),fmt=n=>Math.round(n).toLocaleString("ru-RU"),fmtD=n=>n.toLocaleString("ru-RU",{minimumFractionDigits:1,maximumFractionDigits:1}),talentRank=code=>state.talents[code]||0,talentDef=code=>TALENTS.find(t=>t[0]===code);
/* русские формы числительных: 1 удар, 2 удара, 5 ударов */
function plural(n,one,few,many){const a=Math.abs(n)%100,b=a%10;if(a>10&&a<20)return many;if(b>1&&b<5)return few;if(b===1)return one;return many}
function canUpgrade(t){return talentRank(t[0])<5&&t[9].every(req=>talentRank(req)>=5)}
function canDowngrade(t){return talentRank(t[0])>0&&!TALENTS.some(x=>talentRank(x[0])>0&&x[9].includes(t[0]))}
function spentTalentPoints(){return Object.values(state.talents).reduce((a,b)=>a+b,0)}
function talentTotals(){const total=Object.fromEntries(keys.map(k=>[k,0]));const critDamageByWeapon={grenade:0,gl:0,gauss:0};let critChance=0,noCooldown=0,cooldown=0,firstFreeHit=0;TALENTS.forEach(t=>{const rank=talentRank(t[0]);if(!rank)return;const stat=t[7],target=Array.isArray(t[8])?t[8][0]:t[8],value=t[6][rank-1];if(stat==="free_boss_damage_flat")["knife","pistol","auto"].forEach(k=>total[k]+=value);if(stat==="free_hit_damage_flat")total[target==="rifle"?"auto":target]+=value;if(stat==="paid_hit_damage_flat")total[target==="ubgl"?"gl":target]+=value;if(stat==="paid_hit_crit_damage_flat")critDamageByWeapon[target==="ubgl"?"gl":target]+=value;if(stat==="paid_hit_crit_chance_pct")critChance+=value/100;if(stat==="first_free_hit_damage_bonus_pct")firstFreeHit+=value/100;if(stat==="free_hit_cooldown_reduction_pct")cooldown+=value/100;if(stat==="free_hit_cooldown_dodge_chance_pct")noCooldown+=value/100});return{total,critChance,critDamageByWeapon,noCooldown,cooldown,firstFreeHit}}
function talentNodeStatus(t){const rank=talentRank(t[0]),ready=canUpgrade(t),locked=t[9].some(req=>talentRank(req)<5);return rank>=5?"maxed":ready?"ready":locked?"locked":"open"}
function talentNodeIcon(t){const file=TALENT_ASSETS[t[0]],alt=t[2].replace(/"/g,"&quot;");return file?'<img src="assets/'+file+'" alt="'+alt+'" loading="lazy">':"✥"}
const ROMAN=["","I","II","III","IV","V"];
const TALENT_STAT_LABELS={free_boss_damage_flat:"Урон от бесплатных ударов",free_hit_damage_flat:"Урон",first_free_hit_damage_bonus_pct:"Урон от первого бесплатного удара",paid_hit_damage_flat:"Урон",paid_hit_crit_damage_flat:"Бонус к критическому урону",paid_hit_crit_chance_pct:"Шанс критического удара",free_hit_cooldown_reduction_pct:"Уменьшение времени перезарядки",free_hit_cooldown_dodge_chance_pct:"Шанс удара без отката"};
const TALENT_TARGET_NAMES={knife:"Нож",pistol:"Пистолет",rifle:"Автомат",grenade:"Граната",ubgl:"Гранатомёт",gauss:"Гаусс"};
const TD_CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="m7.8 12.4 3 3 5.6-6.2"/></svg>';
/* окно таланта: ромбы рангов, значения по рангам с подсветкой текущего, требования со статусом */
function renderTalentDetails(t){
 const rank=talentRank(t[0]),up=canUpgrade(t),down=canDowngrade(t),stat=t[7],unit=stat&&stat.endsWith("_pct")?"%":"",target=Array.isArray(t[8])?t[8][0]:t[8],next=rank<5?t[6][rank]:t[6][4];
 const pips=[1,2,3,4,5].map(i=>'<i class="td-pip'+(i<=rank?" on":"")+'"></i>').join("");
 const values=t[6].map((v,i)=>'<span'+(i===rank-1?' class="td-cur"':"")+'>+'+v+unit+'</span>').join('<em>/</em>');
 const reqs=t[9].length?t[9].map(code=>{const d=talentDef(code),ok=talentRank(code)>=5;return '<div class="td-req'+(ok?" ok":"")+'">'+TD_CHECK+'<b>'+(d?d[2]:code)+' '+ROMAN[5]+'</b><span>'+(ok?"Выполнено":"Не выполнено")+'</span></div>'}).join(""):'<div class="td-req none">Нет требований</div>';
 return '<div class="talent-detail"><div class="td-head"><h3>'+t[2]+'</h3><button type="button" class="td-close" data-close-talent-detail aria-label="Закрыть">×</button></div><div class="td-rank"><div class="td-pips">'+pips+'</div><b>'+rank+'/5</b><span>Текущий уровень</span></div><p class="td-desc">'+t[3]+'</p><div class="td-sec">Эффекты</div><div class="td-effect"><small>'+TALENT_STAT_LABELS[stat]+(target?" · "+TALENT_TARGET_NAMES[target]:"")+'</small><div class="td-vals">'+values+'</div></div><div class="td-sec">Требования</div>'+reqs+'<div class="td-actions">'+(down?'<button type="button" class="td-minus" data-talent-down="'+t[0]+'" aria-label="Понизить ранг">−</button>':"")+'<button type="button" class="td-up" data-talent-up="'+t[0]+'" '+(up?"":"disabled")+'>'+(rank>=5?"Максимум":(rank?"Прокачать":"Изучить")+" · +"+next+unit)+'</button></div></div>'
}

/* путь от таланта до его требований, для подсветки */
function talentAncestors(code){const seen=new Set();const walk=c=>{if(seen.has(c))return;seen.add(c);const t=talentDef(c);if(!t)return;t[9].forEach(walk)};walk(code);return seen}

/* Дерево статичное: пользователь его не двигает и не масштабирует.
   Масштаб считается один раз — так, чтобы дерево целиком помещалось в окно,
   и пересчитывается при изменении размеров окна */
const treeT={s:1,x:0,y:0};
function clampTreeScale(s){return Math.min(2.5,Math.max(.2,s))}
function applyTreeTransform(){
 const c=document.querySelector(".talent-flow-canvas");
 if(c)c.style.transform="translate("+treeT.x+"px,"+treeT.y+"px) scale("+treeT.s+")";
}
/* вписать дерево в окно и отцентровать (offsetLeft/Top не учитывают transform).
   Считаем по фактическим границам узлов, а не по холсту: у холста есть поля,
   из-за которых дерево выглядело мелким на широком экране */
function talentNodeBox(){
 const nodes=[...document.querySelectorAll(".talent-flow-canvas .talent-node-game")];
 if(!nodes.length)return null;
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 nodes.forEach(n=>{
  const l=parseFloat(n.style.left)||0,t=parseFloat(n.style.top)||0,w=n.offsetWidth||100,h=n.offsetHeight||100;
  x0=Math.min(x0,l);y0=Math.min(y0,t);x1=Math.max(x1,l+w);y1=Math.max(y1,t+h);
 });
 return{x0,y0,w:x1-x0,h:y1-y0};
}
function resetTreeTransform(){
 const wrap=document.querySelector(".talent-flow-wrap"),canvas=document.querySelector(".talent-flow-canvas");
 if(wrap&&canvas&&wrap.clientWidth&&canvas.offsetWidth){
  const ww=wrap.clientWidth,wh=wrap.clientHeight||ww,pad=20,box=talentNodeBox();
  const bw=box?box.w:canvas.offsetWidth,bh=box?box.h:canvas.offsetHeight;
  const s=clampTreeScale(Math.min(1.4,(ww-pad*2)/bw,(wh-pad*2)/bh));
  const bx=box?box.x0+box.w/2:canvas.offsetWidth/2,by=box?box.y0+box.h/2:canvas.offsetHeight/2;
  treeT.s=s;
  treeT.x=ww/2-bx*s-canvas.offsetLeft;
  treeT.y=wh/2-by*s-canvas.offsetTop;
 }else{treeT.s=1;treeT.x=0;treeT.y=0}
 applyTreeTransform();
}
/* при повороте телефона или изменении размера окна дерево снова вписывается */
let treeFitFrame=0;
window.addEventListener("resize",()=>{
 const modal=document.getElementById("talentModal");
 if(!modal||!modal.classList.contains("show"))return;
 cancelAnimationFrame(treeFitFrame);
 treeFitFrame=requestAnimationFrame(resetTreeTransform);
});

/* подсказка при наведении на узел: без клика видно, что даёт талант */
function showTalentTip(code,node){
 const tip=$("talentTip")||document.getElementById("talentTip");if(!tip||!node)return;
 const t=talentDef(code);if(!t)return;
 const rank=talentRank(code),stat=t[7],unit=stat&&stat.endsWith("_pct")?"%":"",target=Array.isArray(t[8])?t[8][0]:t[8];
 const label=(TALENT_STAT_LABELS[stat]||"Эффект")+(target?" · "+TALENT_TARGET_NAMES[target]:"");
 const left=rank>=5?"изучено до максимума":rank?("сейчас "+rank+" "+plural(rank,"ранг","ранга","рангов")+" · до максимума "+(5-rank)):"не изучен · до максимума 5";
 tip.innerHTML='<b>'+t[2]+'</b><p>'+t[3]+'</p><div class="talent-tip-eff">'+label+' <b>'+t[6].map(v=>"+"+v+unit).join(" / ")+'</b></div><div class="talent-tip-rank">'+left+'</div>';
 const wrap=document.querySelector(".talent-flow-wrap");if(!wrap)return;
 const w=wrap.getBoundingClientRect(),r=node.getBoundingClientRect();
 tip.hidden=false;
 const tw=tip.offsetWidth||260,th=tip.offsetHeight||110;
 tip.style.left=Math.max(8,Math.min(w.width-tw-8,r.left-w.left+r.width+14))+"px";
 tip.style.top=Math.max(8,Math.min(w.height-th-8,r.top-w.top-10))+"px";
}
function hideTalentTip(){const tip=document.getElementById("talentTip");if(tip&&!tip.hidden){tip.hidden=true;tip.innerHTML=""}}

/* суммарные бонусы, урон и крит */
const MIN_LEVEL=1;
/* бесплатные удары растут на 2% за уровень от значения на 1 уровне (47/49/55), подтверждено замерами на 1 и 24 уровне */
const freeBase=(atLevel1,level)=>Math.round(atLevel1*Math.pow(1.02,level-1));
function baseDamageByLevel(level){return{grenade:Math.round(55*Math.pow(1.02,level)),gl:Math.round(113*Math.pow(1.02,level)),gauss:Math.round(360*Math.pow(1.02,level)),knife:freeBase(47,level),pistol:freeBase(49,level),auto:freeBase(55,level)}}
function totals(){
 const total=Object.fromEntries(keys.map(k=>[k,0]));let critChance=0,critDamage=0,critGaussChance=0,critGrenadeChance=0,critGaussDamage=0,critGrenadeDamage=0,noCooldown=0,cooldown=0;
 const addBonuses=x=>{keys.forEach(k=>total[k]+=x.bonuses[k]||0);critChance+=x.critChance||0;critDamage+=x.critDamage||0;critGaussChance+=x.critGaussChance||0;critGrenadeChance+=x.critGrenadeChance||0;critGaussDamage+=x.critGaussDamage||0;critGrenadeDamage+=x.critGrenadeDamage||0;noCooldown+=x.freeNoCooldown||0;cooldown+=x.cooldown||0};
 state.sets.forEach(i=>addBonuses(SETS[i]));
 state.items.forEach(i=>addBonuses(ITEMS[i]));
 const t=talentTotals();keys.forEach(k=>total[k]+=t.total[k]);
 return{total,critChance:critChance+t.critChance,critDamage,critGaussChance,critGrenadeChance,critGaussDamage:critGaussDamage+t.critDamageByWeapon.gauss,critGrenadeDamage:critGrenadeDamage+t.critDamageByWeapon.grenade,critGlDamageTal:t.critDamageByWeapon.gl,noCooldown:noCooldown+t.noCooldown,cooldown:cooldown+t.cooldown,firstFreeHit:t.firstFreeHit,talentTotal:t.total};
}
function results(lvl,pre){
 const level=Math.max(1,Math.min(100,lvl===undefined?num("level"):lvl)),base=baseDamageByLevel(level),T=pre||totals(),r={};
 keys.forEach(k=>r[k]=base[k]+T.total[k]);
 r.critGrenade=T.critChance+T.critGrenadeChance;r.critGl=T.critChance;r.critGauss=T.critChance+T.critGaussChance;
 r.critDmgGrenade=T.critDamage+T.critGrenadeDamage;r.critDmgGl=T.critDamage+T.critGlDamageTal;r.critDmgGauss=T.critDamage+T.critGaussDamage;
 r.noCooldown=T.noCooldown;r.cooldown=T.cooldown;r.firstFreeHit=T.firstFreeHit;
 return r;
}

/* подписи для сводки изменений: [ключ, подпись, в процентах?] */
const RES_META=[["knife","Нож"],["pistol","Пистолет"],["auto","Автомат"],["grenade","Граната"],["gl","Гранатомёт"],["gauss","Гаусс"],["critDmgGrenade","Крит гранаты"],["critDmgGl","Крит гранатомёта"],["critDmgGauss","Крит гаусса"],["critGl","Шанс крита",1],["noCooldown","Удар без отката",1],["cooldown","Сокращение отката",1],["firstFreeHit","Первый удар",1]];
const isZero=(v,pct)=>pct?Math.round(v*100)===0:v===0;
function fmtDelta(v,pct){return(v>0?"+":"−")+(pct?Math.abs(Math.round(v*100))+"%":fmt(Math.abs(v)))}
function diffSummary(a,b){return RES_META.map(([k,l,p])=>({l,v:b[k]-a[k],p})).filter(c=>!isZero(c.v,c.p))}
function pulse(id,v,pct){const el=$(id);if(!el||isZero(v,pct))return;clearTimeout(el._t);el.textContent=fmtDelta(v,pct);el.className="delta show "+(v>0?"up":"down");el._t=setTimeout(()=>{el.className="delta"},2600)}
let prevResults=null,lastTalentChange=null;
function changeTalent(code,dir){
 const t=talentDef(code),r=talentRank(code);
 if(!t||(dir>0?!canUpgrade(t):!(r>0&&canDowngrade(t))))return;
 const before=results();state.talents[code]=r+dir;lastTalentChange=diffSummary(before,results());
 saveState();render();
}

let currentTalentBranch="free_hits",selectedTalentCode=null,talentDetailOpen=false,detailWasOpen=false;
/* renderTalents пересоздаёт кнопки, поэтому запоминаем, где стоял фокус, и возвращаем его на такую же кнопку */
const FOCUS_ATTRS=["data-talent-up","data-talent-down","data-select-talent","data-talent-branch","data-reset-talents"];
function focusKey(){
 const a=document.activeElement;
 if(!a||!a.closest||!a.closest("#talentModal"))return null;
 for(const at of FOCUS_ATTRS)if(a.hasAttribute(at)){const v=a.getAttribute(at);return"["+at+(v?'="'+v+'"':"")+"]"}
 return null;
}
function setDetailInert(on){["#talentSidebar",".talent-flow-wrap",".talent-game-header"].forEach(s=>{const el=document.querySelector("#talentModal "+s);if(el)el.inert=on})}
function renderTalents(){
 const keep=focusKey();
 const branches=[{code:"free_hits",name:"Боевая подготовка",desc:"Ветка бесплатных ударов по боссам"},{code:"paid_hits",name:"Арсенал",desc:"Ветка платных ударов по боссам"}],branch=branches.find(b=>b.code===currentTalentBranch)||branches[0],talents=TALENTS.filter(t=>t[1]===branch.code);
 if(selectedTalentCode&&!talents.some(t=>t[0]===selectedTalentCode)){selectedTalentCode=null;talentDetailOpen=false}
 const pathSet=selectedTalentCode?talentAncestors(selectedTalentCode):new Set();
 const maxX=Math.max(0,...talents.map(t=>{const a=talents.filter(x=>x[4]===t[4]);return Math.abs((a.indexOf(t)-(a.length-1)/2)*164)})),graphWidth=Math.max(760,Math.ceil(maxX*2+100+40)),nodePos=new Map;
 talents.forEach(t=>{const a=talents.filter(x=>x[4]===t[4]),i=a.indexOf(t);nodePos.set(t[0],{x:graphWidth/2+(i-(a.length-1)/2)*164-50,y:28+(t[4]-1)*148})});
 const edges=talents.flatMap(t=>t[9].map(req=>{const a=nodePos.get(req),b=nodePos.get(t[0]);if(!a||!b)return"";const x1=a.x+50,y1=a.y+100,x2=b.x+50,y2=b.y,mid=(y1+y2)/2,met=talentRank(req)>=5,onPath=pathSet.has(t[0]),stroke=onPath?"#54bfff":met?"#d8d8d2":"rgba(190,190,184,.32)",width=onPath?2.6:met?2:1.35;return '<path d="M'+x1+" "+y1+" L "+x1+" "+mid+" L "+x2+" "+mid+" L "+x2+" "+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round"></path>'})).join("");
 const nodes=talents.map(t=>{const p=nodePos.get(t[0]),rank=talentRank(t[0]),status=talentNodeStatus(t);return '<button type="button" class="talent-node-game '+status+(t[0]===selectedTalentCode?" selected":"")+(pathSet.has(t[0])?" on-path":"")+'" data-select-talent="'+t[0]+'" style="left:'+p.x+"px;top:"+p.y+'px"><span class="talent-node-art">'+talentNodeIcon(t)+'</span><span class="talent-node-rank">'+rank+'/5</span><span class="talent-node-bar"><i style="width:'+(rank*20)+'%"></i></span></button>'}).join("");
 $("talentFlow").innerHTML='<div class="talent-flow-canvas" style="width:'+graphWidth+'px;height:760px"><svg class="talent-edge-layer" width="'+graphWidth+'" height="760" viewBox="0 0 '+graphWidth+' 760">'+edges+'</svg>'+nodes+'</div>';
 const spent=spentTalentPoints(),pct=Math.min(100,Math.round(spent/MAX_TALENT_POINTS*100));
 /* прогресс по ветвям: сколько очков вложено из возможных */
 const branchSpent={},branchMax={};
 TALENTS.forEach(t=>{branchSpent[t[1]]=(branchSpent[t[1]]||0)+(talentRank(t[0])||0);branchMax[t[1]]=(branchMax[t[1]]||0)+5});
 const branchRows='<div class="talent-branches">'+branches.map(b=>{const got=branchSpent[b.code]||0,all=branchMax[b.code]||1;return '<div class="talent-branch-progress"><div><span>'+b.name+'</span><b>'+got+' / '+all+'</b></div><span class="talent-branch-bar"><i style="width:'+Math.round(got/all*100)+'%"></i></span></div>'}).join("")+'</div>';
 const last=lastTalentChange&&lastTalentChange.length?'<div class="talent-last"><small>Последнее изменение</small><div class="talent-last-list">'+lastTalentChange.map(c=>'<span class="'+(c.v>0?"up":"down")+'">'+c.l+' <b>'+fmtDelta(c.v,c.p)+'</b></span>').join("")+'</div></div>':"";
 /* кнопки в .talent-side-footer, на телефоне он липнет ко дну панели (styles.css) */
 /* легенда состояний живёт в панели, а не поверх дерева: иначе она перекрывает крайние узлы */
 const legend='<div class="talent-legend" aria-hidden="true"><span><i class="lg-maxed"></i>Изучено до максимума</span><span><i class="lg-ready"></i>Можно прокачать</span><span><i class="lg-open"></i>Открыт, очков нет</span><span><i class="lg-locked"></i>Закрыт требованием</span></div>';
 $("talentSidebar").innerHTML='<div class="talent-side-title"><span>Таланты</span><b>'+spent+' / '+MAX_TALENT_POINTS+'</b></div><div class="talent-gauge" style="--pct:'+pct+'"><div class="talent-gauge-ticks"></div><div class="talent-gauge-value"><b>'+pct+'</b><small>%</small></div></div><div class="talent-side-stats"><div><b>'+Math.max(0,MAX_TALENT_POINTS-spent)+'</b><small>свободно</small></div><div><b>'+spent+'</b><small>распределено</small></div></div>'+branchRows+last+'<div class="talent-branch-tabs">'+branches.map(b=>'<button type="button" class="'+(b.code===currentTalentBranch?"active":"")+'" data-talent-branch="'+b.code+'">'+b.name+'</button>').join("")+'</div><div class="talent-branch-description"><b>'+branch.name+'</b><span>'+branch.desc+'</span></div>'+legend+'<div class="talent-side-hint">Нажми на узел дерева, чтобы открыть описание и прокачку</div><div class="talent-side-footer"><button type="button" class="talent-hide talent-hide-reset" data-reset-talents '+(spent?"":"disabled")+'>↻ Сбросить таланты</button><button type="button" class="talent-hide" data-close-talents>← Скрыть</button></div>';
 const detailOverlay=$("talentDetailOverlay"),detailOn=talentDetailOpen&&!!selectedTalentCode;
 if(detailOn){const dt=talentDef(selectedTalentCode);detailOverlay.innerHTML='<div class="talent-detail-backdrop" data-close-talent-detail></div><div class="talent-detail-modal" role="dialog" aria-modal="true" aria-label="'+dt[2].replace(/"/g,"&quot;")+'" tabindex="-1">'+renderTalentDetails(dt)+'</div>';detailOverlay.classList.add("show")}
 else{detailOverlay.classList.remove("show");detailOverlay.innerHTML=""}
 $("modalSpentPoints").textContent=spent;$("modalMaxPoints").textContent=MAX_TALENT_POINTS;$("talentPointsBadge").textContent=spent+" / "+MAX_TALENT_POINTS;$("talentSummary").textContent=spent?"Распределено "+spent+" очков":"Очки не распределены";
 applyTreeTransform();
 /* фокус: при открытии подробностей уходит в них, при закрытии возвращается на талант, при перерисовке остаётся на своей кнопке */
 if($("talentModal").classList.contains("show")){
  const box=detailOverlay.querySelector(".talent-detail-modal");
  setDetailInert(detailOn);
  if(detailOn&&!detailWasOpen)box.focus({preventScroll:true});
  else if(!detailOn&&detailWasOpen){const n=document.querySelector('#talentFlow [data-select-talent="'+selectedTalentCode+'"]');if(n)n.focus({preventScroll:true})}
  else if(keep){const el=document.querySelector("#talentModal "+keep);if(el&&!el.disabled)el.focus({preventScroll:true});else if(box)box.focus({preventScroll:true})}
 }
 detailWasOpen=detailOn;
}
function openTalents(){lastTalentChange=null;$("talentModal").classList.add("show");$("talentModal").setAttribute("aria-hidden","false");renderTalents();resetTreeTransform()}
function closeTalents(){$("talentModal").classList.remove("show");$("talentModal").setAttribute("aria-hidden","true");talentDetailOpen=false}
function resetTalents(){if(!spentTalentPoints())return;if(!confirm("Сбросить все очки талантов? Уровень и снаряжение останутся без изменений."))return;state.talents={};selectedTalentCode=null;talentDetailOpen=false;lastTalentChange=null;saveState();render()}

/* бонусы всех комплектов и вещей для справки */
const GEAR_BONUS_LABELS={knife:"Нож",pistol:"Пистолет",auto:"Автомат",grenade:"Граната",gl:"Гранатомёт",gauss:"Гаусс",critChance:"Шанс крита (общий)",critDamage:"Урон крита (общий)",critGaussChance:"Шанс крита (гаусс)",critGrenadeChance:"Шанс крита (граната)",critGaussDamage:"Урон крита (гаусс)",critGrenadeDamage:"Урон крита (граната)",freeNoCooldown:"Шанс удара без отката",cooldown:"Сокращение отката"};
const GEAR_BONUS_PCT=new Set(["critChance","critGaussChance","critGrenadeChance","freeNoCooldown","cooldown"]);
const GEAR_EXTRA=["critChance","critDamage","critGaussChance","critGrenadeChance","critGaussDamage","critGrenadeDamage","freeNoCooldown","cooldown"];
function gearBonusTags(x){const tags=[];keys.forEach(k=>{const v=x.bonuses&&x.bonuses[k];if(v)tags.push({label:GEAR_BONUS_LABELS[k],value:"+"+fmt(v)})});GEAR_EXTRA.forEach(k=>{const v=x[k];if(v)tags.push({label:GEAR_BONUS_LABELS[k],value:"+"+(GEAR_BONUS_PCT.has(k)?Math.round(v*100)+"%":fmt(v))})});return tags}
function gearInfoCard(x,extraClass){const tags=gearBonusTags(x);return '<div class="gear-info-card'+(extraClass?" "+extraClass:"")+'"><b>'+x.name+'</b><div class="gear-info-tags">'+(tags.length?tags.map(t=>'<span class="gear-info-tag">'+t.label+' <b>'+t.value+'</b></span>').join(""):'<span class="gear-info-tag">Нет бонусов</span>')+'</div></div>'}
function gearTotalItem(){
 const sum={name:"Сумма всех бонусов",bonuses:{}};
 [...SETS,...ITEMS].forEach(x=>{
  keys.forEach(k=>{sum.bonuses[k]=(sum.bonuses[k]||0)+((x.bonuses&&x.bonuses[k])||0)});
  GEAR_EXTRA.forEach(k=>{sum[k]=(sum[k]||0)+(x[k]||0)});
 });
 return sum;
}
/* базовый список; окно «Бонусы снаряжения» дорисовывает polish.js (полоски, фильтр, группы) */
function renderGearInfo(){$("gearInfoBody").innerHTML='<div class="gear-info-group-title">Комплекты</div>'+SETS.map(x=>gearInfoCard(x)).join("")+'<div class="gear-info-group-title">Одиночные вещи</div>'+ITEMS.map(x=>gearInfoCard(x)).join("")+'<div class="gear-info-total-wrap">'+gearInfoCard(gearTotalItem(),"gear-info-total")+'</div>'}
function openGearInfo(){$("gearInfoModal").classList.add("show");$("gearInfoModal").setAttribute("aria-hidden","false");renderGearInfo()}
function closeGearInfo(){$("gearInfoModal").classList.remove("show");$("gearInfoModal").setAttribute("aria-hidden","true")}

/* расчёт по жетонам */
const TOKEN_PRICES={grenade:3,gl:5,gauss:15},TOKEN_KEY="gameHelperTokens",TOKEN_WEAPONS=[["grenade","Граната"],["gl","Гранатомёт"],["gauss","Гаусс"]],TOKEN_CRIT={grenade:["critGrenade","critDmgGrenade"],gl:["critGl","critDmgGl"],gauss:["critGauss","critDmgGauss"]};
const tokenInt=id=>Math.max(0,Math.floor(Number($(id).value)||0));
function saveTokens(){try{localStorage.setItem(TOKEN_KEY,JSON.stringify({count:$("tokenCount").value,target:$("tokenTarget").value}))}catch{}}
function loadTokens(){try{const d=JSON.parse(localStorage.getItem(TOKEN_KEY)||"null");if(!d)return;if(d.count!==undefined)$("tokenCount").value=d.count;if(d.target!==undefined)$("tokenTarget").value=d.target}catch{}}
/* урон за удар и средний урон с критом: урон + шанс * бонус */
function tokenWeaponStats(){
 const r=results();
 return TOKEN_WEAPONS.map(([k,name])=>{const dmg=r[k],chance=Math.min(1,r[TOKEN_CRIT[k][0]]),bonus=r[TOKEN_CRIT[k][1]];return{key:k,name,price:TOKEN_PRICES[k],dmg,chance,bonus,avg:dmg+chance*bonus}});
}
/* карточки оружия: урон за жетон, полоска выгоды и три строки расчёта.
   Самое выгодное оружие выделено рамкой и зелёной полоской — этого достаточно. */
const TOKEN_ICON_CLASS={grenade:"grenade",gl:"ubgl",gauss:"gauss"};
function renderTokens(){
 const tokens=tokenInt("tokenCount"),target=tokenInt("tokenTarget"),st=tokenWeaponStats();
 const bestCrit=Math.max.apply(null,st.map(w=>w.avg/w.price));
 $("tokCards").innerHTML=st.map(w=>{
  const perToken=w.avg/w.price,best=Math.abs(perToken-bestCrit)<1e-9;
  const shots=Math.floor(tokens/w.price);
  const needed=target>0?Math.ceil(target/w.avg)*w.price:0;
  const width=Math.max(4,Math.round(perToken/bestCrit*100));
  return '<article class="tok-card'+(best?" best":"")+'">'+
   '<div class="tok-card-head"><span class="tok-wicon weapon-'+TOKEN_ICON_CLASS[w.key]+'"></span><div><b>'+w.name+'</b><small>'+w.price+' '+plural(w.price,"жетон","жетона","жетонов")+' за удар · крит '+(w.chance*100).toFixed(0)+'% / +'+fmt(w.bonus)+'</small></div></div>'+
   '<div class="tok-card-big">'+fmtD(perToken)+'</div><div class="tok-card-unit">урона за жетон</div>'+
   '<div class="tok-card-bar"><i style="width:'+width+'%"></i></div>'+
   '<div class="tok-card-rows">'+
     '<div><span>'+fmt(tokens)+' '+plural(tokens,"жетон","жетона","жетонов")+'</span><b>'+fmt(shots)+' '+plural(shots,"удар","удара","ударов")+'</b></div>'+
     '<div><span>это урона</span><b>'+fmt(shots*w.avg)+'</b></div>'+
     '<div class="acc"><span>на '+fmt(target)+' урона нужно</span><b>'+fmt(needed)+' '+plural(needed,"жетон","жетона","жетонов")+'</b></div>'+
   '</div></article>';
 }).join("");
}
function openTokens(){$("tokensModal").classList.add("show");$("tokensModal").setAttribute("aria-hidden","false");renderTokens()}
function closeTokens(){$("tokensModal").classList.remove("show");$("tokensModal").setAttribute("aria-hidden","true")}

/* карточки урона */
const CARDS={paid:[["grenade","Граната","grenade"],["gl","Гранатомёт","ubgl"],["gauss","Гаусс","gauss"]],free:[["knife","Нож","knife"],["pistol","Пистолет","pistol"],["auto","Автомат","rifle"]]};
function cardMarkup([k,name,icon],withCrit){
 const K=cap(k),cellHtml=(cls,label,id)=>'<div class="bd-cell '+cls+'"><small>'+label+'</small><em id="'+id+K+'">0</em></div>';
 return '<article class="damage-card"><div class="weapon-icon weapon-'+icon+'" aria-hidden="true"></div><div class="dmg-main"><h3>'+name+'</h3><strong id="result'+K+'">0</strong>'+(withCrit?"":'<span class="first-hit" id="first'+K+'">(0)</span>')+'</div><i class="delta" id="delta'+K+'"></i><div class="breakdown">'+cellHtml("","База","base")+cellHtml("bd-level","Уровень","level")+cellHtml("bd-gear","Экипировка","gear")+cellHtml("bd-talent","Таланты","talentOut")+'</div>'+(withCrit?'<span class="crit-chip"><span class="crit-chip-label">Крит*</span><em id="crit'+K+'">0%</em><span class="crit-chip-sep">/</span><em id="critDmg'+K+'">0</em></span>':"")+'</article>';
}
function renderCards(){$("paidCards").innerHTML=CARDS.paid.map(c=>cardMarkup(c,true)).join("");$("freeCards").innerHTML=CARDS.free.map(c=>cardMarkup(c,false)).join("")}

function optionMarkup(arr,set,type){return arr.map((x,i)=>'<label class="option"><input type="checkbox" data-type="'+type+'" data-index="'+i+'" '+(set.has(i)?"checked":"")+'><span>'+x.name+'</span></label>').join("")}
function set(id,v,roll){
 const el=$(id);if(!el)return;
 /* итоговый урон «докручивается» до нового значения (ui.js), остальные подписи — сразу */
 if(roll&&window.__roll){window.__roll(el,v);return}
 el.textContent=v;
}
function calc(){
 const level=Math.max(1,Math.min(100,num("level")));$("level").value=level;
 const T=totals(),tal=T.talentTotal,base=baseDamageByLevel(level),baseFlat=baseDamageByLevel(MIN_LEVEL),r=results(undefined,T);
 keys.forEach(k=>{const K=cap(k);set("base"+K,fmt(baseFlat[k]));set("level"+K,fmt(base[k]-baseFlat[k]));set("gear"+K,fmt(T.total[k]-tal[k]));set("talentOut"+K,fmt(tal[k]));set("result"+K,fmt(r[k]),true)});
 /* первый бесплатный удар: итоговый урон плюс процентный бонус таланта */
 ["knife","pistol","auto"].forEach(k=>set("first"+cap(k),"("+fmt(r[k]*(1+r.firstFreeHit))+")"));
 ["Grenade","Gl","Gauss"].forEach(K=>{set("crit"+K,(r["crit"+K]*100).toFixed(0)+"%");set("critDmg"+K,fmt(r["critDmg"+K]))});
 set("noCooldown",(r.noCooldown*100).toFixed(0)+"%");set("cooldown",(r.cooldown*100).toFixed(0)+"%");set("firstFreeHit","+"+(r.firstFreeHit*100).toFixed(0)+"%");
 if(prevResults){
  keys.forEach(k=>pulse("delta"+cap(k),r[k]-prevResults[k]));
  pulse("deltaNoCooldown",r.noCooldown-prevResults.noCooldown,true);pulse("deltaCooldown",r.cooldown-prevResults.cooldown,true);pulse("deltaFirstFreeHit",r.firstFreeHit-prevResults.firstFreeHit,true);
 }
 announceResults(r);
 prevResults=r;
}
function render(){$("sets").innerHTML=optionMarkup(SETS,state.sets,"set");$("items").innerHTML=optionMarkup(ITEMS,state.items,"item");$("selectAllEquipment").checked=state.sets.size===SETS.length&&state.items.size===ITEMS.length;renderTalents();$("gearToggle").textContent="Снаряжение: выбрано "+(state.sets.size+state.items.size)+" из "+(SETS.length+ITEMS.length);calc()}
function showToast(text){const t=$("toast");t.textContent=text||"В разработке";t.classList.add("show");clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove("show"),1800)}

/* билд в ссылке: уровень, снаряжение и таланты после # */
const toBits=s=>[...s].reduce((a,i)=>a|1<<i,0);
const currentBuild=()=>({level:Math.max(1,Math.min(100,num("level"))),sets:[...state.sets],items:[...state.items],talents:{...state.talents}});
function buildHashOf(b){const p=new URLSearchParams();p.set("l",String(b.level));p.set("s",String(toBits(b.sets)));p.set("i",String(toBits(b.items)));p.set("t",TALENTS.map(t=>b.talents[t[0]]||0).join(""));return p.toString()}
function buildHash(){return buildHashOf(currentBuild())}
/* разбор билда: принимает ссылку целиком, хвост после # или просто l=..&s=..; ранги без выполненных требований отбрасываются */
function parseBuild(raw){
 const p=new URLSearchParams(raw.replace(/^[^#]*#/,""));
 if(!["l","s","i","t"].some(k=>p.has(k)))return null;
 const sm=parseInt(p.get("s"),10)||0,im=parseInt(p.get("i"),10)||0,ts=p.get("t")||"";
 const b={level:Math.max(1,Math.min(100,parseInt(p.get("l"),10)||1)),sets:[],items:[],talents:{}};
 SETS.forEach((_,i)=>{if((sm>>i)&1)b.sets.push(i)});
 ITEMS.forEach((_,i)=>{if((im>>i)&1)b.items.push(i)});
 TALENTS.forEach((t,i)=>{const r=Math.max(0,Math.min(5,parseInt(ts[i],10)||0));if(r&&t[9].every(q=>(b.talents[q]||0)>=5))b.talents[t[0]]=r});
 return b;
}
/* расчёт чужого билда: на время подменяем состояние и возвращаем как было */
function resultsFor(b){
 const keep={sets:state.sets,items:state.items,talents:state.talents};
 state.sets=new Set(b.sets);state.items=new Set(b.items);state.talents=b.talents;
 try{return results(b.level)}finally{Object.assign(state,keep)}
}

/* сравнение: второй билд хранится отдельно и не трогает основной */
const CMP_KEY="gameHelperCompare";
let cmpBuild=null;
function saveCompare(){try{if(cmpBuild)localStorage.setItem(CMP_KEY,buildHashOf(cmpBuild));else localStorage.removeItem(CMP_KEY)}catch{}}
function loadCompare(){try{const h=localStorage.getItem(CMP_KEY);if(h)cmpBuild=parseBuild(h)}catch{}}
const CMP_GROUPS=[
 ["⚔ Урон за удар",[["knife","Нож"],["pistol","Пистолет"],["auto","Автомат"],["grenade","Граната"],["gl","Гранатомёт"],["gauss","Гаусс"]]],
 ["✦ Крит",[["critDmgGrenade","Урон крита, граната"],["critDmgGl","Урон крита, гранатомёт"],["critDmgGauss","Урон крита, гаусс"],["critGrenade","Шанс крита, граната",1],["critGl","Шанс крита, гранатомёт",1],["critGauss","Шанс крита, гаусс",1]]],
 ["◷ Дополнительно",[["noCooldown","Удар без отката",1],["cooldown","Сокращение отката",1],["firstFreeHit","Первый бесплатный удар",1]]]
];
const sumRanks=t=>Object.values(t).reduce((a,b)=>a+b,0);
/* у большего значения зелёная стрелка вверх, у меньшего красная вниз, рядом на сколько; поровну — без отметок.
   Под числом — полоска: насколько значение больше/меньше второго билда */
function cmpRow(label,x,y,pct){
 const d=Math.abs(y-x),eq=d<(pct?.005:.5),show=v=>pct?Math.round(v*100)+"%":fmt(v),gap=pct?Math.round(d*100)+"%":fmt(d);
 const total=(x+y)||1,wa=Math.max(4,Math.round(x/total*100)),wb=Math.max(4,100-wa);
 const cell=(v,hi,w)=>eq?'<td class="cmp-cell"><span class="cmp-v">'+show(v)+'</span></td>'
  :'<td class="cmp-cell '+(hi?"cmp-up":"cmp-down")+'"><span class="cmp-v">'+show(v)+'</span>'
   +'<i class="cmp-arr">'+(hi?"▲":"▼")+" "+gap+'</i><span class="cmp-bar"><i style="width:'+w+'%"></i></span></td>';
 return '<tr class="'+(eq?"cmp-eq":"")+'"><th scope="row">'+label+'</th>'+cell(x,x>y,wa)+cell(y,y>x,wb)+'</tr>';
}
const CMP_WEAPONS=["grenade","gl","gauss","knife","pistol","auto"];
const cmpTags=(arr,cls)=>arr.map(t=>'<span class="gear-info-tag cmp-tag '+cls+'">'+t+'</span>').join("");
/* сводка сверху: уровень, очки талантов и сколько собрано снаряжения */
function cmpHead(a,b){
 const gear=x=>x.sets.length+x.items.length,total=SETS.length+ITEMS.length;
 const card=(cls,title,x)=>'<div class="cmp-card '+cls+'"><small>'+title+'</small><b>'+x.level+' уровень</b>'
  +'<span>'+sumRanks(x.talents)+' '+plural(sumRanks(x.talents),"очко","очка","очков")+' талантов</span>'
  +'<span>снаряжение '+gear(x)+' из '+total+'</span></div>';
 return '<div class="cmp-head">'+card("a","Ваш билд",a)+'<div class="cmp-vs">против</div>'+card("b","Другой билд",b)+'</div>';
}
function renderCompare(){
 const body=$("compareBody");
 $("cmpClear").disabled=!cmpBuild;
 if(!cmpBuild){body.innerHTML='<p class="cmp-note">Пока не с чем сравнивать. Вставьте ссылку на билд в поле выше.</p>';return}
 const a=currentBuild(),b=cmpBuild,ra=results(),rb=resultsFor(b);
 let rows='<tr class="cmp-group"><td colspan="3">★ Общее</td></tr>'+cmpRow("Уровень",a.level,b.level)+cmpRow("Очки талантов",sumRanks(a.talents),sumRanks(b.talents))+cmpRow("Комплекты",a.sets.length,b.sets.length)+cmpRow("Одиночные вещи",a.items.length,b.items.length);
 CMP_GROUPS.forEach(([title,list])=>{
  rows+='<tr class="cmp-group"><td colspan="3">'+title+'</td></tr>'+list.map(([k,l,p])=>cmpRow(l,ra[k],rb[k],p)).join("");
 });
 const only=(x,y,list)=>x.filter(i=>!y.includes(i)).map(i=>list[i].name);
 const mine=[...only(a.sets,b.sets,SETS),...only(a.items,b.items,ITEMS)],theirs=[...only(b.sets,a.sets,SETS),...only(b.items,a.items,ITEMS)];
 const tal=TALENTS.filter(t=>(a.talents[t[0]]||0)!==(b.talents[t[0]]||0)).map(t=>{const x=a.talents[t[0]]||0,y=b.talents[t[0]]||0;return{t:t[2]+" "+x+" → "+y,cls:y>x?"b":"a"}});
 const block=(title,html)=>html?'<div class="cmp-diff-row"><small>'+title+'</small><div class="gear-info-tags">'+html+'</div></div>':"";
 const diff=block("Снаряжение только у вас",cmpTags(mine,"a"))+block("Снаряжение только у другого билда",cmpTags(theirs,"b"))+block("Таланты (ваш → другого билда)",tal.map(x=>cmpTags([x.t],x.cls)).join(""));
 body.innerHTML=cmpHead(a,b)
  +'<table class="data-table cmp-table"><colgroup><col class="cmp-c0"><col><col></colgroup><thead><tr><th>Параметр</th>'
  +'<th class="cmp-h-a"><i class="cmp-dot"></i>Ваш билд</th><th class="cmp-h-b"><i class="cmp-dot"></i>Другой билд</th></tr></thead><tbody>'+rows+'</tbody></table>'
  +'<p class="cmp-note">▲ больше, ▼ меньше; рядом показано, на сколько, а полоска — насколько значение больше второго билда.</p>'
  +'<details class="cmp-diff"'+(diff?" open":"")+'><summary>Что отличается</summary>'+(diff||'<p>Снаряжение и таланты совпадают.</p>')+'</details>';
}
function openCompare(){$("compareModal").classList.add("show");$("compareModal").setAttribute("aria-hidden","false");renderCompare()}
function closeCompare(){$("compareModal").classList.remove("show");$("compareModal").setAttribute("aria-hidden","true")}
function loadCmpFromInput(){
 const v=$("cmpInput").value.trim(),b=v&&parseBuild(v);
 if(!b){showToast("Не похоже на ссылку на билд");return}
 cmpBuild=b;saveCompare();$("cmpInput").value="";renderCompare();
}
function fallbackCopy(s){const a=document.createElement("textarea");a.value=s;a.style.cssText="position:fixed;opacity:0";document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand("copy")}catch{}a.remove();return ok}
function copyText(s){return navigator.clipboard&&window.isSecureContext?navigator.clipboard.writeText(s).then(()=>true,()=>fallbackCopy(s)):Promise.resolve(fallbackCopy(s))}
function shareBuild(){copyText(location.href.split("#")[0]+"#"+buildHash()).then(ok=>showToast(ok?"Ссылка скопирована":"Не удалось скопировать"))}

/* ===== Окна и озвучка =====
   Пока окно открыто, страница под ним inert: Tab не уходит за диалог, скринридер не читает фон.
   Фокус идёт в окно и возвращается на кнопку, которой его открыли. Следим за классом .show, поэтому функции открытия и закрытия окон не трогаем */
const openedModals=new Map();
function setPageInert(on){document.querySelectorAll(".site-header,.page,.site-footer").forEach(el=>{el.inert=on})}
function modalShown(m){
 if(openedModals.has(m))return;
 const a=document.activeElement;
 openedModals.set(m,a&&a!==document.body?a:null);
 setPageInert(true);
 m.querySelector(".talent-dialog").focus({preventScroll:true});
}
function modalHidden(m){
 if(!openedModals.has(m))return;
 const opener=openedModals.get(m);
 openedModals.delete(m);
 if(!openedModals.size)setPageInert(false);
 if(m.id==="talentModal"){setDetailInert(false);detailWasOpen=false}
 if(opener&&opener.isConnected)opener.focus({preventScroll:true});
}
["talentModal","gearInfoModal","tokensModal","compareModal"].forEach(id=>{
 const m=$(id);
 m.querySelector(".talent-dialog").tabIndex=-1;
 new MutationObserver(()=>m.classList.contains("show")?modalShown(m):modalHidden(m)).observe(m,{attributes:true,attributeFilter:["class"]});
});

/* итоги расчёта для скринридера: одной фразой и с паузой, чтобы набор уровня по цифре не читался на каждую */
let liveTimer=0,liveText="",liveReady=false;
function announceResults(r){
 const text="Урон за жетоны: граната "+fmt(r.grenade)+", гранатомёт "+fmt(r.gl)+", гаусс "+fmt(r.gauss)+". Бесплатные удары: нож "+fmt(r.knife)+", пистолет "+fmt(r.pistol)+", автомат "+fmt(r.auto)+".";
 clearTimeout(liveTimer);
 if(!liveReady){liveReady=true;liveText=text;return} /* первый расчёт при загрузке не озвучиваем */
 if(text===liveText)return;
 liveTimer=setTimeout(()=>{liveText=text;$("resultsLive").textContent=text},800);
}

document.addEventListener("click",e=>{
 const gt=e.target.closest("#gearToggle");if(gt){const open=gt.closest(".equipment-section").classList.toggle("gear-open");gt.setAttribute("aria-expanded",open);return}
 /* зум дерева талантов кнопками и вписать в окно */
 const closeDetail=e.target.closest("[data-close-talent-detail]");if(closeDetail){talentDetailOpen=false;renderTalents();return}
 const up=e.target.closest("[data-talent-up]");if(up){changeTalent(up.dataset.talentUp,1);return}
 const branch=e.target.closest("[data-talent-branch]");if(branch){currentTalentBranch=branch.dataset.talentBranch;selectedTalentCode=null;talentDetailOpen=false;renderTalents();resetTreeTransform();return}
 const select=e.target.closest("[data-select-talent]");if(select){hideTalentTip();selectedTalentCode=select.dataset.selectTalent;talentDetailOpen=true;renderTalents();return}
 const down=e.target.closest("[data-talent-down]");if(down){changeTalent(down.dataset.talentDown,-1);return}
 if(e.target.closest("#openTalents")){openTalents();return}
 if(e.target.closest("[data-reset-talents]")){resetTalents();return}
 if(e.target.closest("[data-close-talents]")){closeTalents();return}
 if(e.target.closest("#openGearInfo")){openGearInfo();return}
 if(e.target.closest("[data-close-gear-info]")){closeGearInfo();return}
 if(e.target.closest("#openTokens")){openTokens();return}
 if(e.target.closest("[data-close-tokens]")){closeTokens();return}
 if(e.target.closest("#shareBuild")){shareBuild();return}
 if(e.target.closest("#openCompare")){openCompare();return}
 if(e.target.closest("[data-close-compare]")){closeCompare();return}
 if(e.target.closest("#cmpLoad")){loadCmpFromInput();return}
 if(e.target.closest("#cmpClear")){cmpBuild=null;saveCompare();renderCompare();return}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(talentDetailOpen){talentDetailOpen=false;renderTalents()}else if($("compareModal").classList.contains("show")){closeCompare()}else if($("tokensModal").classList.contains("show")){closeTokens()}else if($("gearInfoModal").classList.contains("show")){closeGearInfo()}else closeTalents()}});
/* подсказка к узлу дерева: появляется при наведении, исчезает при уходе курсора */
document.addEventListener("mouseover",e=>{const n=e.target.closest&&e.target.closest(".talent-node-game");if(!n||!$("talentModal").classList.contains("show"))return;showTalentTip(n.dataset.selectTalent,n)});
document.addEventListener("mouseout",e=>{if(e.target.closest&&e.target.closest(".talent-node-game"))hideTalentTip()});
document.addEventListener("change",e=>{const i=e.target;if(!i.matches("[data-type]"))return;const s=i.dataset.type==="set"?state.sets:state.items,n=Number(i.dataset.index);i.checked?s.add(n):s.delete(n);saveState();render()});
document.addEventListener("click",e=>{const b=e.target.closest("[data-step]");if(!b)return;const input=$(b.dataset.step),dir=Number(b.dataset.dir)||0,min=Number(input.min)||0,max=Number(input.max)||999;input.value=Math.min(max,Math.max(min,(Number(input.value)||0)+dir));saveState();calc()});
$("selectAllEquipment").addEventListener("change",e=>{state.sets.clear();state.items.clear();if(e.target.checked){SETS.forEach((_,i)=>state.sets.add(i));ITEMS.forEach((_,i)=>state.items.add(i))}saveState();render()});
$("level").addEventListener("input",()=>{saveState();calc()});
$("resetAll").onclick=()=>{if(!confirm("Точно сбросить весь прогресс — уровень, снаряжение и все очки талантов?"))return;state.sets.clear();state.items.clear();state.talents={};lastTalentChange=null;$("level").value=1;saveState();render()};

["tokenCount","tokenTarget"].forEach(id=>$(id).addEventListener("input",()=>{saveTokens();renderTokens()}));
renderCards();loadState();loadTokens();
$("cmpInput").addEventListener("keydown",e=>{if(e.key==="Enter")loadCmpFromInput()});
/* билд из ссылки идёт в сравнение, свой сохранённый не трогаем */
const linked=parseBuild(location.hash);
if(linked){cmpBuild=linked;saveCompare();history.replaceState(null,"",location.href.split("#")[0])}else loadCompare();
render();
if(linked)openCompare();
