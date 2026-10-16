/**
 * Reorderable list: drag-and-drop with the handle (mouse/touch via pointer events)
 * plus accessible Move up / Move down buttons. Calls onChange(orderedIds).
 */
import { $$ } from "../core/dom.js";

export function makeSortable(list, { onChange }) {
  const ids = () => $$("[data-sort-id]", list).map((el) => el.dataset.sortId);
  let dragged = null;

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sort-move]");
    if (!btn) return;
    const item = btn.closest("[data-sort-id]");
    const sibling = btn.dataset.sortMove === "up" ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling) return;
    btn.dataset.sortMove === "up" ? sibling.before(item) : sibling.after(item);
    btn.focus();
    onChange(ids());
  });

  list.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest("[data-sort-handle]");
    if (!handle) return;
    e.preventDefault();
    dragged = handle.closest("[data-sort-id]");
    dragged.setAttribute("data-dragging", "");
    handle.setPointerCapture(e.pointerId);
    const before = ids().join();

    const move = (ev) => {
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-sort-id]");
      $$("[data-drop-target]", list).forEach((el) => el.removeAttribute("data-drop-target"));
      if (!over || over === dragged || over.parentElement !== list) return;
      over.setAttribute("data-drop-target", "");
      const rect = over.getBoundingClientRect();
      ev.clientY < rect.top + rect.height / 2 ? over.before(dragged) : over.after(dragged);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      dragged.removeAttribute("data-dragging");
      $$("[data-drop-target]", list).forEach((el) => el.removeAttribute("data-drop-target"));
      dragged = null;
      if (ids().join() !== before) onChange(ids());
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  });
}
