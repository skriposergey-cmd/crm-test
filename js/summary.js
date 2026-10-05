/* ═══════ ЗВІТ / ЗВЕДЕНИЙ ЧЕК (summary.js) ═══════
   Зведений чек по клієнту/партнеру. Самодостатній модуль.
   Зовнішній виклик: openSummaryReceipt() — кнопка в картці клієнта. */

/* ═══════════════ ЗВЕДЕНИЙ ЧЕК (для партнера чи клієнта) ═══════════════ */
let summarySelected = new Set();

function openSummaryReceipt() {
  summarySelected = new Set();
  const body = document.getElementById("odm-body");
  body.innerHTML =
    "<div class='detail-top'><span class='detail-title'>Зведений чек</span></div>" +
    "<div class='summary-search-wrap'>" +
      "<input class='cr-input' id='summary-search' placeholder=\"Ім'я клієнта або назва партнера...\" autocomplete='off' oninput='renderSummaryMatches(this.value)'>" +
    "</div>" +
    "<div id='summary-matches'></div>";
  document.getElementById("odm-bg").classList.add("open");
  setTimeout(() => document.getElementById("summary-search").focus(), 50);
}

/* Унікальні імена — і клієнти, і приймальники (партнери), пошук в обох */
function renderSummaryMatches(q) {
  q = q.trim().toLowerCase();
  const box = document.getElementById("summary-matches");
  if (!q) { box.innerHTML = ""; return; }

  const clientNames = new Set(ORDERS.map(o => gv(o,"Ім'я клієнта")).filter(Boolean));
  const partnerNames = new Set(ORDERS.map(o => gv(o,"Приймальник")).filter(Boolean));
  const all = [...new Set([...clientNames, ...partnerNames])];
  const matches = all.filter(n => n.toLowerCase().includes(q)).slice(0, 8);

  box.innerHTML = matches.length ? matches.map(n =>
    "<div class='cr-suggest-opt' style='cursor:pointer' onclick=\"pickSummaryEntity('" + n.replace(/'/g,"\\'") + "')\">" + n + "</div>"
  ).join("") : "<div style='color:var(--txt-3);font-size:12px;padding:10px 0'>Нічого не знайдено</div>";
}

function pickSummaryEntity(name) {
  const matching = ORDERS.filter(o => gv(o,"Ім'я клієнта") === name || gv(o,"Приймальник") === name);
  summarySelected = new Set(matching.map(o => gv(o,"Номер замовлення"))); // за замовчуванням всі відмічені

  const rows = matching.map(o => {
    const num = gv(o,"Номер замовлення");
    const total = orderTotal(num);
    return "<label class='summary-row'>" +
      "<input type='checkbox' checked onchange=\"toggleSummarySel('" + num + "',this.checked)\">" +
      "<span class='sr-num'>" + num + "</span>" +
      "<span class='sr-name'>" + orderItemName(num) + "</span>" +
      "<span class='sr-svc'>" + orderServices(num) + "</span>" +
      "<span class='sr-sum'>" + total.toLocaleString("uk-UA") + " ₴</span>" +
    "</label>";
  }).join("");

  const body = document.getElementById("odm-body");
  body.innerHTML =
    "<div class='detail-top'><span class='detail-title'>Зведений чек — " + name + "</span></div>" +
    (matching.length ?
      "<div class='summary-list'>" + rows + "</div>" +
      "<button class='cr-create-btn' onclick=\"generateSummary('" + name.replace(/'/g,"\\'") + "')\">Сформувати чек (" + matching.length + ")</button>"
    : "<div class='orders-empty'>Замовлень не знайдено</div>");
}

function toggleSummarySel(num, checked) {
  if (checked) summarySelected.add(num); else summarySelected.delete(num);
}

function generateSummary(name) {
  const nums = [...summarySelected];
  if (!nums.length) { alert("Оберіть хоча б одне замовлення"); return; }
  const orders = nums.map(n => ORDERS.find(o => gv(o,"Номер замовлення") === n)).filter(Boolean);

  let grandTotal = 0;
  const itemsHTML = orders.map(o => {
    const num = gv(o,"Номер замовлення");
    const its = ITEMS.filter(i => gv(i,"Номер замовлення") === num);
    let orderSum = 0;
    const svcRows = its.map(it => {
      const amt = extractAmt(gv(it,"Сума"));
      orderSum += amt;
      const name2 = gv(it,"Бренд") || gv(it,"Тип") || "Виріб";
      return "<div class='sum-svc-row'><span>" + name2 + " — " + gv(it,"Послуги") + "</span><span>" + amt.toLocaleString("uk-UA") + " ₴</span></div>";
    }).join("");
    grandTotal += orderSum;
    return "<div class='sum-order-block'><div class='sum-order-head'>" + num + " · " + (gv(o,"Дата створення")||"").split(" ")[0] + "</div>" + svcRows + "</div>";
  }).join("");

  const now = new Date().toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric"});
  const body = document.getElementById("odm-body");
  body.innerHTML =
    "<div id='summary-print'>" +
      "<div class='sum-print-header'><div class='sum-print-logo'>REWISE · STUDIO</div><div class='sum-print-tag'>Зведений чек</div></div>" +
      "<div class='sum-print-meta'><span>" + name + "</span><span>" + now + "</span></div>" +
      "<div class='sum-print-body'>" + itemsHTML + "</div>" +
      "<div class='sum-print-total'><span>Разом</span><span>" + grandTotal.toLocaleString("uk-UA") + " ₴</span></div>" +
      "<div class='sum-print-footer'>rewise-studio · ukraine</div>" +
    "</div>" +
    "<div class='sum-actions no-print'>" +
      "<button class='cr-btn' onclick=\"pickSummaryEntity('" + name.replace(/'/g,"\\'") + "')\" style='flex:1;background:none;border:1px solid var(--field-border);border-radius:8px;color:var(--txt-2);padding:13px;cursor:pointer;font-family:Commissioner,sans-serif;font-size:13px'>Назад</button>" +
      "<button class='cr-btn' id='summary-share-btn' onclick='shareSummaryImage()' style='flex:2;background:none;border:1px solid var(--cognac-border);border-radius:8px;color:var(--cognac);padding:13px;cursor:pointer;font-family:Commissioner,sans-serif;font-size:13px'>Зберегти зображення</button>" +
      "<button class='cr-create-btn' style='flex:2;margin-top:0' onclick='window.print()'>Друкувати</button>" +
    "</div>";
}

function shareSummaryImage() {
  const el = document.getElementById("summary-print");
  if (!el) return;
  const btn = document.getElementById("summary-share-btn");
  const orig = btn.textContent;
  btn.textContent = "Готую...";
  html2canvas(el, { backgroundColor: "#FBF8F3", scale: 2, useCORS: true }).then(canvas => {
    canvas.toBlob(blob => {
      const file = new File([blob], "rewise-zvedeny-chek.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "Rewise — Зведений чек" }).then(()=>btn.textContent=orig).catch(()=>btn.textContent=orig);
      } else {
        const link = document.createElement("a");
        link.download = "rewise-zvedeny-chek-" + Date.now() + ".png";
        link.href = canvas.toDataURL("image/png"); link.click();
        btn.textContent = orig;
      }
    }, "image/png");
  }).catch(()=>btn.textContent=orig);
}
