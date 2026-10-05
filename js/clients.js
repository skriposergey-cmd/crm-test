/* ═══════ ВКЛАДКА КЛІЄНТИ (clients.js) ═══════
   Список клієнтів + пошук. Містить renderers.clients = ..., тому
   підключається наприкінці, після основного коду.
   Залежить від глобальних: ORDERS, gv, openOrder, clientRating,
   clientPaymentStats, clientBonusBalance, clientMessenger, esc, renderers. */
/* ═══════════════ ВКЛАДКА КЛІЄНТИ ═══════════════ */
let clientSearch = "";
let _clientsCache = [];
function buildClientRows() {
  const q = (clientSearch || "").trim().toLowerCase();
  const list = _clientsCache.filter(c => !q || (c.phone||"").toLowerCase().includes(q) || (c.name||"").toLowerCase().includes(q));
  if (!list.length) return "<div class='orders-empty'>" + (_clientsCache.length ? "Нічого не знайдено" : "Ще немає клієнтів") + "</div>";
  return list.map(c => {
    const r = clientRating(c.phone);
    const bonus = clientBonusBalance(c.phone);
    const bonusCls = bonus >= BONUS_MIN_SPEND ? " ready" : "";
    return "<div class='client-row' onclick=\"openClientCard('" + c.phone.replace(/'/g,"") + "')\">" +
      "<span class='client-dot'>" + r.dot + "</span>" +
      "<div><div class='client-name'>" + (c.name || "—") + "</div></div>" +
      "<div class='client-phone'>" + c.phone + "</div>" +
      "<span class='client-count'>" + c.count + " замовл.</span>" +
      "<span class='client-bonus" + bonusCls + "'>" + (bonus > 0 ? bonus + " б." : "—") + "</span>" +
      "<span class='client-sum'>" + c.sum.toLocaleString("uk-UA") + " ₴</span>" +
    "</div>";
  }).join("");
}
renderers.clients = function() {
  const page = document.getElementById("page-clients");
  // Унікальні клієнти за телефоном — ремонт + пошив (без видалених)
  const map = {};
  ORDERS.forEach(o => {
    if (typeof isOrderDeleted === "function" && isOrderDeleted(o)) return;
    const phone = gv(o,"Телефон"); if (!phone) return;
    if (!map[phone]) map[phone] = { name: gv(o,"Ім'я клієнта"), phone: phone, count: 0, sum: 0 };
    map[phone].count++;
    map[phone].sum += orderTotal(gv(o,"Номер замовлення"));
  });
  TAILOR.forEach(t => {
    if (gv(t,"Примітка").indexOf("[ВИДАЛЕНО] ") === 0) return;
    const phone = gv(t,"Телефон"); if (!phone) return;
    if (!map[phone]) map[phone] = { name: gv(t,"Ім'я клієнта"), phone: phone, count: 0, sum: 0 };
    map[phone].count++;
    map[phone].sum += extractAmt(gv(t,"Вартість"));
  });
  _clientsCache = Object.values(map).sort((a,b) => b.sum - a.sum);
  const rows = buildClientRows();
  page.innerHTML =
    "<div class='page-header'><div class='page-title'>Клієнти</div>" +
      "<button class='btn-primary' onclick='openSummaryReceipt()'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round'><path d='M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z'/><path d='M9 12h6M9 16h6M9 8h3'/></svg>Зведений чек</button>" +
    "</div>" +
    "<div class='clients-search-wrap'><input class='clients-search' id='clients-search' inputmode='tel' placeholder='Пошук за номером телефону або імʼям…' value=\"" + (clientSearch||"").replace(/"/g,"&quot;") + "\" oninput='clientSearch=this.value; document.getElementById(\"clients-list\").innerHTML=buildClientRows();'></div>" +
    "<div class='tab-scroll'>" +
      "<div class='clients-list' id='clients-list'>" + rows + "</div>" +
    "</div>";
};

/* ═══════════════ МІНІ-КАРТКА КЛІЄНТА ═══════════════
   Двоколонковий вигляд у стилі чека: ліворуч дані клієнта (з місцем
   під майбутні поля — день народження, адреса), праворуч — історія
   замовлень рядками як у списку (номер / виріб+кількість / сума),
   перші 4 з розгортанням решти. Редагування — окремий режим (кнопка,
   лише адмін). */
let _ccExpanded = false;
/* Розбиває "Ім'я клієнта" на перше слово (ім'я) + решту (прізвище/позначення,
   напр. "Анна Адвокат", "Юлія Магазин взуття") — окремого поля в таблиці немає,
   тому ділимо за першим пробілом. */
function splitClientName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length <= 1) return { first: fullName || "—", rest: "" };
  return { first: parts[0], rest: parts.slice(1).join(" ") };
}
function openClientCard(phone) {
  _ccExpanded = false;
  renderClientCardView(phone);
}
function toggleClientHistExpand(phone) {
  _ccExpanded = !_ccExpanded;
  renderClientCardView(phone);
}
function renderClientCardView(phone) {
  const c = _clientsCache.find(x => x.phone === phone);
  const name = c ? (c.name || "—") : "—";
  const nameParts = splitClientName(name);
  const r = clientRating(phone);
  const balance = clientBonusBalance(phone);
  const count = c ? c.count : 0;
  const sum = c ? c.sum : 0;
  const msg = clientMessenger(phone);
  const admin = isAdmin();
  const birthday = clientBirthday(phone);
  const address = clientMailAddress(phone);

  const orders = ORDERS.filter(o => gv(o,"Телефон") === phone && !isOrderDeleted(o));
  const sorted = [...orders].sort((a,b) => {
    const da = orderDate(a), db = orderDate(b);
    if (da && db) return db - da;
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
  const VISIBLE = 4;
  const shown = _ccExpanded ? sorted : sorted.slice(0, VISIBLE);
  const histRows = shown.map(o => {
    const num = gv(o,"Номер замовлення");
    const total = orderTotal(num);
    const cnt = ITEMS.filter(i => gv(i,"Номер замовлення") === num).length;
    return "<div class='cc-hist-row' onclick=\"closeClientCard();openOrder('" + num + "')\">" +
      "<div class='cc-hist-top'><span class='cc-hist-num'>" + num + "</span><span class='cc-hist-sum'>" + total.toLocaleString("uk-UA") + " ₴</span></div>" +
      "<div class='cc-hist-item'>" + orderItemName(num) + (cnt ? "<span class='olr-count'> · " + cnt + " " + pluralUk(cnt,"річ","речі","речей") + "</span>" : "") + "</div>" +
    "</div>";
  }).join("");
  const moreBtn = sorted.length > VISIBLE
    ? "<button class='cc-more-btn' onclick=\"toggleClientHistExpand('" + phone.replace(/'/g,"") + "')\">" + (_ccExpanded ? "Згорнути" : "Показати ще (" + (sorted.length - VISIBLE) + ")") + "</button>"
    : "";

  let ov = document.getElementById("client-card-modal");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "client-card-modal";
    ov.className = "odm-bg";
    document.body.appendChild(ov);
  }
  ov.innerHTML = "<div class='odm' id='client-card-odm' style='width:520px'>" +
    "<div class='odm-close' onclick='closeClientCard()'>×</div>" +
    "<div class='odm-scroll'>" +
      "<div class='cc-head'><div class='cc-name'>" + nameParts.first + "</div>" +
      (nameParts.rest ? "<div class='cc-name-tag'>" + nameParts.rest + "</div>" : "") +
      "<div class='cc-substatus'>" + r.label + " " + r.dot + "</div></div>" +
      "<div class='cc-grid'>" +
        "<div>" +
          "<div class='cc-col-label'>Клієнт</div>" +
          "<div class='cc-field-label'>Телефон</div><div class='cc-field-value'>" + phone + "</div>" +
          "<div class='cc-field-label'>Месенджер</div><div class='cc-field-value'>" + (msg ? MSG_LABELS[msg] : "—") + "</div>" +
          (birthday ? "<div class='cc-field-label'>День народження</div><div class='cc-field-value'>" + birthday + "</div>" : "") +
          (address ? "<div class='cc-field-label'>Адреса (пошта)</div><div class='cc-field-value'>" + address + "</div>" : "") +
          "<div class='cc-stats-2col'>" +
            "<div><div class='cc-field-label'>Замовлень</div><div class='cc-field-value'>" + count + "</div></div>" +
            "<div><div class='cc-field-label'>Сума</div><div class='cc-field-value'>" + sum.toLocaleString("uk-UA") + " ₴</div></div>" +
          "</div>" +
          "<div class='cc-field-label'>Баланс бонусів</div><div class='cc-bonus-value'>" + balance.toLocaleString("uk-UA") + " балів</div>" +
        "</div>" +
        "<div>" +
          "<div class='cc-col-label'>Історія замовлень</div>" +
          "<div class='cc-hist-list'>" + (histRows || "<div class='orders-empty' style='padding:16px 0'>Немає замовлень</div>") + "</div>" +
          moreBtn +
        "</div>" +
      "</div>" +
      (admin ? "<button class='detail-edit' style='width:100%;text-align:center;padding:11px;margin-top:18px' onclick=\"openClientEdit('" + phone.replace(/'/g,"") + "')\">Редагувати</button>" : "") +
    "</div></div>";
  ov.classList.add("open");
}
function closeClientCard() {
  const ov = document.getElementById("client-card-modal");
  if (ov) ov.classList.remove("open");
}

/* ═══════════════ РЕДАГУВАННЯ КЛІЄНТА (адмін) ═══════════════
   Окремий режим у тому ж модальному вікні — телефон, месенджер, статус,
   обнулення бонусів. Дзеркалить патерн openOrder / openEditOrder. */
function openClientEdit(phone) {
  if (!isAdmin()) { toast("Редагування доступне лише адміністратору"); return; }
  const c = _clientsCache.find(x => x.phone === phone);
  const name = c ? (c.name || "—") : "—";
  const nameParts = splitClientName(name);
  const r = clientRating(phone);
  const balance = clientBonusBalance(phone);
  const msg = clientMessenger(phone);
  const birthday = clientBirthday(phone);
  const address = clientMailAddress(phone);

  const msgPick = ["telegram","whatsapp","viber"].map(m => {
    const active = msg === m;
    const style = active ? " style='background:" + MSG_COLORS[m] + "'" : "";
    return "<button class='cr-msg-btn" + (active?" active":"") + "'" + style + " onclick=\"setClientMessenger('" + phone.replace(/'/g,"") + "','" + m + "')\"><span class='msg-ico'" + (active?" style='color:#fff'":"") + ">" + MSG_ICONS[m] + "</span>" + MSG_LABELS[m] + "</button>";
  }).join("");

  const ov = document.getElementById("client-card-modal");
  if (!ov) return;
  ov.innerHTML = "<div class='odm' id='client-card-odm' style='width:380px'>" +
    "<div class='odm-close' onclick='closeClientCard()'>×</div>" +
    "<div class='odm-scroll'>" +
      "<div class='detail-top'><span class='detail-title' style='font-size:16px'>Редагування — " + name + "</span></div>" +
      "<div class='edit-form'>" +
        "<div class='cr-block-label first'>Телефон</div>" +
        "<input class='cr-input' readonly style='cursor:pointer' id='client-card-phone' value=\"" + phone.replace(/"/g,"&quot;") + "\" onclick=\"openPhoneKeypad('" + phone.replace(/'/g,"") + "', function(v){ var el=document.getElementById('client-card-phone'); if(el) el.value=v; }, function(v){ saveClientPhone('" + phone.replace(/'/g,"") + "', v); })\">" +
        "<div class='cr-block-label'>Ім'я</div>" +
        "<input class='cr-input' id='client-card-firstname' placeholder=\"Ім'я клієнта\" value=\"" + nameParts.first.replace(/"/g,"&quot;") + "\" onblur=\"saveClientFullName('" + phone.replace(/'/g,"") + "')\">" +
        "<div class='cr-block-label'>Прізвище / позначення</div>" +
        "<input class='cr-input' id='client-card-lastname' placeholder='напр. Адвокат, Магазин взуття' value=\"" + nameParts.rest.replace(/"/g,"&quot;") + "\" onblur=\"saveClientFullName('" + phone.replace(/'/g,"") + "')\">" +
        "<div class='cr-block-label'>Месенджер</div>" +
        "<div class='cr-msg-pick'>" + msgPick + "</div>" +
        "<div class='cr-block-label'>День народження</div>" +
        "<input class='cr-input' placeholder='ДД.ММ.РРРР' value=\"" + birthday.replace(/"/g,"&quot;") + "\" onblur=\"saveClientBirthday('" + phone.replace(/'/g,"") + "',this.value)\">" +
        "<div class='cr-block-label'>Адреса (пошта)</div>" +
        "<input class='cr-input' placeholder='напр. Нова Пошта №23, Одеса' value=\"" + address.replace(/"/g,"&quot;") + "\" onblur=\"saveClientMailAddress('" + phone.replace(/'/g,"") + "',this.value)\">" +
        "<div class='cr-block-label'>Статус клієнта</div>" +
        "<div class='d-pay-row'><span class='pv rating-pick' onclick=\"openRatingPick('" + phone.replace(/'/g,"") + "','client-card-odm','client')\">" + r.label + " " + r.dot + "</span></div>" +
      "</div>" +
      (balance > 0 ? "<button class='d-settle-btn' style='margin-top:14px;background:none;border:1px solid rgba(226,75,74,0.3);color:#E24B4A' onclick=\"openResetBonusConfirm('" + phone.replace(/'/g,"") + "','" + name.replace(/'/g,"") + "')\">Обнулити бонуси</button>" : "") +
      "<button style='width:100%;margin-top:10px;background:none;border:1px solid var(--field-border);border-radius:8px;color:var(--txt-2);padding:13px;cursor:pointer;font-family:Commissioner,sans-serif;font-size:13px' onclick=\"openClientCard('" + phone.replace(/'/g,"") + "')\">Готово</button>" +
      "<button style='width:100%;margin-top:10px;background:none;border:1px solid rgba(226,75,74,0.3);border-radius:8px;color:#E24B4A;padding:13px;cursor:pointer;font-family:Commissioner,sans-serif;font-size:13px' onclick=\"openDeleteClientConfirm('" + phone.replace(/'/g,"") + "','" + name.replace(/'/g,"") + "')\">Видалити клієнта</button>" +
    "</div></div>";
}

/* Зберегти месенджер клієнта — пишемо в останнє замовлення цього телефону
   (clientMessenger читає саме звідти, той самий підхід, що й з рейтингом) */
async function setClientMessenger(phone, m) {
  if (!isAdmin()) return;
  const orders = ORDERS.filter(o => gv(o,"Телефон") === phone);
  if (!orders.length) { toast("У клієнта ще немає замовлень"); return; }
  const last = orders[orders.length - 1];
  const num = gv(last,"Номер замовлення");
  const newVal = gv(last,"Месенджер") === m ? "" : m;
  last["Месенджер"] = newVal;
  openClientEdit(phone);
  try {
    await fetch(API_URL.replace("/order","/order/update"), {
      method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ order_num: num, messenger: newVal })
    });
  } catch(e) { console.error("messenger save failed", e); toast("Не вдалося зберегти месенджер"); }
}

/* Зберегти повне ім'я — читаємо обидва поля (ім'я + прізвище/позначення),
   склеюємо в одне поле "Ім'я клієнта" і оновлюємо ВСІ замовлення телефону
   (номер телефону лишається ключем, ім'я має бути однаковим по всій історії). */
async function saveClientFullName(phone) {
  if (!isAdmin()) return;
  const firstEl = document.getElementById("client-card-firstname");
  const lastEl = document.getElementById("client-card-lastname");
  const first = (firstEl ? firstEl.value.trim() : "");
  const rest = (lastEl ? lastEl.value.trim() : "");
  if (!first) { toast("Ім'я не може бути порожнім"); return; }
  const newName = rest ? (first + " " + rest) : first;
  const orders = ORDERS.filter(o => gv(o,"Телефон") === phone);
  if (!orders.length) { toast("У клієнта ще немає замовлень"); return; }
  let failed = 0;
  for (const o of orders) {
    const num = gv(o,"Номер замовлення");
    try {
      const res = await fetch(API_URL.replace("/order","/order/update"), {
        method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ order_num: num, client: newName })
      });
      const r = await res.json();
      if (r.status === "ok") o["Ім'я клієнта"] = newName; else failed++;
    } catch(e) { failed++; }
  }
  if (failed) toast("Готово, але " + failed + " замовлень не оновилися");
  if (renderers.clients) renderers.clients();
  openClientEdit(phone);
}

/* День народження і пошта — пишемо в останнє замовлення, як месенджер */
async function saveClientBirthday(phone, value) {
  if (!isAdmin()) return;
  const orders = ORDERS.filter(o => gv(o,"Телефон") === phone);
  if (!orders.length) { toast("У клієнта ще немає замовлень"); return; }
  const last = orders[orders.length - 1];
  const num = gv(last,"Номер замовлення");
  const newVal = (value || "").trim();
  last["День народження"] = newVal;
  openClientEdit(phone);
  try {
    await fetch(API_URL.replace("/order","/order/update"), {
      method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ order_num: num, birthday: newVal })
    });
  } catch(e) { console.error("birthday save failed", e); toast("Не вдалося зберегти день народження"); }
}
async function saveClientMailAddress(phone, value) {
  if (!isAdmin()) return;
  const orders = ORDERS.filter(o => gv(o,"Телефон") === phone);
  if (!orders.length) { toast("У клієнта ще немає замовлень"); return; }
  const last = orders[orders.length - 1];
  const num = gv(last,"Номер замовлення");
  const newVal = (value || "").trim();
  last["Пошта"] = newVal;
  openClientEdit(phone);
  try {
    await fetch(API_URL.replace("/order","/order/update"), {
      method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ order_num: num, mailAddress: newVal })
    });
  } catch(e) { console.error("mail address save failed", e); toast("Не вдалося зберегти адресу"); }
}

/* Зберегти новий номер телефону клієнта — оновлює ВСІ його замовлення,
   щоб історія лишилась звʼязаною (телефон — це ключ групування клієнтів). */
async function saveClientPhone(oldPhone, newPhoneRaw) {
  if (!isAdmin()) return;
  const newPhone = (newPhoneRaw || "").trim();
  if (!newPhone || newPhone === oldPhone) return;
  if (!confirm("Змінити телефон клієнта на " + newPhone + "?\nОновляться всі його замовлення (" + ORDERS.filter(o => gv(o,"Телефон")===oldPhone).length + ").")) {
    openClientEdit(oldPhone);
    return;
  }
  const orders = ORDERS.filter(o => gv(o,"Телефон") === oldPhone);
  let failed = 0;
  for (const o of orders) {
    const num = gv(o,"Номер замовлення");
    try {
      const res = await fetch(API_URL.replace("/order","/order/update"), {
        method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ order_num: num, phone: newPhone })
      });
      const r = await res.json();
      if (r.status === "ok") o["Телефон"] = newPhone; else failed++;
    } catch(e) { failed++; }
  }
  closeClientCard();
  if (failed) toast("Готово, але " + failed + " замовлень не оновилися");
  else toast("Телефон оновлено");
  if (renderers.clients) renderers.clients();
  openClientEdit(newPhone);
}

/* ── Обнулення бонусів клієнта (адмін, підтвердження паролем) ──
   Скидає "Нараховано бонусів"/"Списано бонусів" на 0 у ВСІХ замовленнях
   цього телефону — тобто баланс стає 0. Дані самих замовлень не чіпаються. */
let pendingResetBonusPhone = null;
function openResetBonusConfirm(phone, name) {
  if (!isAdmin()) { toast("Доступно лише адміністратору"); return; }
  pendingResetBonusPhone = phone;
  const balance = clientBonusBalance(phone);

  let ov = document.getElementById("reset-bonus-confirm");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "reset-bonus-confirm";
    ov.className = "odm-bg";
    document.body.appendChild(ov);
  }
  ov.innerHTML = "<div class='odm' style='width:380px'>" +
    "<div class='odm-close' onclick='closeResetBonusConfirm()'>×</div>" +
    "<div class='odm-scroll'>" +
      "<div class='detail-top'><span class='detail-title' style='font-size:16px'>Обнулити бонуси?</span></div>" +
      "<p style='font-size:13px;color:var(--txt-2);line-height:1.5;margin:0 0 4px'>" +
        name + " · " + phone + "<br>Поточний баланс: <b style='color:var(--cognac)'>" + balance.toLocaleString("uk-UA") + " балів</b>" +
      "</p>" +
      "<p style='font-size:12px;color:var(--txt-3);line-height:1.5'>Нарахування та списання обнуляться у всіх замовленнях цього клієнта. Дію не можна скасувати автоматично.</p>" +
      "<div class='cr-block-label' style='margin-top:14px'>Пароль адміністратора</div>" +
      "<input class='cr-input' id='reset-bonus-pw' type='password' placeholder='Пароль' onkeydown=\"if(event.key==='Enter')confirmResetBonus()\">" +
      "<div class='login-err' id='reset-bonus-err'></div>" +
      "<div style='display:flex;gap:10px;margin-top:6px'>" +
        "<button onclick='closeResetBonusConfirm()' style='flex:1;background:none;border:1px solid var(--field-border);border-radius:8px;color:var(--txt-2);padding:13px;cursor:pointer;font-family:Commissioner,sans-serif;font-size:13px'>Скасувати</button>" +
        "<button class='cr-create-btn' style='flex:2;margin-top:0;background:#E24B4A' id='reset-bonus-btn' onclick='confirmResetBonus()'>Обнулити</button>" +
      "</div>" +
    "</div></div>";
  ov.classList.add("open");
  setTimeout(() => { const el = document.getElementById("reset-bonus-pw"); if (el) el.focus(); }, 50);
}
function closeResetBonusConfirm() {
  const ov = document.getElementById("reset-bonus-confirm");
  if (ov) ov.classList.remove("open");
  pendingResetBonusPhone = null;
}
async function confirmResetBonus() {
  if (!pendingResetBonusPhone) return;
  const err = document.getElementById("reset-bonus-err");
  const pw = document.getElementById("reset-bonus-pw").value;
  if (!pw) { err.textContent = "Введіть пароль"; return; }
  let hash;
  try { hash = await sha256(pw); } catch(e) { err.textContent = "Помилка перевірки"; return; }
  if (hash !== ROLE_HASHES.admin) { err.textContent = "Невірний пароль"; return; }

  const btn = document.getElementById("reset-bonus-btn");
  btn.textContent = "Обнулення..."; btn.disabled = true;
  err.textContent = "";

  const phone = pendingResetBonusPhone;
  const phoneOrders = ORDERS.filter(o => gv(o,"Телефон") === phone);
  let failed = 0;
  for (const o of phoneOrders) {
    const num = gv(o,"Номер замовлення");
    const hadAccrued = extractAmt(gv(o,"Нараховано бонусів"));
    const hadSpent = extractAmt(gv(o,"Списано бонусів"));
    if (!hadAccrued && !hadSpent) continue;
    try {
      const res = await fetch(API_URL.replace("/order","/bonus"), {
        method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ order_num: num, accrued: 0, spent: 0 })
      });
      const r = await res.json();
      if (r.status === "ok") { o["Нараховано бонусів"] = "0"; o["Списано бонусів"] = "0"; }
      else failed++;
    } catch(e) { failed++; }
  }

  closeResetBonusConfirm();
  if (failed) {
    toast("Готово, але " + failed + " замовлень не оновилися — спробуйте ще раз");
  } else {
    toast("Бонуси клієнта обнулено");
  }
  closeClientCard();
  if (renderers.clients) renderers.clients();
}

/* ── Видалення клієнта (адмін, підтвердження паролем) ──
   Клієнт — це агрегований вид по всіх замовленнях телефону, окремого рядка
   немає, тому "видалити клієнта" = заховати ВСІ його замовлення (ремонт
   і виготовлення) тим самим механізмом архіву, що й окреме замовлення.
   Нічого не стирається остаточно — кожне замовлення можна відновити окремо. */
let pendingDeleteClientPhone = null;
function openDeleteClientConfirm(phone, name) {
  if (!isAdmin()) { toast("Доступно лише адміністратору"); return; }
  pendingDeleteClientPhone = phone;
  const c = _clientsCache.find(x => x.phone === phone);
  const count = c ? c.count : 0;

  let ov = document.getElementById("delete-client-confirm");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "delete-client-confirm";
    ov.className = "odm-bg";
    document.body.appendChild(ov);
  }
  ov.innerHTML = "<div class='odm' style='width:400px'>" +
    "<div class='odm-close' onclick='closeDeleteClientConfirm()'>×</div>" +
    "<div class='odm-scroll'>" +
      "<div class='detail-top'><span class='detail-title' style='font-size:16px'>Видалити клієнта?</span></div>" +
      "<p style='font-size:13px;color:var(--txt-2);line-height:1.5;margin:0 0 4px'>" + name + " · " + phone + "</p>" +
      "<p style='font-size:12px;color:var(--txt-3);line-height:1.5'>Сховає всі " + count + " замовлення цього клієнта (ремонт і виготовлення) зі списків і статистики. " +
        "Дані не стираються остаточно — кожне замовлення можна відновити окремо через Google Таблицю.</p>" +
      "<div class='cr-block-label' style='margin-top:14px'>Пароль адміністратора</div>" +
      "<input class='cr-input' id='delete-client-pw' type='password' placeholder='Пароль' onkeydown=\"if(event.key==='Enter')confirmDeleteClient()\">" +
      "<div class='login-err' id='delete-client-err'></div>" +
      "<div style='display:flex;gap:10px;margin-top:6px'>" +
        "<button onclick='closeDeleteClientConfirm()' style='flex:1;background:none;border:1px solid var(--field-border);border-radius:8px;color:var(--txt-2);padding:13px;cursor:pointer;font-family:Commissioner,sans-serif;font-size:13px'>Скасувати</button>" +
        "<button class='cr-create-btn' style='flex:2;margin-top:0;background:#E24B4A' id='delete-client-btn' onclick='confirmDeleteClient()'>Видалити</button>" +
      "</div>" +
    "</div></div>";
  ov.classList.add("open");
  setTimeout(function(){ const el = document.getElementById("delete-client-pw"); if (el) el.focus(); }, 50);
}
function closeDeleteClientConfirm() {
  const ov = document.getElementById("delete-client-confirm");
  if (ov) ov.classList.remove("open");
  pendingDeleteClientPhone = null;
}
async function confirmDeleteClient() {
  if (!pendingDeleteClientPhone) return;
  const err = document.getElementById("delete-client-err");
  const pw = document.getElementById("delete-client-pw").value;
  if (!pw) { err.textContent = "Введіть пароль"; return; }
  let hash;
  try { hash = await sha256(pw); } catch(e) { err.textContent = "Помилка перевірки"; return; }
  if (hash !== ROLE_HASHES.admin) { err.textContent = "Невірний пароль"; return; }

  const btn = document.getElementById("delete-client-btn");
  btn.textContent = "Видалення..."; btn.disabled = true;
  err.textContent = "";

  const phone = pendingDeleteClientPhone;
  let failed = 0;

  const phoneOrders = ORDERS.filter(o => gv(o,"Телефон") === phone && !(typeof isOrderDeleted === "function" && isOrderDeleted(o)));
  for (const o of phoneOrders) {
    const num = gv(o,"Номер замовлення");
    try {
      const res = await fetch(API_URL.replace("/order","/order/delete"), {
        method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ order_num: num })
      });
      const r = await res.json();
      if (r.status === "ok") o["Примітка"] = "[ВИДАЛЕНО] " + gv(o,"Примітка"); else failed++;
    } catch(e) { failed++; }
  }

  const phoneTailor = TAILOR.filter(t => gv(t,"Телефон") === phone && gv(t,"Примітка").indexOf("[ВИДАЛЕНО] ") !== 0);
  for (const t of phoneTailor) {
    const num = gv(t,"Номер");
    try {
      const res = await fetch(API_URL.replace("/order","/tailor/delete"), {
        method: "POST", mode: "cors", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ order_num: num })
      });
      const r = await res.json();
      if (r.status === "ok") t["Примітка"] = "[ВИДАЛЕНО] " + gv(t,"Примітка"); else failed++;
    } catch(e) { failed++; }
  }

  closeDeleteClientConfirm();
  closeClientCard();
  if (failed) toast("Готово, але " + failed + " замовлень не вдалося приховати");
  else toast("Клієнта видалено");
  if (typeof loadData === "function") await loadData();
  else if (renderers.clients) renderers.clients();
}
