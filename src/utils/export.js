import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCellValue, formatCurrency } from "./formatting";

function formatExportValue(value, column) {
  return column.type === "currency" ? formatCurrency(value) : formatCellValue(value);
}

function escapeCsvValue(value) {
  const normalized = String(value ?? "").replace(/"/g, '""');
  return `"${normalized}"`;
}

function sanitizeFileName(value) {
  return String(value || "export")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function downloadCsv({ title, columns, records, mapRecord, fileSuffix = "export" }) {
  const headerRow = columns.map((column) => escapeCsvValue(column.label)).join(",");
  const dataRows = records.map((record, index) => {
    const mappedRecord = mapRecord ? mapRecord(record, index) : record;
    return columns.map((column) => escapeCsvValue(formatExportValue(mappedRecord[column.key], column))).join(",");
  });

  const csvContent = ["\uFEFF" + headerRow, ...dataRows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const fileName = `${sanitizeFileName(title)}-${sanitizeFileName(fileSuffix)}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPdf({ title, columns, records, mapRecord, fileSuffix = "export" }) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

  const tableHeaders = columns.map((col) => col.label);
  const tableData = records.map((record, index) => {
    const mappedRecord = mapRecord ? mapRecord(record, index) : record;
    return columns.map((col) => formatExportValue(mappedRecord[col.key], col));
  });

  autoTable(doc, {
    startY: 28,
    head: [tableHeaders],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [45, 87, 215], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    margin: { top: 25 }
  });

  const fileName = `${sanitizeFileName(title)}-${sanitizeFileName(fileSuffix)}.pdf`;
  doc.save(fileName);
}
