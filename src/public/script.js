"use strict";

/* =========================================================
   Sozlamalar va shablonlar
   ========================================================= */

const MODES = { bw: "Oq-qora", gray: "Kulrang", color: "Rangli" };

const DEFAULT_TEMPLATES = [
  {
    id: "ariza",
    name: "Arizalarni skanerlash",
    kind: "auto", // auto: taymer bilan, manual: har varaqni o'zi tanlaydi
    dpi: "200",
    countdown: 3, // soniya (3..10)
    steps: ["gray", "color"], // 1-varaq Kulrang, 2-varaq Rangli
    rest: "gray", // qolganlari Kulrang
    qrNaming: true, // fayl nomi = QR dagi ariza raqami
    maxPages: 20, // xavfsizlik: bir hujjatda shundan ortiq varaq bo'lsa to'xtaydi
    builtin: true,
  },
  {
    id: "manual",
    name: "Qo'lda",
    kind: "manual",
    dpi: "200",
    countdown: 3,
    steps: [],
    rest: "gray",
    qrNaming: true,
    maxPages: 50,
    builtin: true,
  },
];

const STORAGE = {
  templates: "fastScan.templates",
  active: "fastScan.activeTemplate",
  saved: "fastScan.saved",
  lastScan: "lastFastScanTime",
};

function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeTemplate(t) {
  const countdown = Math.min(10, Math.max(3, Number(t.countdown) || 3));
  const maxPages = Math.min(200, Math.max(1, Number(t.maxPages) || 20));
  return {
    id: String(t.id),
    name: String(t.name || "Nomsiz shablon").slice(0, 60),
    kind: t.kind === "manual" ? "manual" : "auto",
    dpi: ["100", "150", "200", "300", "400"].includes(String(t.dpi))
      ? String(t.dpi)
      : "200",
    countdown,
    steps: (Array.isArray(t.steps) ? t.steps : []).filter((m) => m in MODES),
    rest: t.rest in MODES ? t.rest : "gray",
    qrNaming: t.qrNaming !== false,
    maxPages,
    builtin: Boolean(t.builtin),
  };
}

function loadTemplates() {
  const stored = storageGet(STORAGE.templates, null);
  let list = Array.isArray(stored) ? stored.map(normalizeTemplate) : [];
  // Standart shablonlar doim mavjud bo'lsin
  for (const def of DEFAULT_TEMPLATES) {
    if (!list.some((t) => t.id === def.id)) list.push(clone(def));
  }
  const order = (t) => DEFAULT_TEMPLATES.findIndex((d) => d.id === t.id);
  list.sort((a, b) => {
    const oa = order(a);
    const ob = order(b);
    if (oa !== -1 || ob !== -1) return (oa === -1 ? 99 : oa) - (ob === -1 ? 99 : ob);
    return 0;
  });
  return list;
}

let templates = loadTemplates();

/* =========================================================
   Holat
   ========================================================= */

const S = {
  template: null,
  // idle | scanning | countdown | paused | saving
  status: "idle",
  pausedMessage: "",
  pages: [], // { file, mode }
  scanningMode: null,
  pauseRequested: false,
  countdown: null, // { endAt, total, purpose, raf, lastNum }
  qr: { status: "none", file: null, docNumber: null, arizaId: null, promise: null },
};

function modeForPage(index) {
  const t = S.template;
  return t.steps[index] || t.rest;
}

function isAuto() {
  return S.template.kind === "auto";
}

/* =========================================================
   Elementlar
   ========================================================= */

const $ = (id) => document.getElementById(id);
const el = {
  templateSelect: $("templateSelect"),
  statusCard: $("statusCard"),
  statusTitle: $("statusTitle"),
  statusText: $("statusText"),
  nextPage: $("nextPage"),
  nameCard: $("nameCard"),
  nameValue: $("nameValue"),
  nameHint: $("nameHint"),
  sequence: $("sequence"),
  templateMeta: $("templateMeta"),
  primaryBtn: $("primaryBtn"),
  primaryBtnText: $("primaryBtnText"),
  manualButtons: $("manualButtons"),
  saveBtn: $("saveBtn"),
  removeLastBtn: $("removeLastBtn"),
  clearBtn: $("clearBtn"),
  savedList: $("savedList"),
  pageCount: $("pageCount"),
  pageGrid: $("pageGrid"),
  emptyState: $("emptyState"),
  countdown: $("countdown"),
  countdownCaption: $("countdownCaption"),
  countdownNumber: $("countdownNumber"),
  countdownSub: $("countdownSub"),
  ringFg: $("ringFg"),
  cdSaveBtn: $("cdSaveBtn"),
  cdNowBtn: $("cdNowBtn"),
  cdPauseBtn: $("cdPauseBtn"),
  nameModal: $("nameModal"),
  nameForm: $("nameForm"),
  nameInput: $("nameInput"),
  nameModalHint: $("nameModalHint"),
  nameCancelBtn: $("nameCancelBtn"),
  confirmModal: $("confirmModal"),
  templatesModal: $("templatesModal"),
};

function swatch(mode) {
  return `<span class="mode-swatch ${mode}"></span>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

/* =========================================================
   Render
   ========================================================= */

function render() {
  renderStatus();
  renderName();
  renderSequence();
  renderButtons();
  renderPages();
}

function renderStatus() {
  const n = S.pages.length;
  const next = n + 1;
  const nextMode = modeForPage(n);
  let title = "Tayyor";
  let text = "";
  let showNext = false;

  switch (S.status) {
    case "scanning":
      title = "Skanerlanmoqda…";
      text = `${n + 1}-varaq · ${MODES[S.scanningMode]}`;
      if (S.pauseRequested) text += " — shu varaqdan so'ng to'xtaydi";
      break;
    case "countdown":
      title = "Varaqni almashtiring";
      text = "Taymer tugagach keyingi varaq o'zi skanerlanadi.";
      showNext = true;
      break;
    case "paused":
      title = "To'xtatildi";
      text = S.pausedMessage || "Davom etish uchun Space ni bosing.";
      showNext = isAuto();
      break;
    case "saving":
      title = "Saqlanmoqda…";
      text = "PDF tayyorlanmoqda.";
      break;
    default:
      if (!isAuto()) {
        text = n
          ? "Keyingi varaq turini tanlang (1, 2, 3) yoki 0 bilan saqlang."
          : "Varaqni skanerga qo'ying va turini tanlang: 1 — Oq-qora, 2 — Kulrang, 3 — Rangli.";
      } else {
        text = "Birinchi varaqni skanerga qo'ying va «Boshlash» (Space) ni bosing.";
        showNext = true;
      }
  }

  el.statusCard.dataset.state = S.status;
  el.statusTitle.textContent = title;
  el.statusText.textContent = text;
  el.nextPage.innerHTML = showNext
    ? `Keyingi: ${next}-varaq ${swatch(nextMode)} ${MODES[nextMode]}`
    : "";
}

function renderName() {
  const t = S.template;
  const q = S.qr;
  let state = q.status;
  let value = "—";
  let hint = "Birinchi varaqdagi QR koddan olinadi";

  if (!t.qrNaming) {
    state = "off";
    value = "Qo'lda kiritiladi";
    hint = "Saqlashda fayl nomi so'raladi";
  } else if (q.status === "pending") {
    value = "QR o'qilmoqda…";
  } else if (q.status === "found") {
    value = q.docNumber;
    hint = "Ariza QR kodi o'qildi";
  } else if (q.status === "notfound") {
    value = "QR topilmadi";
    hint = "Saqlashda ariza raqamini o'zingiz kiritasiz";
  }

  el.nameCard.dataset.qr = state;
  el.nameValue.textContent = value;
  el.nameHint.textContent = hint;
}

function renderSequence() {
  const t = S.template;
  const n = S.pages.length;

  if (t.kind === "manual") {
    el.sequence.innerHTML = `<span class="seq-item">Har bir varaq turini o'zingiz tanlaysiz</span>`;
    el.templateMeta.textContent = `${t.dpi} dpi${t.qrNaming ? " · nom QR koddan" : ""}`;
    return;
  }

  const items = t.steps.map((mode, i) => {
    const cls = i < n ? "done" : i === n ? "current" : "";
    return `<span class="seq-item ${cls}"><span class="seq-num">${i + 1}</span>${swatch(mode)}${MODES[mode]}</span>`;
  });
  const restIndex = t.steps.length;
  const restCls = n >= restIndex ? "current" : "";
  const restLabel = restIndex === 0 ? "Hammasi" : `${restIndex + 1}+`;
  items.push(
    `<span class="seq-item ${restCls}"><span class="seq-num" style="width:auto;padding:0 6px;border-radius:999px">${restLabel}</span>${swatch(t.rest)}${MODES[t.rest]}</span>`
  );
  el.sequence.innerHTML = items.join("");
  el.templateMeta.textContent = `${t.dpi} dpi · taymer ${t.countdown} soniya${
    t.qrNaming ? " · nom QR koddan" : ""
  }`;
}

function renderButtons() {
  const st = S.status;
  const busy = st === "scanning" || st === "saving";
  const hasPages = S.pages.length > 0;

  el.primaryBtn.classList.toggle("hidden", !isAuto());
  el.manualButtons.classList.toggle("hidden", isAuto());

  if (st === "countdown" || st === "scanning") {
    el.primaryBtnText.textContent = S.pauseRequested ? "To'xtatilmoqda…" : "To'xtatish";
    el.primaryBtn.className = "btn btn-secondary btn-lg";
    el.primaryBtn.querySelector("kbd").textContent = "Esc";
    el.primaryBtn.disabled = S.pauseRequested;
  } else {
    el.primaryBtnText.textContent = st === "paused" && hasPages ? "Davom etish" : "Boshlash";
    el.primaryBtn.className = "btn btn-primary btn-lg";
    el.primaryBtn.querySelector("kbd").textContent = "Space";
    el.primaryBtn.disabled = st === "saving";
  }

  el.manualButtons.querySelectorAll("button").forEach((b) => (b.disabled = busy));
  el.saveBtn.disabled = !hasPages || st === "saving";
  el.removeLastBtn.disabled = !hasPages || busy;
  el.clearBtn.disabled = !hasPages || busy;
  el.templateSelect.disabled = busy || st === "countdown";
}

let renderedPagesKey = "";

function renderPages() {
  const n = S.pages.length;
  el.pageCount.textContent = n;
  const scanning = S.status === "scanning";
  el.emptyState.classList.toggle("hidden", n > 0 || scanning);

  // Faqat o'zgarganda qayta chizamiz (rasmlar qayta yuklanmasin)
  const key = JSON.stringify([S.pages, scanning && S.scanningMode, S.qr.status, S.qr.file]);
  if (key === renderedPagesKey) return;
  renderedPagesKey = key;

  el.pageGrid.innerHTML = "";
  S.pages.forEach((page, i) => {
    const div = document.createElement("div");
    div.className = "page";
    const qrBadge =
      i === 0 && S.qr.status === "found" && S.qr.file === page.file
        ? `<span class="page-qr">QR ✓</span>`
        : "";
    div.innerHTML = `
      <img src="/image/${encodeURIComponent(page.file)}" alt="${i + 1}-varaq" loading="lazy" />
      ${qrBadge}
      <span class="page-badge">${swatch(page.mode)}${i + 1} · ${MODES[page.mode]}</span>
      <button type="button" class="page-delete" title="O'chirish" aria-label="${i + 1}-varaqni o'chirish">✕</button>`;
    div.querySelector(".page-delete").addEventListener("click", () => removePage(i));
    el.pageGrid.appendChild(div);
  });

  if (scanning) {
    const div = document.createElement("div");
    div.className = "page scanning";
    div.innerHTML = `<span class="scan-line"></span><span>${n + 1}-varaq</span><span>${swatch(S.scanningMode)} ${MODES[S.scanningMode]}</span>`;
    el.pageGrid.appendChild(div);
    div.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

/* =========================================================
   Skanerlash sikli
   ========================================================= */

function setStatus(status, pausedMessage = "") {
  S.status = status;
  S.pausedMessage = pausedMessage;
  render();
}

async function scanPage(mode) {
  if (S.status === "scanning" || S.status === "saving") return;
  cancelCountdown();
  S.scanningMode = mode;
  S.pauseRequested = false;
  setStatus("scanning");

  try {
    const res = await fetch("/scanFromCanon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dpi: S.template.dpi, mode }),
    });
    const text = await res.text();
    if (!res.ok || !text) throw new Error(text || "Skaner javob bermadi");

    S.pages.push({ file: text, mode });
    if (S.pages.length === 1) detectQR();
  } catch (err) {
    S.pauseRequested = false;
    toast("Skanerlashda xatolik: " + err.message, "error");
    setStatus("paused", "Skanerlashda xatolik. Qayta urinish uchun Space ni bosing.");
    return;
  }

  afterScan();
}

function afterScan() {
  if (S.pauseRequested) {
    S.pauseRequested = false;
    setStatus("paused", "Hujjat tugagan bo'lsa 0 ni bosing, davom etish uchun Space.");
    return;
  }
  if (!isAuto()) {
    setStatus("idle");
    return;
  }
  if (S.pages.length >= S.template.maxPages) {
    setStatus(
      "paused",
      `Bir hujjatda ${S.template.maxPages} ta varaq bo'ldi. Saqlash uchun 0, davom etish uchun Space.`
    );
    return;
  }
  startCountdown("next");
}

function startCountdown(purpose) {
  cancelCountdown();
  const total = S.template.countdown * 1000;
  S.countdown = { endAt: performance.now() + total, total, purpose, raf: 0, lastNum: null };
  el.countdown.classList.remove("hidden");
  setStatus("countdown");
  updateCountdownText();
  tickCountdown();
}

function updateCountdownText() {
  const n = S.pages.length;
  const mode = modeForPage(n);
  const newDoc = n === 0;
  el.countdownCaption.textContent = newDoc
    ? "Yangi hujjat — birinchi varaqni qo'ying"
    : "Keyingi varaqni qo'ying";
  let sub = `${swatch(mode)} ${n + 1}-varaq · ${MODES[mode]}`;
  if (!newDoc && S.qr.status === "found") sub += ` · Ariza № ${escapeHtml(S.qr.docNumber)}`;
  el.countdownSub.innerHTML = sub;
  el.cdSaveBtn.classList.toggle("hidden", newDoc);
}

function tickCountdown() {
  const cd = S.countdown;
  if (!cd) return;
  const remaining = Math.max(0, cd.endAt - performance.now());
  const num = Math.ceil(remaining / 1000);

  if (num !== cd.lastNum) {
    cd.lastNum = num;
    el.countdownNumber.textContent = Math.max(1, num);
    el.countdownNumber.classList.remove("tick");
    void el.countdownNumber.offsetWidth; // animatsiyani qayta ishga tushirish
    el.countdownNumber.classList.add("tick");
  }
  const circumference = 565.49;
  el.ringFg.style.strokeDashoffset = String(circumference * (1 - remaining / cd.total));

  if (remaining <= 0) {
    hideCountdown();
    scanPage(modeForPage(S.pages.length));
    return;
  }
  cd.raf = requestAnimationFrame(tickCountdown);
}

function hideCountdown() {
  if (S.countdown) cancelAnimationFrame(S.countdown.raf);
  S.countdown = null;
  el.countdown.classList.add("hidden");
}

function cancelCountdown() {
  if (S.countdown) hideCountdown();
}

function primaryAction() {
  if (S.status === "countdown" || S.status === "scanning") return pause();
  if (S.status === "saving") return;
  start();
}

function start() {
  if (!isAuto()) return;
  if (S.status === "scanning" || S.status === "saving") return;
  const run = () => scanPage(modeForPage(S.pages.length));
  if (S.pages.length === 0) withHourCheck(run);
  else run();
}

function pause() {
  if (S.status === "countdown") {
    hideCountdown();
    setStatus(
      "paused",
      S.pages.length
        ? "Hujjat tugagan bo'lsa 0 ni bosing, davom etish uchun Space."
        : "Davom etish uchun Space ni bosing."
    );
  } else if (S.status === "scanning") {
    S.pauseRequested = true;
    render();
  }
}

function scanNow() {
  if (S.status === "countdown") {
    hideCountdown();
    scanPage(modeForPage(S.pages.length));
  }
}

function manualScan(mode) {
  if (S.status === "scanning" || S.status === "saving") return;
  const run = () => scanPage(mode);
  if (S.pages.length === 0) withHourCheck(run);
  else run();
}

/* =========================================================
   Saqlash
   ========================================================= */

async function requestSave() {
  if (S.status === "saving") return;
  if (S.status === "scanning") {
    S.pauseRequested = true;
    toast("Skanerlash tugagach to'xtaydi. So'ng 0 ni bosing.");
    render();
    return;
  }
  if (S.pages.length === 0) {
    toast("Saqlash uchun varaq yo'q", "error");
    return;
  }

  cancelCountdown();
  const previousStatus = S.status === "countdown" ? "paused" : S.status;
  setStatus("saving");

  const name = await resolveFileName();
  if (!name) {
    setStatus(previousStatus === "idle" ? "idle" : "paused", "Saqlash bekor qilindi. 0 — saqlash, Space — davom etish.");
    return;
  }

  try {
    const res = await fetch("/createPdfByImgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imgFileNames: S.pages.map((p) => p.file),
        outputFileName: name,
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text);

    const fileName = text.split(/[\\/]/).pop() || name + ".pdf";
    addSaved(fileName, S.pages.length);
    toast(`Saqlandi: ${fileName}`, "success");
    storageSet(STORAGE.lastScan, Date.now());
    resetDocument();
  } catch (err) {
    toast("PDF saqlashda xatolik: " + err.message, "error");
    setStatus("paused", "Saqlab bo'lmadi. Qayta urinish uchun 0 ni bosing.");
    return;
  }

  if (isAuto()) startCountdown("newdoc");
  else setStatus("idle");
}

async function resolveFileName() {
  if (S.template.qrNaming) {
    const q = await ensureQR();
    if (q && q.docNumber) return q.docNumber;
    return askFileName("QR kod o'qilmadi. Ariza raqamini kiriting.");
  }
  return askFileName("Fayl nomini kiriting.");
}

function askFileName(hint) {
  return new Promise((resolve) => {
    el.nameModalHint.textContent = hint;
    el.nameInput.value = "";
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      el.nameForm.removeEventListener("submit", onSubmit);
      el.nameCancelBtn.removeEventListener("click", onCancel);
      el.nameModal.removeEventListener("close", onClose);
      if (el.nameModal.open) el.nameModal.close();
      resolve(value);
    };
    const onSubmit = (e) => {
      e.preventDefault();
      const v = el.nameInput.value.trim();
      if (v) finish(v);
    };
    const onCancel = () => finish(null);
    const onClose = () => finish(null);
    el.nameForm.addEventListener("submit", onSubmit);
    el.nameCancelBtn.addEventListener("click", onCancel);
    el.nameModal.addEventListener("close", onClose);
    el.nameModal.showModal();
    el.nameInput.focus();
  });
}

function resetDocument() {
  S.pages = [];
  S.qr = { status: "none", file: null, docNumber: null, arizaId: null, promise: null };
  render();
}

function addSaved(name, pages) {
  const today = new Date().toDateString();
  const saved = storageGet(STORAGE.saved, { day: today, items: [] });
  const items = saved.day === today ? saved.items : [];
  items.unshift({ name, pages, at: Date.now() });
  storageSet(STORAGE.saved, { day: today, items: items.slice(0, 200) });
  renderSaved();
}

function renderSaved() {
  const today = new Date().toDateString();
  const saved = storageGet(STORAGE.saved, { day: today, items: [] });
  const items = saved.day === today ? saved.items : [];
  if (!items.length) {
    el.savedList.innerHTML = `<li class="saved-empty">Hali hech narsa saqlanmadi</li>`;
    return;
  }
  el.savedList.innerHTML = items
    .map((it) => {
      const time = new Date(it.at).toLocaleTimeString("uz", { hour: "2-digit", minute: "2-digit" });
      return `<li><span class="saved-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span><span class="saved-meta">${it.pages} varaq · ${time}</span></li>`;
    })
    .join("");
}

/* =========================================================
   QR kod (birinchi varaqdan)
   ========================================================= */

let qrWorker = null;
let qrSeq = 0;
const qrPending = new Map();

function decodeQR(file) {
  return new Promise((resolve) => {
    try {
      if (!qrWorker) {
        qrWorker = new Worker("/qr-worker.js");
        qrWorker.onmessage = (e) => {
          const cb = qrPending.get(e.data.id);
          if (cb) {
            qrPending.delete(e.data.id);
            cb(e.data.data || null);
          }
        };
      }
    } catch {
      resolve(null);
      return;
    }
    const id = ++qrSeq;
    qrPending.set(id, resolve);
    qrWorker.postMessage({ id, url: `/image/${encodeURIComponent(file)}` });
    setTimeout(() => {
      if (qrPending.has(id)) {
        qrPending.delete(id);
        resolve(null);
      }
    }, 15000);
  });
}

// Dashboarddagi Ariza QR formati: ariza_<arizaId>_<document_number>
function parseArizaQR(text) {
  if (!text) return null;
  const parts = text.trim().split("_");
  if (parts[0] !== "ariza" || parts.length < 3) return null;
  const docNumber = parts.slice(2).join("_");
  if (!docNumber) return null;
  return { arizaId: parts[1], docNumber };
}

function detectQR() {
  const first = S.pages[0];
  if (!first || !S.template.qrNaming) return null;
  const file = first.file;
  S.qr = { status: "pending", file, docNumber: null, arizaId: null, promise: null };
  S.qr.promise = decodeQR(file).then((text) => {
    if (S.qr.file !== file) return null; // varaq o'chirilgan/almashgan
    const parsed = parseArizaQR(text);
    if (parsed) {
      S.qr = { ...S.qr, status: "found", ...parsed };
    } else {
      S.qr = { ...S.qr, status: "notfound" };
      if (text) toast("QR kod ariza formatida emas", "error");
    }
    render();
    if (S.status === "countdown") updateCountdownText();
    return S.qr;
  });
  render();
  return S.qr.promise;
}

async function ensureQR() {
  const first = S.pages[0];
  if (!first) return null;
  if (S.qr.file !== first.file || S.qr.status === "none") detectQR();
  if (S.qr.status === "pending") await S.qr.promise;
  return S.qr.status === "found" ? S.qr : null;
}

/* =========================================================
   Varaqlarni boshqarish
   ========================================================= */

function removePage(index) {
  if (S.status === "scanning" || S.status === "saving") return;
  S.pages.splice(index, 1);
  afterPagesChanged();
}

function removeLast() {
  if (!S.pages.length || S.status === "scanning" || S.status === "saving") return;
  S.pages.pop();
  toast("Oxirgi varaq o'chirildi");
  afterPagesChanged();
}

function clearPages() {
  if (!S.pages.length || S.status === "scanning" || S.status === "saving") return;
  cancelCountdown();
  resetDocument();
  setStatus("idle");
  toast("Barcha varaqlar tozalandi");
}

function afterPagesChanged() {
  if (!S.pages.length) {
    S.qr = { status: "none", file: null, docNumber: null, arizaId: null, promise: null };
  } else if (S.qr.file !== S.pages[0].file && S.template.qrNaming) {
    detectQR();
  }
  if (S.status === "countdown") updateCountdownText();
  render();
}

/* =========================================================
   1 soatlik ogohlantirish
   ========================================================= */

function withHourCheck(run) {
  const last = Number(storageGet(STORAGE.lastScan, 0));
  const oneHour = 60 * 60 * 1000;
  if (!last || Date.now() - last <= oneHour) return run();

  const dialog = el.confirmModal;
  const confirmBtn = $("confirmScanBtn");
  const cancelBtn = $("cancelScanBtn");
  let confirmed = false;
  const onConfirm = () => {
    confirmed = true;
    dialog.close();
  };
  const onCancel = () => dialog.close();
  const onClose = () => {
    confirmBtn.removeEventListener("click", onConfirm);
    cancelBtn.removeEventListener("click", onCancel);
    dialog.removeEventListener("close", onClose);
    if (confirmed) {
      storageSet(STORAGE.lastScan, Date.now());
      run();
    }
  };
  confirmBtn.addEventListener("click", onConfirm);
  cancelBtn.addEventListener("click", onCancel);
  dialog.addEventListener("close", onClose);
  dialog.showModal();
  confirmBtn.focus();
}

/* =========================================================
   Shablon tanlash
   ========================================================= */

function renderTemplateSelect() {
  el.templateSelect.innerHTML = templates
    .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`)
    .join("");
  el.templateSelect.value = S.template.id;
}

function applyTemplate(id) {
  S.template = templates.find((t) => t.id === id) || templates[0];
  storageSet(STORAGE.active, S.template.id);
  renderTemplateSelect();
  if (S.template.qrNaming && S.pages.length && S.qr.status === "none") detectQR();
  render();
}

el.templateSelect.addEventListener("change", (e) => {
  applyTemplate(e.target.value);
  e.target.blur();
});

/* =========================================================
   Shablonlar muharriri
   ========================================================= */

const tpl = {
  list: $("tplList"),
  form: $("tplForm"),
  name: $("tplName"),
  dpi: $("tplDpi"),
  countdown: $("tplCountdown"),
  countdownValue: $("tplCountdownValue"),
  steps: $("tplSteps"),
  addStep: $("tplAddStepBtn"),
  rest: $("tplRest"),
  maxPages: $("tplMaxPages"),
  qr: $("tplQr"),
  deleteBtn: $("tplDeleteBtn"),
  closeBtn: $("tplCloseBtn"),
  newBtn: $("tplNewBtn"),
  editing: null, // tahrirlanayotgan nusxa
};

function modeOptions(selected) {
  return Object.entries(MODES)
    .map(([v, label]) => `<option value="${v}" ${v === selected ? "selected" : ""}>${label}</option>`)
    .join("");
}

function openTemplates() {
  pause();
  editTemplate(S.template.id);
  el.templatesModal.showModal();
}

function editTemplate(id) {
  const t = templates.find((x) => x.id === id);
  tpl.editing = clone(t);
  fillTemplateForm();
}

function fillTemplateForm() {
  const t = tpl.editing;
  tpl.list.innerHTML = templates
    .map(
      (x) =>
        `<li><button type="button" data-id="${escapeHtml(x.id)}" class="${x.id === t.id ? "active" : ""}">${escapeHtml(x.name)}</button></li>`
    )
    .join("");
  tpl.name.value = t.name;
  tpl.form.querySelectorAll('input[name="tplKind"]').forEach((r) => (r.checked = r.value === t.kind));
  tpl.form.dataset.kind = t.kind;
  tpl.dpi.value = t.dpi;
  tpl.countdown.value = t.countdown;
  tpl.countdownValue.textContent = t.countdown;
  tpl.rest.value = t.rest;
  tpl.maxPages.value = t.maxPages;
  tpl.qr.checked = t.qrNaming;
  tpl.deleteBtn.textContent = t.builtin ? "Standartga qaytarish" : "O'chirish";
  tpl.deleteBtn.classList.toggle("hidden", t.builtin && !DEFAULT_TEMPLATES.some((d) => d.id === t.id));
  renderSteps();
}

function renderSteps() {
  const steps = tpl.editing.steps;
  tpl.steps.innerHTML = steps
    .map(
      (mode, i) => `<li>
        <span class="step-label">${i + 1}-varaq</span>
        <select data-i="${i}">${modeOptions(mode)}</select>
        <button type="button" class="step-remove" data-i="${i}" title="Olib tashlash">✕</button>
      </li>`
    )
    .join("");
}

tpl.list.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-id]");
  if (btn) editTemplate(btn.dataset.id);
});

tpl.steps.addEventListener("change", (e) => {
  if (e.target.matches("select[data-i]")) tpl.editing.steps[Number(e.target.dataset.i)] = e.target.value;
});

tpl.steps.addEventListener("click", (e) => {
  const btn = e.target.closest(".step-remove");
  if (!btn) return;
  tpl.editing.steps.splice(Number(btn.dataset.i), 1);
  renderSteps();
});

tpl.addStep.addEventListener("click", () => {
  tpl.editing.steps.push(tpl.editing.rest || "gray");
  renderSteps();
});

tpl.countdown.addEventListener("input", () => {
  tpl.countdownValue.textContent = tpl.countdown.value;
});

tpl.form.querySelectorAll('input[name="tplKind"]').forEach((r) =>
  r.addEventListener("change", () => {
    tpl.form.dataset.kind = r.value;
  })
);

tpl.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const kind = tpl.form.querySelector('input[name="tplKind"]:checked')?.value || "auto";
  const updated = normalizeTemplate({
    ...tpl.editing,
    name: tpl.name.value.trim(),
    kind,
    dpi: tpl.dpi.value,
    countdown: tpl.countdown.value,
    rest: tpl.rest.value,
    maxPages: tpl.maxPages.value,
    qrNaming: tpl.qr.checked,
  });
  const i = templates.findIndex((t) => t.id === updated.id);
  if (i === -1) templates.push(updated);
  else templates[i] = updated;
  storageSet(STORAGE.templates, templates);
  tpl.editing = clone(updated);
  fillTemplateForm();
  applyTemplate(S.template.id === updated.id ? updated.id : S.template.id);
  toast("Shablon saqlandi", "success");
});

tpl.newBtn.addEventListener("click", () => {
  const base = clone(DEFAULT_TEMPLATES[0]);
  tpl.editing = { ...base, id: "t" + Date.now(), name: "Yangi shablon", builtin: false };
  fillTemplateForm();
  tpl.name.focus();
  tpl.name.select();
});

tpl.deleteBtn.addEventListener("click", () => {
  const t = tpl.editing;
  if (t.builtin) {
    const def = DEFAULT_TEMPLATES.find((d) => d.id === t.id);
    if (!def) return;
    templates = templates.map((x) => (x.id === t.id ? clone(def) : x));
    storageSet(STORAGE.templates, templates);
    editTemplate(t.id);
    applyTemplate(S.template.id);
    toast("Standart sozlamalar tiklandi");
    return;
  }
  if (!templates.some((x) => x.id === t.id)) {
    // hali saqlanmagan yangi shablon
    editTemplate(S.template.id);
    return;
  }
  if (!confirm(`«${t.name}» shablonini o'chirasizmi?`)) return;
  templates = templates.filter((x) => x.id !== t.id);
  storageSet(STORAGE.templates, templates);
  applyTemplate(S.template.id === t.id ? templates[0].id : S.template.id);
  editTemplate(S.template.id);
});

tpl.closeBtn.addEventListener("click", () => el.templatesModal.close());

/* =========================================================
   Hodisalar
   ========================================================= */

el.primaryBtn.addEventListener("click", primaryAction);
el.saveBtn.addEventListener("click", requestSave);
el.removeLastBtn.addEventListener("click", removeLast);
el.clearBtn.addEventListener("click", clearPages);
el.cdSaveBtn.addEventListener("click", requestSave);
el.cdNowBtn.addEventListener("click", scanNow);
el.cdPauseBtn.addEventListener("click", pause);
$("openTemplatesBtn").addEventListener("click", openTemplates);
el.manualButtons.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-mode]");
  if (btn) manualScan(btn.dataset.mode);
});

// Tugma bosilgach fokusda qolib, Space/Enter uni qayta bosmasin
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (btn && !btn.closest("dialog")) btn.blur();
});

window.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]")) return;
  const a = document.activeElement;
  const typing =
    a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable);
  if (typing) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  switch (e.key) {
    case " ":
      e.preventDefault();
      if (S.status === "countdown") scanNow();
      else if (S.status !== "scanning") start();
      break;
    case "Enter":
      e.preventDefault();
      if (S.status === "countdown") scanNow();
      else start();
      break;
    case "Escape":
      e.preventDefault();
      pause();
      break;
    case "0":
    case "s":
    case "S":
      e.preventDefault();
      requestSave();
      break;
    case "Backspace":
      e.preventDefault();
      removeLast();
      break;
    case "1":
    case "2":
    case "3":
      if (!isAuto()) {
        e.preventDefault();
        manualScan({ 1: "bw", 2: "gray", 3: "color" }[e.key]);
      }
      break;
  }
});

window.addEventListener("beforeunload", (e) => {
  if (S.pages.length) {
    e.preventDefault();
    e.returnValue = "";
  }
});

/* =========================================================
   Toast
   ========================================================= */

function toast(message, type = "info") {
  const container = $("toast-container");
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  container.appendChild(node);
  setTimeout(() => {
    node.style.opacity = "0";
    setTimeout(() => node.remove(), 300);
  }, 3000);
}

/* =========================================================
   Ishga tushirish
   ========================================================= */

applyTemplate(storageGet(STORAGE.active, DEFAULT_TEMPLATES[0].id));
renderSaved();
