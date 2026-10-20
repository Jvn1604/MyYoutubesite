/**
 * Visual effects shared by the scenes: text decode, split letters, particle fields,
 * celebration bursts and screen flashes. Everything respects the "Animations" switch.
 */

const motionOff = () => document.documentElement.dataset.motion === "off";
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/\\|◆◇▲△";

/** Theme colours as CSS strings, read live so the control panel's colour changes apply. */
export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  return { p: cs.getPropertyValue("--p").trim() || "#a855f7", s: cs.getPropertyValue("--s").trim() || "#e04bff" };
}

/** "Hacker decode": random glyphs settle into the real text left to right. */
export function scramble(el, text, { duration = 900 } = {}) {
  text = String(text ?? "");
  if (motionOff() || !text) { el.textContent = text; return; }
  cancelAnimationFrame(el._scrambleRaf);
  const start = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const settled = Math.floor(t * text.length);
    let out = text.slice(0, settled);
    for (let i = settled; i < text.length; i++) {
      out += text[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (t < 1) el._scrambleRaf = requestAnimationFrame(frame);
  };
  el._scrambleRaf = requestAnimationFrame(frame);
}

/** Wraps every character in a span with --i so CSS can stagger per-letter animation. */
export function splitLetters(el, text) {
  el.setAttribute("aria-label", text);
  el.innerHTML = [...String(text ?? "")]
    .map((c, i) => (c === " " ? '<span class="sp"> </span>' : `<span class="ch" style="--i:${i}" aria-hidden="true">${c.replace(/[&<>]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[x])}</span>`))
    .join("");
}

/** Restarts CSS animations on an element by toggling a class. */
export function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/**
 * Ambient particle field on a full-screen canvas: rising embers plus a faint
 * constellation that links nearby particles. Pauses when animations are off.
 */
export function particleField(canvas, { count = 90, link = 130, speed = 1 } = {}) {
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = canvas.clientWidth || 1920);
  const H = (canvas.height = canvas.clientHeight || 1080);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const make = (y = rnd(0, H)) => ({ x: rnd(0, W), y, r: rnd(.6, 2.4), vy: -rnd(.15, .7) * speed, vx: rnd(-.25, .25) * speed, ph: rnd(0, Math.PI * 2), hue: Math.random() < .5 ? "p" : "s" });
  const parts = Array.from({ length: count }, () => make());
  let colors = themeColors();
  setInterval(() => (colors = themeColors()), 2000);

  const draw = (now) => {
    requestAnimationFrame(draw);
    if (motionOff()) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx + Math.sin(now / 1800 + p.ph) * .25;
      p.y += p.vy;
      if (p.y < -10) Object.assign(p, make(H + 10));
    }
    if (link) {
      ctx.lineWidth = 1;
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i], b = parts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < link) {
            ctx.globalAlpha = (1 - d / link) * .22;
            ctx.strokeStyle = colors.p;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
    }
    for (const p of parts) {
      const twinkle = .55 + .45 * Math.sin(now / 400 + p.ph);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = colors[p.hue];
      ctx.shadowColor = colors[p.hue];
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  };
  requestAnimationFrame(draw);
}

/**
 * One-shot explosion of sparks (with gravity) from x,y on a full-screen canvas.
 * Creates the canvas on first use.
 */
let burstCanvas, burstCtx, sparks = [], burstRunning = false;
export function burst(x, y, { count = 70, power = 9, colors } = {}) {
  if (motionOff()) return;
  if (!burstCanvas) {
    burstCanvas = Object.assign(document.createElement("canvas"), { width: 1920, height: 1080 });
    burstCanvas.style.cssText = "position:fixed;inset:0;width:1920px;height:1080px;pointer-events:none;z-index:50";
    document.body.append(burstCanvas);
    burstCtx = burstCanvas.getContext("2d");
  }
  const { p, s } = themeColors();
  const palette = colors ?? [p, s, "#ffffff"];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = power * (.35 + Math.random() * .8);
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * .3, life: 1, decay: .01 + Math.random() * .015,
      size: 2 + Math.random() * 3, color: palette[i % palette.length], rect: Math.random() < .5, rot: Math.random() * 6 });
  }
  if (!burstRunning) { burstRunning = true; requestAnimationFrame(stepBurst); }
}
function stepBurst() {
  burstCtx.clearRect(0, 0, 1920, 1080);
  sparks = sparks.filter((k) => k.life > 0);
  for (const k of sparks) {
    k.x += k.vx; k.y += k.vy; k.vy += .22; k.vx *= .985; k.life -= k.decay; k.rot += .2;
    burstCtx.globalAlpha = Math.max(0, k.life);
    burstCtx.fillStyle = k.color;
    burstCtx.shadowColor = k.color;
    burstCtx.shadowBlur = 10;
    burstCtx.save();
    burstCtx.translate(k.x, k.y);
    burstCtx.rotate(k.rot);
    if (k.rect) burstCtx.fillRect(-k.size, -k.size / 2, k.size * 2, k.size);
    else { burstCtx.beginPath(); burstCtx.arc(0, 0, k.size * .7, 0, Math.PI * 2); burstCtx.fill(); }
    burstCtx.restore();
  }
  if (sparks.length) requestAnimationFrame(stepBurst);
  else { burstRunning = false; burstCtx.clearRect(0, 0, 1920, 1080); }
}

/** Floating "+1"-style label that rises and fades from a point. */
export function floatText(x, y, text) {
  if (motionOff()) return;
  const el = document.createElement("div");
  el.className = "float-text";
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.append(el);
  setTimeout(() => el.remove(), 1800);
}

/** Calls fn at a random interval between min and max ms, forever. */
export function every(min, max, fn) {
  const loop = () => setTimeout(() => { if (!motionOff()) fn(); loop(); }, min + Math.random() * (max - min));
  loop();
}
