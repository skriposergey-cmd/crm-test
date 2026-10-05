/* ═══════════════ ЕКРАННА ЦИФРОВА КЛАВІАТУРА ═══════════════
   Модалка по центру. Ввід тільки через екранні кнопки (поле readonly).
   Три режими: телефон (openPhoneKeypad), ціна (openPriceKeypad),
   термін у днях (openTermKeypad).
   - startValue: поточне значення (рядок/число)
   - onChange(newValue): викликається на кожну зміну (для live-підказок/чека)
   - onDone(finalValue): викликається при «Готово» або закритті */

let _kpValue = "";
let _kpOnChange = null;
let _kpOnDone = null;
let _kpMode = "phone";

function openPhoneKeypad(startValue, onChange, onDone) {
  let v = (startValue || "").trim();
  if (!v) v = "+380 ";
  _openKeypad("phone", "Номер телефону", v, onChange, onDone);
}

function openPriceKeypad(startValue, onChange, onDone) {
  const v = (startValue != null && startValue !== "") ? String(parseInt(startValue) || 0) : "";
  _openKeypad("price", "Ціна", v, onChange, onDone);
}

function openTermKeypad(startValue, onChange, onDone) {
  const v = (startValue != null && startValue !== "") ? String(parseInt(startValue) || 0) : "";
  _openKeypad("term", "Термін, днів", v, onChange, onDone);
}

function _openKeypad(mode, title, startValue, onChange, onDone) {
  _kpMode = mode;
  _kpValue = startValue;
  _kpOnChange = onChange || null;
  _kpOnDone = onDone || null;

  let bg = document.getElementById("kp-bg");
  if (!bg) {
    bg = document.createElement("div");
    bg.id = "kp-bg";
    bg.className = "kp-bg";
    bg.onclick = function(e) { if (e.target === bg) closePhoneKeypad(); };
    document.body.appendChild(bg);
  }

  const grid = (mode === "price" || mode === "term")
    ? (kpBtn("1") + kpBtn("2") + kpBtn("3") +
       kpBtn("4") + kpBtn("5") + kpBtn("6") +
       kpBtn("7") + kpBtn("8") + kpBtn("9") +
       "<span></span>" + kpBtn("0") +
       "<button class='kp-key kp-del' onclick='kpPress(\"del\")'>⌫</button>")
    : (kpBtn("1") + kpBtn("2") + kpBtn("3") +
       kpBtn("4") + kpBtn("5") + kpBtn("6") +
       kpBtn("7") + kpBtn("8") + kpBtn("9") +
       kpBtn("+") + kpBtn("0") +
       "<button class='kp-key kp-del' onclick='kpPress(\"del\")'>⌫</button>");

  bg.innerHTML =
    "<div class='kp-modal'>" +
      "<div class='kp-modal-head'>" +
        "<span class='kp-modal-title'>" + title + "</span>" +
        "<div class='kp-close' onclick='closePhoneKeypad()'>×</div>" +
      "</div>" +
      "<div class='kp-display' id='kp-display'></div>" +
      (mode === "phone" ? "<div class='kp-phone-hint' id='kp-phone-hint'></div>" : "") +
      "<div class='kp-grid'>" + grid + "</div>" +
      "<button class='kp-done' id='kp-done' onclick='kpDone()'>Готово</button>" +
    "</div>";
  bg.classList.add("open");
  kpRenderDisplay();
}

function kpBtn(k) {
  return "<button class='kp-key' onclick='kpPress(\"" + k + "\")'>" + k + "</button>";
}

function kpPress(k) {
  if (k === "del") _kpValue = _kpValue.slice(0, -1);
  else if (k === "+") { if (!_kpValue.includes("+")) _kpValue = "+" + _kpValue; }
  else if (_kpMode === "phone" && kpPhoneLocalDigits().length >= 9) { /* номер вже повний — зайві цифри ігноруємо */ }
  else _kpValue += k;
  kpRenderDisplay();
  if (_kpOnChange) _kpOnChange(_kpValue);
}

function kpPhoneLocalDigits() {
  const digitsOnly = (_kpValue || "").replace(/\D/g, "");
  return digitsOnly.indexOf("380") === 0 ? digitsOnly.slice(3) : digitsOnly;
}
function kpPhoneValid() {
  return kpPhoneLocalDigits().length >= 9;
}
function kpDone() {
  if (_kpMode === "phone" && !kpPhoneValid()) return;
  closePhoneKeypad();
}

function kpRenderDisplay() {
  const d = document.getElementById("kp-display");
  if (!d) return;
  if (_kpMode === "price") {
    const n = parseInt(_kpValue || "0") || 0;
    d.textContent = n.toLocaleString("uk-UA") + " ₴";
  } else if (_kpMode === "term") {
    const n = parseInt(_kpValue || "0") || 0;
    d.textContent = n + " дн";
  } else if (_kpMode === "phone") {
    const local = kpPhoneLocalDigits().slice(0, 9);
    const parts = [local.slice(0,2), local.slice(2,5), local.slice(5,7), local.slice(7,9)].filter(p => p.length);
    d.textContent = "+380" + (parts.length ? " " + parts.join(" ") : "");
    const hint = document.getElementById("kp-phone-hint");
    const valid = local.length >= 9;
    if (hint) {
      hint.textContent = valid ? "Номер введено повністю" : "Введіть номер повністю (" + local.length + " з 9 цифр)";
      hint.classList.toggle("ok", valid);
    }
    const btn = document.getElementById("kp-done");
    if (btn) {
      btn.disabled = !valid;
      btn.classList.toggle("kp-done-disabled", !valid);
    }
  } else {
    d.textContent = _kpValue || "";
  }
}

function closePhoneKeypad() {
  const bg = document.getElementById("kp-bg");
  if (bg) bg.classList.remove("open");
  if (_kpOnDone) _kpOnDone(_kpValue);
  _kpOnChange = null;
  _kpOnDone = null;
}
