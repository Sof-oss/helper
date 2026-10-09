/* «Что нового?» на главной.
   Новая запись - в начало списка. date - ГГГГ-ММ-ДД, items - пункты: [тип, текст], тип: new - новое, up - улучшено, fix - исправлено.
   В тексте можно ставить ссылки: <a href="/top100">Топ-100</a>.
   Или без правки этого файла: строки «new: …», «up: …», «fix: …» в описании коммита добавляются сюда
   автоматически при сборке сайта - см. build-changelog.js.
   Посетитель, который ещё не видел верхнюю запись, увидит у заголовка метку «NEW». */
window.CHANGELOG=[
 {date:"2026-10-06",title:"Темы «Рассвет» и «Вольные сталкеры»",items:[
  ["new","Два новых оформления: «Рассвет» и «Вольные сталкеры» - со своими фонами, цветами и каноничными нашивками"],
  ["new",'В <a href="/top100">Топ-100</a> у игроков этих группировок в карточке теперь своя нашивка и фото базы']
 ]},
 {date:"2026-10-06",title:"«Личное дело» игрока",items:[
  ["new","Карточка игрока оформлена как «ПДА // Личное дело»: нашивка группировки, звание по уровню и фото базы в шапке"],
  ["new","Нашивки за места в рейтингах"],
  ["new","У ссылки на карточку в мессенджерах и соцсетях появилась картинка-превью"],
  ["up","Смена ника больше не разрывает историю игрока в рейтинге"]
 ]},
 {date:"2026-10-06",title:"Скорость и стабильность",items:[
  ["up",'<a href="/calculator">Калькулятор</a> открывается быстрее'],
  ["up","3D-заставка и живой фон на главной больше не замедляют открытие страницы и не мешают нажимать кнопки"],
  ["fix",'Отправка <a href="/guides">гайдов</a> с картинками стабильно работает у всех российских провайдеров']
 ]},
 {date:"2026-10-06",title:"Гайды от игроков",items:[
  ["new",'Открылся раздел <a href="/guides">Гайды</a>: любой игрок может написать гайд с картинками и отправить его на сайт'],
  ["new","После проверки гайд публикуется с подписью автора"]
 ]},
 {date:"2026-10-06",title:"Карточки игроков",items:[
  ["new",'В <a href="/top100">Топ-100</a> по нажатию на ник открывается карточка игрока: все показатели, места во всех рейтингах, прирост за период и графики'],
  ["new","Поиск любого игрока по нику, история группировок и смены ника, разбивка по боссам"],
  ["new","Ссылкой на карточку можно поделиться"]
 ]},
 {date:"2026-10-06",title:"Прогресс из калькулятора",items:[
  ["new",'В <a href="/info">Информации</a> полученные уровни персонажа и талантов отмечаются по данным калькулятора'],
  ["new","На главной появился блок «Что нового?»"],
  ["new",'В <a href="/info">Заданиях</a> появился калькулятор энергии: сколько ресурсов даст энергия на локации и во сколько жетонов обойдутся энергетики']
 ]},
 {date:"2026-10-05",title:"Отряды в Топ-100",items:[
  ["new",'В <a href="/top100">Топ-100</a> у ников цветные точки группировок и фильтр по отрядам'],
  ["up","Плашки отрядов на каждой вкладке идут по числу участников"],
  ["fix","На телефоне изменение места больше не наезжает на ник"]
 ]},
 {date:"2026-10-04",title:"Редизайн «ПДА сталкера»",items:[
  ["new","Новый облик сайта: тактические рамки, трафаретные заголовки, живой 3D-фон на главной"],
  ["new","В Топ-100 можно выбрать период, за который показываются изменения"]
 ]},
 {date:"2026-10-03",title:"Темы группировок",items:[
  ["new","Оформление в цветах Наёмников, Долга, Свободы, Учёных или Монолита"],
  ["new","В Топ-100 видно, на сколько мест поднялся или опустился игрок, а новички помечены NEW"]
 ]},
 {date:"2026-10-02",title:"Обмен билдами",items:[
  ["new",'<a href="/calculator">Калькулятором</a> можно поделиться ссылкой на свой билд и сравнить его с чужим']
 ]},
 {date:"2026-09-30",title:"Сортировка в Топ-100",items:[
  ["up","Рейтинг можно отсортировать по уровню игрока"]
 ]},
 {date:"2026-09-29",title:"Задания",items:[
  ["new","В Информации появился раздел «Задания»: награды, затраты энергии и выгода по локациям"]
 ]},
 {date:"2026-09-26",title:"Топ-100",items:[
  ["new","Рейтинг лучших сталкеров по семи разделам"]
 ]},
 {date:"2026-09-23",title:"Запуск сайта",items:[
  ["new","Калькулятор урона с древом талантов и справочные таблицы по уровням"]
 ]}
];

(function(){
 const root=document.getElementById("homeNews");
 if(!root||!Array.isArray(window.CHANGELOG)||!window.CHANGELOG.length)return;
 const SEEN_KEY="gameHelperNewsSeen";
 const TYPES={new:"Новое",up:"Улучшено",fix:"Исправлено"};
 const MONTHS=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
 const fmtDate=d=>{const[y,m,day]=d.split("-").map(Number);return day+" "+MONTHS[m-1]+" "+y};
 const list=window.CHANGELOG,latest=list[0].date;
 /* компактно: последняя запись целиком (до ITEMS пунктов), ещё COMPACT записей - одной строкой «дата + заголовок»,
    раскрываются по нажатию; остальное - под кнопкой «Вся история» */
 const COMPACT=2,ITEMS=3;
 const plural=n=>n%10==1&&n%100!=11?"изменение":n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?"изменения":"изменений";
 const entry=(e,i)=>{
  const compact=i>0,cls="news-entry"+(compact?" news-compact":"")+(i>COMPACT?" news-more":"");
  const head=compact
   ?'<button type="button" class="news-head" aria-expanded="false"><time datetime="'+e.date+'">'+fmtDate(e.date)+'</time><b>'+e.title+'</b><span class="news-count">'+e.items.length+" "+plural(e.items.length)+'</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>'
   :'<div class="news-head"><time datetime="'+e.date+'">'+fmtDate(e.date)+'</time><b>'+e.title+'</b></div>';
  const items=e.items.map(([t,text],k)=>'<li'+(!compact&&k>=ITEMS?' class="news-extra"':'')+'><span class="news-tag news-tag-'+t+'">'+(TYPES[t]||t)+'</span><span>'+text+'</span></li>').join("");
  const more=!compact&&e.items.length>ITEMS?'<button type="button" class="news-extra-btn">Ещё '+(e.items.length-ITEMS)+'</button>':'';
  return '<li class="'+cls+'">'+head+'<ul class="news-items">'+items+'</ul>'+more+'</li>';
 };
 let seen="";try{seen=localStorage.getItem(SEEN_KEY)||""}catch{}
 root.innerHTML='<div class="news-title"><span class="news-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.2"/></svg></span><h2>Что нового?</h2>'+
  (seen&&seen<latest?'<span class="news-badge">NEW</span>':'')+'</div>'+
  '<ol class="news-list" id="homeNewsList">'+list.map(entry).join("")+'</ol>'+
  (list.length>COMPACT+1?'<button type="button" class="news-toggle" aria-expanded="false" aria-controls="homeNewsList"><span>Вся история</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>':'');
 /* первый визит тоже запоминаем: метку NEW покажем, когда появится следующая запись */
 try{if(seen!==latest)localStorage.setItem(SEEN_KEY,latest)}catch{}
 const btn=root.querySelector(".news-toggle");
 if(btn&&btn.addEventListener)btn.addEventListener("click",()=>{
  const open=root.classList.toggle("open");
  btn.setAttribute("aria-expanded",open);
  btn.querySelector("span").textContent=open?"Свернуть":"Вся история";
 });
 /* раскрыть одну запись или остаток пунктов последней */
 if(root.addEventListener)root.addEventListener("click",ev=>{
  const t=ev.target&&ev.target.closest?ev.target.closest(".news-compact > .news-head, .news-extra-btn"):null;
  if(!t)return;
  const li=t.closest(".news-entry");
  if(t.classList.contains("news-extra-btn")){li.classList.add("show-all");t.remove();return}
  const on=li.classList.toggle("expanded");
  t.setAttribute("aria-expanded",on);
 });
})();
