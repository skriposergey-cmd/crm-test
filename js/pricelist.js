/* ═══════ ОНЛАЙН-ПРАЙС (pricelist.js) ═══════
   Вкладка прайсу (перегляд). УВАГА: містить renderers.pricelist = ...,
   тому підключається ПІСЛЯ основного <script> (коли renderers вже існує).
   Залежить від глобальних: PRICE, priceLoaded, renderers, showPage. */

/* ═══════════════ ВКЛАДКА ОНЛАЙН-ПРАЙС (для консультацій) ═══════════════ */
let plCat = "";
let plSearch = "";
let plDept = "";
function setPlDept(d) { plDept = d; renderers.pricelist(); }
function plDays(n) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return "день";
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return "дні";
  return "днів";
}
function plTermText(t) {
  const s = String(t).trim();
  if (/^\d+$/.test(s)) { const n = parseInt(s); return n + " " + plDays(n); }
  return s;
}

/* Розкладка карток прайсу по колонках — зберігається в цьому браузері (перетягуванням) */
function plLayoutKey(catKey) { return "rw_pl_layout_" + catKey; }
function plSavedLayout(catKey) {
  try { return JSON.parse(localStorage.getItem(plLayoutKey(catKey)) || "null"); } catch(e) { return null; }
}
function plSaveLayout(catKey, cols) {
  try { localStorage.setItem(plLayoutKey(catKey), JSON.stringify(cols)); } catch(e) {}
}
/* Повертає масив колонок (масив назв відділів). Нерозміщені — у коротшу колонку. */
function plColumns(catKey, nCols) {
  nCols = nCols || 2;
  const all = Object.keys(PRICE[catKey].departments);
  const cols = []; for (let i=0;i<nCols;i++) cols.push([]);
  const placed = new Set();
  const saved = plSavedLayout(catKey);
  if (saved && Array.isArray(saved)) {
    saved.forEach((col, ci) => {
      const target = Math.min(ci, nCols-1);
      (col||[]).forEach(d => { if (all.includes(d) && !placed.has(d)) { cols[target].push(d); placed.add(d); } });
    });
  }
  const weight = ci => cols[ci].reduce((n,d) => n + PRICE[catKey].departments[d].length, 0);
  all.filter(d => !placed.has(d)).forEach(d => {
    let min = 0; for (let i=1;i<nCols;i++) if (weight(i) < weight(min)) min = i;
    cols[min].push(d);
  });
  return cols;
}
const PL_GRIP = "<span class='pl-grip'><svg viewBox='0 0 20 20' width='12' height='12' fill='currentColor'><circle cx='7' cy='4.5' r='1.5'/><circle cx='13' cy='4.5' r='1.5'/><circle cx='7' cy='10' r='1.5'/><circle cx='13' cy='10' r='1.5'/><circle cx='7' cy='15.5' r='1.5'/><circle cx='13' cy='15.5' r='1.5'/></svg></span>";

function plCardFor(s) {
  const hint = svcHint(s.name);
  return "<div class='pl-scard' onclick=\"this.classList.toggle('pl-lit')\">" +
    "<div class='pl-scard-name'>" + s.name + "</div>" +
    (hint ? "<div class='pl-scard-hint'>" + hint + "</div>" : "") +
    "<div class='pl-scard-foot'>" +
      "<div class='pl-scard-price'>" + s.price.toLocaleString("uk-UA") + " ₴" +
        (s.unit ? "<span class='pl-unit'> / " + s.unit + "</span>" : "") + "</div>" +
      (s.term ? "<div class='pl-scard-term'>⏱ " + plTermText(s.term) + "</div>" : "") +
    "</div>" +
  "</div>";
}
/* Будує лише HTML карток за поточним пошуком/фільтром (без поля пошуку) */
function plBuildCards() {
  const cats = Object.keys(PRICE);
  if (!cats.length) return "<div class='orders-empty'>Прайс порожній</div>";
  if (!plCat || !PRICE[plCat]) plCat = cats[0];
  const q = plSearch.trim().toLowerCase();
  let cardsHTML = "";
  if (q) {
    cats.forEach(catKey => Object.keys(PRICE[catKey].departments).forEach(dept => {
      PRICE[catKey].departments[dept].forEach(s => {
        if (s.active === false) return;
        if (s.name.toLowerCase().includes(q) || dept.toLowerCase().includes(q)) cardsHTML += plCardFor(s);
      });
    }));
  } else {
    const depts = Object.keys(PRICE[plCat].departments);
    (plDept ? [plDept] : depts).forEach(dept => {
      (PRICE[plCat].departments[dept] || []).forEach(s => { if (s.active !== false) cardsHTML += plCardFor(s); });
    });
  }
  return cardsHTML ? "<div class='pl-cards'>" + cardsHTML + "</div>" : "<div class='orders-empty'>Нічого не знайдено</div>";
}

renderers.pricelist = function() {
  const page = document.getElementById("page-pricelist");
  try {
  if (!priceLoaded) {
    page.innerHTML = "<div class='page-header'><div class='page-title'>Прайс</div></div>" +
      "<div class='orders-loading'>Завантаження...</div>";
    return;
  }
  const cats = Object.keys(PRICE);
  if (!cats.length) {
    page.innerHTML = "<div class='page-header'><div class='page-title'>Прайс</div></div>" +
      "<div class='orders-empty'>Прайс порожній</div>";
    return;
  }
  if (!plCat || !PRICE[plCat]) plCat = cats[0];

  const q = plSearch.trim().toLowerCase();
  const tabs = cats.map(k =>
    "<button class='pl-tab" + (plCat===k?" active":"") + "' onclick=\"setPlCat('" + k + "')\">" + PRICE[k].label + "</button>"
  ).join("");

  const depts = Object.keys(PRICE[plCat].departments);
  if (plDept && !depts.includes(plDept)) plDept = "";
  const filters = "<button class='pl-filter" + (!plDept?" active":"") + "' onclick=\"setPlDept('')\">Усі</button>" +
    depts.map(d => "<button class='pl-filter" + (plDept===d?" active":"") + "' onclick=\"setPlDept('" + d.replace(/'/g,"\\'") + "')\">" + d + "</button>").join("");

  const searchSVG = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>";

  page.innerHTML =
    "<div class='page-header'><div class='page-title'>Прайс</div></div>" +
    "<div class='tab-scroll'><div class='pl-wrap'>" +
      "<div class='pl-tabs'>" + tabs + "</div>" +
      "<div class='pl-searchbar'>" + searchSVG +
        "<input type='text' id='pl-search-input' placeholder='Пошук послуги…' value=\"" + plSearch.replace(/"/g,"&quot;") + "\" oninput='onPlSearch(this.value)'></div>" +
      "<div id='pl-filters-wrap'>" + (q ? "" : "<div class='pl-filters'>" + filters + "</div>") + "</div>" +
      "<div id='pl-results'>" + plBuildCards() + "</div>" +
    "</div></div>";
  } catch(e) {
    page.innerHTML = "<div class='page-header'><div class='page-title'>Прайс</div></div>" +
      "<div style='padding:20px;color:#E24B4A;font-size:13px'>Помилка прайсу: " + (e.message || e) + "</div>";
  }
};

function setPlCat(k) { plCat = k; plDept = ""; renderers.pricelist(); }
function plFiltersHTML() {
  const depts = Object.keys(PRICE[plCat].departments);
  if (plDept && !depts.includes(plDept)) plDept = "";
  return "<div class='pl-filters'><button class='pl-filter" + (!plDept?" active":"") + "' onclick=\"setPlDept('')\">Усі</button>" +
    depts.map(d => "<button class='pl-filter" + (plDept===d?" active":"") + "' onclick=\"setPlDept('" + d.replace(/'/g,"\\'") + "')\">" + d + "</button>").join("") + "</div>";
}
function onPlSearch(v) {
  plSearch = v;
  // Оновлюємо лише результати й фільтри — поле пошуку не чіпаємо, щоб клавіатура не закривалась
  const results = document.getElementById("pl-results");
  if (results) results.innerHTML = plBuildCards();
  const fwrap = document.getElementById("pl-filters-wrap");
  if (fwrap) fwrap.innerHTML = v.trim() ? "" : plFiltersHTML();
}