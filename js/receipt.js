/* ═══════ ЧЕК (receipt.js) ═══════
Винесено з index.html. Залежить від глобальних: NO, ORDERS, ITEMS,
gv, extractAmt, html2canvas — вони лишаються в основному коді. */

function escHtml(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;");
}

/* Форматує номер тільки для показу (+380 XX XXX XX XX) — не чіпає збережене
   значення, щоб не зламати пошук/зіставлення клієнтів по точному рядку. */
function fmtPhone(raw) {
  const digitsOnly = String(raw || "").replace(/\D/g, "");
  const local = digitsOnly.indexOf("380") === 0 ? digitsOnly.slice(3) : digitsOnly;
  if (local.length < 9) return raw || "";
  const parts = [local.slice(0,2), local.slice(2,5), local.slice(5,7), local.slice(7,9)];
  return "+380 " + parts.join(" ");
}

/* Розраховує статус оплати за сумою замовлення та рядком "Оплата".
   Повертає { isPrepay, prepayAmt, toPay, isPaid } — використовується
   і у формі створення (NO), і в готових замовленнях (ORDERS). */
function computePayStatus(total, paymentStr, prepayAmt, settleAmt) {
  const isPrepay = (paymentStr || "").includes("Передплата") || (paymentStr || "").includes("Передоплата");
  const paidTotal = (isPrepay ? (prepayAmt || 0) : 0) + (settleAmt || 0);
  const toPay = Math.max(0, total - paidTotal);
  return { isPrepay, prepayAmt: prepayAmt || 0, toPay, isPaid: total > 0 && toPay <= 0 };
}

function payBlockHTML(total, status) {
  if (total <= 0) return "";
  if (status.isPaid) {
    return "<div class='r-payblock'><div class='r-payrow'><span class='pr-label'>Сплачено</span><span class='pr-value'>" + total.toLocaleString("uk-UA") + " ₴</span></div></div>";
  }
  if (status.isPrepay && status.prepayAmt) {
    return "<div class='r-payblock'>" +
      "<div class='r-payrow'><span class='pr-label'>Передплата</span><span class='pr-value'>" + status.prepayAmt.toLocaleString("uk-UA") + " ₴</span></div>" +
      "<div class='r-payrow'><span class='pr-label'>Залишок</span><span class='pr-value pr-due'>" + status.toPay.toLocaleString("uk-UA") + " ₴</span></div>" +
      "</div>";
  }
  return "";
}

function footerText(status) {
  if (status.isPaid) return "Дякуємо за довіру.<br>Носіть із задоволенням";
  if (status.isPrepay) return "Дякуємо за довіру до нашої роботи.";
  return "Дякуємо за довіру.";
}

function receiptHeaderHTML(num, dateStr) {
  return "<div class='r-header'><div class='r-logo'>Rewise Studio</div><div class='r-subtag'>Ремонт · Реставрація · Чищення</div></div>" +
    "<div class='r-meta'><span class='r-meta-num'>" + escHtml(num || "") + "</span><span>" + dateStr + "</span></div>";
}

function receiptClientHTML(client, phone, term, delivery) {
  const hasLeft = client || phone;
  const hasRight = term || delivery;
  if (!hasLeft && !hasRight) return "";
  const left = "<div class='r-ccol'>" +
    (client ? "<div class='r-crow'><span class='rc-label'>Клієнт</span></div><div class='rc-value-2col'>" + escHtml(client) + "</div>" : "") +
    (phone ? "<div class='r-crow'><span class='rc-label'>Телефон</span></div><div class='rc-value-2col'>" + escHtml(fmtPhone(phone)) + "</div>" : "") +
    "</div>";
  const right = "<div class='r-ccol'>" +
    (term ? "<div class='r-crow'><span class='rc-label'>Термін</span></div><div class='rc-value-2col'>" + escHtml(term) + "</div>" : "") +
    (delivery ? "<div class='r-crow'><span class='rc-label'>Отримання</span></div><div class='rc-value-2col'>" + escHtml(delivery) + "</div>" : "") +
    "</div>";
  return "<div class='r-client r-client-2col'>" + left + right + "</div>";
}

function updateReceipt() {
  const receipt = document.getElementById("receipt");
  if (!receipt) return;
  const hasSvc = NO.items.some(i => i.services.length > 0);
  if (!hasSvc) {
    receipt.innerHTML = "<div class='r-empty'><div class='icon'>🧾</div>Додайте річ та послуги — тут з'явиться кошторис</div>";
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric"}) + " · " + now.toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"});

  let total = 0, itemsHTML = "";
  NO.items.forEach((item, idx) => {
    if (!item.services.length) return;
    item.services.forEach(s => total += s.price);
    const svcs = item.services.map(s => "<div class='r-svcrow'><span>"+escHtml(s.name)+"</span><span class='rs-price'>"+s.price+" ₴</span></div>").join("");
    const label = [item.model, item.brand].filter(Boolean).join(" · ");
    const noteHTML = item.note ? "<div class='r-item-note'>Коментар: "+escHtml(item.note)+"</div>" : "";
    itemsHTML += "<div class='r-item'><div class='r-item-title'><span class='ri-num'>№"+(idx+1)+"</span>"+(label?"<span class='ri-name'>"+escHtml(label)+"</span>":"")+"</div>"+svcs+noteHTML+"</div>";
  });

  const term = NO.deadline || "";
  const delivery = NO.delivery || "";
  const clientHTML = receiptClientHTML(NO.client, NO.phone, term, delivery);

  const status = computePayStatus(total,
    NO.payment === "Передплата" ? "Передплата" : "",
    NO.payment === "Передплата" ? parseInt(NO.prepay) || 0 : 0,
    0);

  receipt.innerHTML =
    receiptHeaderHTML("", dateStr) +
    clientHTML +
    "<div class='r-items'>"+itemsHTML+"</div>" +
    (total>0 ? "<hr class='r-divider'><div class='r-total'><span class='rt-label'>Разом</span><span class='rt-amount'>"+total+" ₴</span></div>" + payBlockHTML(total, status) : "") +
    (total>0 ? "<div class='r-footer'>"+footerText(status)+"</div><div class='r-disclaimer'>Документ не є фіскальним чеком</div>" : "");
}

function shareReceipt() {
  const el = document.getElementById("receipt");
  if (!el || el.querySelector(".r-empty")) { alert("Додайте послуги для кошторису"); return; }
  const btn = document.querySelector("button[onclick=\"shareReceipt()\"]");
  const orig = btn ? btn.innerHTML : "";
  if (btn) btn.textContent = "Готую...";
  html2canvas(el, { backgroundColor: "#FFFFFF", scale: 2, useCORS: true }).then(canvas => {
    canvas.toBlob(blob => {
      const file = new File([blob], "rewise-koshtorys.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "Rewise — Кошторис" }).then(()=>{ if(btn) btn.innerHTML=orig; }).catch(()=>{ if(btn) btn.innerHTML=orig; });
      } else {
        const link = document.createElement("a");
        link.download = "rewise-koshtorys-"+Date.now()+".png";
        link.href = canvas.toDataURL("image/png"); link.click();
        if(btn) btn.innerHTML = orig;
      }
    }, "image/png");
  }).catch(()=>{ if(btn) btn.innerHTML=orig; });
}

function orderReceiptHTML(num) {
  const o = ORDERS.find(x => gv(x,"Номер замовлення") === num);
  const its = ITEMS.filter(i => gv(i,"Номер замовлення") === num);
  const client = o ? gv(o,"Ім'я клієнта") : "";
  const phone = o ? gv(o,"Телефон") : "";
  const created = o ? gv(o,"Дата створення") : "";
  const term = o ? gv(o,"Термін") : "";
  const delivery = its.length ? gv(its[0],"Доставка") : "";

  let total = 0, itemsHTML = "";
  its.forEach((it, idx) => {
    const amt = extractAmt(gv(it,"Сума")); total += amt;
    const name = [gv(it,"Тип"), gv(it,"Бренд")].filter(Boolean).join(" · ") || "Виріб";
    const itemNum = gv(it,"Номер виробу");
    const detailedSvcs = (typeof servicesOfItem === "function") ? servicesOfItem(itemNum) : [];
    const note = gv(it,"Коментар");
    let svcRow;
    if (detailedSvcs.length) {
      // Кожна послуга окремим рядком — з детального логу (лист «Послуги»)
      svcRow = detailedSvcs.map(s => {
        const p = extractAmt(gv(s,"Ціна"));
        return "<div class='r-svcrow'><span>" + escHtml(gv(s,"Назва")) + "</span><span class='rs-price'>" + p.toLocaleString("uk-UA") + " ₴</span></div>";
      }).join("");
    } else {
      // Фолбек для старих замовлень без детального логу — одним рядком, як раніше
      const svcs = gv(it,"Послуги");
      svcRow = "<div class='r-svcrow'><span>" + escHtml(svcs || "Послуги") + "</span><span class='rs-price'>" + amt.toLocaleString("uk-UA") + " ₴</span></div>";
    }
    const noteHTML = note ? "<div class='r-item-note'>Коментар: " + escHtml(note) + "</div>" : "";
    itemsHTML += "<div class='r-item'><div class='r-item-title'><span class='ri-num'>№" + (idx+1) + "</span><span class='ri-name'>" + escHtml(name) + "</span></div>" + svcRow + noteHTML + "</div>";
  });

  const payStr = o ? gv(o,"Оплата") : "";
  const prepayAmt = extractAmt(payStr);
  const settleAmt = o ? extractAmt(gv(o,"Сума доплати")) : 0;
  const status = computePayStatus(total, payStr, prepayAmt, settleAmt);

  const clientHTML = receiptClientHTML(client, phone, term, delivery);

  return "<div id='order-receipt'>" +
    receiptHeaderHTML(num, created) +
    clientHTML +
    "<div class='r-items'>" + itemsHTML + "</div>" +
    (total > 0 ? "<hr class='r-divider'><div class='r-total'><span class='rt-label'>Разом</span><span class='rt-amount'>" + total.toLocaleString("uk-UA") + " ₴</span></div>" + payBlockHTML(total, status) : "") +
    (total > 0 ? "<div class='r-footer'>" + footerText(status) + "</div><div class='r-disclaimer'>Документ не є фіскальним чеком</div>" : "") +
    "</div>";
}

function shareOrderReceipt(num) {
  const el = document.getElementById("order-receipt");
  if (!el) return;
  html2canvas(el, { backgroundColor: "#FFFFFF", scale: 2, useCORS: true }).then(canvas => {
    canvas.toBlob(blob => {
      const file = new File([blob], "rewise-chek-" + num + ".png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "Rewise — Чек " + num }).catch(()=>{});
      } else {
        const link = document.createElement("a");
        link.download = "rewise-chek-" + num + ".png";
        link.href = canvas.toDataURL("image/png"); link.click();
      }
    }, "image/png");
  }).catch(()=>{});
}

function saveOrderReceiptImage(num) {
  const el = document.getElementById("order-receipt");
  if (!el) return;
  html2canvas(el, { backgroundColor: "#FFFFFF", scale: 2, useCORS: true }).then(canvas => {
    const link = document.createElement("a");
    link.download = "rewise-chek-" + num + ".png";
    link.href = canvas.toDataURL("image/png"); link.click();
  }).catch(()=>{});
}
