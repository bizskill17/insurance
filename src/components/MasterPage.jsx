import { Fragment, useDeferredValue, useEffect, useMemo, useState } from "react";
import { ActionIconDisplay } from "./ActionIcon";
import { API_BASE } from "../config/api";
import { masterConfigs } from "../data/masterConfigs";
import { formatMenuViews } from "../data/menu";
import { buildFilterOptions, filterRecords, sortRecords } from "../utils/dataView";
import { downloadCsv, downloadPdf } from "../utils/export";
import { formatAccountType, formatCellValue } from "../utils/formatting";
import FormLabel from "./FormLabel";
import MultiSelectFilter from "./MultiSelectFilter";
import RecordDetailModal from "./RecordDetailModal";
import TablePagination from "./TablePagination";
import { ButtonSpinner, Spinner } from "./Spinner";
import SearchableSelect from "./SearchableSelect";

async function readApiJson(response) {
  const rawText = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!rawText.trim()) {
    throw new Error(
      `API returned an empty response (${response.status} ${response.statusText || "Unknown Status"}).`
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    const looksLikeHtml =
      contentType.includes("text/html") || /^\s*<!doctype html|^\s*<html/i.test(rawText);

    if (looksLikeHtml) {
      throw new Error(
        `API endpoint returned HTML instead of JSON (${response.status} ${response.statusText || "Unknown Status"}). Please check the API URL or server rewrite configuration.`
      );
    }

    throw new Error(
      `API returned an unreadable response (${response.status} ${response.statusText || "Unknown Status"}).`
    );
  }
}

function emptyState(config) {
  return config.fields.reduce((acc, field) => {
    acc[field.name] =
      field.type === "checkbox"
        ? true
        : field.type === "file"
        ? null
        : field.type === "checklist" || field.type === "permission-list"
        ? []
        : "";
    return acc;
  }, {});
}

function getOptionLabel(resource, item) {
  if (resource === "customer-groups") return item.group_name;
  if (resource === "insurance-companies") return item.company_name;
  if (resource === "states") return item.state_name;
  if (resource === "cities") return item.city_name;
  if (resource === "product-categories") return item.category_name;
  if (resource === "agents") return item.full_name;
  return item.name ?? item.label ?? item.id;
}

function getOptionValue(field, option) {
  return field.optionValueKey ? option[field.optionValueKey] ?? "" : option.id;
}

function validateField(field, value) {
  if (field.required && field.type === "checklist" && (!Array.isArray(value) || value.length === 0)) {
    return `${field.label} is required.`;
  }

  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (field.validation?.pattern) {
    const pattern = new RegExp(field.validation.pattern);
    if (!pattern.test(normalizedValue)) {
      return field.validation.message || `Invalid ${field.label}.`;
    }
  }

  return "";
}

function normalizeLookupValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => String(cell).trim() !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => String(cell).trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

function buildTemplateColumns(config) {
  return config.fields.map((field) => ({
    key: field.name,
    label: field.templateLabel || field.label
  }));
}

function parseCheckboxValue(value) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) return true;
  if (["true", "yes", "1", "active"].includes(normalized)) return true;
  if (["false", "no", "0", "inactive"].includes(normalized)) return false;
  return null;
}

function parseChecklistValue(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
function getPermissionValues(user, key, fallbackViews = []) {
  if (!user || !Object.prototype.hasOwnProperty.call(user, key)) {
    return fallbackViews;
  }

  if (user[key] === undefined || user[key] === null || user[key] === "") {
    return fallbackViews;
  }

  return parseChecklistValue(user[key]);
}
function getFieldLabel(config, fieldName) {
  return config.fields.find((field) => field.name === fieldName)?.label || fieldName;
}

function chunkItems(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function formatBulkServerError(config, payload, message) {
  const duplicateMatch = String(message || "").match(/Duplicate entry '(.+)' for key '([^']+)'/i);
  if (!duplicateMatch) {
    return {
      field: "Row",
      value: "",
      message: message || "Failed to import this row."
    };
  }

  const duplicateValue = duplicateMatch[1];
  const rawKey = duplicateMatch[2];
  const keyName = rawKey.split(".").pop()?.replace(/[^a-zA-Z0-9_]/g, "") || rawKey;

  const matchedField =
    config.fields.find((field) => field.name === keyName) ||
    config.fields.find((field) => String(payload[field.name] ?? "") === duplicateValue) ||
    config.fields.find((field) => keyName.toLowerCase().includes(field.name.toLowerCase()));

  const label = matchedField ? getFieldLabel(config, matchedField.name) : "Value";
  const displayValue = matchedField ? payload[matchedField.name] ?? duplicateValue : duplicateValue;

  return {
    field: label,
    value: displayValue,
    message: `Duplicate ${label} - ${displayValue}`
  };
}

function formatLinkedDeleteError(message) {
  const normalizedMessage = String(message || "");

  if (!normalizedMessage.toLowerCase().startsWith("cannot delete")) {
    return normalizedMessage;
  }

  const [summary, ...details] = normalizedMessage.split(/\.\s+/);
  const detailText = details.join(". ").trim();

  return (
    <>
      <strong>{summary}.</strong>
      {detailText ? <span>{detailText}</span> : null}
    </>
  );
}

function formatMasterServerError(config, payload, message) {
  const formatted = formatBulkServerError(config, payload, message);
  if (formatted.message !== (message || "Failed to import this row.")) {
    return formatted.message;
  }

  const notNullMatch = String(message || "").match(/Column '([^']+)' cannot be null/i);
  if (notNullMatch) {
    const fieldName = notNullMatch[1];
    return `${getFieldLabel(config, fieldName)} is required.`;
  }

  return message || "Request failed.";
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75z" />
      <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42L18.37 3.29a1.003 1.003 0 0 0-1.42 0L15.13 5.1l3.75 3.75z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z" />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5c5.5 0 9.8 4.6 10.9 6-.9 1.4-5.2 6-10.9 6S2.2 12.4 1.1 11C2.2 9.6 6.5 5 12 5Zm0 2C8.5 7 5.4 9.6 3.8 11 5.4 12.4 8.5 15 12 15s6.6-2.6 8.2-4C18.6 9.6 15.5 7 12 7Zm0 1.5A2.5 2.5 0 1 1 9.5 11 2.5 2.5 0 0 1 12 8.5Z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 16h2V7.83l2.58 2.59L17 9l-5-5-5 5 1.42 1.41L11 7.83V16zm-7 2h16v2H4v-2z" />
    </svg>
  );
}

function emptyCustomerDocumentEntry() {
  return {
    document_type_id: "",
    document_number: "",
    document_date: "",
    expiry_date: "",
    remarks: "",
    file: null
  };
}

function isNameColumn(columnKey) {
  const normalized = String(columnKey || "").toLowerCase();
  return (
    normalized.includes("name") ||
    normalized.includes("customer") ||
    normalized.includes("company") ||
    normalized.includes("agent")
  );
}


function getFixedColumnStyle(columnKey) {
  const normalized = String(columnKey || "").toLowerCase();

  if (normalized.includes("product")) {
    return { width: "300px", minWidth: "300px", maxWidth: "300px" };
  }

  if (normalized.includes("company")) {
    return { width: "260px", minWidth: "260px", maxWidth: "260px" };
  }

  return undefined;
}

function getTableCellClass(columnKey, extraClassName = "") {
  return [isNameColumn(columnKey) ? "text-blue" : "", extraClassName].filter(Boolean).join(" ");
}

export default function MasterPage({
  resourceKey,
  currentUser = null,
  embeddedFormOnly = false,
  autoOpenForm = false,
  onFormSaved,
  onFormCancel
}) {
  const config = masterConfigs[resourceKey];
  const isSettingsView = resourceKey === "settings";
  const [records, setRecords] = useState([]);
  const [optionsMap, setOptionsMap] = useState({});
  const [formState, setFormState] = useState(() => emptyState(config));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFormLocked, setIsFormLocked] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [relatedPoliciesModal, setRelatedPoliciesModal] = useState({
    isOpen: false,
    customer: null,
    policies: [],
    documents: [],
    loading: false,
    error: ""
  });
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState({
    processed: 0,
    successCount: 0,
    failureCount: 0,
    errors: []
  });
  const [customerUploadModal, setCustomerUploadModal] = useState({
    isOpen: false,
    customer: null,
    documentTypes: [],
    documents: [emptyCustomerDocumentEntry()],
    loading: false,
    uploading: false,
    error: ""
  });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const currentPath = `/masters/${resourceKey}`;
  const currentUserViews = parseChecklistValue(currentUser?.views);
  const canAddRecord = isSettingsView || getPermissionValues(currentUser, "add_permissions", currentUserViews).includes(currentPath);
  const canEditRecord = isSettingsView || getPermissionValues(currentUser, "edit_permissions", currentUserViews).includes(currentPath);
  const canDeleteRecord = isSettingsView || getPermissionValues(currentUser, "delete_permissions", currentUserViews).includes(currentPath);

  const selectedCompanyType =
    resourceKey === "insurance-products" && formState.company_id
      ? (optionsMap["insurance-companies"] || []).find(
          (company) => String(company.id ?? "") === String(formState.company_id)
        )?.company_type || ""
      : "";

  const closeForm = ({ notifyCancel = true } = {}) => {
    setFormState(emptyState(config));
    setEditingId(null);
    setIsFormLocked(false);
    setIsFormOpen(false);

    if (notifyCancel && embeddedFormOnly && onFormCancel) {
      onFormCancel();
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const dependencies = useMemo(
    () =>
      [...new Set(config.fields.filter((field) => field.optionsFrom).map((field) => field.optionsFrom))],
    [config.fields]
  );

  const filterableColumns = useMemo(
    () =>
      config.tableColumns.filter(
        (column) =>
          column.type !== "boolean" &&
          column.formatter !== "view_list" &&
          !["notes", "description", "password"].includes(column.key)
      ),
    [config.tableColumns]
  );

  const filterConfigs = useMemo(
    () =>
      filterableColumns.map((column) => ({
        key: column.key,
        label: column.label,
        options: buildFilterOptions(records, column.key)
      })),
    [filterableColumns, records]
  );

  const searchKeys = useMemo(() => config.tableColumns.map((column) => column.key), [config.tableColumns]);

  useEffect(() => {
    setActiveFilters(Object.fromEntries(filterConfigs.map((filter) => [filter.key, []])));
  }, [filterConfigs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilters, pageSize, resourceKey, records, filterConfigs]);

  const filteredRecords = useMemo(
    () => filterRecords(records, { searchTerm, searchKeys, activeFilters }),
    [records, searchTerm, searchKeys, activeFilters]
  );

  const sortedRecords = useMemo(
    () => sortRecords(filteredRecords, sortConfig),
    [filteredRecords, sortConfig]
  );
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedRecords = useMemo(
    () => sortedRecords.slice(pageStart, pageStart + pageSize),
    [pageSize, pageStart, sortedRecords]
  );

  const groupedRecords = useMemo(() => {
    if (resourceKey !== "cities") return null;

    const groups = {};
    paginatedRecords.forEach((record) => {
      const stateName = record.state_name || "Unknown State";
      if (!groups[stateName]) {
        groups[stateName] = [];
      }
      groups[stateName].push(record);
    });
    return groups;
  }, [paginatedRecords, resourceKey]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setMessage("");
    setError("");
    setSearchTerm("");
    setActiveFilters({});
    setIsFiltersOpen(false);
    setIsFormOpen(false);
    setEditingId(null);
    setSelectedRecord(null);
    setFormState(emptyState(config));
    setIsBulkUploadOpen(false);
    setBulkUploadFile(null);
    setBulkUploading(false);
    setBulkUploadResult({
      processed: 0,
      successCount: 0,
      failureCount: 0,
      errors: []
    });
    resetRelatedPoliciesModal();
    resetCustomerUploadModal();
  }, [resourceKey, config]);

  useEffect(() => {
    if (embeddedFormOnly && autoOpenForm) {
      setFormState(emptyState(config));
      setEditingId(null);
      setMessage("");
      setError("");
      setIsFormOpen(true);
    }
  }, [autoOpenForm, embeddedFormOnly, config]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const searchQuery = deferredSearchTerm.trim();
        const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
        const [recordResponse, ...optionResponses] = await Promise.all([
          fetch(`${API_BASE}/masters/${config.resource}?limit=500000${searchParam}`),
          ...dependencies.map((dependency) => fetch(`${API_BASE}/masters/${dependency}?limit=500000`))
        ]);

        const recordJson = await readApiJson(recordResponse);
        if (!recordResponse.ok) {
          throw new Error(recordJson.message || "Failed to load records.");
        }

        const optionEntries = await Promise.all(
          optionResponses.map(async (response, index) => {
            const json = await readApiJson(response);
            if (!response.ok) {
              throw new Error(json.message || "Failed to load lookup data.");
            }
            return [dependencies[index], json.data];
          })
        );

        setRecords(recordJson.data || []);
        setOptionsMap(Object.fromEntries(optionEntries));
      } catch (loadError) {
        if (String(loadError.message || "").includes("organization_id")) {
          setRecords([]);
          setOptionsMap({});
          setError("");
          return;
        }

        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [config.resource, dependencies, deferredSearchTerm]);

  const resetForm = () => {
    closeForm();
  };

  const handleAdd = () => {
    setFormState(emptyState(config));
    setEditingId(null);
    setIsFormLocked(false);
    setMessage("");
    setError("");
    setIsFormOpen(true);
  };

  const handleDownloadTemplate = () => {
    downloadCsv({
      title: `${config.title} Template`,
      columns: buildTemplateColumns(config),
      records: [],
      fileSuffix: "template"
    });
  };

  const resetBulkUpload = () => {
    setBulkUploadFile(null);
    setBulkUploadResult({
      processed: 0,
      successCount: 0,
      failureCount: 0,
      errors: []
    });
    setBulkUploading(false);
  };

  const openBulkUpload = () => {
    setMessage("");
    setError("");
    resetBulkUpload();
    setIsBulkUploadOpen(true);
  };

  const closeBulkUpload = () => {
    setIsBulkUploadOpen(false);
    resetBulkUpload();
  };

  const handleChange = (field, value) => {
    setFormState((current) => {
      const nextState = {
        ...current,
        ...(field.resetsFields
          ? Object.fromEntries(field.resetsFields.map((fieldName) => [fieldName, ""]))
          : {}),
        [field.name]: field.type === "checkbox" ? Boolean(value) : value
      };

      if (field.actionFields?.length) {
        const allowedValues = new Set(Array.isArray(value) ? value : []);
        field.actionFields.forEach((actionField) => {
          nextState[actionField.name] = parseChecklistValue(current[actionField.name]).filter((item) =>
            allowedValues.has(item)
          );
        });
      }

      return nextState;
    });
  };
  const handleEdit = (record) => {
    const nextState = emptyState(config);
    for (const field of config.fields) {
      nextState[field.name] =
        field.type === "checkbox"
          ? Boolean(record[field.name])
          : field.type === "checklist" || field.type === "permission-list"
          ? parseChecklistValue(record[field.name])
          : record[field.name] ?? "";
    }
    setFormState(nextState);
    setEditingId(record.id);
    setIsFormLocked(false);
    setMessage("");
    setError("");
    setIsFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    for (const field of config.fields) {
      if (field.type === "file") {
        continue;
      }
      const validationError = validateField(field, formState[field.name]);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setSaving(true);

    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId
        ? `${API_BASE}/masters/${config.resource}/${editingId}`
        : `${API_BASE}/masters/${config.resource}`;
      const hasFileField = config.fields.some((field) => field.type === "file");
      let response;

      if (hasFileField) {
        const payload = new FormData();
        const requestMethod = editingId ? "POST" : method;

        if (editingId) {
          payload.append("_method", "PUT");
        }

        config.fields.forEach((field) => {
          const value = formState[field.name];

          if (field.type === "file") {
            if (value instanceof File) {
              payload.append(field.name, value);
            }
            return;
          }

          if (field.type === "checkbox") {
            payload.append(field.name, value ? "1" : "0");
            return;
          }

          if (field.type === "checklist" || field.type === "permission-list") {
            payload.append(field.name, JSON.stringify(value || []));
            return;
          }

          payload.append(field.name, value ?? "");
        });

        response = await fetch(url, {
          method: requestMethod,
          body: payload
        });
      } else {
        const serializedState = Object.fromEntries(
          config.fields.map((field) => [
            field.name,
            field.type === "checklist" || field.type === "permission-list"
              ? JSON.stringify(formState[field.name] || [])
              : formState[field.name]
          ])
        );

        response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(serializedState)
        });
      }

      const json = await readApiJson(response);
      if (!response.ok) {
        throw new Error(formatMasterServerError(config, formState, json.message || "Save failed."));
      }

      const savedRecordId = method === "POST" ? Number(json.id || 0) : Number(editingId || 0);
      setMessage(json.message || "Saved successfully.");
      setIsFormLocked(false);
      if (method === "POST" && savedRecordId > 0) {
        setEditingId(savedRecordId);
      }

      const refresh = await fetch(`${API_BASE}/masters/${config.resource}?limit=500000`);
      const refreshJson = await readApiJson(refresh);
      if (!refresh.ok) {
        throw new Error(refreshJson.message || "Refresh failed.");
      }
      const nextRecords = refreshJson.data || [];
      setRecords(nextRecords);

      if (onFormSaved) {
        const savedRecord = nextRecords.find((record) => Number(record.id) === savedRecordId) || null;
        onFormSaved(savedRecord);
      }
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    const label = record.name || record.full_name || record.company_name || record.group_name || record.id;
    const confirmed = window.confirm(`Delete "${label}"?`);

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_BASE}/masters/${config.resource}/${record.id}`, {
        method: "DELETE"
      });
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(formatMasterServerError(config, record, json.message || "Delete failed."));
      }

      setRecords((current) => current.filter((item) => item.id !== record.id));
      setMessage(json.message || "Record deleted successfully.");

      if (editingId === record.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(formatLinkedDeleteError(deleteError.message));
    }
  };

  const resolveSelectValue = (field, rawValue, currentPayload) => {
    const normalized = String(rawValue ?? "").trim();
    if (!normalized) {
      return { value: "", error: "" };
    }

    if (field.staticOptions) {
      const option = field.staticOptions.find((item) => {
        return (
          normalizeLookupValue(item.value) === normalizeLookupValue(normalized) ||
          normalizeLookupValue(item.label) === normalizeLookupValue(normalized)
        );
      });

      if (!option) {
        return { value: "", error: `Invalid ${field.label}.` };
      }

      return { value: option.value, error: "" };
    }

    const options = (optionsMap[field.optionsFrom] || []).filter((option) => {
      if (!field.dependsOn || !field.dependsOnKey) {
        return true;
      }

      const parentValue = currentPayload[field.dependsOn];
      if (!parentValue) {
        return false;
      }

      return String(option[field.dependsOnKey] ?? "") === String(parentValue);
    });

    const option = options.find((item) => {
      const optionValue = String(getOptionValue(field, item) ?? "");
      const optionLabel = String(
        field.optionLabelKey ? item[field.optionLabelKey] : getOptionLabel(field.optionsFrom, item)
      );

      return (
        normalizeLookupValue(optionValue) === normalizeLookupValue(normalized) ||
        normalizeLookupValue(optionLabel) === normalizeLookupValue(normalized)
      );
    });

    if (!option) {
      if (resourceKey === "customers" && (field.name === "state" || field.name === "city")) {
        return { value: normalized, error: "" };
      }

      return { value: "", error: `Invalid ${field.label}.` };
    }

    return { value: getOptionValue(field, option), error: "" };
  };

  const handleBulkUpload = async (event) => {
    event.preventDefault();

    if (!bulkUploadFile) {
      setBulkUploadResult({
        processed: 0,
        successCount: 0,
        failureCount: 1,
        errors: [{ row: "-", field: "File", value: "", message: "Please choose a CSV file." }]
      });
      return;
    }

    setBulkUploading(true);

    try {
      const text = await bulkUploadFile.text();
      const csvRows = parseCsv(text.replace(/^\uFEFF/, ""));

      if (csvRows.length === 0) {
        setBulkUploadResult({
          processed: 0,
          successCount: 0,
          failureCount: 1,
          errors: [{ row: "-", field: "File", value: "", message: "The uploaded CSV is empty." }]
        });
        return;
      }

      const [headerRow, ...dataRows] = csvRows;
      const headerIndexMap = new Map(
        headerRow.map((header, index) => [normalizeLookupValue(header), index])
      );
      const fieldHeaderMap = new Map();

      for (const field of config.fields) {
        const headerCandidates = [
          field.name,
          field.label,
          field.templateLabel,
          ...(field.importAliases || [])
        ].filter(Boolean);
        const matchedHeader = headerCandidates
          .map((header) => headerIndexMap.get(normalizeLookupValue(header)))
          .find((index) => index !== undefined);
        if (matchedHeader !== undefined) {
          fieldHeaderMap.set(field.name, matchedHeader);
        }
      }

      const uploadErrors = [];
      let successCount = 0;

      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
        const rowValues = dataRows[rowIndex];
        const payload = emptyState(config);
        const rowErrors = [];

        for (const field of config.fields) {
          const headerIndex = fieldHeaderMap.get(field.name);
          const rawValue = headerIndex === undefined ? "" : rowValues[headerIndex] ?? "";

          if (field.type === "checkbox") {
            const checkboxValue = parseCheckboxValue(rawValue);
            if (checkboxValue === null) {
              rowErrors.push({
                row: rowIndex + 2,
                field: field.label,
                value: rawValue,
                message: `Invalid ${field.label}. Use Yes/No or True/False.`
              });
            } else {
              payload[field.name] = checkboxValue;
            }
            continue;
          }

          if (field.type === "select") {
            const resolved = resolveSelectValue(field, rawValue, payload);
            if (resolved.error) {
              rowErrors.push({
                row: rowIndex + 2,
                field: field.label,
                value: rawValue,
                message: resolved.error
              });
            }
            payload[field.name] = resolved.value;
          } else {
            payload[field.name] = String(rawValue ?? "").trim();
          }

          if (field.required && !String(payload[field.name] ?? "").trim()) {
            rowErrors.push({
              row: rowIndex + 2,
              field: field.label,
              value: rawValue,
              message: `${field.label} is required.`
            });
          }

          const validationError = validateField(field, payload[field.name]);
          if (validationError) {
            rowErrors.push({
              row: rowIndex + 2,
              field: field.label,
              value: rawValue,
              message: validationError
            });
          }
        }

        if (rowErrors.length > 0) {
          uploadErrors.push(...rowErrors);
          continue;
        }

        try {
          const response = await fetch(`${API_BASE}/masters/${config.resource}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
          const json = await readApiJson(response);

          if (!response.ok) {
            const formattedError = formatBulkServerError(
              config,
              payload,
              json.message || "Failed to import this row."
            );
            uploadErrors.push({
              row: rowIndex + 2,
              field: formattedError.field,
              value: formattedError.value,
              message: formattedError.message
            });
            continue;
          }

          successCount += 1;
        } catch (uploadError) {
          const formattedError = formatBulkServerError(config, payload, uploadError.message);
          uploadErrors.push({
            row: rowIndex + 2,
            field: formattedError.field,
            value: formattedError.value,
            message: formattedError.message
          });
        }
      }

      setBulkUploadResult({
        processed: dataRows.length,
        successCount,
        failureCount: uploadErrors.length > 0 ? new Set(uploadErrors.map((errorItem) => errorItem.row)).size : 0,
        errors: uploadErrors
      });

      if (successCount > 0) {
        const refresh = await fetch(`${API_BASE}/masters/${config.resource}?limit=500000`);
        const refreshJson = await readApiJson(refresh);
        if (!refresh.ok) {
          throw new Error(refreshJson.message || "Refresh failed after bulk upload.");
        }
        setRecords(refreshJson.data || []);
        setMessage(
          uploadErrors.length > 0
            ? `${successCount} rows uploaded. Some rows have validation errors.`
            : `${successCount} rows uploaded successfully.`
        );
      }
    } catch (uploadError) {
      setBulkUploadResult({
        processed: 0,
        successCount: 0,
        failureCount: 1,
        errors: [{ row: "-", field: "Upload", value: "", message: uploadError.message }]
      });
    } finally {
      setBulkUploading(false);
    }
  };

  const resetRelatedPoliciesModal = () => {
    setRelatedPoliciesModal({
      isOpen: false,
      customer: null,
      policies: [],
      documents: [],
      loading: false,
      error: ""
    });
  };

  const resetCustomerUploadModal = () => {
    setCustomerUploadModal({
      isOpen: false,
      customer: null,
      documentTypes: [],
      documents: [emptyCustomerDocumentEntry()],
      loading: false,
      uploading: false,
      error: ""
    });
  };

  const openCustomerUploadModal = async (record) => {
    setMessage("");
    setError("");
    setCustomerUploadModal({
      isOpen: true,
      customer: record,
      documentTypes: [],
      documents: [emptyCustomerDocumentEntry()],
      loading: true,
      uploading: false,
      error: ""
    });

    try {
      const response = await fetch(`${API_BASE}/masters/document-types?limit=500000`);
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to load document types.");
      }

      setCustomerUploadModal((current) => ({
        ...current,
        documentTypes: (json.data || []).filter(
          (documentType) => String(documentType.entity_level || "").toLowerCase() === "customer"
        ),
        loading: false
      }));
    } catch (loadError) {
      setCustomerUploadModal((current) => ({
        ...current,
        loading: false,
        error: loadError.message
      }));
    }
  };

  const handleCustomerUploadChange = (index, key, value) => {
    setCustomerUploadModal((current) => ({
      ...current,
      documents: current.documents.map((document, documentIndex) =>
        documentIndex === index
          ? {
              ...document,
              [key]: value
            }
          : document
      )
    }));
  };

  const addCustomerUploadDocument = () => {
    setCustomerUploadModal((current) => ({
      ...current,
      documents: [...current.documents, emptyCustomerDocumentEntry()]
    }));
  };

  const removeCustomerUploadDocument = (index) => {
    setCustomerUploadModal((current) => ({
      ...current,
      documents:
        current.documents.length <= 1
          ? [emptyCustomerDocumentEntry()]
          : current.documents.filter((_, documentIndex) => documentIndex !== index)
    }));
  };

  const handleCustomerDocumentUpload = async (event) => {
    event.preventDefault();

    if (!customerUploadModal.customer) {
      return;
    }

    setCustomerUploadModal((current) => ({
      ...current,
      uploading: true,
      error: ""
    }));

    try {
      const payload = new FormData();
      payload.append("customer_id", String(customerUploadModal.customer.id));

      const documents = customerUploadModal.documents.map((document) => ({
        document_type_id: document.document_type_id,
        document_number: document.document_number,
        document_date: document.document_date,
        expiry_date: document.expiry_date,
        remarks: document.remarks
      }));

      payload.append("documents", JSON.stringify(documents));

      customerUploadModal.documents.forEach((document) => {
        if (document.file) {
          payload.append("files[]", document.file);
        }
      });

      const response = await fetch(`${API_BASE}/customers/upload-documents`, {
        method: "POST",
        body: payload
      });
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to upload document.");
      }

      setMessage(json.message || "Customer document uploaded successfully.");
      resetCustomerUploadModal();
    } catch (uploadError) {
      setCustomerUploadModal((current) => ({
        ...current,
        uploading: false,
        error: uploadError.message
      }));
      return;
    }

    setCustomerUploadModal((current) => ({
      ...current,
      uploading: false
    }));
  };

  const handleViewRelatedPolicies = async (record) => {
    setRelatedPoliciesModal({
      isOpen: true,
      customer: record,
      policies: [],
      documents: [],
      loading: true,
      error: ""
    });

    try {
      const response = await fetch(`${API_BASE}/customers/${record.id}/policies`);
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to load customer policies.");
      }

      setRelatedPoliciesModal({
        isOpen: true,
        customer: json.data.customer || record,
        policies: json.data.policies || [],
        documents: json.data.documents || [],
        loading: false,
        error: ""
      });
    } catch (loadError) {
      setRelatedPoliciesModal({
        isOpen: true,
        customer: record,
        policies: [],
        documents: [],
        loading: false,
        error: loadError.message
      });
    }
  };

  const renderRowActions = (record) => (
    <div className="table-actions">
      {isSettingsView ? null : (
        <>
      {resourceKey === "customers" ? (
        <button
          type="button"
          className="icon-button icon-button--upload"
          onClick={() => openCustomerUploadModal(record)}
          aria-label="Upload customer document"
          title="Upload customer document"
        >
          <UploadIcon />
        </button>
      ) : null}
      {resourceKey === "customers" ? (
        <button
          type="button"
          className="icon-button icon-button--view"
          onClick={() => handleViewRelatedPolicies(record)}
          aria-label="View related policies"
          title="View related policies"
        >
          <ViewIcon />
        </button>
      ) : null}
      {canEditRecord ? (
        <button
          type="button"
          className="icon-button icon-button--edit"
          onClick={() => handleEdit(record)}
          aria-label="Edit record"
          title="Edit"
        >
          <EditIcon />
        </button>
      ) : null}
      {canDeleteRecord ? (
        <button
          type="button"
          className="icon-button icon-button--delete"
          onClick={() => handleDelete(record)}
          aria-label="Delete record"
          title="Delete"
        >
          <DeleteIcon />
        </button>
      ) : null}
        </>
      )}
    </div>
  );

  const buildDetailValue = (record, column) => {
    if (column.formatter === "account_type") {
      return formatAccountType(record[column.key]);
    }

    if (column.formatter === "view_list") {
      return formatCellValue(formatMenuViews(record[column.key]));
    }

    if (column.type === "boolean") {
      return record[column.key] ? "Yes" : "No";
    }

    if (column.type === "image" && record[column.key]) {
      const imageUrl = /^https?:\/\//i.test(record[column.key])
        ? record[column.key]
        : `${API_BASE}/${String(record[column.key]).replace(/^\/+/, "")}`;

      return <img src={imageUrl} alt={column.label} className="master-table__logo" />;
    }

    return formatCellValue(record[column.key]);
  };

  const detailRows = useMemo(() => {
    if (!selectedRecord) {
      return [];
    }

    return config.tableColumns.map((column) => ({
      key: column.key,
      label: column.label,
      value: buildDetailValue(selectedRecord, column)
    }));
  }, [config.tableColumns, selectedRecord]);

  const formatColumnValue = (record, column) => {
    if (column.formatter === "account_type") {
      return formatAccountType(record[column.key]);
    }

    if (column.formatter === "view_list") {
      return formatCellValue(formatMenuViews(record[column.key]));
    }

    if (column.type === "boolean") {
      return record[column.key] ? "Yes" : "No";
    }

    if (column.type === "image" && record[column.key]) {
      return (
        <img
          src={
            /^https?:\/\//i.test(record[column.key])
              ? record[column.key]
              : `${API_BASE}/${String(record[column.key]).replace(/^\/+/, "")}`
          }
          alt="Logo"
          className="master-table__logo"
        />
      );
    }

    return formatCellValue(record[column.key]);
  };

  const formModal = isFormOpen ? (
    <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="master-form-title">
      <div className="master-modal__backdrop" onClick={resetForm} />
      <section className="master-card master-modal__panel">
        <div className="master-card__header">
          <h3 id="master-form-title">{editingId ? `Edit ${config.title}` : `Add ${config.title}`}</h3>
          <button type="button" className="text-button" onClick={resetForm}>
            Cancel
          </button>
        </div>

        <div className="master-modal__body">
          <form className="master-form" onSubmit={handleSubmit}>
            <fieldset className="master-form__fieldset">
            {config.fields.map((field) => {
              if (field.type === "permission-list") {
                return null;
              }

              if (field.type === "checklist") {
                const checklistOptions = (field.optionGroups || []).flatMap((group) =>
                  (group.options || []).map((option) => ({
                    ...option,
                    groupLabel: group.label
                  }))
                );
                const checklistValues = Array.isArray(formState[field.name]) ? formState[field.name] : [];
                const allChecklistValues = checklistOptions.map((option) => option.value);
                const isAllSelected =
                  checklistOptions.length > 0 && allChecklistValues.every((value) => checklistValues.includes(value));
                const checklistRows = chunkItems(checklistOptions, 2);
                const actionFields = field.actionFields || [];

                return (
                  <div key={field.name} className="form-field checklist-field">
                    <FormLabel required={Boolean(field.required)}>{field.label}</FormLabel>
                    <div className="checklist-field__actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => handleChange(field, isAllSelected ? [] : allChecklistValues)}
                      >
                        {isAllSelected ? "Clear All" : "Select All"}
                      </button>
                    </div>
                    <div className="checklist-field__matrix-wrap">
                      <table className="checklist-field__matrix">
                        <thead>
                          <tr>
                            {[0, 1].map((columnIndex) => (
                              <Fragment key={`${field.name}-head-group-${columnIndex}`}>
                                <th className="checklist-field__matrix-head">Menu</th>
                                <th className="checklist-field__matrix-head checklist-field__matrix-head--allow">Allow</th>
                                {actionFields.map((actionField) => (
                                  <th
                                    key={`${field.name}-head-${columnIndex}-${actionField.name}`}
                                    className="checklist-field__matrix-head checklist-field__matrix-head--action"
                                  >
                                    {actionField.label}
                                  </th>
                                ))}
                              </Fragment>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {checklistRows.map((row, rowIndex) => (
                            <tr key={`${field.name}-row-${rowIndex}`}>
                              {[0, 1].map((columnIndex) => {
                                const option = row[columnIndex];

                                if (!option) {
                                  return (
                                    <Fragment key={`${field.name}-empty-${rowIndex}-${columnIndex}`}>
                                      <td className="checklist-field__matrix-cell" />
                                      <td className="checklist-field__matrix-cell checklist-field__matrix-cell--allow" />
                                      {actionFields.map((actionField) => (
                                        <td
                                          key={`${field.name}-empty-${actionField.name}-${rowIndex}-${columnIndex}`}
                                          className="checklist-field__matrix-cell checklist-field__matrix-cell--action"
                                        />
                                      ))}
                                    </Fragment>
                                  );
                                }

                                const checked = checklistValues.includes(option.value);
                                const actionCells = actionFields.map((actionField) => {
                                  const actionValues = parseChecklistValue(formState[actionField.name]);
                                  const actionChecked = checked && actionValues.includes(option.value);

                                  return (
                                    <td
                                      key={`${field.name}-${actionField.name}-${option.value}`}
                                      className="checklist-field__matrix-cell checklist-field__matrix-cell--action"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={actionChecked}
                                        disabled={!checked}
                                        aria-label={`${actionField.label} ${option.label}`}
                                        onChange={(event) => {
                                          const nextValues = parseChecklistValue(formState[actionField.name]);

                                          handleChange(
                                            { name: actionField.name },
                                            event.target.checked
                                              ? [...new Set([...nextValues, option.value])]
                                              : nextValues.filter((item) => item !== option.value)
                                          );
                                        }}
                                      />
                                    </td>
                                  );
                                });

                                return (
                                  <Fragment key={`${field.name}-option-${option.value}`}>
                                    <td className="checklist-field__matrix-cell">
                                      <label className={`checklist-pill checklist-pill--${(rowIndex + columnIndex) % 6}`}>
                                        <span className="checklist-pill__label">{option.label}</span>
                                      </label>
                                    </td>
                                    <td className="checklist-field__matrix-cell checklist-field__matrix-cell--allow">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) => {
                                          const nextValues = Array.isArray(formState[field.name])
                                            ? [...formState[field.name]]
                                            : [];

                                          handleChange(
                                            field,
                                            event.target.checked
                                              ? [...new Set([...nextValues, option.value])]
                                              : nextValues.filter((item) => item !== option.value)
                                          );
                                        }}
                                      />
                                    </td>
                                    {actionCells}
                                  </Fragment>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="checklist-field__actions checklist-field__actions--bottom">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => handleChange(field, isAllSelected ? [] : allChecklistValues)}
                      >
                        {isAllSelected ? "Clear All" : "Select All"}
                      </button>
                    </div>
                  </div>
                );
              }
              if (field.type === "checkbox") {
                return (
                  <label key={field.name} className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={Boolean(formState[field.name])}
                      onChange={(event) => handleChange(field, event.target.checked)}
                    />
                    <span>{field.label}</span>
                  </label>
                );
              }

              if (field.type === "textarea") {
                return (
                  <label key={field.name} className="form-field">
                    <FormLabel required={Boolean(field.required)}>{field.label}</FormLabel>
                    <textarea
                      value={formState[field.name]}
                      onChange={(event) => handleChange(field, event.target.value)}
                      rows="3"
                    />
                  </label>
                );
              }

              if (field.type === "file") {
                return (
                  <label key={field.name} className="form-field">
                    <FormLabel required={Boolean(field.required)}>{field.label}</FormLabel>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleChange(field, event.target.files?.[0] || null)}
                    />
                  </label>
                );
              }

              if (field.type === "select") {
                const dynamicOptions = field.optionsFrom
                  ? (optionsMap[field.optionsFrom] || []).filter((option) => {
                      if (field.optionFilter && !field.optionFilter(option, formState)) {
                        return false;
                      }

                      if (!field.dependsOn || !field.dependsOnKey) {
                        return true;
                      }

                      const parentValue = formState[field.dependsOn];
                      if (!parentValue) {
                        return false;
                      }

                      return String(option[field.dependsOnKey] ?? "") === String(parentValue);
                    })
                  : field.staticOptions || [];

                return (
                  <label key={field.name} className="form-field">
                    <FormLabel required={Boolean(field.required)}>{field.label}</FormLabel>
                    <SearchableSelect
                      value={formState[field.name]}
                      onChange={(event) => handleChange(field, event.target.value)}
                    >
                      {!field.staticOptions ? <option value="">Select {field.label}</option> : null}
                      {field.staticOptions
                        ? field.staticOptions.map((option) => (
                            <option key={`${field.name}-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))
                        : dynamicOptions.map((option) => (
                            <option
                              key={`${field.name}-${field.optionValueKey || "id"}-${getOptionValue(field, option)}`}
                              value={getOptionValue(field, option)}
                            >
                              {field.optionLabelKey
                                ? option[field.optionLabelKey]
                                : getOptionLabel(field.optionsFrom, option)}
                            </option>
                          ))}
                    </SearchableSelect>
                    {resourceKey === "insurance-products" && field.name === "category_id" && selectedCompanyType ? (
                      <p className="table-state">Selected Company Type: {selectedCompanyType}</p>
                    ) : null}
                  </label>
                );
              }

              return (
                <label key={field.name} className="form-field">
                  <FormLabel required={Boolean(field.required)}>{field.label}</FormLabel>
                  <input
                    type={field.type || "text"}
                    value={formState[field.name]}
                    required={Boolean(field.required)}
                    inputMode={field.validation?.pattern === "^\\d{10}$" ? "numeric" : undefined}
                    pattern={field.validation?.pattern}
                    title={field.validation?.message}
                    maxLength={field.validation?.pattern === "^\\d{10}$" ? 10 : undefined}
                    onChange={(event) => handleChange(field, event.target.value)}
                  />
                </label>
              );
            })}

            </fieldset>
            <div className="form-actions">
              <button type="button" className="secondary-button form-actions__cancel" onClick={resetForm}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? <ButtonSpinner label="Saving..." /> : editingId ? "Update Record" : "Save Record"}
              </button>
            </div>
          </form>

          {error ? <p className="feedback feedback--error">{error}</p> : null}
        </div>
      </section>
    </div>
  ) : null;

  if (embeddedFormOnly) {
    return formModal;
  }

  return (
    <div className="master-page">
      <div className="master-grid master-grid--list-only">
        <section className="master-card master-card--table">
          <div className="master-card__header">
            <span>{sortedRecords.length} records</span>
            <div className="master-card__actions master-card__actions--header">
                {isSettingsView ? null : (
                  <>
	                  <div className="master-list-toolbar__search">
	                    <input
	                      type="search"
	                      placeholder="Search..."
	                      value={searchTerm}
	                      onChange={(event) => setSearchTerm(event.target.value)}
	                    />
	                  </div>

	                  {filterConfigs.length > 0 ? (
	                    <ActionIconDisplay
	                      icon="filter"
	                      label="Filters"
	                      active={isFiltersOpen}
	                      onClick={() => setIsFiltersOpen((current) => !current)}
	                      variant="toolbar"
	                    />
	                  ) : null}

	                  <ActionIconDisplay
	                    icon="excel"
	                    label="Excel"
	                    showLabel
	                    variant="toolbar"
	                    onClick={() =>
	                      downloadCsv({
	                        title: config.title,
		                        columns: config.tableColumns,
		                        records: sortedRecords,
		                        mapRecord: (record) =>
		                          Object.fromEntries(
		                            config.tableColumns.map((column) => [
		                              column.key,
		                              column.formatter === "view_list"
		                                ? formatMenuViews(record[column.key])
		                                : column.type === "boolean"
		                                ? (record[column.key] ? "Yes" : "No")
		                                : record[column.key]
		                            ])
		                          )
		                      })
	                    }
	                  />
	                  <ActionIconDisplay
	                    icon="pdf"
	                    label="PDF"
	                    showLabel
	                    variant="toolbar"
	                    onClick={() =>
	                      downloadPdf({
	                        title: config.title,
		                        columns: config.tableColumns,
		                        records: sortedRecords,
		                        mapRecord: (record) =>
		                          Object.fromEntries(
		                            config.tableColumns.map((column) => [
		                              column.key,
		                              column.formatter === "view_list"
		                                ? formatMenuViews(record[column.key])
		                                : column.type === "boolean"
		                                ? (record[column.key] ? "Yes" : "No")
		                                : record[column.key]
		                            ])
		                          )
		                      })
	                    }
	                  />
	                  <button
	                    type="button"
	                    className="secondary-button secondary-button--template hide-mobile"
	                    onClick={handleDownloadTemplate}
	                  >
	                    Template
	                  </button>
	                  <button
	                    type="button"
	                    className="secondary-button secondary-button--upload hide-mobile"
	                    onClick={openBulkUpload}
	                  >
	                    Upload
	                  </button>
                  </>
                )}
              {canAddRecord ? (
                <button
                  type="button"
                  className="primary-button primary-button--add"
                  onClick={handleAdd}
                  aria-label="Add record"
                  title="Add"
                >
                  <span className="primary-button__icon" aria-hidden="true">
                    +
                  </span>
                  <span className="primary-button__label">Add</span>
                </button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="table-state">
              <Spinner label="Loading records..." />
            </div>
          ) : (
            <>
	              {isFiltersOpen && !isSettingsView ? (
                <div className="data-toolbar">
                  <div className="data-toolbar__filters">
                    {filterConfigs.map((filter) => (
                      <MultiSelectFilter
                        key={filter.key}
                        label={filter.label}
                        options={filter.options}
                        selectedValues={activeFilters[filter.key] || []}
                        onChange={(values) =>
                          setActiveFilters((current) => ({
                            ...current,
                            [filter.key]: values
                          }))
                        }
                      />
                    ))}

                    {filterConfigs.length > 0 ? (
                      <div className="data-toolbar__clear">
                        <button
                          type="button"
                          className="clear-filters-button"
                          onClick={() => {
                            setSearchTerm("");
                            setActiveFilters(
                              Object.fromEntries(filterConfigs.map((filter) => [filter.key, []]))
                            );
                          }}
                        >
                          Clear Filters
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="table-wrap">
                <table className="master-table">
                  <thead>
                    <tr>
                      <th>Sl.No.</th>
                      {config.tableColumns.map((column) => (
                        <th
                          key={column.key}
                          onClick={() => handleSort(column.key)}
                          style={{ cursor: "pointer", ...(getFixedColumnStyle(column.key) || {}) }}
                        >
                          {column.label}
                          {sortConfig.key === column.key && (
                            <span>{sortConfig.direction === "asc" ? " ^" : " v"}</span>
                          )}
                        </th>
                      ))}
                        {isSettingsView ? null : <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRecords.length === 0 ? (
                      <tr>
	                        <td colSpan={config.tableColumns.length + (isSettingsView ? 1 : 2)} className="table-state">
                          No records yet.
                        </td>
                      </tr>
                    ) : resourceKey === "cities" && groupedRecords ? (
                      (() => {
                        let runningIndex = pageStart;
                        return Object.entries(groupedRecords).map(([stateName, recordsInState]) => (
                          <Fragment key={stateName}>
                            <tr className="table-group-header">
                              <td
		                                colSpan={config.tableColumns.length + (isSettingsView ? 1 : 2)}
                                style={{ fontWeight: "bold", backgroundColor: "#f0f4ff", color: "#2d57d7" }}
                              >
                                {stateName}
                              </td>
                            </tr>
                            {recordsInState.map((record) => {
                              runningIndex += 1;
                              return (
                                <tr
                                  key={record.id}
                                  className="master-table__row"
                                  onClick={() => setSelectedRecord(record)}
                                >
                                  <td>{runningIndex}</td>
                                  {config.tableColumns.map((column) => {
                                    return (
                                      <td
                                        key={`${record.id}-${column.key}`}
                                        style={getFixedColumnStyle(column.key)}
                                        className={getTableCellClass(column.key)}
                                      >
                                        {formatColumnValue(record, column)}
                                      </td>
                                    );
                                  })}
		                                {isSettingsView ? null : <td onClick={(event) => event.stopPropagation()}>{renderRowActions(record)}</td>}
                                </tr>
                              );
                            })}
                          </Fragment>
                        ));
                      })()
                    ) : (
                      paginatedRecords.map((record, index) => (
                        <tr
                          key={record.id}
                          className="master-table__row"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <td>{pageStart + index + 1}</td>
                          {config.tableColumns.map((column) => {
                            return (
                              <td
                                key={`${record.id}-${column.key}`}
                                        style={getFixedColumnStyle(column.key)}
                                        className={getTableCellClass(column.key)}
                              >
                                {formatColumnValue(record, column)}
                              </td>
                            );
                          })}
                            {isSettingsView ? null : <td onClick={(event) => event.stopPropagation()}>{renderRowActions(record)}</td>}
                        </tr>
                      ))
                    )}
                  </tbody>
	                </table>
	              </div>
                {sortedRecords.length > 0 ? (
                  <TablePagination
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalItems={sortedRecords.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                  />
                ) : null}
                <RecordDetailModal
                  isOpen={Boolean(selectedRecord)}
                  title={config.title}
                  rows={detailRows}
                  actions={!isSettingsView && selectedRecord ? renderRowActions(selectedRecord) : null}
                  onClose={() => setSelectedRecord(null)}
                />
	            </>
	          )}

          {message ? <p className="feedback feedback--success">{message}</p> : null}
          {error && !isFormOpen ? <p className="feedback feedback--error">{error}</p> : null}
        </section>
      </div>

      {formModal}

      {isBulkUploadOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-upload-title">
          <div className="master-modal__backdrop" onClick={closeBulkUpload} />
          <section className="master-card master-modal__panel master-modal__panel--wide">
            <div className="master-card__header">
              <h3 id="bulk-upload-title">Bulk Upload {config.title}</h3>
              <button type="button" className="text-button" onClick={closeBulkUpload}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              <form className="master-form" onSubmit={handleBulkUpload}>
                <label className="form-field">
                  <FormLabel required>Upload CSV File</FormLabel>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => setBulkUploadFile(event.target.files?.[0] || null)}
                  />
                </label>

                <p className="table-state">
                  Download the template first, fill the same columns, then upload the CSV file for bulk import.
                </p>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button form-actions__cancel"
                    onClick={closeBulkUpload}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" disabled={bulkUploading}>
                    {bulkUploading ? <ButtonSpinner label="Uploading..." /> : "Upload Bulk"}
                  </button>
                </div>
              </form>

              {bulkUploadResult.processed > 0 || bulkUploadResult.errors.length > 0 ? (
                <div className="bulk-upload-results">
                  <p className="feedback feedback--success">
                    Processed: {bulkUploadResult.processed} | Success: {bulkUploadResult.successCount} | Failed:{" "}
                    {bulkUploadResult.failureCount}
                  </p>

                  {bulkUploadResult.errors.length > 0 ? (
                    <div className="table-wrap">
                      <table className="master-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Field</th>
                            <th>Value</th>
                            <th>Validation Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkUploadResult.errors.map((errorItem, index) => (
                            <tr key={`${errorItem.row}-${errorItem.field}-${index}`}>
                              <td>{errorItem.row}</td>
                              <td>{errorItem.field}</td>
                              <td>{formatCellValue(errorItem.value)}</td>
                              <td>{errorItem.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {resourceKey === "customers" && relatedPoliciesModal.isOpen ? (
        <div
          className="master-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-related-policies-title"
        >
          <div className="master-modal__backdrop" onClick={resetRelatedPoliciesModal} />
          <section className="master-card master-modal__panel master-modal__panel--wide">
	            <div className="master-card__header">
	              <h3 id="customer-related-policies-title">
	                Related Policies - Customer Name: {relatedPoliciesModal.customer?.full_name || "Customer"}
	              </h3>
              <button type="button" className="text-button" onClick={resetRelatedPoliciesModal}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              {relatedPoliciesModal.loading ? (
                <div className="table-state">
                  <Spinner label="Loading related policies..." />
                </div>
	              ) : relatedPoliciesModal.error ? (
	                <p className="feedback feedback--error">{relatedPoliciesModal.error}</p>
	              ) : (
                  <div className="customer-view-sections">
                    <div className="customer-view-section">
                      <div className="master-card__header">
                        <h4 className="customer-view-section__title">Policies</h4>
                        <div className="master-card__actions">
                          <ActionIconDisplay
                            icon="excel"
                            label="Excel"
                            variant="toolbar"
                            onClick={() =>
                              downloadCsv({
                                title: `Policies - ${relatedPoliciesModal.customer?.full_name}`,
                                columns: [
                                  { key: "policy_number", label: "Policy No." },
                                  { key: "issue_date", label: "Issue Date" },
                                  { key: "business_type", label: "Business Type" },
                                  { key: "policy_type", label: "Policy Type" },
                                  { key: "company_name", label: "Company" },
                                  { key: "product_name", label: "Product" },
                                  { key: "risk_end_date", label: "Risk Expiry Date" },
                                  { key: "renewal_status", label: "Renewal Status" },
                                  { key: "policy_status", label: "Status" }
                                ],
                                records: relatedPoliciesModal.policies
                              })
                            }
                          />
                          <ActionIconDisplay
                            icon="pdf"
                            label="PDF"
                            variant="toolbar"
                            onClick={() =>
                              downloadPdf({
                                title: `Policies - ${relatedPoliciesModal.customer?.full_name}`,
                                columns: [
                                  { key: "policy_number", label: "Policy No." },
                                  { key: "issue_date", label: "Issue Date" },
                                  { key: "business_type", label: "Business Type" },
                                  { key: "policy_type", label: "Policy Type" },
                                  { key: "company_name", label: "Company" },
                                  { key: "product_name", label: "Product" },
                                  { key: "risk_end_date", label: "Risk Expiry Date" },
                                  { key: "renewal_status", label: "Renewal Status" },
                                  { key: "policy_status", label: "Status" }
                                ],
                                records: relatedPoliciesModal.policies
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="table-wrap">
                        <table className="master-table">
                          <thead>
		                        <tr>
		                          <th>Policy No.</th>
		                          <th>Issue Date</th>
		                          <th>Business Type</th>
		                          <th>Policy Type</th>
		                          <th>Company</th>
		                          <th>Product</th>
		                          <th>Risk Expiry Date</th>
		                          <th>Renewal Status</th>
		                          <th>Status</th>
	                        </tr>
                          </thead>
                          <tbody>
                            {relatedPoliciesModal.policies.length === 0 ? (
                              <tr>
                                <td colSpan="9" className="table-state">
                                  No related policies found for this customer.
                                </td>
                              </tr>
                            ) : (
                              relatedPoliciesModal.policies.map((policy) => (
		                            <tr key={policy.id}>
		                              <td>{formatCellValue(policy.policy_number)}</td>
		                              <td>{formatCellValue(policy.issue_date)}</td>
		                              <td>{formatCellValue(policy.business_type)}</td>
		                              <td>{formatCellValue(policy.policy_type)}</td>
		                              <td className="text-blue">{formatCellValue(policy.company_name)}</td>
		                              <td className="text-blue">{formatCellValue(policy.product_name)}</td>
		                              <td>{formatCellValue(policy.risk_end_date)}</td>
		                              <td>{formatCellValue(policy.renewal_status)}</td>
		                              <td>{formatCellValue(policy.policy_status)}</td>
	                            </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="customer-view-section">
                      <div className="master-card__header">
                        <h4 className="customer-view-section__title">Documents</h4>
                        <div className="master-card__actions">
                          <ActionIconDisplay
                            icon="excel"
                            label="Excel"
                            variant="toolbar"
                            onClick={() =>
                              downloadCsv({
                                title: `Documents - ${relatedPoliciesModal.customer?.full_name}`,
                                columns: [
                                  { key: "document_type_name", label: "Document Type" },
                                  { key: "file_name", label: "File Name" },
                                  { key: "document_number", label: "Document No." },
                                  { key: "document_date", label: "Document Date" },
                                  { key: "expiry_date", label: "Expiry Date" },
                                  { key: "remarks", label: "Remarks" },
                                ],
                                records: relatedPoliciesModal.documents
                              })
                            }
                          />
                          <ActionIconDisplay
                            icon="pdf"
                            label="PDF"
                            variant="toolbar"
                            onClick={() =>
                              downloadPdf({
                                title: `Documents - ${relatedPoliciesModal.customer?.full_name}`,
                                columns: [
                                  { key: "document_type_name", label: "Document Type" },
                                  { key: "file_name", label: "File Name" },
                                  { key: "document_number", label: "Document No." },
                                  { key: "document_date", label: "Document Date" },
                                  { key: "expiry_date", label: "Expiry Date" },
                                  { key: "remarks", label: "Remarks" },
                                ],
                                records: relatedPoliciesModal.documents
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="table-wrap">
                        <table className="master-table">
                          <thead>
                            <tr>
                              <th>Document Type</th>
                              <th>File Name</th>
                              <th>Document No.</th>
                              <th>Document Date</th>
                              <th>Expiry Date</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatedPoliciesModal.documents.length === 0 ? (
                              <tr>
                                <td colSpan="6" className="table-state">
                                  No documents found for this customer.
                                </td>
                              </tr>
                            ) : (
	                              relatedPoliciesModal.documents.map((document) => (
	                                <tr key={document.id}>
	                                  <td>{formatCellValue(document.document_type_name)}</td>
	                                  <td>
                                      {document.file_url ? (
                                        <a
                                          href={`${API_BASE}/${String(document.file_url).replace(/^\/+/, "")}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-blue"
                                        >
                                          {formatCellValue(document.file_name)}
                                        </a>
                                      ) : (
                                        formatCellValue(document.file_name)
                                      )}
                                    </td>
	                                  <td>{formatCellValue(document.document_number)}</td>
	                                  <td>{formatCellValue(document.document_date)}</td>
	                                  <td>{formatCellValue(document.expiry_date)}</td>
                                  <td>{formatCellValue(document.remarks)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
	              )}
            </div>
          </section>
        </div>
      ) : null}

      {resourceKey === "customers" && customerUploadModal.isOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="customer-upload-title">
          <div className="master-modal__backdrop" onClick={resetCustomerUploadModal} />
          <section className="master-card master-modal__panel">
            <div className="master-card__header">
              <h3 id="customer-upload-title">Upload Customer Document</h3>
              <button type="button" className="text-button" onClick={resetCustomerUploadModal}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              {customerUploadModal.loading ? (
                <div className="table-state">
                  <Spinner label="Loading document types..." />
                </div>
              ) : (
                <form className="master-form" onSubmit={handleCustomerDocumentUpload}>
                  <label className="form-field">
                    <FormLabel>Customer</FormLabel>
                    <input type="text" readOnly value={customerUploadModal.customer?.full_name || ""} />
                  </label>


                  <div className="customer-document-list">
                    {customerUploadModal.documents.map((document, index) => (
                      <div className="customer-document-card" key={`customer-document-${index + 1}`}>
                        <div className="customer-document-card__header">
                          <h4>Document {index + 1}</h4>
                          {customerUploadModal.documents.length > 1 ? (
                            <button
                              type="button"
                              className="text-button text-blue"
                              onClick={() => removeCustomerUploadDocument(index)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>

                        <div className="customer-document-card__grid">
                          <label className="form-field">
                            <FormLabel required>Document Type</FormLabel>
                            <SearchableSelect
                              value={document.document_type_id}
                              required
                              onChange={(event) =>
                                handleCustomerUploadChange(index, "document_type_id", event.target.value)
                              }
                            >
                              <option value="">Select Document Type</option>
                              {customerUploadModal.documentTypes.map((documentType) => (
                                <option key={documentType.id} value={documentType.id}>
                                  {documentType.name}
                                </option>
                              ))}
                            </SearchableSelect>
                          </label>

                          <label className="form-field">
                            <FormLabel>Document Number</FormLabel>
                            <input
                              type="text"
                              value={document.document_number}
                              onChange={(event) =>
                                handleCustomerUploadChange(index, "document_number", event.target.value)
                              }
                            />
                          </label>

                          <label className="form-field">
                            <FormLabel>Document Date</FormLabel>
                            <input
                              type="date"
                              value={document.document_date}
                              onChange={(event) =>
                                handleCustomerUploadChange(index, "document_date", event.target.value)
                              }
                            />
                          </label>

                          <label className="form-field">
                            <FormLabel>Expiry Date</FormLabel>
                            <input
                              type="date"
                              value={document.expiry_date}
                              onChange={(event) =>
                                handleCustomerUploadChange(index, "expiry_date", event.target.value)
                              }
                            />
                          </label>

                          <label className="form-field">
                            <FormLabel required>Choose File</FormLabel>
                            <input
                              type="file"
                              required
                              onChange={(event) =>
                                handleCustomerUploadChange(index, "file", event.target.files?.[0] || null)
                              }
                            />
                          </label>

                          <label className="form-field">
                            <FormLabel>Remarks</FormLabel>
                            <textarea
                              rows="3"
                              value={document.remarks}
                              onChange={(event) =>
                                handleCustomerUploadChange(index, "remarks", event.target.value)
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="form-actions form-actions--stacked">
                    <button type="button" className="secondary-button" onClick={addCustomerUploadDocument}>
                      + Add Another Document
                    </button>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="secondary-button form-actions__cancel"
                      onClick={resetCustomerUploadModal}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="primary-button" disabled={customerUploadModal.uploading}>
                      {customerUploadModal.uploading ? (
                        <ButtonSpinner label="Uploading..." />
                      ) : (
                        "Upload Documents"
                      )}
                    </button>
                  </div>
                </form>
              )}

              {customerUploadModal.error ? (
                <p className="feedback feedback--error">{customerUploadModal.error}</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}







