/* DePhantom chat: StreamElements custom widget (YouTube chat). */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=";
function scramble(node, text, duration = 500) {
  const start = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const settled = Math.floor(t * text.length);
    let out = text.slice(0, settled);
    for (let i = settled; i < text.length; i++) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    node.textContent = out;
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

let fields = {};
const ignored = new Set();

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeImg = (url) => (/^https:\/\//.test(url ?? "") ? escapeHtml(url) : "");

function roleOf(data) {
  const a = data.authorDetails || {};
  const types = (data.badges || []).map((b) => String(b.type || "").toLowerCase());
  if (a.isChatOwner || types.some((t) => t === "broadcaster" || t === "owner")) return "owner";
  if (a.isChatModerator || types.includes("moderator")) return "mod";
  if (a.isChatSponsor || types.some((t) => t === "sponsor" || t === "member" || t === "subscriber")) return "member";
  return "viewer";
}
const ROLE_TAG = { owner: "Host", mod: "Mod", member: "Member" };

/** Escapes the text and swaps emote names for images. */
function renderText(text, emotes = []) {
  const map = new Map(emotes.map((e) => [e.name, e.urls?.["2"] || e.urls?.["1"] || e.urls?.["4"]]));
  return String(text ?? "")
    .split(/(\s+)/)
    .map((word) => {
      const url = safeImg(map.get(word));
      return url ? `<img src="${url}" alt="${escapeHtml(word)}">` : escapeHtml(word);
    })
    .join("");
}

function addMessage(data) {
  const name = data.displayName || data.nick || data.authorDetails?.displayName || "viewer";
  const text = data.text ?? data.message ?? "";
  if (ignored.has(name.toLowerCase())) return;
  if (fields.hideCommands && text.trim().startsWith("!")) return;

  const role = roleOf(data);
  const badges = (data.badges || []).map((b) => safeImg(b.url)).filter(Boolean).map((u) => `<img src="${u}" alt="">`).join("");
  const tag = fields.showRoleTags && ROLE_TAG[role] ? `<span class="msg__tag">${ROLE_TAG[role]}</span>` : "";

  const msg = document.createElement("div");
  msg.className = `msg${data.isAction ? " is-action" : ""}`;
  msg.dataset.role = role;
  msg.dataset.id = data.msgId || "";
  msg.dataset.user = data.userId || "";
  msg.innerHTML = `
    <div class="msg__head"><span class="msg__badges">${badges}</span><span class="msg__name">${escapeHtml(name)}</span>${tag}</div>
    <div class="msg__text">${renderText(text, data.emotes)}</div>`;

  const chat = document.getElementById("chat");
  chat.append(msg);
  scramble(msg.querySelector(".msg__name"), name);
  const max = Number(fields.maxMessages) || 20;
  while (chat.children.length > max) chat.firstElementChild.remove();

  const hideAfter = Number(fields.hideAfter) || 0;
  if (hideAfter > 0) setTimeout(() => removeMessage(msg), hideAfter * 1000);
}

function removeMessage(msg) {
  if (!msg?.isConnected) return;
  msg.classList.add("is-out");
  setTimeout(() => msg.remove(), 500);
}

window.addEventListener("onWidgetLoad", (obj) => {
  fields = obj.detail.fieldData || {};
  String(fields.ignoredUsers || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).forEach((u) => ignored.add(u));
  const root = document.documentElement.style;
  if (fields.primary) root.setProperty("--p", fields.primary);
  if (fields.secondary) root.setProperty("--s", fields.secondary);
  if (fields.background) root.setProperty("--bg", fields.background);
  if (fields.fontSize) root.setProperty("--size", `${fields.fontSize}px`);
  if (fields.panelOpacity != null) root.setProperty("--panel-alpha", `${fields.panelOpacity}%`);
});

window.addEventListener("onEventReceived", (obj) => {
  const { listener, event } = obj.detail || {};
  if (listener === "message" && event?.data) return addMessage(event.data);
  if (listener === "delete-message") {
    return removeMessage(document.querySelector(`.msg[data-id="${CSS.escape(event.msgId || "")}"]`));
  }
  if (listener === "delete-messages") {
    return document.querySelectorAll(`.msg[data-user="${CSS.escape(event.userId || "")}"]`).forEach(removeMessage);
  }
  if (listener === "widget-button" && event.field === "testMessage") {
    const samples = [
      { displayName: "PhantomFan", text: "Let's gooo! First try this time 🔥" },
      { displayName: "SoulsVeteran", text: "Roll through the second swing", authorDetails: { isChatSponsor: true } },
      { displayName: "ModSquad", text: "Remember to be kind in chat!", authorDetails: { isChatModerator: true } },
    ];
    addMessage({ ...samples[Math.floor(Math.random() * samples.length)], msgId: String(Date.now()) });
  }
});
