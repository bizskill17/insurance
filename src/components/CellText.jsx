import { useState } from "react";
import { formatCellValue } from "../utils/formatting";

// Text longer than this, or with more than 2 line breaks, is cut to 3 lines in table cells.
const LONG_TEXT_CHARS = 120;

function isLongText(value) {
  if (typeof value !== "string") {
    return false;
  }
  return value.length > LONG_TEXT_CHARS || (value.match(/\n/g) || []).length > 2;
}

/**
 * Shows long cell text (remarks, descriptions, notes) cut to 3 lines so one long note
 * does not stretch the whole row. Hover shows the full text; "more" expands it in place.
 */
export function ClampedCellText({ text }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <span className="cell-text">
      <span className={expanded ? "cell-text__body" : "cell-text__body cell-text__body--clamped"} title={expanded ? undefined : text}>
        {text}
      </span>
      <button
        type="button"
        className="cell-text__toggle"
        onClick={(event) => {
          event.stopPropagation();
          setExpanded((current) => !current);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        {expanded ? "less" : "more"}
      </button>
    </span>
  );
}

export function renderCellText(value) {
  const formatted = formatCellValue(value);
  return isLongText(formatted) ? <ClampedCellText text={formatted} /> : formatted;
}

