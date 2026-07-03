import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { ActionIconButton } from "./ActionIcon";
import FormLabel from "./FormLabel";
import ResponsiveDataView from "./ResponsiveDataView";
import { ButtonSpinner } from "./Spinner";
import { buildFilterOptions } from "../utils/dataView";
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

const MIN_PENDING_DOCUMENT_ISSUE_DATE = "2026-04-01";

const columns = [
  { key: "policy_number", label: "Policy No." },
  { key: "issue_date", label: "Issue Date" },
  { key: "customer_name", label: "Customer", highlight: true },
  { key: "customer_group_name", label: "Group Name", highlight: true },
  { key: "company_name", label: "Insurance Company", highlight: true },
  { key: "product_name", label: "Product Name", highlight: true },
  { key: "policy_type", label: "Policy Type" },
  { key: "risk_end_date", label: "Risk Expiry Date" }
];

function emptyPolicyDocumentEntry() {
  return {
    document_type_id: "",
    document_number: "",
    document_date: "",
    expiry_date: "",
    remarks: "",
    file: null
  };
}

export default function AttachDocumentsPage() {
  const [records, setRecords] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issueDateFrom, setIssueDateFrom] = useState(MIN_PENDING_DOCUMENT_ISSUE_DATE);
  const [issueDateTo, setIssueDateTo] = useState("");
  const [expiryDateFrom, setExpiryDateFrom] = useState("");
  const [expiryDateTo, setExpiryDateTo] = useState("");
  const [documents, setDocuments] = useState([emptyPolicyDocumentEntry()]);

  const policyDocumentTypes = documentTypes.filter(
    (documentType) => String(documentType.entity_level || "").toLowerCase() === "policy"
  );

  useEffect(() => {
    setIssueDateFrom(MIN_PENDING_DOCUMENT_ISSUE_DATE);
    setIssueDateTo("");
    setExpiryDateFrom("");
    setExpiryDateTo("");

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [policiesResponse, documentTypesResponse] = await Promise.all([
          fetch(`${API_BASE}/policies/pending-documents?limit=100`),
          fetch(`${API_BASE}/masters/document-types?limit=250`)
        ]);
        const [policiesJson, documentTypesJson] = await Promise.all([
          readApiJson(policiesResponse),
          readApiJson(documentTypesResponse)
        ]);

        if (!policiesResponse.ok) {
          throw new Error(policiesJson.message || "Failed to load pending document policies.");
        }

        if (!documentTypesResponse.ok) {
          throw new Error(documentTypesJson.message || "Failed to load document types.");
        }

        setRecords(policiesJson.data || []);
        setDocumentTypes(documentTypesJson.data || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const resetModal = () => {
    setIsModalOpen(false);
    setSelectedPolicy(null);
    setDocuments([emptyPolicyDocumentEntry()]);
  };

  const handleOpenUpload = (policy) => {
    setSelectedPolicy(policy);
    setMessage("");
    setError("");
    setDocuments([emptyPolicyDocumentEntry()]);
    setIsModalOpen(true);
  };

  const handleDocumentChange = (index, key, value) => {
    setDocuments((current) =>
      current.map((document, documentIndex) =>
        documentIndex === index
          ? {
              ...document,
              [key]: value
            }
          : document
      )
    );
  };

  const addDocumentBlock = () => {
    setDocuments((current) => [...current, emptyPolicyDocumentEntry()]);
  };

  const removeDocumentBlock = (index) => {
    setDocuments((current) =>
      current.length <= 1 ? [emptyPolicyDocumentEntry()] : current.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedPolicy) {
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const payload = new FormData();
      payload.append("policy_id", String(selectedPolicy.id));
      payload.append(
        "documents",
        JSON.stringify(
          documents.map((document) => ({
            document_type_id: document.document_type_id,
            document_number: document.document_number,
            document_date: document.document_date,
            expiry_date: document.expiry_date,
            remarks: document.remarks
          }))
        )
      );

      documents.forEach((document) => {
        if (document.file) {
          payload.append("files[]", document.file);
        }
      });

      const response = await fetch(`${API_BASE}/policies/upload-documents`, {
        method: "POST",
        body: payload
      });
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to upload document.");
      }

      setMessage(json.message || "Document uploaded successfully.");
      setRecords((current) => current.filter((record) => record.id !== selectedPolicy.id));
      resetModal();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  };

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
          title="Pending Document Uploads"
          records={dateFilteredRecords}
          columns={columns}
          loading={loading}
          error={error && !isModalOpen ? error : ""}
          loadingMessage="Loading pending policies..."
          emptyMessage="No policies are pending document upload."
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
            setIssueDateFrom(MIN_PENDING_DOCUMENT_ISSUE_DATE);
            setIssueDateTo("");
            setExpiryDateFrom("");
            setExpiryDateTo("");
          }}
          renderActions={(record) => (
            <ActionIconButton
              icon="upload"
              label="Upload Document"
              onClick={() => handleOpenUpload(record)}
            />
          )}
        />

        {message ? <p className="feedback feedback--success">{message}</p> : null}
      </section>

      {isModalOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="upload-document-title">
          <div className="master-modal__backdrop" onClick={resetModal} />
          <section className="master-card master-modal__panel">
            <div className="master-card__header">
              <h3 id="upload-document-title">Upload Document</h3>
              <button type="button" className="text-button" onClick={resetModal}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
	              <form className="master-form" onSubmit={handleSubmit}>
                <label className="form-field">
                  <FormLabel>Policy No.</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.policy_number || ""} />
                </label>

                <label className="form-field">
                  <FormLabel>Customer</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.customer_name || ""} />
                </label>

                  <div className="customer-document-list">
                    {documents.map((document, index) => (
                      <div className="customer-document-card" key={`policy-document-${index + 1}`}>
                        <div className="customer-document-card__header">
                          <h4>Document {index + 1}</h4>
                          {documents.length > 1 ? (
                            <button
                              type="button"
                              className="text-button text-blue"
                              onClick={() => removeDocumentBlock(index)}
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
                              onChange={(event) => handleDocumentChange(index, "document_type_id", event.target.value)}
                            >
                              <option value="">Select Document Type</option>
                              {policyDocumentTypes.map((documentType) => (
                                <option key={documentType.id} value={documentType.id}>
                                  {documentType.name}
                                </option>
                              ))}
                            </SearchableSelect>
                          </label>

                          <label className="form-field">
                            <FormLabel required>Choose File</FormLabel>
                            <input
                              type="file"
                              required
                              onChange={(event) => handleDocumentChange(index, "file", event.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="form-actions form-actions--stacked">
                    <button type="button" className="secondary-button" onClick={addDocumentBlock}>
                      + Add Another Document
                    </button>
                  </div>

	                <div className="form-actions">
                    <button type="button" className="secondary-button form-actions__cancel" onClick={resetModal}>
                      Cancel
                    </button>
	                  <button type="submit" className="primary-button" disabled={uploading}>
	                    {uploading ? <ButtonSpinner label="Uploading..." /> : "Upload Documents"}
	                  </button>
	                </div>
	              </form>

              {error ? <p className="feedback feedback--error">{error}</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
