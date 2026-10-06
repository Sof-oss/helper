/* Точка входа калькулятора (calculator.html). build.js собирает отсюда один файл dist/calculator.js.
   Порядок важен: сначала app.js (расчёт и интерфейс, внутри берёт таланты из talents.js),
   потом polish.js — дорисовывает полосы урона, плитки снаряжения и окно бонусов */
import "../app.js";
import "../polish.js";
