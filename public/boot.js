/* Runs before first paint (blocking, tiny):
   - flags JS support so reveal animations may hide content
   - re-applies the last known appearance to avoid a theme flash */
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  try {
    var a = JSON.parse(localStorage.getItem("dp:appearance") || "null");
    if (!a) return;
    if (a.primary) root.style.setProperty("--brand-primary", a.primary);
    if (a.secondary) root.style.setProperty("--brand-secondary", a.secondary);
    if (a.background) root.style.setProperty("--brand-bg", a.background);
    if (a.radiusScale) root.style.setProperty("--radius-scale", a.radiusScale);
    if (a.motion && a.motion !== "normal") root.setAttribute("data-motion", a.motion);
  } catch (e) { /* storage unavailable: defaults apply */ }
})();
