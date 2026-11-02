function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatDateDisplay(value) {
  if (!value || typeof value !== "string") {
    return value || "";
  }

  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
  if (!dateMatch) {
    return value;
  }

  const [, year, month, day] = dateMatch;
  return `${pad(day)}-${pad(month)}-${year}`;
}

export function formatAccountType(value) {
  if (!value) return "";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatCellValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "string") {
    return formatDateDisplay(value);
  }

  return value;
}
