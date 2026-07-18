import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE } from "../config/api";
import ResponsiveDataView from "./ResponsiveDataView";
import { buildFilterOptions } from "../utils/dataView";
import FormLabel from "./FormLabel";

const columns = [

  { key: "risk_end_date", label: "Expiry Date" },
  { key: "document_url", label: "Document", type: "document-link" },
  { key: "policy_number", label: "Policy No." },
  { key: "issue_date", label: "Issue Date" },
  { key: "customer_name", label: "Customer", highlight: true },
  { key: "customer_group_name", label: "Customer Group", highlight: true },
  { key: "company_name", label: "Insurance Company", highlight: true },
  { key: "product_name", label: "Product Name", highlight: true },
  { key: "policy_type", label: "Policy Type" },
  { key: "business_type", label: "Business Type" },
  { key: "net_premium", label: "Net Premium" },
  { key: "policy_status", label: "Status" }
];

const monthLabels = {
  1: "January",
  2: "February",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "August",
  9: "September",
  10: "October",
  11: "November",
  12: "December"
};

function getExpiryConfig(reportType, reportValue) {
  if (reportType === "month") {
    return {
      title: `${monthLabels[Number(reportValue)] || "Monthly"} Expiry Report`,
      endpoint: `${API_BASE}/reports/expiring-policies?mode=month&value=${encodeURIComponent(reportValue)}&limit=100`
    };
  }

  if (reportType === "day") {
    const labels = {
      today: "Today's Expiry Report",
      tomorrow: "Tomorrow's Expiry Report",
      "day-after-tomorrow": "Day After Tomorrow Expiry Report"
    };

    return {
      title: labels[reportValue] || "Daily Expiry Report",
      endpoint: `${API_BASE}/reports/expiring-policies?mode=day&value=${encodeURIComponent(reportValue)}&limit=100`
    };
  }

  if (reportType === "week") {
    return {
      title: "Next 7 Days Expiry Report",
      endpoint: `${API_BASE}/reports/expiring-policies?mode=week&value=${encodeURIComponent(reportValue || "7-days")}&limit=100`
    };
  }

  if (reportType === "year") {
    const labels = {
      current: "Current Financial Years Expiry Report",
      future: "Future Financial Years Expiry Report"
    };

    return {
      title: labels[reportValue] || "Yearly Expiry Report",
      endpoint: `${API_BASE}/reports/expiring-policies?mode=year&value=${encodeURIComponent(reportValue)}&limit=100`
    };
  }

  return null;
}

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

export default function ExpiryReportDetailPage() {
  const { reportType, reportValue } = useParams();
  const config = useMemo(
    () => getExpiryConfig(reportType, reportValue),
    [reportType, reportValue]
  );
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issueDateFrom, setIssueDateFrom] = useState("");
  const [issueDateTo, setIssueDateTo] = useState("");
  const [expiryDateFrom, setExpiryDateFrom] = useState("");
  const [expiryDateTo, setExpiryDateTo] = useState("");

  useEffect(() => {
    setIssueDateFrom("");
    setIssueDateTo("");
    setExpiryDateFrom("");
    setExpiryDateTo("");

    if (!config) {
      setLoading(false);
      setError("Expiry report configuration not found.");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(config.endpoint);
        const json = await readApiJson(response);

        if (!response.ok) {
          throw new Error(json.message || "Failed to load expiry report.");
        }

        setRecords(json.data || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [config]);

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

  const filterConfigs = useMemo(
    () => [
      { key: "customer_name", label: "Customer", options: buildFilterOptions(records, "customer_name") },
      { key: "customer_group_name", label: "Group", options: buildFilterOptions(records, "customer_group_name") },
      { key: "company_name", label: "Company", options: buildFilterOptions(records, "company_name") },
      { key: "product_name", label: "Product", options: buildFilterOptions(records, "product_name") },
      { key: "policy_type", label: "Policy Type", options: buildFilterOptions(records, "policy_type") },
      { key: "policy_status", label: "Status", options: buildFilterOptions(records, "policy_status") }
    ],
    [records]
  );

  if (!config) {
    return (
      <div className="page-shell issue-policy-page">
        <section className="master-card issue-policy-card">
          <p className="feedback feedback--error">Expiry report configuration not found.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        <ResponsiveDataView
          title={config.title}
          records={dateFilteredRecords}
          columns={columns}
          loading={loading}
          error={error}
          loadingMessage="Loading expiry report..."
          emptyMessage="No matching expiry policies found."
          searchKeys={[
            "policy_number",
            "customer_name",
            "customer_group_name",
            "company_name",
            "product_name",
            "policy_type"
          ]}
          filterConfigs={filterConfigs}
          customFilterContent={
            <>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Issue Date From</FormLabel>
                <input
                  type="date"
                  value={issueDateFrom}
                  onChange={(event) => setIssueDateFrom(event.target.value)}
                />
              </label>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Issue Date To</FormLabel>
                <input
                  type="date"
                  value={issueDateTo}
                  onChange={(event) => setIssueDateTo(event.target.value)}
                />
              </label>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Expiry Date From</FormLabel>
                <input
                  type="date"
                  value={expiryDateFrom}
                  onChange={(event) => setExpiryDateFrom(event.target.value)}
                />
              </label>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Expiry Date To</FormLabel>
                <input
                  type="date"
                  value={expiryDateTo}
                  onChange={(event) => setExpiryDateTo(event.target.value)}
                />
              </label>
            </>
          }
          onClearCustomFilters={() => {
            setIssueDateFrom("");
            setIssueDateTo("");
            setExpiryDateFrom("");
            setExpiryDateTo("");
          }}
        />
      </section>
    </div>
  );
}
