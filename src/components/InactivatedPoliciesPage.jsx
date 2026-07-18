import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { ActionIconButton } from "./ActionIcon";
import FormLabel from "./FormLabel";
import ResponsiveDataView from "./ResponsiveDataView";
import { buildFilterOptions } from "../utils/dataView";

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
  { key: "inactive_reason", label: "Inactive Reason" }
];

export default function InactivatedPoliciesPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reactivatingId, setReactivatingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [issueDateFrom, setIssueDateFrom] = useState("");
  const [issueDateTo, setIssueDateTo] = useState("");
  const [expiryDateFrom, setExpiryDateFrom] = useState("");
  const [expiryDateTo, setExpiryDateTo] = useState("");

  const loadRecords = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/policies/inactivated`);
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to load inactivated policies.");
      }

      setRecords(json.data?.policies || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

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

  const reactivatePolicy = async (policy) => {
    if (!window.confirm(`Reactivate policy "${policy.policy_number}"?`)) {
      return;
    }

    setReactivatingId(policy.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/policies/${policy.id}/reactivate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to reactivate policy.");
      }

      setMessage(json.message || "Policy reactivated successfully.");
      window.dispatchEvent(new Event("refresh-counts"));
      await loadRecords();
    } catch (reactivateError) {
      setError(reactivateError.message);
    } finally {
      setReactivatingId(null);
    }
  };

  const filterConfigs = useMemo(
    () => [
      { key: "customer_name", label: "Customer", options: buildFilterOptions(records, "customer_name") },
      { key: "company_name", label: "Company", options: buildFilterOptions(records, "company_name") },
      { key: "product_name", label: "Product", options: buildFilterOptions(records, "product_name") },
      { key: "policy_type", label: "Policy Type", options: buildFilterOptions(records, "policy_type") },
      { key: "customer_group_name", label: "Group", options: buildFilterOptions(records, "customer_group_name") }
    ],
    [records]
  );

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        <ResponsiveDataView
          title="Inactivated Policies"
          records={dateFilteredRecords}
          columns={columns}
          loading={loading}
          error={error}
          loadingMessage="Loading inactivated policies..."
          emptyMessage="No inactivated policies found."
          searchKeys={[
            "policy_number",
            "customer_name",
            "customer_mobile",
            "customer_group_name",
            "company_name",
            "product_name",
            "policy_type",
            "registration_no",
            "inactive_reason"
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
          renderActions={(policy) => (
            <ActionIconButton
              icon="tick"
              label={reactivatingId === policy.id ? "Reactivating..." : "Reactivate"}
              tone="primary"
              onClick={() => reactivatePolicy(policy)}
              disabled={reactivatingId === policy.id}
            />
          )}
        />

        {message ? <p className="feedback feedback--success">{message}</p> : null}
      </section>
    </div>
  );
}
