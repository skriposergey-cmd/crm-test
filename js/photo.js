/* ═══════ ФОТО (photo.js) ═══════
   Перегляд фото з Google Drive. Самодостатній модуль. */

/* ─── ФОТО: перетворення посилання Google Drive на пряме зображення ─── */
function driveFileId(url) {
  if (!url) return "";
  const u = url.trim();
  let m = u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  m = u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  m = u.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  return "";
}

/* Кілька варіантів адреси — якщо перший не відкриється, пробуємо наступний */
function photoCandidates(url) {
  const u = (url || "").trim();
  if (!u) return [];
  if (/\.(jpg|jpeg|png|webp|gif|heic)(\?|$)/i.test(u)) return [u];
  const id = driveFileId(u);
  if (id) return [
    "https://lh3.googleusercontent.com/d/" + id + "=w1200",
    "https://drive.google.com/thumbnail?id=" + id + "&sz=w1200",
    "https://drive.google.com/uc?export=view&id=" + id
  ];
  return [u];
}

function photoDirectUrl(url) {
  const c = photoCandidates(url);
  return c.length ? c[0] : "";
}

/* Перемикання на наступний варіант адреси при помилці завантаження */
function photoNext(img) {
  const cands = (img.dataset.cands || "").split("|").filter(Boolean);
  let i = parseInt(img.dataset.i || "0") + 1;
  if (i < cands.length) {
    img.dataset.i = i;
    img.src = cands[i];
    return;
  }
  const orig = img.dataset.orig || "";
  const holder = img.parentElement;
  if (holder) {
    holder.innerHTML = "<a class='tailor-photo-link' href='" + orig + "' target='_blank' rel='noopener'>Не вдалося показати — відкрити ↗</a>";
  }
}

/* Розмітка однієї фотографії */
function photoImgHTML(url, cls, noZoom) {
  const cands = photoCandidates(url);
  if (!cands.length) return "";
  return "<img class='" + (cls || "") + "' src='" + cands[0] + "' loading='lazy' alt='Фото' " +
    "data-cands='" + cands.join("|") + "' data-i='0' data-orig='" + url + "' " +
    "onerror='photoNext(this)'" + (noZoom ? "" : " onclick=\"event.stopPropagation();openPhoto(this.src)\"") + ">";
}

function openPhoto(src) {
  let ov = document.getElementById("photo-viewer");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "photo-viewer";
    ov.onclick = function(){ ov.classList.remove("open"); };
    document.body.appendChild(ov);
  }
  ov.innerHTML = "<img src='" + src + "' alt='Фото'>";
  ov.classList.add("open");
}
