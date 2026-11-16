import { useEffect, useRef, useState } from "react";

// Boxes that scroll wide tables sideways.
const TABLE_WRAP_SELECTOR = ".table-wrap, .master-table-wrap";
// Tables inside pop-ups keep only their own scrollbar.
const IGNORE_INSIDE_SELECTOR = ".master-modal, [role='dialog']";

const HIDDEN = { visible: false, left: 0, width: 0, contentWidth: 0 };

/**
 * A sideways scrollbar pinned to the bottom of the window. It appears while a wide
 * table is on screen but the table's own scrollbar is below the bottom edge, so the
 * right-hand columns can be reached without scrolling to the end of the list.
 * When the table's own scrollbar comes into view, this one hides.
 */
export default function StickyTableScrollbar() {
  const barRef = useRef(null);
  const targetRef = useRef(null);
  const syncingFromBarRef = useRef(false);
  const frameRef = useRef(0);
  const [bar, setBar] = useState(HIDDEN);

  useEffect(() => {
    const measure = () => {
      frameRef.current = 0;
      const viewportHeight = window.innerHeight;

      const target = Array.from(document.querySelectorAll(TABLE_WRAP_SELECTOR)).find((element) => {
        if (element.closest(IGNORE_INSIDE_SELECTOR)) {
          return false;
        }
        if (element.scrollWidth <= element.clientWidth + 1) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        // Part of the table is on screen, and its own bottom scrollbar is below the window.
        return rect.width > 0 && rect.top < viewportHeight - 60 && rect.bottom > viewportHeight;
      });

      targetRef.current = target || null;

      if (!target) {
        setBar((current) => (current.visible ? HIDDEN : current));
        return;
      }

      const rect = target.getBoundingClientRect();
      const next = {
        visible: true,
        left: Math.round(rect.left + target.clientLeft),
        width: Math.round(target.clientWidth),
        contentWidth: Math.round(target.scrollWidth)
      };

      setBar((current) =>
        current.visible === next.visible &&
        current.left === next.left &&
        current.width === next.width &&
        current.contentWidth === next.contentWidth
          ? current
          : next
      );

      if (barRef.current && !syncingFromBarRef.current && barRef.current.scrollLeft !== target.scrollLeft) {
        barRef.current.scrollLeft = target.scrollLeft;
      }
    };

    const scheduleMeasure = (event) => {
      // The bar's own scrolling is handled in handleBarScroll.
      if (event && event.target === barRef.current) {
        return;
      }
      if (!frameRef.current) {
        frameRef.current = window.requestAnimationFrame(measure);
      }
    };

    // Capture phase also catches sideways scrolling inside the table boxes.
    window.addEventListener("scroll", scheduleMeasure, true);
    window.addEventListener("resize", scheduleMeasure);
    // Pages load data, filter, change page or open the menu: re-measure after DOM changes.
    const mutationObserver = new MutationObserver(() => scheduleMeasure());
    mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    scheduleMeasure();

    return () => {
      window.removeEventListener("scroll", scheduleMeasure, true);
      window.removeEventListener("resize", scheduleMeasure);
      mutationObserver.disconnect();
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, []);

  // Keep the bar's position when it (re)appears.
  useEffect(() => {
    if (bar.visible && barRef.current && targetRef.current) {
      barRef.current.scrollLeft = targetRef.current.scrollLeft;
    }
  }, [bar.visible, bar.contentWidth]);

  const handleBarScroll = () => {
    const target = targetRef.current;
    if (!target || !barRef.current) {
      return;
    }
    syncingFromBarRef.current = true;
    target.scrollLeft = barRef.current.scrollLeft;
    window.requestAnimationFrame(() => {
      syncingFromBarRef.current = false;
    });
  };

  return (
    <div
      ref={barRef}
      className={`sticky-table-scrollbar ${bar.visible ? "is-visible" : ""}`}
      style={{ left: `${bar.left}px`, width: `${bar.width}px` }}
      onScroll={handleBarScroll}
      aria-hidden="true"
    >
      <div style={{ width: `${bar.contentWidth}px`, height: "1px" }} />
    </div>
  );
}
