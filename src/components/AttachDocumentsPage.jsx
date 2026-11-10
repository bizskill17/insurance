import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { ActionIconButton } from "./ActionIcon";
import FormLabel from "./FormLabel";
import ResponsiveDataView from "./ResponsiveDataView";
import { ButtonSpinner } from "./Spinner";
import { buildFilterOptions } from "../utils/dataView";
import SearchableSelect from "./SearchableSelect";
import {
  DOCUMENT_ACCEPT,
  compressDocumentFile,
  formatFileSize,
  postFormWithProgress,
  validateDocumentFile
} from "../utils/documentUpload";

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
const PENDING_LIST_LIMIT = 2000;

const columns = [
  { key: "policy_number", label: "Policy No." },
  { key: "issue_date", label: "Issue Date" },
  { key: "customer_name", label: "Customer", highlight: true },
  { key: "customer_group_name", label: "Group Name", highlight: true },
  { key: "company_name", label: "Insurance Company", highlight: true },
  { key: "product_name", label: "Product Name", highlight: true },
  { key: "policy_type", label: "Policy Type" },
  { key: "risk_end_date", label: "Risk Expiry Date" },
  { key: "document_url", label: "Document", type: "document-link" }
];

function emptyPolicyDocumentEntry() {
  return {
    document_type_id: "",
    document_number: "",
    document_date: "",
    expiry_date: "",
    remarks: "",
    file: null,
    fileError: ""
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
  const [totalPending, setTotalPending] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const policyDocumentTypes = documentTypes.filter(
    (documentType) => String(documentType.entity_level || "").toLowerCase() === "policy"
  );

  useEffect(() => {
    let cancelled = false;

    const loadDocumentTypes = async () => {
      try {
        const response = await fetch(`${API_BASE}/masters/document-types?limit=250`);
        const json = await readApiJson(response);
        if (!response.ok) {
          throw new Error(json.message || "Failed to load document types.");
        }
        if (!cancelled) setDocumentTypes(json.data || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      }
    };

    loadDocumentTypes();
    return () => {
      cancelled = true;
    };
  }, []);

  // Date filters are applied on the server so every matching policy can be found,
  // not only the most recent ones that fit in one response.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: String(PENDING_LIST_LIMIT) });
    if (issueDateFrom) params.set("issue_from", issueDateFrom);
    if (issueDateTo) params.set("issue_to", issueDateTo);
    if (expiryDateFrom) params.set("expiry_from", expiryDateFrom);
    if (expiryDateTo) params.set("expiry_to", expiryDateTo);

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/policies/pending-documents?${params.toString()}`);
        const json = await readApiJson(response);

        if (!response.ok) {
          throw new Error(json.message || "Failed to load pending document policies.");
        }

        if (!cancelled) {
          const rows = json.data || [];
          setRecords(rows);
          setTotalPending(Number(json.meta?.total ?? rows.length));
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [issueDateFrom, issueDateTo, expiryDateFrom, expiryDateTo]);

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

  // Picking several files at once fills this block and adds a block for each extra file,
  // copying the chosen document type so it does not have to be selected again.
  const handleFilesSelected = (index, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) {
      setDocuments((current) =>
        current.map((document, documentIndex) =>
          documentIndex === index ? { ...document, file: null, fileError: "" } : document
        )
      );
      return;
    }

    setDocuments((current) => {
      const base = current[index] || emptyPolicyDocumentEntry();
      const updated = current.map((document, documentIndex) =>
        documentIndex === index
          ? { ...document, file: files[0], fileError: validateDocumentFile(files[0]) }
          : document
      );
      const extraBlocks = files.slice(1).map((file) => ({
        ...emptyPolicyDocumentEntry(),
        document_type_id: base.document_type_id,
        file,
        fileError: validateDocumentFile(file)
      }));

      return [...updated.slice(0, index + 1), ...extraBlocks, ...updated.slice(index + 1)];
    });
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

    const invalidDocument = documents.find((document) => document.fileError || validateDocumentFile(document.file));
    if (invalidDocument) {
      setError(invalidDocument.fileError || validateDocumentFile(invalidDocument.file));
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStage("Preparing files...");
    setMessage("");
    setError("");

    try {
      const preparedFiles = await Promise.all(documents.map((document) => compressDocumentFile(document.file)));
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

      preparedFiles.forEach((file) => {
        payload.append("files[]", file);
      });

      setUploadStage("Uploading...");
      const { ok, json } = await postFormWithProgress(
        `${API_BASE}/policies/upload-documents`,
        payload,
        setUploadProgress
      );

      if (!ok) {
        throw new Error(json?.message || "Failed to upload document.");
      }

      setMessage(json.message || "Document uploaded successfully.");
      setRecords((current) => current.filter((record) => record.id !== selectedPolicy.id));
      setTotalPending((current) => Math.max(0, current - 1));
      window.dispatchEvent(new Event("refresh-counts"));
      resetModal();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
      setUploadStage("");
      setUploadProgress(0);
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

        {!loading && totalPending > records.length ? (
          <p className="feedback">
            Showing the {records.length.toLocaleString()} most recently updated of {totalPending.toLocaleString()} pending
            policies. Use the date filters to find older ones.
          </p>
        ) : null}
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
                            {document.file ? (
                              <div className={`upload-file-chip ${document.fileError ? "upload-file-chip--error" : ""}`}>
                                <span className="upload-file-chip__name">
                                  {document.fileError || `${document.file.name} (${formatFileSize(document.file.size)})`}
                                </span>
                                <button
                                  type="button"
                                  className="text-button text-blue"
                                  onClick={() => handleFilesSelected(index, [])}
                                >
                                  Change file
                                </button>
                              </div>
                            ) : (
                              <>
                                <input
                                  type="file"
                                  required
                                  multiple
                                  accept={DOCUMENT_ACCEPT}
                                  onChange={(event) => handleFilesSelected(index, event.target.files)}
                                />
                                <small className="upload-file-note">
                                  PDF, image, Word or Excel, up to 15 MB. You can select several files at once.
                                </small>
                              </>
                            )}
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
	                    {uploading ? (
	                      <ButtonSpinner
	                        label={uploadStage === "Uploading..." ? `Uploading ${uploadProgress}%` : uploadStage || "Uploading..."}
	                      />
	                    ) : (
	                      "Upload Documents"
	                    )}
	                  </button>
	                </div>
	                {uploading && uploadStage === "Uploading..." ? (
	                  <div className="upload-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}>
	                    <div className="upload-progress__bar" style={{ width: `${uploadProgress}%` }} />
	                  </div>
	                ) : null}
	              </form>

              {error ? <p className="feedback feedback--error">{error}</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
