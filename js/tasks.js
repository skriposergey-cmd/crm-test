/* ═══════ ЗАДАЧІ (tasks.js) ═══════
   Вкладка задач. Містить renderers.tasks = ..., тому підключається
   ПІСЛЯ основного <script>. Залежить від глобальних: TASKS, API_URL,
   formatDeadlineDate, renderers. */

/* ═══════════════ ВКЛАДКА ЗАДАЧІ ═══════════════ */
let taskAddOrder = "";

renderers.tasks = function() {
  const page = document.getElementById("page-tasks");
  let active = TASKS.filter(t => t["Статус"] !== "так");
  const done = TASKS.filter(t => t["Статус"] === "так");

  // Сортування активних задач: спочатку прострочені, потім за найближчим дедлайном, без дедлайну — в кінці
  function sortKey(t) {
    const d = parseDeadline(t["Дедлайн"]);
    return d ? d.getTime() : Infinity;
  }
  active = active.sort((a,b) => sortKey(a) - sortKey(b));

  function isOverdue(t) {
    if (t["Статус"] === "так") return false;
    const d = parseDeadline(t["Дедлайн"]);
    if (!d) return false;
    const now = new Date(); now.setHours(0,0,0,0);
    return d.getTime() < now.getTime();
  }

  function taskRow(t) {
    const isDone = t["Статус"] === "так";
    const overdue = isOverdue(t);
    const num = t["Замовлення"];
    const order = num ? "<span class='task-order' onclick=\"openOrder('" + num + "')\">" + num + "</span>" : "";
    const deadline = t["Дедлайн"] ? "<span class='task-deadline" + (overdue?" overdue":"") + "'>" + (overdue?"⚠ ":"") + t["Дедлайн"] + "</span>" : "";
    const created = (t["Створено"]||"").replace(/"/g,"&quot;");
    const txt = (t["Текст"]||"").replace(/"/g,"&quot;");
    return "<div class='task-row" + (isDone?" done":"") + (overdue?" overdue-row":"") + "'>" +
      "<span class='task-check" + (isDone?" on":"") + "' onclick=\"toggleTask('" + txt.replace(/'/g,"\\'") + "','" + created.replace(/'/g,"\\'") + "'," + (!isDone) + ")\">" + (isDone?"✓":"") + "</span>" +
      "<span class='task-text'>" + t["Текст"] + order + deadline + "</span>" +
      "<button class='task-del' onclick=\"deleteTask('" + txt.replace(/'/g,"\\'") + "','" + created.replace(/'/g,"\\'") + "')\">×</button>" +
    "</div>";
  }

  const orderChip = taskAddOrder ?
    "<span class='task-order-chip'>" + taskAddOrder + "<button onclick='clearTaskOrder()'>×</button></span>" : "";

  page.innerHTML =
    groupSwitcher("planning") +
    "<div class='page-header'><div class='page-title'>Задачі</div></div>" +
    "<div class='tab-scroll'>" +
      "<div class='task-add-form'>" +
        "<div class='task-field-label'>Що потрібно зробити</div>" +
        "<input class='cr-input' id='task-input' placeholder='Наприклад: передзвонити клієнту, замовити фурнітуру' style='margin-bottom:0' onkeydown='if(event.key===\"Enter\")addTask()'>" +
        "<div class='task-add-row'>" +
          "<div class='task-order-search'>" +
            "<div class='task-field-label'>Замовлення (необов'язково)</div>" +
            "<input class='ic-mini' id='task-order-input' placeholder='Введи номер або ім\\'я клієнта' autocomplete='off' oninput='filterTaskOrders(this.value)' onfocus='filterTaskOrders(this.value)'>" +
            "<div class='ic-dd' id='task-order-dd'></div>" +
            orderChip +
          "</div>" +
          "<div style='max-width:170px'>" +
            "<div class='task-field-label'>До якої дати</div>" +
            "<input class='ic-mini' id='task-deadline-input' type='date'>" +
          "</div>" +
          "<div><div class='task-field-label'>&nbsp;</div><button class='task-add-btn' onclick='addTask()'>+</button></div>" +
        "</div>" +
      "</div>" +
      (active.length ? active.map(taskRow).join("") : "<div style='color:var(--txt-3);font-size:13px;padding:20px 0;text-align:center'>Немає активних задач</div>") +
      (done.length ? "<div class='task-done-label'>Виконані</div>" + done.map(taskRow).join("") : "") +
    "</div>";
};

function filterTaskOrders(q) {
  q = (q||"").trim().toLowerCase();
  const dd = document.getElementById("task-order-dd");
  if (!dd) return;
  if (!q) { dd.classList.remove("open"); return; }
  const matches = ORDERS.filter(o =>
    gv(o,"Номер замовлення").toLowerCase().includes(q) || gv(o,"Ім'я клієнта").toLowerCase().includes(q)
  ).slice(0, 6);
  if (!matches.length) { dd.innerHTML = "<div class='ic-opt'><span class='o-empty'>Нічого не знайдено</span></div>"; dd.classList.add("open"); return; }
  dd.innerHTML = matches.map(o => {
    const num = gv(o,"Номер замовлення");
    return "<div class='ic-opt' onclick=\"pickTaskOrder('" + num + "')\"><span class='o-name'>" + num + " · " + gv(o,"Ім'я клієнта") + "</span></div>";
  }).join("");
  dd.classList.add("open");
}
function pickTaskOrder(num) {
  taskAddOrder = num;
  document.getElementById("task-order-dd").classList.remove("open");
  renderers.tasks();
}
function clearTaskOrder() { taskAddOrder = ""; renderers.tasks(); }

async function addTask() {
  const input = document.getElementById("task-input");
  let text = input.value.trim();
  const order = taskAddOrder;
  if (!text) {
    if (order) {
      text = "Нагадування по замовленню " + order;
    } else {
      toast("Введи, що потрібно зробити");
      return;
    }
  }
  const deadlineRaw = document.getElementById("task-deadline-input").value;
  const deadline = deadlineRaw ? formatDeadlineDate(deadlineRaw) : "";
  const created = new Date().toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric"}) + " " + new Date().toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"});
  TASKS.push({ "Текст": text, "Замовлення": order, "Статус": "ні", "Створено": created, "Виконано": "", "Дедлайн": deadline });
  input.value = "";
  taskAddOrder = "";
  renderers.tasks();
  try {
    await fetch(API_URL.replace("/order","/task"), {
      method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ text: text, order: order, deadline: deadline })
    });
  } catch(e) { console.error("task add failed", e); }
}

async function toggleTask(text, created, done) {
  const t = TASKS.find(x => x["Текст"] === text && x["Створено"] === created);
  if (t) { t["Статус"] = done ? "так" : "ні"; }
  renderers.tasks();
  try {
    await fetch(API_URL.replace("/order","/task/toggle"), {
      method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ text: text, created: created, done: done })
    });
  } catch(e) { console.error("task toggle failed", e); }
}

async function deleteTask(text, created) {
  TASKS = TASKS.filter(x => !(x["Текст"] === text && x["Створено"] === created));
  renderers.tasks();
  try {
    await fetch(API_URL.replace("/order","/task/delete"), {
      method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ text: text, created: created })
    });
  } catch(e) { console.error("task delete failed", e); }
}
