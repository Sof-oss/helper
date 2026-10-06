/* «Что нового?» на главной.
   Новая запись — в начало списка. date — ГГГГ-ММ-ДД, items — пункты: [тип, текст], тип: new — новое, up — улучшено, fix — исправлено.
   В тексте можно ставить ссылки: <a href="/top100">Топ-100</a>.
   Посетитель, который ещё не видел верхнюю запись, увидит у заголовка метку «NEW». */
window.CHANGELOG=[
 {date:"2026-10-07",title:"Гайды от игроков",items:[
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
 const SEEN_KEY="gameHelperNewsSeen",SHOW=3;
 const TYPES={new:"Новое",up:"Улучшено",fix:"Исправлено"};
 const MONTHS=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
 const fmtDate=d=>{const[y,m,day]=d.split("-").map(Number);return day+" "+MONTHS[m-1]+" "+y};
 const list=window.CHANGELOG,latest=list[0].date;
 const entry=(e,i)=>'<li class="news-entry'+(i>=SHOW?' news-more':'')+'"><div class="news-head"><time datetime="'+e.date+'">'+fmtDate(e.date)+'</time><b>'+e.title+'</b></div><ul class="news-items">'+
  e.items.map(([t,text])=>'<li><span class="news-tag news-tag-'+t+'">'+(TYPES[t]||t)+'</span><span>'+text+'</span></li>').join("")+'</ul></li>';
 let seen="";try{seen=localStorage.getItem(SEEN_KEY)||""}catch{}
 root.innerHTML='<div class="news-title"><span class="news-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.2"/></svg></span><h2>Что нового?</h2>'+
  (seen&&seen<latest?'<span class="news-badge">NEW</span>':'')+'</div>'+
  '<ol class="news-list" id="homeNewsList">'+list.map(entry).join("")+'</ol>'+
  (list.length>SHOW?'<button type="button" class="news-toggle" aria-expanded="false" aria-controls="homeNewsList"><span>Вся история</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>':'');
 /* первый визит тоже запоминаем: метку NEW покажем, когда появится следующая запись */
 try{if(seen!==latest)localStorage.setItem(SEEN_KEY,latest)}catch{}
 const btn=root.querySelector(".news-toggle");
 if(btn&&btn.addEventListener)btn.addEventListener("click",()=>{
  const open=root.classList.toggle("open");
  btn.setAttribute("aria-expanded",open);
  btn.querySelector("span").textContent=open?"Свернуть":"Вся история";
 });
})();
