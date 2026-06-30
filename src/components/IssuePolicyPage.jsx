import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import FormLabel from "./FormLabel";
import { ButtonSpinner, Spinner } from "./Spinner";
import SearchableSelect from "./SearchableSelect";

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function createInitialFormState() {
  const today = getTodayDateValue();

  return {
    customer_group_id: "",
    customer_id: "",
    policy_number: "",
    gross_premium: "",
    net_premium: "",
    issue_date: today,
    risk_start_date: today,
    risk_end_date: "",
    business_type: "",
    sum_insured: "",
    policy_type: "",
    company_id: "",
    product_id: "",
    vehicle_make: "",
    vehicle_model: "",
    year_of_manufacture: "",
    registration_no: "",
    paid_by_type: "",
    agent_payment_account_id: "",
    payment_mode: "",
    cheque_number: "",
    cheque_date: "",
    cheque_amount: ""
  };
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

function sortByLabel(items, key) {
  return [...items].sort((a, b) => String(a[key] || "").localeCompare(String(b[key] || "")));
}

function validatePolicyDates(issueDate, riskEndDate) {
  if (issueDate && riskEndDate && riskEndDate < issueDate) {
    return "Risk Expiry Date must be greater than or equal to Policy Issued Date.";
  }

  return "";
}

export default function IssuePolicyPage() {
  const [formState, setFormState] = useState(createInitialFormState);
  const [lookupData, setLookupData] = useState({
    customerGroups: [],
    customers: [],
    policyTypes: [],
    insuranceCompanies: [],
    products: [],
    agentAccounts: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/policies/issue-form`);
        const json = await readApiJson(response);

        if (!response.ok) {
          throw new Error(json.message || "Failed to load form data.");
        }

        setLookupData({
          customerGroups: sortByLabel(json.data.customerGroups || [], "group_name"),
          customers: sortByLabel(json.data.customers || [], "full_name"),
          policyTypes: sortByLabel(json.data.policyTypes || [], "category_name"),
          insuranceCompanies: sortByLabel(json.data.insuranceCompanies || [], "company_name"),
          products: sortByLabel(json.data.products || [], "product_name"),
          agentAccounts: sortByLabel(json.data.agentAccounts || [], "account_label")
        });
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredCustomers = useMemo(
    () =>
      lookupData.customers.filter(
        (customer) =>
          !formState.customer_group_id || String(customer.group_id || "") === formState.customer_group_id
      ),
    [formState.customer_group_id, lookupData.customers]
  );

  const filteredProducts = useMemo(
    () =>
      lookupData.products.filter((product) => {
        const matchesCompany =
          !formState.company_id || String(product.company_id || "") === formState.company_id;
        const matchesPolicyType =
          !formState.policy_type || String(product.category_id || "") === formState.policy_type;

        return matchesCompany && matchesPolicyType;
      }),
    [formState.company_id, formState.policy_type, lookupData.products]
  );
  const showAgentChequeFields =
    formState.paid_by_type === "Agent" && formState.payment_mode === "Cheque";

  const handleChange = (name, value) => {
    setFormState((current) => {
      const next = { ...current, [name]: value };

      if (name === "customer_group_id" && current.customer_group_id !== value) {
        next.customer_id = "";
      }

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

      if (
        (name === "paid_by_type" && value !== "Agent") ||
        (name === "payment_mode" && value !== "Cheque")
      ) {
        next.cheque_number = "";
        next.cheque_date = "";
        next.cheque_amount = "";
      }

      if (name === "paid_by_type" && value !== "Agent") {
        next.agent_payment_account_id = "";
        next.payment_mode = "";
      }

      return next;
    });
  };

  const resetForm = () => {
    setFormState(createInitialFormState());
    setIsLocked(false);
    setMessage("");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isLocked) {
      return;
    }

    const dateValidationError = validatePolicyDates(formState.issue_date, formState.risk_end_date);
    if (dateValidationError) {
      setError(dateValidationError);
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = { ...formState };
      delete payload.customer_group_id;

      const response = await fetch(`${API_BASE}/policies/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const json = await readApiJson(response);
      if (!response.ok) {
        throw new Error(json.message || "Failed to issue policy.");
      }

      setMessage(json.message || "Policy issued successfully.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        <div className="master-card__header">
          <span></span>
        </div>

        {loading ? (
          <div className="table-state">
            <Spinner label="Loading form data..." />
          </div>
        ) : (
          <form className="issue-policy-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <FormLabel required>Customer Group</FormLabel>
              <SearchableSelect
                required
                value={formState.customer_group_id}
                disabled={isLocked}
                onChange={(event) => handleChange("customer_group_id", event.target.value)}
              >
                <option value="">Select Customer Group</option>
                {lookupData.customerGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.group_name}
                  </option>
                ))}
              </SearchableSelect>
            </label>

            <label className="form-field">
              <FormLabel required>Customer</FormLabel>
              <SearchableSelect
                required
                value={formState.customer_id}
                placeholder="Search customer by name or mobile"
                disabled={isLocked}
                onChange={(event) => handleChange("customer_id", event.target.value)}
              >
                <option value="">Search customer by name or mobile</option>
                {filteredCustomers.map((customer) => {
                  const customerMobile = String(customer.mobile || "").trim();
                  const label = [customer.full_name, customerMobile].filter(Boolean).join(" - ");
                  const searchText = [customer.full_name, customerMobile].filter(Boolean).join(" ");

                  return (
                    <option
                      key={customer.id}
                      value={customer.id}
                      data-search-text={searchText}
                    >
                      {label}
                    </option>
                  );
                })}
              </SearchableSelect>
            </label>

            <label className="form-field">
              <FormLabel required>Policy No.</FormLabel>
              <input
                type="text"
                disabled={isLocked}
                value={formState.policy_number}
                required
                onChange={(event) => handleChange("policy_number", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel required>Gross Premium</FormLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                disabled={isLocked}
                value={formState.gross_premium}
                onChange={(event) => handleChange("gross_premium", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel required>Net Premium</FormLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                disabled={isLocked}
                value={formState.net_premium}
                onChange={(event) => handleChange("net_premium", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel required>Policy Issued Date</FormLabel>
              <input
                type="date"
                required
                disabled={isLocked}
                value={formState.issue_date}
                onChange={(event) => handleChange("issue_date", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel required>Risk Inception Date</FormLabel>
              <input
                type="date"
                required
                disabled={isLocked}
                value={formState.risk_start_date}
                onChange={(event) => handleChange("risk_start_date", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel required>Risk Expiry Date</FormLabel>
              <input
                type="date"
                required
                disabled={isLocked}
                value={formState.risk_end_date}
                min={formState.issue_date || undefined}
                onChange={(event) => handleChange("risk_end_date", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel required>Business Type</FormLabel>
              <SearchableSelect
                required
                value={formState.business_type}
                disabled={isLocked}
                onChange={(event) => handleChange("business_type", event.target.value)}
              >
                <option value="">Select Business Type</option>
                <option value="New">New</option>
                <option value="Existing">Existing</option>
              </SearchableSelect>
            </label>

            <label className="form-field">
              <FormLabel required>Sum Insured</FormLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                disabled={isLocked}
                value={formState.sum_insured}
                onChange={(event) => handleChange("sum_insured", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel required>Policy Type</FormLabel>
              <SearchableSelect
                required
                value={formState.policy_type}
                disabled={isLocked}
                onChange={(event) => handleChange("policy_type", event.target.value)}
              >
                <option value="">Select Policy Type</option>
                {lookupData.policyTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.category_name}
                  </option>
                ))}
              </SearchableSelect>
            </label>

            <label className="form-field">
              <FormLabel required>Insurance Company</FormLabel>
              <SearchableSelect
                required
                value={formState.company_id}
                disabled={isLocked}
                onChange={(event) => handleChange("company_id", event.target.value)}
              >
                <option value="">Select Insurance Company</option>
                {lookupData.insuranceCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name}
                  </option>
                ))}
              </SearchableSelect>
            </label>

            <label className="form-field">
              <FormLabel required>Product Name</FormLabel>
              <SearchableSelect
                required
                value={formState.product_id}
                placeholder="Search product name"
                disabled={isLocked}
                onChange={(event) => handleChange("product_id", event.target.value)}
              >
                <option value="">Search product name</option>
                {filteredProducts.map((product) => {
                  const companyName = String(product.company_name || "").trim();
                  const searchText = [product.product_name, companyName].filter(Boolean).join(" ");

                  return (
                    <option
                      key={product.id}
                      value={product.id}
                      data-search-text={searchText}
                    >
                      {product.product_name}
                    </option>
                  );
                })}
              </SearchableSelect>
            </label>

            <label className="form-field">
              <FormLabel>Vehicle Make</FormLabel>
              <input
                type="text"
                disabled={isLocked}
                value={formState.vehicle_make}
                onChange={(event) => handleChange("vehicle_make", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel>Vehicle Model</FormLabel>
              <input
                type="text"
                disabled={isLocked}
                value={formState.vehicle_model}
                onChange={(event) => handleChange("vehicle_model", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel>Manufacture Year</FormLabel>
              <input
                type="number"
                min="1900"
                max="9999"
                step="1"
                disabled={isLocked}
                value={formState.year_of_manufacture}
                onChange={(event) => handleChange("year_of_manufacture", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel>Registration No.</FormLabel>
              <input
                type="text"
                disabled={isLocked}
                value={formState.registration_no}
                onChange={(event) => handleChange("registration_no", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel required>Payment By</FormLabel>
              <SearchableSelect
                required
                value={formState.paid_by_type}
                disabled={isLocked}
                onChange={(event) => handleChange("paid_by_type", event.target.value)}
              >
                <option value="">Select Payment By</option>
                <option value="Client">Client</option>
                <option value="Agent">Agent</option>
              </SearchableSelect>
            </label>

            {formState.paid_by_type === "Agent" ? (
              <>
                <label className="form-field">
                  <FormLabel required>Agent Accounts</FormLabel>
                  <SearchableSelect
                    required
                    value={formState.agent_payment_account_id}
                    disabled={isLocked}
                    onChange={(event) => handleChange("agent_payment_account_id", event.target.value)}
                  >
                    <option value="">Select Agent Account</option>
                    {lookupData.agentAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {[account.agent_name, account.account_label, account.account_type]
                          .filter(Boolean)
                          .join(" - ")}
                      </option>
                    ))}
                  </SearchableSelect>
                </label>

                <label className="form-field">
                  <FormLabel>Payment Mode</FormLabel>
                  <SearchableSelect
                    value={formState.payment_mode}
                    disabled={isLocked}
                    onChange={(event) => handleChange("payment_mode", event.target.value)}
                  >
                    <option value="">Select Payment Mode</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                    <option value="Cash">Cash</option>
                  </SearchableSelect>
                </label>
              </>
            ) : null}

            {showAgentChequeFields ? (
              <>
                <label className="form-field">
                  <FormLabel required>Cheque No.</FormLabel>
                  <input
                    type="text"
                    required
                    disabled={isLocked}
                    value={formState.cheque_number}
                    onChange={(event) => handleChange("cheque_number", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel required>Cheque Date</FormLabel>
                  <input
                    type="date"
                    required
                    disabled={isLocked}
                    value={formState.cheque_date}
                    onChange={(event) => handleChange("cheque_date", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel required>Amount</FormLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    disabled={isLocked}
                    value={formState.cheque_amount}
                    onChange={(event) => handleChange("cheque_amount", event.target.value)}
                  />
                </label>
              </>
            ) : null}

            <div className="form-actions issue-policy-form__actions">
              <button type="button" className="secondary-button" onClick={resetForm}>
                Reset
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? <ButtonSpinner label="Saving..." /> : "Save Policy"}
              </button>
            </div>
          </form>
        )}

        {message ? <p className="feedback feedback--success">{message}</p> : null}
        {error ? <p className="feedback feedback--error">{error}</p> : null}
      </section>
    </div>
  );
}
