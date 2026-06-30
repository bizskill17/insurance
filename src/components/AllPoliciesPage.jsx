import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import ResponsiveDataView from "./ResponsiveDataView";
import { ActionIconButton } from "./ActionIcon";
import { buildFilterOptions } from "../utils/dataView";
import FormLabel from "./FormLabel";
import { ButtonSpinner } from "./Spinner";
import SearchableSelect from "./SearchableSelect";
import { formatCellValue } from "../utils/formatting";

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

function sortByLabel(items, key) {
  return [...items].sort((a, b) => String(a[key] || "").localeCompare(String(b[key] || "")));
}

function validatePolicyDates(issueDate, riskEndDate) {
  if (issueDate && riskEndDate && riskEndDate < issueDate) {
    return "Risk Expiry Date must be greater than or equal to Policy Issued Date.";
  }

  return "";
}

function createEditFormState(policy) {
  return {
    id: policy?.id ? String(policy.id) : "",
    customer_name: policy?.customer_name || "",
    customer_group_name: policy?.customer_group_name || "",
    policy_number: policy?.policy_number || "",
    gross_premium: policy?.gross_premium ?? "",
    net_premium: policy?.net_premium ?? "",
    issue_date: String(policy?.issue_date || "").slice(0, 10),
    risk_start_date: String(policy?.risk_start_date || "").slice(0, 10),
    risk_end_date: String(policy?.risk_end_date || "").slice(0, 10),
    business_type: policy?.business_type || "",
    sum_insured: policy?.sum_insured ?? "",
    policy_type: policy?.policy_type_id ? String(policy.policy_type_id) : "",
    company_id: policy?.company_id ? String(policy.company_id) : "",
    product_id: policy?.product_id ? String(policy.product_id) : "",
    vehicle_make: policy?.vehicle_make || "",
    vehicle_model: policy?.vehicle_model || "",
    year_of_manufacture: policy?.year_of_manufacture ?? "",
    registration_no: policy?.registration_no || "",
    paid_by_type: policy?.paid_by_type || "",
    agent_payment_account_id: policy?.agent_payment_account_id ? String(policy.agent_payment_account_id) : "",
    payment_mode: policy?.payment_mode || ""
  };
}

const columns = [
  { key: "policy_number", label: "Policy No." },
  { key: "issue_date", label: "Issue Date" },
  { key: "customer_name", label: "Customer", highlight: true },
  { key: "customer_group_name", label: "Customer Group", highlight: true },
  { key: "company_name", label: "Insurance Company", highlight: true },
  { key: "product_name", label: "Product Name", highlight: true },
  { key: "policy_type", label: "Policy Type" },
  { key: "business_type", label: "Business Type" },
  { key: "gross_premium", label: "Gross Premium" },
  { key: "net_premium", label: "Net Premium" },
  { key: "risk_start_date", label: "Risk Start" },
  { key: "risk_end_date", label: "Risk End" },
  { key: "paid_by_type", label: "Payment By" },
  { key: "payment_mode", label: "Payment Mode" },
  { key: "policy_status", label: "Status" }
];

export default function AllPoliciesPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [issueDateFrom, setIssueDateFrom] = useState("");
  const [issueDateTo, setIssueDateTo] = useState("");
  const [expiryDateFrom, setExpiryDateFrom] = useState("");
  const [expiryDateTo, setExpiryDateTo] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [isInactiveOpen, setIsInactiveOpen] = useState(false);
  const [inactiveReason, setInactiveReason] = useState("");
  const [inactiveError, setInactiveError] = useState("");
  const [savingInactive, setSavingInactive] = useState(false);
  const [lookupData, setLookupData] = useState({
    policyTypes: [],
    insuranceCompanies: [],
    products: [],
    agentAccounts: []
  });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [editFormState, setEditFormState] = useState(createEditFormState(null));
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadRecords = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/policies?limit=500000`);
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to load policies.");
      }

      setRecords(json.data || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const loadEditLookups = async () => {
    if (lookupData.policyTypes.length > 0) {
      return;
    }

    setLoadingEditData(true);
    try {
      const response = await fetch(`${API_BASE}/policies/issue-form`);
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to load policy form data.");
      }

      setLookupData({
        policyTypes: sortByLabel(json.data?.policyTypes || [], "category_name"),
        insuranceCompanies: sortByLabel(json.data?.insuranceCompanies || [], "company_name"),
        products: sortByLabel(json.data?.products || [], "product_name"),
        agentAccounts: sortByLabel(json.data?.agentAccounts || [], "account_label")
      });
    } catch (lookupError) {
      setEditError(lookupError.message);
    } finally {
      setLoadingEditData(false);
    }
  };

  const filteredProducts = useMemo(
    () =>
      lookupData.products.filter((product) => {
        const matchesCompany =
          !editFormState.company_id || String(product.company_id || "") === editFormState.company_id;
        const matchesPolicyType =
          !editFormState.policy_type || String(product.category_id || "") === editFormState.policy_type;

        return matchesCompany && matchesPolicyType;
      }),
    [editFormState.company_id, editFormState.policy_type, lookupData.products]
  );

  const dateFilteredRecords = useMemo(() => {
    return records.filter((record) => {
      const issueDate = String(record.issue_date || "").slice(0, 10);
      const expiryDate = String(record.risk_end_date || "").slice(0, 10);

      if (issueDateFrom && issueDate < issueDateFrom) return false;
      if (issueDateTo && issueDate > issueDateTo) return false;
      if (expiryDateFrom && expiryDate < expiryDateFrom) return false;
      if (expiryDateTo && expiryDate > expiryDateTo) return false;

      return true;
    });
  }, [records, issueDateFrom, issueDateTo, expiryDateFrom, expiryDateTo]);

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
      await loadRecords();
    } catch (inactiveSaveError) {
      setInactiveError(inactiveSaveError.message);
    } finally {
      setSavingInactive(false);
    }
  };

  const openEditModal = async (policy) => {
    setSelectedPolicy(policy);
    setEditFormState(createEditFormState(policy));
    setEditError("");
    setMessage("");
    setIsEditOpen(true);
    await loadEditLookups();
  };

  const closeEditModal = () => {
    setSelectedPolicy(null);
    setIsEditOpen(false);
    setEditFormState(createEditFormState(null));
    setEditError("");
    setSavingEdit(false);
  };

  const handleEditChange = (name, value) => {
    setEditFormState((current) => {
      const next = { ...current, [name]: value };

      if (name === "company_id" && current.company_id !== value) {
        next.product_id = "";
      }

      if (name === "policy_type" && current.policy_type !== value) {
        next.product_id = "";
      }

      if (name === "product_id") {
        const product = lookupData.products.find((item) => String(item.id) === value);
        next.policy_type = product?.category_id ? String(product.category_id) : next.policy_type;
      }

      if (name === "paid_by_type" && value !== "Agent") {
        next.agent_payment_account_id = "";
        next.payment_mode = "";
      }

      return next;
    });
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();

    const dateValidationError = validatePolicyDates(editFormState.issue_date, editFormState.risk_end_date);
    if (dateValidationError) {
      setEditError(dateValidationError);
      return;
    }

    setSavingEdit(true);
    setEditError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/policies/${editFormState.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          policy_number: editFormState.policy_number,
          gross_premium: editFormState.gross_premium,
          net_premium: editFormState.net_premium,
          issue_date: editFormState.issue_date,
          risk_start_date: editFormState.risk_start_date,
          risk_end_date: editFormState.risk_end_date,
          business_type: editFormState.business_type,
          sum_insured: editFormState.sum_insured,
          policy_type: editFormState.policy_type,
          company_id: editFormState.company_id,
          product_id: editFormState.product_id,
          vehicle_make: editFormState.vehicle_make,
          vehicle_model: editFormState.vehicle_model,
          year_of_manufacture: editFormState.year_of_manufacture,
          registration_no: editFormState.registration_no,
          paid_by_type: editFormState.paid_by_type,
          agent_payment_account_id: editFormState.agent_payment_account_id,
          payment_mode: editFormState.payment_mode
        })
      });
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to update policy.");
      }

      setMessage(json.message || "Policy updated successfully.");
      closeEditModal();
      await loadRecords();
    } catch (saveError) {
      setEditError(saveError.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const loadPolicyDocuments = async (policy) => {
    const response = await fetch(`${API_BASE}/policies/${policy.id}/documents`);
    const json = await readApiJson(response);

    if (!response.ok) {
      throw new Error(json.message || "Failed to load policy documents.");
    }

    return { documents: json.data || [] };
  };

  const renderPolicyDetailExtra = (policy, detailData, detailState) => {
    if (!policy) {
      return null;
    }

    return (
      <div className="customer-view-section">
        <div className="master-card__header">
          <h4 className="customer-view-section__title">Documents</h4>
        </div>
        {detailState.loading ? (
          <div className="table-state">Loading documents...</div>
        ) : detailState.error ? (
          <p className="feedback feedback--error">{detailState.error}</p>
        ) : detailData?.documents?.length ? (
          <div className="table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>Document Type</th>
                  <th>File</th>
                </tr>
              </thead>
              <tbody>
                {detailData.documents.map((document, index) => (
                  <tr key={`${policy.id}-document-${index}`}>
                    <td>{formatCellValue(document.document_type_name)}</td>
                    <td>
                      {document.file_url ? (
                        <a
                          href={`${API_BASE}/${String(document.file_url).replace(/^\/+/, "")}`}
                          download={document.file_name || true}
                          className="text-blue"
                          style={{ textDecoration: "underline", fontWeight: 600 }}
                          title={document.file_name || "Download File"}
                        >
                          Link
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-state">No documents found for this policy.</div>
        )}
      </div>
    );
  };

  const renderPolicyActions = (policy) => (
    <>
      <ActionIconButton icon="pencil" label="Edit Policy" onClick={() => openEditModal(policy)} />
      {String(policy.policy_status || "") !== "Inactive" ? (
        <ActionIconButton icon="inactive" label="Make Policy Inactive" tone="danger" onClick={() => openInactiveModal(policy)} />
      ) : null}
    </>
  );

  const filterConfigs = useMemo(
    () => [
      { key: "customer_name", label: "Customer", options: buildFilterOptions(records, "customer_name") },
      { key: "customer_group_name", label: "Group", options: buildFilterOptions(records, "customer_group_name") },
      { key: "company_name", label: "Company", options: buildFilterOptions(records, "company_name") },
      { key: "policy_type", label: "Policy Type", options: buildFilterOptions(records, "policy_type") },
      { key: "business_type", label: "Business Type", options: buildFilterOptions(records, "business_type") },
      { key: "policy_status", label: "Status", options: buildFilterOptions(records, "policy_status") },
      { key: "paid_by_type", label: "Payment By", options: buildFilterOptions(records, "paid_by_type") }
    ],
    [records]
  );

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        {message ? <p className="feedback feedback--success">{message}</p> : null}
        <ResponsiveDataView
          title="All Policies"
          records={dateFilteredRecords}
          columns={columns}
          loading={loading}
          error={error}
          loadingMessage="Loading policies..."
          emptyMessage="No policies found."
          searchKeys={[
            "policy_number",
            "customer_name",
            "customer_group_name",
            "company_name",
            "product_name",
            "policy_type",
            "registration_no"
          ]}
          filterConfigs={filterConfigs}
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
          renderActions={renderPolicyActions}
          detailTitle="Policy Details"
          loadDetailData={loadPolicyDocuments}
          renderDetailExtra={renderPolicyDetailExtra}
        />
      </section>

      {isInactiveOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="all-policy-inactive-title">
          <div className="master-modal__backdrop" onClick={closeInactiveModal} />
          <section className="master-card master-modal__panel master-modal__panel--small">
            <div className="master-card__header">
              <h3 id="all-policy-inactive-title">Make Policy Inactive</h3>
              <button type="button" className="text-button" onClick={closeInactiveModal}>Cancel</button>
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
                  <button type="button" className="secondary-button form-actions__cancel" onClick={closeInactiveModal}>Cancel</button>
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

      {isEditOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="all-policy-edit-title">
          <div className="master-modal__backdrop" onClick={closeEditModal} />
          <section className="master-card master-modal__panel master-modal__panel--wide">
            <div className="master-card__header">
              <h3 id="all-policy-edit-title">Edit Policy</h3>
              <button type="button" className="text-button" onClick={closeEditModal}>Cancel</button>
            </div>
            <div className="master-modal__body">
              {loadingEditData ? <div className="table-state">Loading form data...</div> : (
                <form className="issue-policy-form" onSubmit={handleEditSubmit}>
                  <label className="form-field"><FormLabel>Customer Group</FormLabel><input type="text" readOnly value={editFormState.customer_group_name} /></label>
                  <label className="form-field"><FormLabel>Customer</FormLabel><input type="text" readOnly value={editFormState.customer_name} /></label>
                  <label className="form-field"><FormLabel required>Policy No.</FormLabel><input type="text" value={editFormState.policy_number} required onChange={(event) => handleEditChange("policy_number", event.target.value)} /></label>
                  <label className="form-field"><FormLabel required>Gross Premium</FormLabel><input type="number" min="0" step="0.01" required value={editFormState.gross_premium} onChange={(event) => handleEditChange("gross_premium", event.target.value)} /></label>
                  <label className="form-field"><FormLabel required>Net Premium</FormLabel><input type="number" min="0" step="0.01" required value={editFormState.net_premium} onChange={(event) => handleEditChange("net_premium", event.target.value)} /></label>
                  <label className="form-field"><FormLabel required>Policy Issued Date</FormLabel><input type="date" required value={editFormState.issue_date} onChange={(event) => handleEditChange("issue_date", event.target.value)} /></label>
                  <label className="form-field"><FormLabel required>Risk Inception Date</FormLabel><input type="date" required value={editFormState.risk_start_date} onChange={(event) => handleEditChange("risk_start_date", event.target.value)} /></label>
                  <label className="form-field"><FormLabel required>Risk Expiry Date</FormLabel><input type="date" required min={editFormState.issue_date || undefined} value={editFormState.risk_end_date} onChange={(event) => handleEditChange("risk_end_date", event.target.value)} /></label>
                  <label className="form-field"><FormLabel required>Business Type</FormLabel><SearchableSelect required value={editFormState.business_type} onChange={(event) => handleEditChange("business_type", event.target.value)}><option value="">Select Business Type</option><option value="New">New</option><option value="Existing">Existing</option><option value="Renewal">Renewal</option></SearchableSelect></label>
                  <label className="form-field"><FormLabel required>Sum Insured</FormLabel><input type="number" min="0" step="0.01" required value={editFormState.sum_insured} onChange={(event) => handleEditChange("sum_insured", event.target.value)} /></label>
                  <label className="form-field"><FormLabel required>Policy Type</FormLabel><SearchableSelect required value={editFormState.policy_type} onChange={(event) => handleEditChange("policy_type", event.target.value)}><option value="">Select Policy Type</option>{lookupData.policyTypes.map((type) => (<option key={type.id} value={type.id}>{type.category_name}</option>))}</SearchableSelect></label>
                  <label className="form-field"><FormLabel required>Insurance Company</FormLabel><SearchableSelect required value={editFormState.company_id} onChange={(event) => handleEditChange("company_id", event.target.value)}><option value="">Select Insurance Company</option>{lookupData.insuranceCompanies.map((company) => (<option key={company.id} value={company.id}>{company.company_name}</option>))}</SearchableSelect></label>
                  <label className="form-field"><FormLabel required>Product Name</FormLabel><SearchableSelect required value={editFormState.product_id} placeholder="Search product name" onChange={(event) => handleEditChange("product_id", event.target.value)}><option value="">Search product name</option>{filteredProducts.map((product) => { const companyName = String(product.company_name || "").trim(); const searchText = [product.product_name, companyName].filter(Boolean).join(" "); return (<option key={product.id} value={product.id} data-description={companyName} data-search-text={searchText}>{product.product_name}</option>); })}</SearchableSelect></label>
                  <label className="form-field"><FormLabel>Vehicle Make</FormLabel><input type="text" value={editFormState.vehicle_make} onChange={(event) => handleEditChange("vehicle_make", event.target.value)} /></label>
                  <label className="form-field"><FormLabel>Vehicle Model</FormLabel><input type="text" value={editFormState.vehicle_model} onChange={(event) => handleEditChange("vehicle_model", event.target.value)} /></label>
                  <label className="form-field"><FormLabel>Manufacture Year</FormLabel><input type="number" min="1900" max="9999" step="1" value={editFormState.year_of_manufacture} onChange={(event) => handleEditChange("year_of_manufacture", event.target.value)} /></label>
                  <label className="form-field"><FormLabel>Registration No.</FormLabel><input type="text" value={editFormState.registration_no} onChange={(event) => handleEditChange("registration_no", event.target.value)} /></label>
                  <label className="form-field"><FormLabel required>Payment By</FormLabel><SearchableSelect required value={editFormState.paid_by_type} onChange={(event) => handleEditChange("paid_by_type", event.target.value)}><option value="">Select Payment By</option><option value="Client">Client</option><option value="Agent">Agent</option></SearchableSelect></label>
                  {editFormState.paid_by_type === "Agent" ? (<><label className="form-field"><FormLabel required>Agent Accounts</FormLabel><SearchableSelect required value={editFormState.agent_payment_account_id} onChange={(event) => handleEditChange("agent_payment_account_id", event.target.value)}><option value="">Select Agent Account</option>{lookupData.agentAccounts.map((account) => (<option key={account.id} value={account.id}>{[account.agent_name, account.account_label, account.account_type].filter(Boolean).join(" - ")}</option>))}</SearchableSelect></label><label className="form-field"><FormLabel>Payment Mode</FormLabel><SearchableSelect value={editFormState.payment_mode} onChange={(event) => handleEditChange("payment_mode", event.target.value)}><option value="">Select Payment Mode</option><option value="Cheque">Cheque</option><option value="Online">Online</option><option value="Cash">Cash</option></SearchableSelect></label></>) : null}
                  <div className="form-actions issue-policy-form__actions"><button type="button" className="secondary-button form-actions__cancel" onClick={closeEditModal}>Cancel</button><button type="submit" className="primary-button" disabled={savingEdit}>{savingEdit ? <ButtonSpinner label="Saving..." /> : "Save Policy"}</button></div>
                </form>
              )}
              {editError ? <p className="feedback feedback--error">{editError}</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
