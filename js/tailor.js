/* ═══════ ПОШИВ / ВИГОТОВЛЕННЯ (tailor.js) ═══════
   Модуль виготовлення. Містить renderers.tailor = ..., тому підключається
   наприкінці, після основного коду. Стан TL/tailorFilter тут.
   Залежить від глобальних: TAILOR, PARTNERS, gv, extractAmt, esc, toast,
   photoImgHTML, formatDeadlineDate, ddmmToISO, deadlineHintHTML, renderDeadlineHint, renderers. */

const TAILOR_STATUSES = [
  ["🆕 Новий", "Прийнято", "#378ADD"],
  ["⚙️ В роботі", "В роботі", "#EF9F27"],
  ["✅ Готово", "Готово", "#639922"],
  ["📦 Виданий", "Видано", "#B4B2A9"]
];
let tailorFilter = "all";

function tailorStatusIdx(s) {
  if (s === "📦 Виданий") return 3;
  if (s === "✅ Готово") return 2;
  if (s === "⚙️ В роботі") return 1;
  return 0;
}
function tailorBadge(s) {
  const i = tailorStatusIdx(s);
  const cls = ["b-new","b-work","b-ready","b-issued"][i];
  return "<span class='badge " + cls + "'>" + TAILOR_STATUSES[i][1] + "</span>";
}

renderers.tailor = function() {
  const page = document.getElementById("page-tailor");
  let list = TAILOR.slice().reverse().filter(t => !gv(t,"Примітка").startsWith("[ВИДАЛЕНО] "));
  if (tailorFilter !== "all") {
    list = list.filter(t => tailorStatusIdx(gv(t,"Статус")) === parseInt(tailorFilter));
  }

  const counts = { all: list.length, 0:0, 1:0, 2:0, 3:0 };
  TAILOR.forEach(t => { if (!gv(t,"Примітка").startsWith("[ВИДАЛЕНО] ")) counts[tailorStatusIdx(gv(t,"Статус"))]++; });
  const tabs = [["all","Всі"],["0","Нові"],["1","В роботі"],["2","Готові"],["3","Видані"]].map(function(pair){
    const k = pair[0], label = pair[1];
    const cnt = (k === "all") ? counts.all : (counts[parseInt(k)] || 0);
    return "<button class='ftab" + (tailorFilter===k?" active":"") + "' onclick=\"setTailorFilter('" + k + "')\">" + label + "<b>" + cnt + "</b></button>";
  }).join("");

  const rows = list.map(t => {
    const num = gv(t,"Номер");
    const accent = TAILOR_STATUSES[tailorStatusIdx(gv(t,"Статус"))][2];
    const price = extractAmt(gv(t,"Вартість"));
    const warn = tailorDeadlineWarn(t);

    // Фото: спочатку готовий виріб, якщо його немає — референс
    const finished = String(gv(t,"Фото")||"").split(/[\s,;]+/).filter(Boolean);
    const sketch = String(gv(t,"Референс")||"").split(/[\s,;]+/).filter(Boolean);
    const src = finished[0] || sketch[0] || "";
    const isFinished = !!finished[0];

    const media = src
      ? "<div class='tc-photo'>" + photoImgHTML(src, "tc-img", true) +
          (isFinished ? "" : "<span class='tc-tag sketch'>Референс</span>") +
        "</div>"
      : "<div class='tc-photo tc-empty'><span>Без фото</span></div>";

    return "<div class='tcard" + (warn ? " warn" : "") + "' style='border-top-color:" + accent + "' onclick=\"openTailor('" + num + "')\">" +
      media +
      "<div class='tc-body'>" +
        "<div class='tc-head'><span class='tc-num'>" + num.replace("RW-V-","В-") + "</span>" + tailorBadge(gv(t,"Статус")) + "</div>" +
        "<div class='tc-title'>" + (gv(t,"Ім'я клієнта")||"—") + "</div>" +
        "<div class='tc-sub'>" + (gv(t,"Телефон")||"") + "</div>" +
        "<div class='tc-product'>" + (gv(t,"Виріб")||"—") + "</div>" +
        "<div class='tc-foot'>" +
          "<span class='tc-date" + (warn ? " warn" : "") + "'>" + (gv(t,"Термін")||"—") + "</span>" +
          "<span class='tc-price'>" + (price ? price.toLocaleString("uk-UA") + " ₴" : "—") + "</span>" +
        "</div>" +
      "</div>" +
    "</div>";
  }).join("");

  page.innerHTML =
    groupSwitcher("worklist") +
    "<div class='page-header'><div class='page-title'>Виготовлення</div>" +
      "<button class='btn-primary' onclick='openTailorCreate()'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round'><line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/></svg>Нове замовлення</button>" +
    "</div>" +
    "<div class='filters'>" + tabs + "</div>" +
    "<div class='orders-scroll'>" + (list.length ? "<div class='tcards'>" + rows + "</div>" : "<div class='orders-empty'>Немає замовлень на виготовлення</div>") + "</div>";
};

function setTailorFilter(k) { tailorFilter = k; renderers.tailor(); }

/* Чи горить термін у замовленні на виготовлення */
function tailorDeadlineWarn(t) {
  if (gv(t,"Статус") === "📦 Виданий") return false;
  const d = parseDeadline(gv(t,"Термін"));
  if (!d) return false;
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = (d - now) / 86400000;
  return diff <= 3;
}

/* ─── Створення замовлення на виготовлення ─── */
let TL = {};
function openTailorCreate() {
  TL = { manager: PARTNERS[0] || "", client:"", phone:"", messenger:"", product:"", material:"",
         measurements:"", terms:"", price:"", payment:"", prepayMethod:"", prepayAmount:"",
         deadline:"", note:"", photo:"", sketch:"" };
  renderTailorForm();
  document.getElementById("odm-bg").classList.add("open");
}

/* Автопідстановка клієнта у формі пошиву — спільна база з ремонтом */
function onTailorClientInput(v) { TL.client = v; showTailorSuggest(v, "name"); }
function onTailorPhoneInput(v) { TL.phone = v; showTailorSuggest(v, "phone"); }
function showTailorSuggest(q, field) {
  const dd = document.getElementById("tl-suggest");
  if (!dd) return;
  q = (q||"").trim().toLowerCase();
  if (!q) { dd.classList.remove("open"); return; }
  const matches = knownClients().filter(c =>
    (field === "phone" ? c.phone : c.name).toLowerCase().includes(q)
  ).slice(0, 5);
  if (!matches.length) { dd.classList.remove("open"); return; }
  dd.innerHTML = matches.map(c =>
    "<div class='cr-suggest-opt' onclick=\"pickTailorClient('" + c.phone.replace(/'/g,"") + "')\"><span>" + c.name + "</span><span class='sug-phone'>" + c.phone + "</span></div>"
  ).join("");
  dd.classList.add("open");
}
function pickTailorClient(phone) {
  const c = knownClients().find(x => x.phone === phone);
  if (!c) return;
  TL.client = c.name; TL.phone = c.phone;
  const msg = clientMessenger(phone);
  if (msg) TL.messenger = msg;
  const dd = document.getElementById("tl-suggest");
  if (dd) dd.classList.remove("open");
  renderTailorForm();
}

function renderTailorForm() {
  const body = document.getElementById("odm-body");
  const mgrPills = PARTNERS.map(p =>
    "<button class='cr-pill" + (TL.manager===p?" active":"") + "' onclick=\"TL.manager='" + p.replace(/'/g,"\\'") + "';renderTailorForm()\">" + p + "</button>"
  ).join("");
  const msgPick = ["telegram","whatsapp","viber"].map(m => {
    const active = TL.messenger === m;
    return "<button class='cr-msg-btn" + (active?" active":"") + "'" + (active?" style='background:"+MSG_COLORS[m]+"'":"") +
      " onclick=\"TL.messenger = TL.messenger==='" + m + "' ? '' : '" + m + "'; renderTailorForm()\">" +
      "<span class='msg-ico'" + (active?" style='color:#fff'":"") + ">" + MSG_ICONS[m] + "</span>" + MSG_LABELS[m] + "</button>";
  }).join("");
  const payPills = ["Передоплата","Післяплата"].map(p =>
    "<button class='cr-pill cr-pill-wide" + (TL.payment===p?" active":"") + "' onclick=\"TL.payment='" + p + "';renderTailorForm()\">" + p + "</button>"
  ).join("");
  const prepayBlock = TL.payment === "Передоплата" ?
    "<input class='cr-input' type='number' placeholder='Сума передоплати, ₴' value=\"" + esc(TL.prepayAmount) + "\" oninput='TL.prepayAmount=this.value'>" +
    "<div class='cr-pills'>" +
    ["Готівка","Картка","ФОП"].map(m =>
      "<button class='cr-pill" + (TL.prepayMethod===m?" active":"") + "' onclick=\"TL.prepayMethod='" + m + "';renderTailorForm()\">" + m + "</button>"
    ).join("") + "</div>" : "";

  body.innerHTML =
    "<div class='detail-top'><span class='detail-title'>Нове замовлення на виготовлення</span></div>" +
    "<div class='cr-grid'>" +

      "<div class='cr-box'>" +
        "<div class='cr-block-label first'>Хто приймає</div>" +
        "<div class='cr-pills'>" + mgrPills + "</div>" +
        "<div class='cr-block-label'>Клієнт</div>" +
        "<div class='cr-client-suggest'>" +
          "<input class='cr-input' id='tl-client' placeholder=\"Ім'я клієнта\" autocomplete='off' value=\"" + esc(TL.client) + "\" oninput='onTailorClientInput(this.value)'>" +
          "<div class='cr-suggest-dd' id='tl-suggest'></div>" +
        "</div>" +
        "<input class='cr-input' id='tl-phone' placeholder='+380...' autocomplete='off' value=\"" + esc(TL.phone) + "\" oninput='onTailorPhoneInput(this.value)'>" +
        "<div class='cr-msg-pick'>" + msgPick + "</div>" +
      "</div>" +

      "<div class='cr-box'>" +
        "<div class='cr-block-label first'>Вартість і термін</div>" +
        "<input class='cr-input' type='number' placeholder='Вартість, ₴' value=\"" + esc(TL.price) + "\" oninput='TL.price=this.value'>" +
        "<div class='cr-pills'>" + payPills + "</div>" +
        prepayBlock +
        "<div class='cr-block-label'>Термін виконання</div>" +
        "<input class='cr-input' type='date' value=\"" + ddmmToISO(TL.deadline) + "\" oninput='TL.deadline=formatDeadlineDate(this.value);renderDeadlineHint(\"tl-deadline-hint\",\"applyTailorReco\",this.value)'>" +
        "<div class='cr-deadline-hint' id='tl-deadline-hint'>" + deadlineHintHTML("applyTailorReco", ddmmToISO(TL.deadline)) + "</div>" +
      "</div>" +

      "<div class='cr-box cr-box-full'>" +
        "<div class='cr-block-label first'>Виріб</div>" +
        "<input class='cr-input' placeholder='Що виготовляємо — сумка, ремінь, гаманець...' value=\"" + esc(TL.product) + "\" oninput='TL.product=this.value'>" +
        "<input class='cr-input' placeholder='Матеріал — шкіра, колір, фурнітура' value=\"" + esc(TL.material) + "\" oninput='TL.material=this.value'>" +
        "<div class='tl-two'>" +
          "<div><div class='task-field-label'>Мірки та розміри</div>" +
            "<textarea class='cr-input tailor-area' placeholder='Наприклад: довжина 30, ширина 12, ручка 60' oninput='TL.measurements=this.value'>" + esc(TL.measurements) + "</textarea></div>" +
          "<div><div class='task-field-label'>Умови замовлення</div>" +
            "<textarea class='cr-input tailor-area' placeholder='Домовленості, побажання, особливості' oninput='TL.terms=this.value'>" + esc(TL.terms) + "</textarea></div>" +
        "</div>" +
      "</div>" +

      "<div class='cr-box cr-box-full'>" +
        "<div class='cr-block-label first'>Фото</div>" +
        "<div class='tl-two'>" +
          "<div>" +
            "<div class='task-field-label'>Референс</div>" +
            "<textarea class='cr-input tailor-area photo-area' placeholder='Фото-зразок, за яким шиємо — кожне посилання з нового рядка' oninput='TL.sketch=this.value'>" + esc(TL.sketch) + "</textarea>" +
            "<div class='param-hint'>Фото з інтернету, від клієнта або власне фото зразка</div>" +
          "</div>" +
          "<div>" +
            "<div class='task-field-label'>Готовий виріб</div>" +
            "<textarea class='cr-input tailor-area photo-area' placeholder='Заповнюється, коли виріб готовий' oninput='TL.photo=this.value'>" + esc(TL.photo) + "</textarea>" +
            "<div class='param-hint'>Можна додати пізніше через «Редагувати»</div>" +
          "</div>" +
        "</div>" +
        "<div class='task-field-label' style='margin-top:12px'>Примітка</div>" +
        "<textarea class='cr-input tailor-area' placeholder='Будь-що важливе по замовленню' oninput='TL.note=this.value'>" + esc(TL.note) + "</textarea>" +
      "</div>" +

    "</div>" +
    "<div style='display:flex;gap:10px;margin-top:18px'>" +
      "<button onclick='backToOrders()' style='flex:1;background:none;border:1px solid var(--field-border);border-radius:8px;color:var(--txt-2);padding:13px;cursor:pointer;font-family:Commissioner,sans-serif;font-size:13px'>Скасувати</button>" +
      "<button class='cr-create-btn' style='flex:2;margin-top:0' onclick='submitTailor()'>Створити замовлення</button>" +
    "</div>";
}
function esc(v) { return String(v||"").replace(/"/g,"&quot;"); }

async function submitTailor() {
  if (!TL.client.trim()) { alert("Введіть ім'я клієнта"); return; }
  if (!TL.phone.trim()) { alert("Введіть телефон"); return; }
  if (!TL.product.trim()) { alert("Вкажіть, що виготовляємо"); return; }
  const now = new Date();
  const pad = n => String(n).padStart(2,"0");
  const dateStr = pad(now.getDate())+"."+pad(now.getMonth()+1)+"."+now.getFullYear()+" "+pad(now.getHours())+":"+pad(now.getMinutes());
  let paymentStr = TL.payment;
  if (TL.payment === "Передоплата" && TL.prepayAmount) {
    paymentStr = "Передоплата: " + parseInt(TL.prepayAmount).toLocaleString("uk-UA") + " ₴";
  }
  const payload = Object.assign({}, TL, {
    date: dateStr,
    payment: paymentStr,
    price: TL.price ? parseInt(TL.price).toLocaleString("uk-UA") + " ₴" : ""
  });

  const btn = document.querySelector(".cr-create-btn");
  btn.textContent = "Збереження..."; btn.disabled = true;
  try {
    const res = await fetch(API_URL.replace("/order","/tailor"), {
      method:"POST", mode:"cors", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.status === "ok") {
      btn.textContent = "✓ " + (result.order_num || "Збережено");
      setTimeout(() => { backToOrders(); loadData(); showPage("tailor"); }, 1000);
    } else { alert("Помилка: " + result.message); btn.textContent = "Створити замовлення"; btn.disabled = false; }
  } catch(e) { alert("Помилка збереження: " + e.message); btn.textContent = "Створити замовлення"; btn.disabled = false; }
}

/* ─── Картка замовлення на виготовлення ─── */
let tailorDetailNum = null;
function openTailor(num) {
  const t = TAILOR.find(x => gv(x,"Номер") === num);
  if (!t) return;
  tailorDetailNum = num;
  const body = document.getElementById("odm-body");
  const phone = gv(t,"Телефон");
  const phoneClean = phone.replace(/[^\d]/g,"");
  const activeMsg = gv(t,"Месенджер");
  const curIdx = tailorStatusIdx(gv(t,"Статус"));

  const commHTML = ["telegram","whatsapp","viber"].map(m => {
    const active = activeMsg === m;
    return "<button type='button' class='d-comm-btn" + (active?" active":"") + "'" + (active?" style='background:"+MSG_COLORS[m]+"'":"") +
      " onclick=\"openMessenger('" + m + "','" + phoneClean + "')\">" + MSG_ICONS[m] + MSG_LABELS[m] + "</button>";
  }).join("");

  const statusBtns = TAILOR_STATUSES.map((s, si) => {
    const cls = si === curIdx ? "d-status-btn current" : (si < curIdx ? "d-status-btn done" : "d-status-btn");
    const style = si === curIdx ? " style='background:" + s[2] + "'" : "";
    return "<button class='" + cls + "'" + style + " onclick=\"setTailorStatus('" + num + "'," + si + ")\">" + s[1] + "</button>";
  }).join("");

  function row(label, val) {
    return val ? "<div class='d-pay-row'><span class='pl'>" + label + "</span><span class='pv'>" + val + "</span></div>" : "";
  }
  function block(label, content) {
    return content ? "<div class='dblock'><div class='dblock-label'>" + label + "</div>" + content + "</div>" : "";
  }

  const splitUrls = v => String(v||"").split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  const sketchUrls = splitUrls(gv(t,"Референс"));
  const photoUrls = splitUrls(gv(t,"Фото"));

  function photoGrid(label, urls, emptyHint) {
    if (!urls.length) {
      return "<div class='dblock'><div class='dblock-label'>" + label + "</div>" +
        "<div class='photo-empty'>" + emptyHint + "</div></div>";
    }
    return "<div class='dblock'><div class='dblock-label'>" + label + "</div>" +
      "<div class='tailor-photos'>" +
      urls.map(u => "<div class='tailor-photo'>" + photoImgHTML(u) + "</div>").join("") +
      "</div></div>";
  }

  const sketchBlock = photoGrid("Референс", sketchUrls, "Не додано");
  const photoBlock = photoGrid("Готовий виріб", photoUrls, "Ще немає — додай через «Редагувати», коли виріб буде готовий");

  body.innerHTML =
    "<div class='detail-top'>" +
      "<span class='detail-title'>Виготовлення " + num.replace("RW-V-","В-") + "</span>" +
      tailorBadge(gv(t,"Статус")) +
      "<button class='detail-edit' onclick=\"openTailorEdit('" + num + "')\">Редагувати</button>" +
      "<button class='detail-edit' style='color:#E24B4A;border-color:rgba(226,75,74,.3)' onclick=\"openDeleteTailorConfirm('" + num + "')\">Видалити</button>" +
    "</div>" +
    "<div class='detail-grid'>" +
      "<div class='detail-col'>" +
        "<div class='dblock'><div class='dblock-label'>Клієнт</div>" +
          "<div class='d-client-head'><div class='d-avatar'>" + (gv(t,"Ім'я клієнта")||"—").charAt(0).toUpperCase() + "</div>" +
          "<div><div class='d-client-name'><span>" + (gv(t,"Ім'я клієнта")||"—") + "</span></div>" +
          "<div class='d-client-sub'>" + phone + "</div></div></div>" +
          "<div class='d-comm'>" + commHTML + "</div></div>" +
        block("Мірки", gv(t,"Мірки") ? "<div class='tailor-text'>" + gv(t,"Мірки") + "</div>" : "") +
        block("Умови", gv(t,"Умови") ? "<div class='tailor-text'>" + gv(t,"Умови") + "</div>" : "") +
      "</div>" +
      "<div class='detail-col'>" +
        "<div class='dblock'><div class='dblock-label'>Виріб</div>" +
          row("Що виготовляємо", gv(t,"Виріб")) + row("Матеріал", gv(t,"Матеріал")) +
          row("Термін", gv(t,"Термін")) + row("Прийняв", gv(t,"Приймальник")) +
          "<div class='d-pay-total'><span class='pl'>Вартість</span><span class='pv'>" + (gv(t,"Вартість")||"—") + "</span></div></div>" +
        "<div class='dblock'><div class='dblock-label'>Оплата</div>" +
          row("Тип", gv(t,"Оплата")) + row("Спосіб передоплати", gv(t,"Спосіб передоплати")) +
          row("Доплата", gv(t,"Сума доплати")) + row("Спосіб доплати", gv(t,"Спосіб доплати")) +
          (!gv(t,"Оплата") ? "<div class='d-bonus-hint'>Не вказано</div>" : "") + "</div>" +
        block("Примітка", gv(t,"Примітка") ? "<div class='tailor-text'>" + gv(t,"Примітка") + "</div>" : "") +
      "</div>" +
    "</div>" +
    "<div class='detail-grid'>" + sketchBlock + photoBlock + "</div>" +
    "<div class='detail-stack'>" +
      "<div class='dblock'><div class='dblock-label'>Статус</div><div class='d-status-row'>" + statusBtns + "</div></div>" +
    "</div>";

  document.getElementById("odm-bg").classList.add("open");
}

async function setTailorStatus(num, idx) {
  const t = TAILOR.find(x => gv(x,"Номер") === num);
  if (!t) return;
  t["Статус"] = TAILOR_STATUSES[idx][0];
  openTailor(num);
  try {
    await fetch(API_URL.replace("/order","/tailor/update"), {
      method:"POST", mode:"cors", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ order_num: num, status: TAILOR_STATUSES[idx][0] })
    });
  } catch(e) { console.error("tailor status failed", e); }
}

/* ─── Видалення замовлення на виготовлення (архів, з паролем) ─── */
let pendingDeleteTailor = null;
function openDeleteTailorConfirm(num) {
  if (!isAdmin()) { toast("Видалення доступне лише адміністратору"); return; }
  pendingDeleteTailor = num;

  let ov = document.getElementById("delete-tailor-confirm");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "delete-tailor-confirm";
    ov.className = "odm-bg";
    document.body.appendChild(ov);
  }
  ov.innerHTML =
    "<div class='odm' style='width:420px'>" +
      "<div class='odm-close' onclick='closeDeleteTailorConfirm()'>×</div>" +
      "<div class='odm-scroll'>" +
        "<div class='detail-top'><span class='detail-title'>Видалити замовлення " + num.replace("RW-V-","В-") + "?</span></div>" +
        "<p style='font-size:13px;color:var(--txt-2);line-height:1.5;margin:10px 0 0'>" +
          "Замовлення зникне зі списку. Дані не стираються остаточно — " +
          "їх можна відновити вручну через Google Таблицю, прибравши позначку в примітці." +
        "</p>" +
        "<div class='cr-block-label' style='margin-top:18px'>Пароль адміністратора</div>" +
        "<input class='cr-input' id='delete-tailor-pw' type='password' placeholder='Пароль' " +
          "onkeydown=\"if(event.key==='Enter')confirmDeleteTailor()\">" +
        "<div class='login-err' id='delete-tailor-err'></div>" +
        "<div style='display:flex;gap:10px;margin-top:6px'>" +
          "<button onclick='closeDeleteTailorConfirm()' style='flex:1;background:none;border:1px solid var(--field-border);border-radius:8px;color:var(--txt-2);padding:13px;cursor:pointer;font-family:Commissioner,sans-serif;font-size:13px'>Скасувати</button>" +
          "<button class='cr-create-btn' style='flex:2;margin-top:0;background:#E24B4A' id='delete-tailor-btn' onclick='confirmDeleteTailor()'>Видалити</button>" +
        "</div>" +
      "</div>" +
    "</div>";
  ov.classList.add("open");
  setTimeout(function(){ const el = document.getElementById("delete-tailor-pw"); if (el) el.focus(); }, 50);
}
function closeDeleteTailorConfirm() {
  const ov = document.getElementById("delete-tailor-confirm");
  if (ov) ov.classList.remove("open");
  pendingDeleteTailor = null;
}
async function confirmDeleteTailor() {
  if (!pendingDeleteTailor) return;
  const err = document.getElementById("delete-tailor-err");
  const pw = document.getElementById("delete-tailor-pw").value;
  if (!pw) { err.textContent = "Введіть пароль"; return; }
  let hash;
  try { hash = await sha256(pw); } catch(e) { err.textContent = "Помилка перевірки"; return; }
  if (hash !== ROLE_HASHES.admin) { err.textContent = "Невірний пароль"; return; }

  const btn = document.getElementById("delete-tailor-btn");
  btn.textContent = "Видалення..."; btn.disabled = true;
  err.textContent = "";

  const num = pendingDeleteTailor;
  try {
    const res = await fetch(API_URL.replace("/order","/tailor/delete"), {
      method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ order_num: num })
    });
    const r = await res.json();
    if (r.status !== "ok") throw new Error(r.message || "error");
  } catch(e) {
    err.textContent = "Не вдалося видалити. Спробуйте ще раз.";
    btn.textContent = "Видалити"; btn.disabled = false;
    return;
  }

  closeDeleteTailorConfirm();
  document.getElementById("odm-bg").classList.remove("open");
  const t = TAILOR.find(function(x){ return gv(x,"Номер") === num; });
  if (t) t["Примітка"] = "[ВИДАЛЕНО] " + (gv(t,"Примітка") || "");
  toast("Замовлення " + num.replace("RW-V-","В-") + " видалено");
  renderers.tailor();
}

// Функції фото винесено у js/photo.js

/* ─── Редагування замовлення на виготовлення ─── */
function openTailorEdit(num) {
  if (!isAdmin()) { toast("Редагування доступне лише адміністратору"); return; }
  const t = TAILOR.find(x => gv(x,"Номер") === num);
  if (!t) return;
  TL = {
    num: num, client: gv(t,"Ім'я клієнта"), phone: gv(t,"Телефон"), messenger: gv(t,"Месенджер"),
    product: gv(t,"Виріб"), material: gv(t,"Матеріал"), measurements: gv(t,"Мірки"),
    terms: gv(t,"Умови"), price: String(extractAmt(gv(t,"Вартість"))||""), payment: gv(t,"Оплата"),
    prepayMethod: gv(t,"Спосіб передоплати"), deadline: gv(t,"Термін"),
    note: gv(t,"Примітка"), photo: gv(t,"Фото"), sketch: gv(t,"Референс")
  };
  renderTailorEditForm();
}

function renderTailorEditForm() {
  const body = document.getElementById("odm-body");
  const msgPick = ["telegram","whatsapp","viber"].map(m => {
    const active = TL.messenger === m;
    return "<button class='cr-msg-btn" + (active?" active":"") + "'" + (active?" style='background:"+MSG_COLORS[m]+"'":"") +
      " onclick=\"TL.messenger = TL.messenger==='" + m + "' ? '' : '" + m + "'; renderTailorEditForm()\">" +
      "<span class='msg-ico'" + (active?" style='color:#fff'":"") + ">" + MSG_ICONS[m] + "</span>" + MSG_LABELS[m] + "</button>";
  }).join("");
  const payPills = ["Передоплата","Післяплата"].map(p =>
    "<button class='cr-pill cr-pill-wide" + (TL.payment===p?" active":"") + "' onclick=\"TL.payment='" + p + "';renderTailorEditForm()\">" + p + "</button>"
  ).join("");

  body.innerHTML =
    "<div class='detail-top'><span class='detail-title'>Редагування " + TL.num.replace("RW-V-","В-") + "</span></div>" +
    "<div class='tailor-form'>" +
      "<div class='cr-block-label first'>Клієнт</div>" +
      "<input class='cr-input' value=\"" + esc(TL.client) + "\" oninput='TL.client=this.value'>" +
      "<input class='cr-input' value=\"" + esc(TL.phone) + "\" oninput='TL.phone=this.value'>" +
      "<div class='cr-msg-pick'>" + msgPick + "</div>" +
      "<div class='cr-block-label'>Виріб</div>" +
      "<input class='cr-input' placeholder='Що виготовляємо' value=\"" + esc(TL.product) + "\" oninput='TL.product=this.value'>" +
      "<input class='cr-input' placeholder='Матеріал' value=\"" + esc(TL.material) + "\" oninput='TL.material=this.value'>" +
      "<textarea class='cr-input tailor-area' placeholder='Мірки' oninput='TL.measurements=this.value'>" + esc(TL.measurements) + "</textarea>" +
      "<textarea class='cr-input tailor-area' placeholder='Умови' oninput='TL.terms=this.value'>" + esc(TL.terms) + "</textarea>" +
      "<div class='cr-block-label'>Вартість і термін</div>" +
      "<input class='cr-input' type='number' placeholder='Вартість, ₴' value=\"" + esc(TL.price) + "\" oninput='TL.price=this.value'>" +
      "<div class='cr-pills'>" + payPills + "</div>" +
      "<input class='cr-input' placeholder='Термін (дд.мм.рррр)' value=\"" + esc(TL.deadline) + "\" oninput='TL.deadline=this.value'>" +
      "<div class='cr-block-label'>Фото</div>" +
      "<div class='task-field-label'>Референс</div>" +
      "<textarea class='cr-input tailor-area photo-area' placeholder='Фото-зразок, за яким шиємо — кожне посилання з нового рядка' oninput='TL.sketch=this.value'>" + esc(TL.sketch) + "</textarea>" +
      "<div class='task-field-label'>Готовий виріб</div>" +
      "<textarea class='cr-input tailor-area photo-area' placeholder='Посилання на фото готового виробу' oninput='TL.photo=this.value'>" + esc(TL.photo) + "</textarea>" +
      "<div class='cr-block-label'>Примітка</div>" +
      "<textarea class='cr-input tailor-area' placeholder='Будь-що важливе' oninput='TL.note=this.value'>" + esc(TL.note) + "</textarea>" +
      "<div style='display:flex;gap:10px;margin-top:20px'>" +
        "<button onclick=\"openTailor('" + TL.num + "')\" style='flex:1;background:none;border:1px solid var(--field-border);border-radius:8px;color:var(--txt-2);padding:13px;cursor:pointer;font-family:Commissioner,sans-serif;font-size:13px'>Скасувати</button>" +
        "<button class='cr-create-btn' style='flex:2;margin-top:0' onclick='saveTailorEdit()'>Зберегти зміни</button>" +
      "</div>" +
    "</div>";
}

async function saveTailorEdit() {
  const t = TAILOR.find(x => gv(x,"Номер") === TL.num);
  if (t) {
    t["Ім'я клієнта"] = TL.client; t["Телефон"] = TL.phone; t["Месенджер"] = TL.messenger;
    t["Виріб"] = TL.product; t["Матеріал"] = TL.material; t["Мірки"] = TL.measurements;
    t["Умови"] = TL.terms; t["Оплата"] = TL.payment; t["Термін"] = TL.deadline;
    t["Примітка"] = TL.note; t["Фото"] = TL.photo; t["Референс"] = TL.sketch;
    t["Вартість"] = TL.price ? parseInt(TL.price).toLocaleString("uk-UA") + " ₴" : "";
  }
  openTailor(TL.num);
  try {
    await fetch(API_URL.replace("/order","/tailor/update"), {
      method:"POST", mode:"cors", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        order_num: TL.num, client: TL.client, phone: TL.phone, messenger: TL.messenger,
        product: TL.product, material: TL.material, measurements: TL.measurements,
        terms: TL.terms, payment: TL.payment, deadline: TL.deadline,
        note: TL.note, photo: TL.photo, sketch: TL.sketch,
        price: TL.price ? parseInt(TL.price).toLocaleString("uk-UA") + " ₴" : ""
      })
    });
    toast("Зміни збережено");
  } catch(e) { console.error("tailor edit failed", e); }
}

function applyTailorReco(iso) {
  TL.deadline = formatDeadlineDate(iso);
  renderTailorForm();
}
