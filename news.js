/* «Новости Зоны» на главной: короткие новости игры со ссылкой на пост в группе ВК.
   Как добавить новость: вставьте строку В НАЧАЛО списка (самая свежая - первая) и сохраните файл.
   date  - дата в формате ГГГГ-ММ-ДД
   title - короткий заголовок (до ~60 символов)
   text  - пара слов о сути (до ~120 символов)
   url   - ссылка на пост ВК (кнопка «Читать в ВК»)
   На главной видно 3 последние новости, остальные - по кнопке «Все новости». */
window.ZONE_NEWS=[
 {date:"2026-10-09",title:"Скоро Хэллоуин в Зоне",text:"Готовится осенний ивент ко Дню всех святых - следите за анонсами",url:"https://vk.ru/theheartzone"}
];

(function(){
 const root=document.getElementById("zoneNews");
 const list=Array.isArray(window.ZONE_NEWS)?window.ZONE_NEWS.filter(n=>n&&n.title&&n.url):[];
 if(!root||!list.length)return;
 const SHOW=3,FRESH_DAYS=3;
 const MONTHS=["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
 const fmt=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(d||"");return m?+m[3]+" "+MONTHS[m[2]-1]:esc(d||"")};
 const now=Date.now();
 const fresh=d=>{const t=Date.parse(d);return t&&now-t<FRESH_DAYS*864e5&&t<=now+864e5};
 const item=(n,i)=>'<li class="zn-item'+(i>=SHOW?' zn-more':'')+'">'+
  '<div class="zn-meta"><time datetime="'+esc(n.date)+'">'+fmt(n.date)+'</time>'+(fresh(n.date)?'<span class="zn-new">NEW</span>':'')+'</div>'+
  '<b class="zn-title">'+esc(n.title)+'</b>'+
  (n.text?'<p class="zn-text">'+esc(n.text)+'</p>':'')+
  '<a class="zn-link" href="'+esc(n.url)+'" target="_blank" rel="noopener noreferrer">Читать в ВК<span class="sr-only">: '+esc(n.title)+'</span>'+
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a></li>';
 root.innerHTML='<div class="news-title"><span class="news-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 13v8M9 21h6"/><circle cx="12" cy="11" r="2"/><path d="M8.5 7.5a5 5 0 0 0 0 7M15.5 7.5a5 5 0 0 1 0 7M5.6 4.6a9 9 0 0 0 0 12.8M18.4 4.6a9 9 0 0 1 0 12.8"/></svg></span><h2>Новости Зоны</h2></div>'+
  '<ol class="zn-list" id="zoneNewsList">'+list.map(item).join("")+'</ol>'+
  (list.length>SHOW?'<button type="button" class="news-toggle zn-toggle" aria-expanded="false" aria-controls="zoneNewsList"><span>Все новости</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>':'');
 const btn=root.querySelector?root.querySelector(".zn-toggle"):null;
 if(btn&&btn.addEventListener)btn.addEventListener("click",()=>{
  const open=root.classList.toggle("open");
  btn.setAttribute("aria-expanded",open);
  btn.querySelector("span").textContent=open?"Свернуть":"Все новости";
 });
})();
