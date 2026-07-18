import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { ActionIconButton, ActionIconDisplay } from "./ActionIcon";
import FollowUpModal from "./FollowUpModal";
import { formatCellValue, formatDateDisplay } from "../utils/formatting";
import FormLabel from "./FormLabel";
import ResponsiveDataView from "./ResponsiveDataView";
import { ButtonSpinner } from "./Spinner";
import { buildFilterOptions } from "../utils/dataView";
import SearchableSelect from "./SearchableSelect";

const initialFormState = {
  customer_group_id: "",
  previous_policy_id: "",
  customer_id: "",
  new_policy_number: "",
  gross_premium: "",
  net_premium: "",
  issue_date: "",
  risk_start_date: "",
  risk_end_date: "",
  business_type: "Renewal",
  sum_insured: "",
  policy_type: "",
  company_id: "",
  product_id: "",
  vehicle_make: "",
  vehicle_model: "",
  year_of_manufacture: "",
  registration_no: "",
  paid_by_type: "",
  payment_mode: ""
};

const initialBulkUploadResult = {
  total_rows: 0,
  imported_count: 0,
  imported_with_warning_count: 0,
  failed_count: 0,
  warnings: [],
  errors: []
};

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

async function downloadResponseBlob(response, fallbackName) {
  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") || "";
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  const fileName = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function downloadCsvRows(headers, rows, fallbackName) {
  const csvContent = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(","))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fallbackName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildPolicyHolderDetail(policy) {
  if (!policy) return "";

  const parts = [
    policy.customer_name,
    policy.customer_mobile ? `Mobile: ${policy.customer_mobile}` : "",
    policy.customer_group_name ? `Group: ${policy.customer_group_name}` : ""
  ].filter(Boolean);

  return parts.join(" | ");
}

function validatePolicyDates(issueDate, riskEndDate) {
  if (issueDate && riskEndDate && riskEndDate < issueDate) {
    return "Risk Expiry Date must be greater than or equal to Policy Issued Date.";
  }

  return "";
}

function buildOldPolicyDetail(policy) {
  if (!policy) return "";

  const parts = [
    policy.policy_number ? `Policy No: ${policy.policy_number}` : "",
    policy.policy_type ? `Type: ${policy.policy_type}` : "",
    policy.company_name ? `Company: ${policy.company_name}` : "",
    policy.product_name ? `Product: ${policy.product_name}` : "",
    policy.risk_end_date ? `Expiry: ${formatDateDisplay(policy.risk_end_date)}` : ""
  ].filter(Boolean);

  return parts.join(" | ");
}

const renewalViewConfig = {
  all: {
    title: "Renew Policy",
    emptyMessage: "No policies are currently eligible for renewal."
  },
  "upcoming-45-days": {
    title: "Renew Policy - Upcoming 45 Days",
    emptyMessage: "No policies are due for renewal in the upcoming 45 days."
  },
  overdue: {
    title: "Renew Policy - Overdue",
    emptyMessage: "No overdue renewal policies found."
  }
};

function toDateKey(value) {
  return String(value || "").slice(0, 10);
}

function getTodayKey() {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function filterRenewalView(records, viewMode) {
  if (viewMode === "all") {
    return records;
  }

  const today = getTodayKey();
  const next45Days = addDaysKey(today, 45);

  return records.filter((record) => {
    const riskEndDate = toDateKey(record.risk_end_date);
    if (!riskEndDate) return false;

    if (viewMode === "upcoming-45-days") {
      return riskEndDate >= today && riskEndDate <= next45Days;
    }

    if (viewMode === "overdue") {
      return riskEndDate < today;
    }

    return true;
  });
}

const columns = [

  { key: "risk_end_date", label: "Expiry Date" },
  { key: "document_url", label: "Document", type: "document-link" },
  { key: "policy_number", label: "Policy No." },
  { key: "issue_date", label: "Issue Date" },
  { key: "customer_name", label: "Customer", highlight: true },
  { key: "customer_mobile", label: "Mobile" },
  { key: "customer_group_name", label: "Group", highlight: true },
  { key: "company_name", label: "Company Name", highlight: true },
  { key: "product_name", label: "Product Name", highlight: true },
  { key: "policy_type", label: "Policy Type" },
  { key: "registration_no", label: "Registration No." },
  { key: "follow_up_at", label: "Follow Up Date", className: "table-cell--follow-up" },
  { key: "follow_up_by_name", label: "Follow Up By", className: "table-cell--follow-up" },
  { key: "follow_up_mode", label: "Follow Up Mode", className: "table-cell--follow-up" },
  { key: "next_follow_up_at", label: "Next Follow Up Date", className: "table-cell--follow-up" },
  { key: "follow_up_status", label: "Follow Up Status", className: "table-cell--follow-up" },
  { key: "follow_up_remarks", label: "Follow Up Remarks", className: "table-cell--follow-up" }
];

export default function RenewPolicyPage({ viewMode = "all" }) {
  const [formState, setFormState] = useState(initialFormState);
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [inactiveReason, setInactiveReason] = useState("");
  const [bulkUploadFile, setBulkUploadFile] = useState(null);
  const [bulkUploadResult, setBulkUploadResult] = useState(initialBulkUploadResult);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isInactiveOpen, setIsInactiveOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [savingInactive, setSavingInactive] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [followUpError, setFollowUpError] = useState("");
  const [inactiveError, setInactiveError] = useState("");
  const [bulkUploadError, setBulkUploadError] = useState("");
  const [issueDateFrom, setIssueDateFrom] = useState("");
  const [issueDateTo, setIssueDateTo] = useState("");
  const [expiryDateFrom, setExpiryDateFrom] = useState("");
  const [expiryDateTo, setExpiryDateTo] = useState("");

  const normalizedViewMode = renewalViewConfig[viewMode] ? viewMode : "all";
  const viewConfig = renewalViewConfig[normalizedViewMode];

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [response, usersResponse] = await Promise.all([
        fetch(`${API_BASE}/policies/renew-form`),
        fetch(`${API_BASE}/masters/users?limit=250`)
      ]);
      const json = await readApiJson(response);
      const usersJson = await readApiJson(usersResponse);

      if (!response.ok) {
        throw new Error(json.message || "Failed to load renewal form data.");
      }
      if (!usersResponse.ok) {
        throw new Error(usersJson.message || "Failed to load users.");
      }

      setRecords(json.data?.policies || []);
      setUsers(usersJson.data || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (name, value) => {
    setFormState((current) => ({
      ...current,
      [name]: value
    }));
  };

  const openRenewForm = (policy) => {
    setSelectedPolicy(policy);
    setFormState({
      customer_group_id: policy.customer_group_id ? String(policy.customer_group_id) : "",
      previous_policy_id: String(policy.id),
      customer_id: policy.customer_id ? String(policy.customer_id) : "",
      new_policy_number: "",
      gross_premium: "",
      net_premium: "",
      issue_date: "",
      risk_start_date: "",
      risk_end_date: "",
      business_type: "Renewal",
      sum_insured: policy.sum_insured || "",
      policy_type: policy.policy_type || "",
      company_id: policy.company_id ? String(policy.company_id) : "",
      product_id: policy.product_id ? String(policy.product_id) : "",
      vehicle_make: policy.vehicle_make || "",
      vehicle_model: policy.vehicle_model || "",
      year_of_manufacture: policy.year_of_manufacture || "",
      registration_no: policy.registration_no || "",
      paid_by_type: "",
      payment_mode: ""
    });
    setMessage("");
    setError("");
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setFormState(initialFormState);
    setSelectedPolicy(null);
    setIsFormOpen(false);
  };

  const openFollowUpModal = (policy) => {
    setSelectedPolicy(policy);
    setFollowUpError("");
    setMessage("");
    setIsFollowUpOpen(true);
  };

  const closeFollowUpModal = () => {
    setSelectedPolicy(null);
    setIsFollowUpOpen(false);
    setFollowUpError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const dateValidationError = validatePolicyDates(formState.issue_date, formState.risk_end_date);
    if (dateValidationError) {
      setError(dateValidationError);
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_BASE}/policies/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formState)
      });

      const json = await readApiJson(response);
      if (!response.ok) {
        throw new Error(json.message || "Failed to renew policy.");
      }

      setMessage(json.message || "Policy renewed successfully.");
      resetForm();
      window.dispatchEvent(new Event("refresh-counts"));
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFollowUpSubmit = async (payload) => {
    setSavingFollowUp(true);
    setFollowUpError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/follow-ups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const json = await readApiJson(response);
      if (!response.ok) {
        throw new Error(json.message || "Failed to save follow up.");
      }

      setRecords((current) =>
        current.map((record) =>
          record.id === payload.policy_id
            ? {
                ...record,
                follow_up_at: json.data?.follow_up_at || record.follow_up_at,
                follow_up_by_name: json.data?.follow_up_by_name || record.follow_up_by_name,
                follow_up_mode: json.data?.follow_up_mode || record.follow_up_mode,
                next_follow_up_at: json.data?.next_follow_up_at || record.next_follow_up_at,
                follow_up_status: json.data?.follow_up_status || record.follow_up_status,
                follow_up_remarks: json.data?.follow_up_remarks || record.follow_up_remarks
              }
            : record
        )
      );
      setMessage(json.message || "Follow up saved successfully.");
      closeFollowUpModal();
    } catch (saveError) {
      setFollowUpError(saveError.message);
    } finally {
      setSavingFollowUp(false);
    }
  };

  const openInactiveModal = (policy) => {
    setSelectedPolicy(policy);
    setInactiveReason("");
    setInactiveError("");
    setMessage("");
    setIsInactiveOpen(true);
  };

  const closeInactiveModal = () => {
    setSelectedPolicy(null);
    setInactiveReason("");
    setInactiveError("");
    setIsInactiveOpen(false);
  };

  const closeBulkUpload = () => {
    setIsBulkUploadOpen(false);
    setBulkUploadFile(null);
    setBulkUploadError("");
    setBulkUploadResult(initialBulkUploadResult);
  };

  const handleInactiveSubmit = async (event) => {
    event.preventDefault();
    setSavingInactive(true);
    setInactiveError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/policies/${selectedPolicy?.id}/inactivate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reason: inactiveReason })
      });
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to mark policy inactive.");
      }

      setMessage(json.message || "Policy marked inactive successfully.");
      closeInactiveModal();
      window.dispatchEvent(new Event("refresh-counts"));
      await loadData();
    } catch (inactiveSaveError) {
      setInactiveError(inactiveSaveError.message);
    } finally {
      setSavingInactive(false);
    }
  };

  const handleTemplateDownload = async () => {
    setDownloadingTemplate(true);
    setBulkUploadError("");

    try {
      const response = await fetch(`${API_BASE}/policies/renew-import-template`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to download template.");
      }

      await downloadResponseBlob(response, "renew-policy-import-template.csv");
    } catch (downloadError) {
      setBulkUploadError(downloadError.message);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleBulkUpload = async (event) => {
    event.preventDefault();

    if (!bulkUploadFile) {
      setBulkUploadError("Please select a CSV file to upload.");
      return;
    }

    setBulkUploading(true);
    setBulkUploadError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", bulkUploadFile);

      const response = await fetch(`${API_BASE}/policies/renew-import`, {
        method: "POST",
        body: formData
      });
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to upload renewal CSV.");
      }

      setBulkUploadResult(json.data || initialBulkUploadResult);
      setMessage(json.message || "Renewal import processed.");
      window.dispatchEvent(new Event("refresh-counts"));
      await loadData();
    } catch (uploadError) {
      setBulkUploadError(uploadError.message);
    } finally {
      setBulkUploading(false);
    }
  };

  const handleErrorCsvDownload = () => {
    if (bulkUploadResult.errors.length === 0) {
      return;
    }

    const rows = bulkUploadResult.errors.map((errorItem) => [
      errorItem.row,
      errorItem.field,
      formatCellValue(errorItem.value),
      errorItem.message
    ]);

    downloadCsvRows(["Row", "Field", "Value", "Validation Error"], rows, "renew-policy-import-errors.csv");
  };

  const viewFilteredRecords = useMemo(
    () => filterRenewalView(records, normalizedViewMode),
    [records, normalizedViewMode]
  );

  const dateFilteredRecords = useMemo(() => {
    return viewFilteredRecords.filter((record) => {
      const issueDate = toDateKey(record.issue_date);
      const expiryDate = toDateKey(record.risk_end_date);

      if (issueDateFrom && issueDate < issueDateFrom) return false;
      if (issueDateTo && issueDate > issueDateTo) return false;
      if (expiryDateFrom && expiryDate < expiryDateFrom) return false;
      if (expiryDateTo && expiryDate > expiryDateTo) return false;

      return true;
    });
  }, [viewFilteredRecords, issueDateFrom, issueDateTo, expiryDateFrom, expiryDateTo]);

  const filterConfigs = useMemo(
    () => [
      { key: "customer_name", label: "Customer", options: buildFilterOptions(viewFilteredRecords, "customer_name") },
      { key: "company_name", label: "Company", options: buildFilterOptions(viewFilteredRecords, "company_name") },
      { key: "product_name", label: "Product", options: buildFilterOptions(viewFilteredRecords, "product_name") },
      { key: "policy_type", label: "Policy Type", options: buildFilterOptions(viewFilteredRecords, "policy_type") },
      { key: "customer_group_name", label: "Group", options: buildFilterOptions(viewFilteredRecords, "customer_group_name") }
    ],
    [viewFilteredRecords]
  );

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        <ResponsiveDataView
          title={viewConfig.title}
          records={dateFilteredRecords}
          columns={columns}
          loading={loading}
          error={error && !isFormOpen ? error : ""}
          loadingMessage="Loading renewal policies..."
          emptyMessage={viewConfig.emptyMessage}
          searchKeys={[
            "policy_number",
            "customer_name",
            "customer_mobile",
            "customer_group_name",
            "company_name",
            "product_name",
            "policy_type",
            "registration_no"
          ]}
          filterConfigs={filterConfigs}
          headerExtras={
            <>
              <ActionIconDisplay
                icon="excel"
                label={downloadingTemplate ? "Downloading..." : "CSV Template"}
                showLabel
                variant="toolbar"
                onClick={handleTemplateDownload}
              />
              <ActionIconDisplay
                icon="upload"
                label="Upload CSV"
                showLabel
                variant="toolbar"
                onClick={() => {
                  setBulkUploadError("");
                  setBulkUploadResult(initialBulkUploadResult);
                  setIsBulkUploadOpen(true);
                }}
              />
            </>
          }
          customFilterContent={
            <>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Issue Date From</FormLabel>
                <input type="date" value={issueDateFrom} onChange={(event) => setIssueDateFrom(event.target.value)} />
              </label>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Issue Date To</FormLabel>
                <input type="date" value={issueDateTo} onChange={(event) => setIssueDateTo(event.target.value)} />
              </label>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Expiry Date From</FormLabel>
                <input type="date" value={expiryDateFrom} onChange={(event) => setExpiryDateFrom(event.target.value)} />
              </label>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Expiry Date To</FormLabel>
                <input type="date" value={expiryDateTo} onChange={(event) => setExpiryDateTo(event.target.value)} />
              </label>
            </>
          }
          onClearCustomFilters={() => {
            setIssueDateFrom("");
            setIssueDateTo("");
            setExpiryDateFrom("");
            setExpiryDateTo("");
          }}
          renderActions={(policy) => (
            <>
              <ActionIconButton icon="followup" label="Followup" onClick={() => openFollowUpModal(policy)} />
              <ActionIconButton icon="renew" label="Renew" tone="primary" onClick={() => openRenewForm(policy)} />
              <ActionIconButton icon="inactive" label="Make Inactive" tone="danger" onClick={() => openInactiveModal(policy)} />
            </>
          )}
        />

        {message ? <p className="feedback feedback--success">{message}</p> : null}
      </section>

      {isFormOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="renew-policy-title">
          <div className="master-modal__backdrop" onClick={resetForm} />
          <section className="master-card master-modal__panel master-modal__panel--wide">
            <div className="master-card__header">
              <h3 id="renew-policy-title">Renew Policy Form</h3>
              <button type="button" className="text-button" onClick={resetForm}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              <form className="issue-policy-form" onSubmit={handleSubmit}>
                <label className="form-field">
                  <FormLabel>Group Name</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.customer_group_name || ""} />
                </label>

                <label className="form-field issue-policy-form__wide">
                  <FormLabel>Old Policy Details</FormLabel>
                  <textarea readOnly rows="2" value={buildOldPolicyDetail(selectedPolicy)} />
                </label>

                <label className="form-field issue-policy-form__wide">
                  <FormLabel>Policy Holder Detail</FormLabel>
                  <textarea readOnly rows="2" value={buildPolicyHolderDetail(selectedPolicy)} />
                </label>

                <label className="form-field">
                  <FormLabel required>New Policy Number</FormLabel>
                  <input type="text" value={formState.new_policy_number} required onChange={(event) => handleChange("new_policy_number", event.target.value)} />
                </label>
                <label className="form-field">
                  <FormLabel>Gross Premium</FormLabel>
                  <input type="number" min="0" step="0.01" value={formState.gross_premium} onChange={(event) => handleChange("gross_premium", event.target.value)} />
                </label>
                <label className="form-field">
                  <FormLabel>Net Premium</FormLabel>
                  <input type="number" min="0" step="0.01" value={formState.net_premium} onChange={(event) => handleChange("net_premium", event.target.value)} />
                </label>
                <label className="form-field">
                  <FormLabel>Policy Issued Date</FormLabel>
                  <input type="date" value={formState.issue_date} onChange={(event) => handleChange("issue_date", event.target.value)} />
                </label>
                <label className="form-field">
                  <FormLabel>Risk Inception Date</FormLabel>
                  <input type="date" value={formState.risk_start_date} onChange={(event) => handleChange("risk_start_date", event.target.value)} />
                </label>
                <label className="form-field">
                  <FormLabel>Risk Expiry Date</FormLabel>
                  <input type="date" value={formState.risk_end_date} min={formState.issue_date || undefined} onChange={(event) => handleChange("risk_end_date", event.target.value)} />
                </label>
                <label className="form-field">
                  <FormLabel>Business Type</FormLabel>
                  <input type="text" readOnly value={formState.business_type} />
                </label>
                <label className="form-field">
                  <FormLabel>Sum Insured</FormLabel>
                  <input type="number" min="0" step="0.01" value={formState.sum_insured} onChange={(event) => handleChange("sum_insured", event.target.value)} />
                </label>
                <label className="form-field">
                  <FormLabel>Policy Type</FormLabel>
                  <input type="text" readOnly value={formState.policy_type} />
                </label>
                <label className="form-field">
                  <FormLabel>Company Name</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.company_name || ""} />
                </label>
                <label className="form-field">
                  <FormLabel>Product Name</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.product_name || ""} />
                </label>
                <label className="form-field">
                  <FormLabel>Vehicle Make</FormLabel>
                  <input type="text" readOnly value={formState.vehicle_make} />
                </label>
                <label className="form-field">
                  <FormLabel>Vehicle Model</FormLabel>
                  <input type="text" readOnly value={formState.vehicle_model} />
                </label>
                <label className="form-field">
                  <FormLabel>Year of Manufacture</FormLabel>
                  <input type="number" readOnly value={formState.year_of_manufacture} />
                </label>
                <label className="form-field">
                  <FormLabel>Registration No.</FormLabel>
                  <input type="text" readOnly value={formState.registration_no} />
                </label>
                <label className="form-field">
                  <FormLabel>Payment made by</FormLabel>
                  <SearchableSelect value={formState.paid_by_type} onChange={(event) => handleChange("paid_by_type", event.target.value)}>
                    <option value="">Select Payment made by</option>
                    <option value="Client">Client</option>
                    <option value="Agent">Agent</option>
                  </SearchableSelect>
                </label>
                <label className="form-field">
                  <FormLabel>Payment Mode</FormLabel>
                  <SearchableSelect value={formState.payment_mode} onChange={(event) => handleChange("payment_mode", event.target.value)}>
                    <option value="">Select Payment Mode</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                    <option value="Cash">Cash</option>
                  </SearchableSelect>
                </label>

                <div className="form-actions issue-policy-form__actions">
                  <button type="button" className="secondary-button form-actions__cancel" onClick={resetForm}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" disabled={saving}>
                    {saving ? <ButtonSpinner label="Saving..." /> : "Save Renewal"}
                  </button>
                </div>
              </form>

              {error ? <p className="feedback feedback--error">{error}</p> : null}
            </div>
          </section>
        </div>
      ) : null}

      {isInactiveOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="inactive-policy-title">
          <div className="master-modal__backdrop" onClick={closeInactiveModal} />
          <section className="master-card master-modal__panel master-modal__panel--small">
            <div className="master-card__header">
              <h3 id="inactive-policy-title">Make Policy Inactive</h3>
              <button type="button" className="text-button" onClick={closeInactiveModal}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              <form className="master-form" onSubmit={handleInactiveSubmit}>
                <label className="form-field">
                  <FormLabel>Policy No.</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.policy_number || ""} />
                </label>
                <label className="form-field">
                  <FormLabel>Customer</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.customer_name || ""} />
                </label>
                <label className="form-field issue-policy-form__wide">
                  <FormLabel required>Reason</FormLabel>
                  <textarea rows="4" required value={inactiveReason} onChange={(event) => setInactiveReason(event.target.value)} />
                </label>
                <div className="form-actions">
                  <button type="button" className="secondary-button form-actions__cancel" onClick={closeInactiveModal}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" disabled={savingInactive}>
                    {savingInactive ? <ButtonSpinner label="Saving..." /> : "Save Inactive"}
                  </button>
                </div>
              </form>
              {inactiveError ? <p className="feedback feedback--error">{inactiveError}</p> : null}
            </div>
          </section>
        </div>
      ) : null}

      {isBulkUploadOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="renew-bulk-upload-title">
          <div className="master-modal__backdrop" onClick={closeBulkUpload} />
          <section className="master-card master-modal__panel master-modal__panel--wide">
            <div className="master-card__header">
              <h3 id="renew-bulk-upload-title">Historical Renewal CSV Upload</h3>
              <button type="button" className="text-button" onClick={closeBulkUpload}>
                Cancel
              </button>
            </div>
            <div className="master-modal__body">
              <form className="master-form" onSubmit={handleBulkUpload}>
                <label className="form-field">
                  <FormLabel required>Upload CSV File</FormLabel>
                  <input type="file" accept=".csv,text/csv" onChange={(event) => setBulkUploadFile(event.target.files?.[0] || null)} />
                </label>
                <p className="table-state">
                  Download the CSV template with the dummy example row first. Do not enter IDs in the file. The backend will resolve labels to IDs where applicable.
                </p>
                <div className="form-actions">
                  <button type="button" className="secondary-button form-actions__cancel" onClick={handleTemplateDownload}>
                    {downloadingTemplate ? "Downloading..." : "Download Template"}
                  </button>
                  <button type="submit" className="primary-button" disabled={bulkUploading}>
                    {bulkUploading ? <ButtonSpinner label="Uploading..." /> : "Upload CSV"}
                  </button>
                </div>
              </form>

              {bulkUploadError ? <p className="feedback feedback--error">{bulkUploadError}</p> : null}

              {bulkUploadResult.total_rows > 0 || bulkUploadResult.errors.length > 0 || bulkUploadResult.warnings.length > 0 ? (
                <div className="bulk-upload-results">
                  <div className="form-actions">
                    <p className="feedback feedback--success">
                      Total Rows: {bulkUploadResult.total_rows} | Imported: {bulkUploadResult.imported_count} | Imported With Warning: {bulkUploadResult.imported_with_warning_count} | Failed: {bulkUploadResult.failed_count}
                    </p>
                    {bulkUploadResult.errors.length > 0 ? (
                      <button type="button" className="secondary-button" onClick={handleErrorCsvDownload}>
                        Download Errors CSV
                      </button>
                    ) : null}
                  </div>

                  {bulkUploadResult.warnings.length > 0 ? (
                    <div className="table-wrap">
                      <table className="master-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Field</th>
                            <th>Value</th>
                            <th>Warning</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkUploadResult.warnings.map((warning, index) => (
                            <tr key={`warning-${warning.row}-${warning.field}-${index}`}>
                              <td>{warning.row}</td>
                              <td>{warning.field}</td>
                              <td>{formatCellValue(warning.value)}</td>
                              <td>{warning.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

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

      <FollowUpModal
        isOpen={isFollowUpOpen}
        title="Renewal Follow Up"
        policy={selectedPolicy}
        policyType="Renewal"
        users={users}
        saving={savingFollowUp}
        error={followUpError}
        onClose={closeFollowUpModal}
        onSubmit={handleFollowUpSubmit}
      />
    </div>
  );
}

