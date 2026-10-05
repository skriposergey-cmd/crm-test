/* ═══════ КАЛЕНДАР — СТОРІНКА (calendar.js) ═══════
   Сторінка календаря. Містить renderers.calendar = ..., тому
   підключається ПІСЛЯ основного <script>.
   Стан (calMonth/calYear/calFilter) та гелпери залишаються в index.html. */

function calendarEvents() {  const events = [];
  if (calFilter === "all" || calFilter === "orders") {
    ORDERS.forEach(o => {
      const d = parseDeadline(gv(o,"Термін"));
      if (!d) return;
      const num = gv(o,"Номер замовлення");
      const st = getStatus(num);
      const done = st === "issued";
      const now = new Date(); now.setHours(0,0,0,0);
      events.push({
        type: "order", date: d, done: done,
        late: !done && d < now,
        title: num + " " + (gv(o,"Ім'я клієнта") || ""),
        sub: orderServices(num),
        ref: num
      });
    });
  }
  if (calFilter === "all" || calFilter === "tasks") {
    TASKS.forEach(t => {
      const d = parseDeadline(t["Дедлайн"]);
      if (!d) return;
      const done = t["Статус"] === "так";
      const now = new Date(); now.setHours(0,0,0,0);
      events.push({
        type: "task", date: d, done: done,
        late: !done && d < now,
        title: t["Текст"],
        sub: t["Замовлення"] ? t["Замовлення"] : "",
        ref: t["Замовлення"] || ""
      });
    });
  }
  if (calFilter === "all" || calFilter === "tailor") {
    TAILOR.forEach(t => {
      const d = parseDeadline(gv(t,"Термін"));
      if (!d) return;
      const done = gv(t,"Статус") === "📦 Виданий";
      const now = new Date(); now.setHours(0,0,0,0);
      events.push({
        type: "tailor", date: d, done: done,
        late: !done && d < now,
        title: gv(t,"Номер") + " " + (gv(t,"Виріб") || ""),
        sub: gv(t,"Ім'я клієнта"),
        ref: gv(t,"Номер")
      });
    });
  }
  return events;
}

renderers.calendar = function() {
  const page = document.getElementById("page-calendar");
  const events = calendarEvents();
  const today = new Date(); today.setHours(0,0,0,0);

  // Перший день сітки (понеділок тижня, в якому 1-е число)
  const first = new Date(calYear, calMonth, 1);
  let startOffset = (first.getDay() + 6) % 7; // Пн = 0
  const gridStart = new Date(calYear, calMonth, 1 - startOffset);

  let cells = "";
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const inMonth = d.getMonth() === calMonth;
    const isToday = sameDay(d, today);
    const dayEvents = events.filter(e => sameDay(e.date, d));
    const evHTML = dayEvents.slice(0, 3).map(e =>
      "<div class='cal-ev " + (e.late ? "late" : e.type) + "'>" + (e.done ? "✓ " : "") + e.title + "</div>"
    ).join("");
    const more = dayEvents.length > 3 ? "<div class='cal-more'>+" + (dayEvents.length - 3) + " ще</div>" : "";
    const load = inMonth ? dayLoad(d) : 0;
    const loadBadge = (inMonth && DAILY_CAP && load > 0)
      ? "<span class='cal-load " + loadLevel(load) + "'>" + load + "</span>" : "";
    cells += "<div class='cal-cell" + (inMonth ? "" : " other") + (isToday ? " today" : "") + "' onclick=\"openCalDay('" + localISO(d) + "')\">" +
      "<div class='cal-dayhead'><span class='cal-daynum'>" + d.getDate() + "</span>" + loadBadge + "</div>" + evHTML + more + "</div>";
  }

  const dowHTML = DOW_NAMES.map(n => "<div class='cal-dow'>" + n + "</div>").join("");
  const filterBtn = (k, label) =>
    "<button class='mt-btn" + (calFilter===k?" active":"") + "' onclick=\"setCalFilter('" + k + "')\">" + label + "</button>";

  page.innerHTML =
    groupSwitcher("planning") +
    "<div class='page-header'><div class='page-title'>Календар</div></div>" +
    "<div class='tab-scroll'>" +
      "<div class='cal-head'>" +
        "<button class='cal-nav-btn' onclick='calShift(-1)'>‹</button>" +
        "<span class='cal-month'>" + MONTH_NAMES[calMonth] + " " + calYear + "</span>" +
        "<button class='cal-nav-btn' onclick='calShift(1)'>›</button>" +
        "<button class='cal-today-btn' onclick='calToday()'>Сьогодні</button>" +
        "<div class='cal-filters'>" + filterBtn("all","Все") + filterBtn("orders","Ремонт") + filterBtn("tailor","Виготовлення") + filterBtn("tasks","Задачі") + "</div>" +
      "</div>" +
      "<div class='cal-grid'>" + dowHTML + cells + "</div>" +
    "</div>";
};

function calShift(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderers.calendar();
}
function calToday() {
  const n = new Date();
  calMonth = n.getMonth(); calYear = n.getFullYear();
  renderers.calendar();
}
function setCalFilter(k) { calFilter = k; renderers.calendar(); }

/* Перегляд конкретного дня — у модалці */
function openCalDay(iso) {
  const d = new Date(iso + "T00:00:00");
  const events = calendarEvents().filter(e => sameDay(e.date, d));
  const body = document.getElementById("odm-body");
  const dateLabel = d.getDate() + " " + MONTH_NAMES[d.getMonth()].toLowerCase() + " " + d.getFullYear();

  const list = events.length ? events.map(e =>
    "<div class='cal-day-item'" + (e.ref && e.type === "order" ? " onclick=\"openOrder('" + e.ref + "')\"" : (e.ref && e.type === "tailor" ? " onclick=\"openTailor('" + e.ref + "')\"" : "")) + ">" +
      "<span class='cal-tag " + e.type + "'>" + (e.type === "order" ? "Ремонт" : e.type === "tailor" ? "Виготовлення" : "Задача") + "</span>" +
      "<div style='flex:1'><div class='cal-day-txt'>" + (e.done ? "✓ " : "") + e.title + "</div>" +
        (e.sub ? "<div class='cal-day-sub'>" + e.sub + "</div>" : "") + "</div>" +
      (e.late ? "<span class='badge b-postponed'>Прострочено</span>" : "") +
    "</div>"
  ).join("") : "<div class='orders-empty'>На цей день нічого не заплановано</div>";

  body.innerHTML =
    "<div class='detail-top'><span class='detail-title'>" + dateLabel + "</span></div>" +
    "<div class='cal-day-list'>" + list + "</div>";
  document.getElementById("odm-bg").classList.add("open");
}
