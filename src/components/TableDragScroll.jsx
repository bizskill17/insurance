import { useEffect } from "react";

// Boxes that scroll wide tables sideways.
const TABLE_WRAP_SELECTOR = ".table-wrap, .master-table-wrap";
// Pressing on these never starts a drag, so they keep working as before.
const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, label, summary, [role='button'], [contenteditable='true'], .cell-text__toggle";
// The mouse must move this far before a press becomes a drag (smaller moves stay clicks).
const DRAG_THRESHOLD_PX = 5;

/**
 * Lets people drag any table with the mouse: press on the rows and move left/right to
 * slide the columns, up/down to scroll the page. Clicks, buttons, links and the
 * scrollbar under the table keep working. Mounted once in AppLayout.
 */
export default function TableDragScroll() {
  useEffect(() => {
    let drag = null;

    const endDrag = () => {
      if (!drag) {
        return;
      }
      const wasDragging = drag.active;
      drag = null;
      document.body.classList.remove("table-dragging");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", endDrag);

      if (wasDragging) {
        // The click that follows a drag must not open a row or press anything.
        const swallowClick = (event) => {
          event.preventDefault();
          event.stopPropagation();
        };
        window.addEventListener("click", swallowClick, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener("click", swallowClick, { capture: true }), 0);
      }
    };

    function handlePointerMove(event) {
      if (!drag) {
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (!drag.active) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
          return;
        }
        drag.active = true;
        document.body.classList.add("table-dragging");
        window.getSelection()?.removeAllRanges();
      }

      event.preventDefault();
      drag.wrap.scrollLeft = drag.startScrollLeft - dx;
      window.scrollTo({ top: drag.startScrollY - dy, behavior: "instant" });
    }

    function handlePointerUp() {
      endDrag();
    }

    const handlePointerDown = (event) => {
      // Left mouse button only; touch and pens already scroll natively.
      if (event.pointerType !== "mouse" || event.button !== 0) {
        return;
      }
      const wrap = event.target.closest?.(TABLE_WRAP_SELECTOR);
      if (!wrap || event.target.closest(INTERACTIVE_SELECTOR)) {
        return;
      }

      drag = {
        wrap,
        active: false,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: wrap.scrollLeft,
        startScrollY: window.scrollY
      };
      window.addEventListener("pointermove", handlePointerMove, { passive: false });
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", endDrag);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      endDrag();
    };
  }, []);

  return null;
}
