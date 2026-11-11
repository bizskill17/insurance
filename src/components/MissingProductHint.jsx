import { useState } from "react";

/**
 * Shown under a Product Name dropdown when the chosen company has no products. Explains why the list is empty, opens Products
 * master in a new tab to add one, and reloads the list without losing the form.
 */
export default function MissingProductHint({ companyName, onReload }) {
  const [reloading, setReloading] = useState(false);

  const handleReload = async () => {
    setReloading(true);
    try {
      await onReload();
    } finally {
      setReloading(false);
    }
  };

  return (
    <div
      className="missing-product-hint"
      role="status"
      // The hint sits inside the field's <label>; stop plain-text clicks from opening the dropdown.
      onClick={(event) => {
        if (!event.target.closest("a, button")) event.preventDefault();
      }}
    >
      <span>
        No product added for <strong>{companyName || "this company"}</strong>. Add one in Products master, or choose
        another company.
      </span>
      <span className="missing-product-hint__actions">
        <a href="/masters/insurance-products" target="_blank" rel="noreferrer">
          Add product
        </a>
        <button type="button" onClick={handleReload} disabled={reloading}>
          {reloading ? "Reloading..." : "Reload list"}
        </button>
      </span>
    </div>
  );
}

export function missingProductMessage(companyName) {
  return `No product added for ${companyName || "this company"}.`;
}
