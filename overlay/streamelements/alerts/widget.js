/* DePhantom alerts: StreamElements custom widget (YouTube).
   Paste widget.html / widget.css / widget.js / fields.json into the matching tabs of a
   StreamElements Custom Widget. Alerts queue up and play one at a time. */

const ICONS = {
  subscriber: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  member: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
  gift: '<path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>',
  superchat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M9 10h.01M13 10h.01M17 10h.01"/>',
  tip: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ---------- Effects ---------- */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>◆◇";
function scramble(node, text, duration = 900) {
  const start = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const settled = Math.floor(t * text.length);
    let out = text.slice(0, settled);
    for (let i = settled; i < text.length; i++) out += text[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    node.textContent = out;
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Counts a money amount up from zero, e.g. RM0.00 → RM5.00 */
function countUp(node, amount, duration = 1200) {
  const start = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - start) / duration);
    node.textContent = money(amount * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Confetti + spark explosion from the centre of the card */
let sparks = [];
let fxRunning = false;
function confetti(colors, count = 140) {
  const canvas = document.getElementById("fx");
  const ctx = canvas.getContext("2d");
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const card = document.querySelector(".card").getBoundingClientRect();
  const cx = card.left + card.width / 2, cy = card.top + card.height / 2;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 6 + Math.random() * 12;
    sparks.push({ x: cx + Math.cos(a) * card.width * .3, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, life: 1,
      decay: .006 + Math.random() * .01, w: 4 + Math.random() * 6, h: 2 + Math.random() * 4, rot: Math.random() * 6,
      spin: (Math.random() - .5) * .4, color: colors[i % colors.length], dot: Math.random() < .35 });
  }
  if (fxRunning) return;
  fxRunning = true;
  const step = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sparks = sparks.filter((k) => k.life > 0 && k.y < canvas.height + 20);
    for (const k of sparks) {
      k.x += k.vx; k.y += k.vy; k.vy += .28; k.vx *= .98; k.life -= k.decay; k.rot += k.spin;
      ctx.globalAlpha = Math.max(0, Math.min(1, k.life * 1.5));
      ctx.fillStyle = k.color;
      ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.rot);
      if (k.dot) { ctx.shadowColor = k.color; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, 0, k.h * .8, 0, 7); ctx.fill(); }
      else ctx.fillRect(-k.w / 2, -k.h / 2, k.w, k.h * Math.abs(Math.cos(k.rot * 2)) + .5);
      ctx.restore();
    }
    if (sparks.length) requestAnimationFrame(step);
    else { fxRunning = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };
  requestAnimationFrame(step);
}

const ACCENTS = { superchat: "#fbbf24", tip: "#fbbf24", member: "#34d399" };

let fields = {};
let currency = { symbol: "$", code: "USD" };
const queue = [];
let playing = false;

const el = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  try { return new Intl.NumberFormat("en", { style: "currency", currency: currency.code || "USD" }).format(n); }
  catch { return `${currency.symbol ?? ""}${n}`; }
};

/** Turns a StreamElements event into what the card shows, or null to ignore it. */
function describe(listener, event) {
  const name = event.displayName || event.name || "Someone";
  switch (listener) {
    case "subscriber-latest":
      if (!fields.subEnabled) return null;
      return { type: "subscriber", icon: "subscriber", kicker: fields.subTitle, name, detail: "", message: "", sound: fields.subSound };
    case "sponsor-latest": {
      if (!fields.memberEnabled) return null;
      if (event.isCommunityGift) return null; // individual gifts arrive after the bulk event
      if (event.bulkGifted) {
        return { type: "member", icon: "gift", kicker: fields.giftTitle, name: event.sender || name,
          detail: `gifted ${event.amount} membership${event.amount === 1 ? "" : "s"}`, message: "", sound: fields.memberSound };
      }
      const months = Number(event.amount) || 1;
      return { type: "member", icon: "member", kicker: fields.memberTitle, name,
        detail: months > 1 ? `Member for ${months} months` : (event.tier ? `${event.tier}` : "Welcome to the crew!"),
        message: event.message || "", sound: fields.memberSound };
    }
    case "superchat-latest":
      if (!fields.superchatEnabled) return null;
      return { type: "superchat", icon: "superchat", kicker: fields.superchatTitle, name,
        detail: money(event.amount), amount: Number(event.amount), message: event.message || "", sound: fields.superchatSound };
    case "tip-latest":
      if (!fields.tipEnabled) return null;
      return { type: "tip", icon: "tip", kicker: fields.tipTitle, name,
        detail: money(event.amount), amount: Number(event.amount), message: event.message || "", sound: fields.tipSound };
    default:
      return null;
  }
}

function enqueue(alert) {
  if (!alert) return;
  queue.push(alert);
  if (!playing) playNext();
}

async function playNext() {
  const alert = queue.shift();
  if (!alert) { playing = false; return; }
  playing = true;

  const box = el("alert");
  box.dataset.type = alert.type;
  el("badge").innerHTML = svg(alert.icon);
  el("kicker").textContent = alert.kicker;
  el("name").textContent = alert.name;
  el("detail").textContent = alert.detail;
  scramble(el("name"), alert.name, 1000);
  if (alert.amount != null) countUp(el("detail"), alert.amount);
  el("message").innerHTML = fields.showMessages ? escapeHtml(alert.message) : "";

  // Restart every animation inside the alert
  box.hidden = false;
  box.classList.remove("is-in", "is-out");
  box.querySelectorAll("*").forEach((n) => { n.style.animation = "none"; void n.offsetWidth; n.style.animation = ""; });
  box.classList.add("is-in");
  const cs = getComputedStyle(document.documentElement);
  const accent = ACCENTS[alert.type] ?? cs.getPropertyValue("--p").trim();
  setTimeout(() => confetti([accent, cs.getPropertyValue("--s").trim(), "#ffffff", accent]), 200);

  if (alert.sound) {
    const audio = new Audio(alert.sound);
    audio.volume = Math.min(1, Math.max(0, (Number(fields.volume) || 0) / 100));
    audio.play().catch(() => {});
  }

  const extra = alert.message ? Math.min(6, alert.message.length / 25) : 0; // longer messages stay longer
  await sleep(((Number(fields.duration) || 7) + extra) * 1000);
  box.classList.replace("is-in", "is-out");
  await sleep(650);
  box.hidden = true;
  await sleep((Number(fields.gap) || 1) * 1000);
  playNext();
}

const TESTS = {
  testSub: ["subscriber-latest", { name: "PhantomFan" }],
  testMember: ["sponsor-latest", { name: "SoulsVeteran", amount: 3 }],
  testGift: ["sponsor-latest", { name: "GenerousOne", sender: "GenerousOne", amount: 5, bulkGifted: true }],
  testSuperchat: ["superchat-latest", { name: "BossSlayer", amount: 5, message: "GG on that boss! First try next time 🔥" }],
  testTip: ["tip-latest", { name: "Maidenless", amount: 10, message: "For the snacks" }],
};

window.addEventListener("onWidgetLoad", (obj) => {
  fields = obj.detail.fieldData || {};
  currency = obj.detail.currency || currency;
  const root = document.documentElement.style;
  if (fields.primary) root.setProperty("--p", fields.primary);
  if (fields.secondary) root.setProperty("--s", fields.secondary);
  if (fields.background) root.setProperty("--bg", fields.background);
  root.zoom = (Number(fields.scale) || 100) / 100;
});

window.addEventListener("onEventReceived", (obj) => {
  const { listener, event } = obj.detail || {};
  if (listener === "widget-button" && TESTS[event.field]) {
    const [l, e] = TESTS[event.field];
    return enqueue(describe(l, e));
  }
  enqueue(describe(listener, event || {}));
});
