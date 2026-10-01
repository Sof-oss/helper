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

function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify({sets:[...state.sets],items:[...state.items],level:$("level").value,talents:state.talents}))}
function loadState(){try{const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(!data)return;state.sets.clear();state.items.clear();state.talents={};(Array.isArray(data.sets)?data.sets:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<SETS.length).forEach(i=>state.sets.add(i));(Array.isArray(data.items)?data.items:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<ITEMS.length).forEach(i=>state.items.add(i));if(data.level!==undefined)$("level").value=data.level;if(data.talents&&typeof data.talents==="object")Object.entries(data.talents).forEach(([id,v])=>{if(TALENTS.some(t=>t[0]===id))state.talents[id]=Math.max(0,Math.min(5,Number(v)||0))})}catch{}}
const num=id=>Math.max(0,Number($(id).value)||0),fmt=n=>Math.round(n).toLocaleString("ru-RU"),fmtD=n=>n.toLocaleString("ru-RU",{minimumFractionDigits:1,maximumFractionDigits:1}),talentRank=code=>state.talents[code]||0,talentDef=code=>TALENTS.find(t=>t[0]===code);
function canUpgrade(t){return talentRank(t[0])<5&&t[9].every(req=>talentRank(req)>=5)}
function canDowngrade(t){return talentRank(t[0])>0&&!TALENTS.some(x=>talentRank(x[0])>0&&x[9].includes(t[0]))}
function spentTalentPoints(){return Object.values(state.talents).reduce((a,b)=>a+b,0)}
function talentTotals(){const total=Object.fromEntries(keys.map(k=>[k,0]));const critDamageByWeapon={grenade:0,gl:0,gauss:0};let critChance=0,noCooldown=0,cooldown=0,firstFreeHit=0;TALENTS.forEach(t=>{const rank=talentRank(t[0]);if(!rank)return;const stat=t[7],target=Array.isArray(t[8])?t[8][0]:t[8],value=t[6][rank-1];if(stat==="free_boss_damage_flat")["knife","pistol","auto"].forEach(k=>total[k]+=value);if(stat==="free_hit_damage_flat")total[target==="rifle"?"auto":target]+=value;if(stat==="paid_hit_damage_flat")total[target==="ubgl"?"gl":target]+=value;if(stat==="paid_hit_crit_damage_flat")critDamageByWeapon[target==="ubgl"?"gl":target]+=value;if(stat==="paid_hit_crit_chance_pct")critChance+=value/100;if(stat==="first_free_hit_damage_bonus_pct")firstFreeHit+=value/100;if(stat==="free_hit_cooldown_reduction_pct")cooldown+=value/100;if(stat==="free_hit_cooldown_dodge_chance_pct")noCooldown+=value/100});return{total,critChance,critDamageByWeapon,noCooldown,cooldown,firstFreeHit}}
function talentNodeStatus(t){const rank=talentRank(t[0]),ready=canUpgrade(t),locked=t[9].some(req=>talentRank(req)<5);return rank>=5?"maxed":ready?"ready":locked?"locked":"open"}
function talentNodeIcon(t){const file=TALENT_ASSETS[t[0]],alt=t[2].replace(/"/g,"&quot;");return file?'<img src="assets/'+file+'" alt="'+alt+'" loading="lazy">':"✥"}
function talentEffectLines(t){const rank=talentRank(t[0]),stat=t[7],values=t[6],unit=stat&&stat.endsWith("_pct")?"%":"";return values.map((v,i)=>'<span class="'+(i<rank?"talent-rank-done":"")+'">Ранг '+(i+1)+': <b>+'+v+unit+'</b></span>').join("")}
function renderTalentDetails(t){const rank=talentRank(t[0]),up=canUpgrade(t),down=canDowngrade(t),req=t[9].length?t[9].map(code=>talentDef(code)?.[2]||code).join(", "):"Нет",target=Array.isArray(t[8])?t[8][0]:t[8],stat=t[7],labels={free_boss_damage_flat:"Урон от бесплатных ударов",free_hit_damage_flat:"Урон",first_free_hit_damage_bonus_pct:"Урон первого бесплатного удара",paid_hit_damage_flat:"Урон",paid_hit_crit_damage_flat:"Бонус к критическому урону",paid_hit_crit_chance_pct:"Шанс критического удара",free_hit_cooldown_reduction_pct:"Уменьшение времени перезарядки",free_hit_cooldown_dodge_chance_pct:"Шанс удара без отката"},targetNames={knife:"Нож",pistol:"Пистолет",rifle:"Автомат",grenade:"Граната",ubgl:"Гранатомёт",gauss:"Гаусс"},next=rank<5?t[6][rank]:t[6][4];return '<div class="talent-detail"><div class="talent-detail-art">'+talentNodeIcon(t)+'</div><div class="talent-detail-title"><h3>'+t[2]+'</h3><span>'+rank+' / 5</span></div><p class="talent-detail-desc">'+t[3]+'</p><div class="talent-detail-effect"><small>'+labels[stat]+(target?" · "+targetNames[target]:"")+'</small>'+talentEffectLines(t)+'</div><div class="talent-detail-requirement"><span>Требования</span><b>'+req+'</b></div><div class="talent-detail-actions">'+(down?'<button type="button" class="talent-detail-minus" data-talent-down="'+t[0]+'">−</button>':"")+'<button type="button" class="talent-detail-up" data-talent-up="'+t[0]+'" '+(up?"":"disabled")+'>'+(rank>=5?"Максимум":rank?"Прокачать":"Изучить")+(rank<5?" · +"+next+(stat&&stat.endsWith("_pct")?"%":""):"")+'</button></div></div>'}

/* путь от таланта до его требований, для подсветки */
function talentAncestors(code){const seen=new Set();const walk=c=>{if(seen.has(c))return;seen.add(c);const t=talentDef(c);if(!t)return;t[9].forEach(walk)};walk(code);return seen}

/* масштаб и сдвиг дерева талантов */
const treeT={s:1,x:0,y:0};
function clampTreeScale(s){return Math.min(2.5,Math.max(.5,s))}
function applyTreeTransform(){const c=document.querySelector(".talent-flow-canvas");if(c)c.style.transform="translate("+treeT.x+"px,"+treeT.y+"px) scale("+treeT.s+")"}
/* вписать дерево в окно и отцентровать (offsetLeft/Top не учитывают transform) */
function resetTreeTransform(){
 const wrap=document.querySelector(".talent-flow-wrap"),canvas=document.querySelector(".talent-flow-canvas");
 if(wrap&&canvas&&wrap.clientWidth&&canvas.offsetWidth){
  const ww=wrap.clientWidth,wh=wrap.clientHeight||ww,cw=canvas.offsetWidth,ch=canvas.offsetHeight||cw;
  const s=clampTreeScale(Math.min(1,ww/cw,wh/ch)*.92);
  const dx=(ww-cw*s)/2,dy=Math.max(10,(wh-ch*s)/2);
  treeT.s=s;
  treeT.x=dx-canvas.offsetLeft;
  treeT.y=dy-canvas.offsetTop;
 }else{treeT.s=1;treeT.x=0;treeT.y=0}
 applyTreeTransform();
}

/* суммарные бонусы, урон и крит */
const MIN_LEVEL=1;
function baseDamageByLevel(level){return{grenade:Math.round(55*Math.pow(1.02,level)),gl:Math.round(113*Math.pow(1.02,level)),gauss:Math.round(360*Math.pow(1.02,level)),knife:Math.floor(45.85+1.15*level),pistol:Math.floor(47.8+1.2*level),auto:Math.floor(53.65+1.35*level)}}
function totals(){
 const total=Object.fromEntries(keys.map(k=>[k,0]));let critChance=0,critDamage=0,critGaussChance=0,critGrenadeChance=0,critGaussDamage=0,critGrenadeDamage=0,noCooldown=0,cooldown=0;
 const addBonuses=x=>{keys.forEach(k=>total[k]+=x.bonuses[k]||0);critChance+=x.critChance||0;critDamage+=x.critDamage||0;critGaussChance+=x.critGaussChance||0;critGrenadeChance+=x.critGrenadeChance||0;critGaussDamage+=x.critGaussDamage||0;critGrenadeDamage+=x.critGrenadeDamage||0;noCooldown+=x.freeNoCooldown||0;cooldown+=x.cooldown||0};
 state.sets.forEach(i=>addBonuses(SETS[i]));
 state.items.forEach(i=>addBonuses(ITEMS[i]));
 const t=talentTotals();keys.forEach(k=>total[k]+=t.total[k]);
 return{total,critChance:critChance+t.critChance,critDamage,critGaussChance,critGrenadeChance,critGaussDamage:critGaussDamage+t.critDamageByWeapon.gauss,critGrenadeDamage:critGrenadeDamage+t.critDamageByWeapon.grenade,critGlDamageTal:t.critDamageByWeapon.gl,noCooldown:noCooldown+t.noCooldown,cooldown:cooldown+t.cooldown};
}
function results(){
 const level=Math.max(1,Math.min(100,num("level"))),base=baseDamageByLevel(level),T=totals(),r={};
 keys.forEach(k=>r[k]=base[k]+T.total[k]);
 r.critGrenade=T.critChance+T.critGrenadeChance;r.critGl=T.critChance;r.critGauss=T.critChance+T.critGaussChance;
 r.critDmgGrenade=T.critDamage+T.critGrenadeDamage;r.critDmgGl=T.critDamage+T.critGlDamageTal;r.critDmgGauss=T.critDamage+T.critGaussDamage;
 r.noCooldown=T.noCooldown;r.cooldown=T.cooldown;r.firstFreeHit=talentTotals().firstFreeHit;
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

let currentTalentBranch="free_hits",selectedTalentCode=null,talentDetailOpen=false;
function renderTalents(){
 const branches=[{code:"free_hits",name:"Боевая подготовка",desc:"Ветка бесплатных ударов по боссам"},{code:"paid_hits",name:"Арсенал",desc:"Ветка платных ударов по боссам"}],branch=branches.find(b=>b.code===currentTalentBranch)||branches[0],talents=TALENTS.filter(t=>t[1]===branch.code);
 if(selectedTalentCode&&!talents.some(t=>t[0]===selectedTalentCode)){selectedTalentCode=null;talentDetailOpen=false}
 const pathSet=selectedTalentCode?talentAncestors(selectedTalentCode):new Set();
 const maxX=Math.max(0,...talents.map(t=>{const a=talents.filter(x=>x[4]===t[4]);return Math.abs((a.indexOf(t)-(a.length-1)/2)*164)})),graphWidth=Math.max(760,Math.ceil(maxX*2+100+40)),nodePos=new Map;
 talents.forEach(t=>{const a=talents.filter(x=>x[4]===t[4]),i=a.indexOf(t);nodePos.set(t[0],{x:graphWidth/2+(i-(a.length-1)/2)*164-50,y:28+(t[4]-1)*148})});
 const edges=talents.flatMap(t=>t[9].map(req=>{const a=nodePos.get(req),b=nodePos.get(t[0]);if(!a||!b)return"";const x1=a.x+50,y1=a.y+100,x2=b.x+50,y2=b.y,mid=(y1+y2)/2,met=talentRank(req)>=5,onPath=pathSet.has(t[0]),stroke=onPath?"#54bfff":met?"#d8d8d2":"rgba(190,190,184,.32)",width=onPath?2.6:met?2:1.35;return '<path d="M'+x1+" "+y1+" L "+x1+" "+mid+" L "+x2+" "+mid+" L "+x2+" "+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round"></path>'})).join("");
 const nodes=talents.map(t=>{const p=nodePos.get(t[0]),rank=talentRank(t[0]),status=talentNodeStatus(t);return '<button type="button" class="talent-node-game '+status+(t[0]===selectedTalentCode?" selected":"")+(pathSet.has(t[0])?" on-path":"")+'" data-select-talent="'+t[0]+'" style="left:'+p.x+"px;top:"+p.y+'px"><span class="talent-node-art">'+talentNodeIcon(t)+'</span><span class="talent-node-rank">'+rank+'/5</span></button>'}).join("");
 $("talentFlow").innerHTML='<div class="talent-flow-canvas" style="width:'+graphWidth+'px;height:760px"><svg class="talent-edge-layer" width="'+graphWidth+'" height="760" viewBox="0 0 '+graphWidth+' 760">'+edges+'</svg>'+nodes+'</div>';
 const spent=spentTalentPoints(),pct=Math.min(100,Math.round(spent/MAX_TALENT_POINTS*100));
 const last=lastTalentChange&&lastTalentChange.length?'<div class="talent-last"><small>Последнее изменение</small><div class="talent-last-list">'+lastTalentChange.map(c=>'<span class="'+(c.v>0?"up":"down")+'">'+c.l+' <b>'+fmtDelta(c.v,c.p)+'</b></span>').join("")+'</div></div>':"";
 /* кнопки в .talent-side-footer, на телефоне он липнет ко дну панели (styles.css) */
 $("talentSidebar").innerHTML='<div class="talent-side-title"><span>Таланты</span><b>'+spent+' / '+MAX_TALENT_POINTS+'</b></div><div class="talent-gauge" style="--pct:'+pct+'"><div class="talent-gauge-ticks"></div><div class="talent-gauge-value"><b>'+pct+'</b><small>%</small></div></div><div class="talent-side-stats"><div><b>'+Math.max(0,MAX_TALENT_POINTS-spent)+'</b><small>свободно</small></div><div><b>'+spent+'</b><small>распределено</small></div></div>'+last+'<div class="talent-branch-tabs">'+branches.map(b=>'<button type="button" class="'+(b.code===currentTalentBranch?"active":"")+'" data-talent-branch="'+b.code+'">'+b.name+'</button>').join("")+'</div><div class="talent-branch-description"><b>'+branch.name+'</b><span>'+branch.desc+'</span></div><div class="talent-side-hint">Нажми на узел дерева, чтобы открыть его описание и прокачку</div><div class="talent-side-footer"><button type="button" class="talent-hide" data-reset-talents '+(spent?"":"disabled")+'>↻ Сбросить таланты</button><button type="button" class="talent-hide" data-close-talents>← Скрыть</button></div>';
 const detailOverlay=$("talentDetailOverlay");
 if(talentDetailOpen&&selectedTalentCode){detailOverlay.innerHTML='<div class="talent-detail-backdrop" data-close-talent-detail></div><div class="talent-detail-modal">'+renderTalentDetails(talentDef(selectedTalentCode))+'<button type="button" class="talent-detail-close" data-close-talent-detail aria-label="Закрыть">×</button></div>';detailOverlay.classList.add("show")}
 else{detailOverlay.classList.remove("show");detailOverlay.innerHTML=""}
 $("modalSpentPoints").textContent=spent;$("modalMaxPoints").textContent=MAX_TALENT_POINTS;$("talentPointsBadge").textContent=spent+" / "+MAX_TALENT_POINTS;$("talentSummary").textContent=spent?"Распределено "+spent+" очков":"Очки не распределены";
 applyTreeTransform();
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
function renderTokens(){
 const tokens=tokenInt("tokenCount"),target=tokenInt("tokenTarget"),st=tokenWeaponStats();
 const best=Math.max(...st.map(w=>w.dmg/w.price)),bestCrit=Math.max(...st.map(w=>w.avg/w.price));
 const cell=(v,b)=>{const top=Math.abs(v-b)<1e-9;return '<td class="'+(top?"tok-best":"")+'">'+fmtD(v)+(top?" ★":"")+'</td>'};
 $("tokenBase").innerHTML=st.map(w=>'<tr><td>'+w.name+'</td><td>'+w.price+'</td><td>'+fmt(w.dmg)+'</td><td>'+(w.chance*100).toFixed(0)+'% / +'+fmt(w.bonus)+'</td><td class="tok-crit">'+fmt(w.avg)+'</td>'+cell(w.dmg/w.price,best)+cell(w.avg/w.price,bestCrit)+'</tr>').join("");
 $("tokenExpected").innerHTML=st.map(w=>{const shots=Math.floor(tokens/w.price);return '<tr><td>'+w.name+'</td><td>'+fmt(shots)+'</td><td>'+fmt(shots*w.dmg)+'</td><td class="tok-crit">'+fmt(shots*w.avg)+'</td></tr>'}).join("");
 $("tokenNeeded").innerHTML=st.map(w=>'<tr><td>'+w.name+'</td><td>'+fmt(Math.ceil(target/w.dmg)*w.price)+'</td><td class="tok-crit">'+fmt(Math.ceil(target/w.avg)*w.price)+'</td></tr>').join("");
}
function openTokens(){$("tokensModal").classList.add("show");$("tokensModal").setAttribute("aria-hidden","false");renderTokens()}
function closeTokens(){$("tokensModal").classList.remove("show");$("tokensModal").setAttribute("aria-hidden","true")}

/* карточки урона */
const CARDS={paid:[["grenade","Граната","grenade"],["gl","Гранатомёт","ubgl"],["gauss","Гаусс","gauss"]],free:[["knife","Нож","knife"],["pistol","Пистолет","pistol"],["auto","Автомат","rifle"]]};
function cardMarkup([k,name,icon],withCrit){
 const K=cap(k),cellHtml=(cls,label,id)=>'<div class="bd-cell '+cls+'"><small>'+label+'</small><em id="'+id+K+'">0</em></div>';
 return '<article class="damage-card"><div class="weapon-icon weapon-'+icon+'" aria-hidden="true"></div><div class="dmg-main"><h3>'+name+'</h3><strong id="result'+K+'">0</strong></div><i class="delta" id="delta'+K+'"></i><div class="breakdown">'+cellHtml("","База","base")+cellHtml("bd-level","Уровень","level")+cellHtml("bd-gear","Экипировка","gear")+cellHtml("bd-talent","Таланты","talentOut")+'</div>'+(withCrit?'<span class="crit-chip"><span class="crit-chip-label">Крит*</span><em id="crit'+K+'">0%</em><span class="crit-chip-sep">/</span><em id="critDmg'+K+'">0</em></span>':"")+'</article>';
}
function renderCards(){$("paidCards").innerHTML=CARDS.paid.map(c=>cardMarkup(c,true)).join("");$("freeCards").innerHTML=CARDS.free.map(c=>cardMarkup(c,false)).join("")}

function optionMarkup(arr,set,type){return arr.map((x,i)=>'<label class="option"><input type="checkbox" data-type="'+type+'" data-index="'+i+'" '+(set.has(i)?"checked":"")+'><span>'+x.name+'</span></label>').join("")}
function set(id,v){$(id).textContent=v}
function calc(){
 const level=Math.max(1,Math.min(100,num("level")));$("level").value=level;
 const T=totals(),tal=talentTotals().total,base=baseDamageByLevel(level),baseFlat=baseDamageByLevel(MIN_LEVEL),r=results();
 keys.forEach(k=>{const K=cap(k);set("base"+K,fmt(baseFlat[k]));set("level"+K,fmt(base[k]-baseFlat[k]));set("gear"+K,fmt(T.total[k]-tal[k]));set("talentOut"+K,fmt(tal[k]));set("result"+K,fmt(r[k]))});
 ["Grenade","Gl","Gauss"].forEach(K=>{set("crit"+K,(r["crit"+K]*100).toFixed(0)+"%");set("critDmg"+K,fmt(r["critDmg"+K]))});
 set("noCooldown",(r.noCooldown*100).toFixed(0)+"%");set("cooldown",(r.cooldown*100).toFixed(0)+"%");set("firstFreeHit","+"+(r.firstFreeHit*100).toFixed(0)+"%");
 if(prevResults){
  keys.forEach(k=>pulse("delta"+cap(k),r[k]-prevResults[k]));
  pulse("deltaNoCooldown",r.noCooldown-prevResults.noCooldown,true);pulse("deltaCooldown",r.cooldown-prevResults.cooldown,true);pulse("deltaFirstFreeHit",r.firstFreeHit-prevResults.firstFreeHit,true);
 }
 prevResults=r;
}
function render(){$("sets").innerHTML=optionMarkup(SETS,state.sets,"set");$("items").innerHTML=optionMarkup(ITEMS,state.items,"item");$("selectAllEquipment").checked=state.sets.size===SETS.length&&state.items.size===ITEMS.length;renderTalents();calc()}
function showToast(text){const t=$("toast");t.textContent=text||"В разработке";t.classList.add("show");clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove("show"),1800)}

/* билд в ссылке: уровень, снаряжение и таланты после # */
const toBits=s=>[...s].reduce((a,i)=>a|1<<i,0);
function buildHash(){const p=new URLSearchParams();p.set("l",String(Math.max(1,Math.min(100,num("level")))));p.set("s",String(toBits(state.sets)));p.set("i",String(toBits(state.items)));p.set("t",TALENTS.map(t=>talentRank(t[0])).join(""));return p.toString()}
function applyHash(){
 const h=location.hash.replace(/^#/,"");if(!h)return false;
 const p=new URLSearchParams(h);if(!p.has("t")&&!p.has("l")&&!p.has("s")&&!p.has("i"))return false;
 $("level").value=Math.max(1,Math.min(100,parseInt(p.get("l"),10)||1));
 const sm=parseInt(p.get("s"),10)||0,im=parseInt(p.get("i"),10)||0,ts=p.get("t")||"";
 state.sets.clear();state.items.clear();state.talents={};
 SETS.forEach((_,i)=>{if((sm>>i)&1)state.sets.add(i)});ITEMS.forEach((_,i)=>{if((im>>i)&1)state.items.add(i)});
 TALENTS.forEach((t,i)=>{const r=Math.max(0,Math.min(5,parseInt(ts[i],10)||0));if(r&&t[9].every(q=>talentRank(q)>=5))state.talents[t[0]]=r});
 history.replaceState(null,"",location.href.split("#")[0]);saveState();return true;
}
function fallbackCopy(s){const a=document.createElement("textarea");a.value=s;a.style.cssText="position:fixed;opacity:0";document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand("copy")}catch{}a.remove();return ok}
function copyText(s){return navigator.clipboard&&window.isSecureContext?navigator.clipboard.writeText(s).then(()=>true,()=>fallbackCopy(s)):Promise.resolve(fallbackCopy(s))}
function shareBuild(){copyText(location.href.split("#")[0]+"#"+buildHash()).then(ok=>showToast(ok?"Ссылка скопирована":"Не удалось скопировать"))}

document.addEventListener("click",e=>{
 const closeDetail=e.target.closest("[data-close-talent-detail]");if(closeDetail){talentDetailOpen=false;renderTalents();return}
 const up=e.target.closest("[data-talent-up]");if(up){changeTalent(up.dataset.talentUp,1);return}
 const branch=e.target.closest("[data-talent-branch]");if(branch){currentTalentBranch=branch.dataset.talentBranch;selectedTalentCode=null;talentDetailOpen=false;renderTalents();resetTreeTransform();return}
 const select=e.target.closest("[data-select-talent]");if(select){selectedTalentCode=select.dataset.selectTalent;talentDetailOpen=true;renderTalents();return}
 const down=e.target.closest("[data-talent-down]");if(down){changeTalent(down.dataset.talentDown,-1);return}
 if(e.target.closest("#openTalents")){openTalents();return}
 if(e.target.closest("[data-reset-talents]")){resetTalents();return}
 if(e.target.closest("[data-close-talents]")){closeTalents();return}
 if(e.target.closest("#openGearInfo")){openGearInfo();return}
 if(e.target.closest("[data-close-gear-info]")){closeGearInfo();return}
 if(e.target.closest("#openTokens")){openTokens();return}
 if(e.target.closest("[data-close-tokens]")){closeTokens();return}
 if(e.target.closest("#shareBuild")){shareBuild();return}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(talentDetailOpen){talentDetailOpen=false;renderTalents()}else if($("tokensModal").classList.contains("show")){closeTokens()}else if($("gearInfoModal").classList.contains("show")){closeGearInfo()}else closeTalents()}});
document.addEventListener("change",e=>{const i=e.target;if(!i.matches("[data-type]"))return;const s=i.dataset.type==="set"?state.sets:state.items,n=Number(i.dataset.index);i.checked?s.add(n):s.delete(n);saveState();render()});
document.addEventListener("click",e=>{const b=e.target.closest("[data-step]");if(!b)return;const input=$(b.dataset.step),dir=Number(b.dataset.dir)||0,min=Number(input.min)||0,max=Number(input.max)||999;input.value=Math.min(max,Math.max(min,(Number(input.value)||0)+dir));saveState();calc()});
$("selectAllEquipment").addEventListener("change",e=>{state.sets.clear();state.items.clear();if(e.target.checked){SETS.forEach((_,i)=>state.sets.add(i));ITEMS.forEach((_,i)=>state.items.add(i))}saveState();render()});
$("level").addEventListener("input",()=>{saveState();calc()});
$("resetAll").onclick=()=>{if(!confirm("Точно сбросить весь прогресс — уровень, снаряжение и все очки талантов?"))return;state.sets.clear();state.items.clear();state.talents={};lastTalentChange=null;$("level").value=1;saveState();render()};

/* pinch-zoom и сдвиг дерева (тач) */
const distTouch=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
const midTouch=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});
let touchState=null;
document.addEventListener("touchstart",e=>{
 const wrap=e.target.closest(".talent-flow-wrap");if(!wrap)return;
 if(e.touches.length===1)touchState={mode:"pan",lastX:e.touches[0].clientX,lastY:e.touches[0].clientY};
 else if(e.touches.length===2)touchState={mode:"pinch",lastDist:distTouch(e.touches[0],e.touches[1])};
},{passive:true});
document.addEventListener("touchmove",e=>{
 if(!touchState)return;const wrap=e.target.closest(".talent-flow-wrap");if(!wrap)return;
 if(touchState.mode==="pan"&&e.touches.length===1){
  const dx=e.touches[0].clientX-touchState.lastX,dy=e.touches[0].clientY-touchState.lastY;
  treeT.x+=dx;treeT.y+=dy;touchState.lastX=e.touches[0].clientX;touchState.lastY=e.touches[0].clientY;
  applyTreeTransform();e.preventDefault();
 }else if(touchState.mode==="pinch"&&e.touches.length===2){
  const rect=wrap.getBoundingClientRect(),mid=midTouch(e.touches[0],e.touches[1]),d=distTouch(e.touches[0],e.touches[1]);
  const canvasX=(mid.x-rect.left-treeT.x)/treeT.s,canvasY=(mid.y-rect.top-treeT.y)/treeT.s;
  const newScale=clampTreeScale(treeT.s*(d/touchState.lastDist));
  treeT.x=mid.x-rect.left-canvasX*newScale;treeT.y=mid.y-rect.top-canvasY*newScale;treeT.s=newScale;touchState.lastDist=d;
  applyTreeTransform();e.preventDefault();
 }
},{passive:false});
document.addEventListener("touchend",e=>{
 const wrap=e.target.closest(".talent-flow-wrap");
 if(wrap&&e.touches.length===1)touchState={mode:"pan",lastX:e.touches[0].clientX,lastY:e.touches[0].clientY};
 else touchState=null;
});

/* сдвиг мышью, зум колесом */
let dragState=null;
document.addEventListener("mousedown",e=>{
 const wrap=e.target.closest(".talent-flow-wrap");if(!wrap||e.target.closest(".talent-node-game"))return;
 dragState={x:e.clientX,y:e.clientY};wrap.style.cursor="grabbing";
});
document.addEventListener("mousemove",e=>{
 if(!dragState)return;
 treeT.x+=e.clientX-dragState.x;treeT.y+=e.clientY-dragState.y;dragState={x:e.clientX,y:e.clientY};
 applyTreeTransform();
});
document.addEventListener("mouseup",()=>{if(dragState){dragState=null;const wrap=document.querySelector(".talent-flow-wrap");if(wrap)wrap.style.cursor="grab"}});
document.addEventListener("wheel",e=>{
 const wrap=e.target.closest(".talent-flow-wrap");if(!wrap)return;
 e.preventDefault();const rect=wrap.getBoundingClientRect();
 if(e.ctrlKey){
  const canvasX=(e.clientX-rect.left-treeT.x)/treeT.s,canvasY=(e.clientY-rect.top-treeT.y)/treeT.s;
  const newScale=clampTreeScale(treeT.s*(1-e.deltaY*.01));
  treeT.x=e.clientX-rect.left-canvasX*newScale;treeT.y=e.clientY-rect.top-canvasY*newScale;treeT.s=newScale;
 }else{treeT.x-=e.deltaX;treeT.y-=e.deltaY}
 applyTreeTransform();
},{passive:false});

["tokenCount","tokenTarget"].forEach(id=>$(id).addEventListener("input",()=>{saveTokens();renderTokens()}));
renderCards();loadState();loadTokens();
const openedFromLink=applyHash();
render();
if(openedFromLink)showToast("Открыт билд по ссылке");
