export const reportConfigs = {
  "policies-renewed-today": {
    title: "Policies Renewed Today",
    endpoint: "/reports/policies-renewed-today",
    emptyMessage: "No policies renewed today.",
    loadingMessage: "Loading policies renewed today...",
    searchKeys: [
      "policy_number",
      "previous_policy_number",
      "customer_name",
      "customer_group_name",
      "company_name",
      "product_name",
      "policy_type"
    ],
    filters: [
      { key: "customer_name", label: "Customer" },
      { key: "customer_group_name", label: "Group" },
      { key: "company_name", label: "Company" },
      { key: "policy_type", label: "Policy Type" },
      { key: "business_type", label: "Business Type" }
    ],
    columns: [
      { key: "policy_number", label: "New Policy No." },
      { key: "previous_policy_number", label: "Old Policy No." },
      { key: "customer_name", label: "Customer", highlight: true },
      { key: "customer_group_name", label: "Customer Group", highlight: true },
      { key: "company_name", label: "Insurance Company", highlight: true },
      { key: "product_name", label: "Product Name", highlight: true },
      { key: "policy_type", label: "Policy Type" },
      { key: "business_type", label: "Business Type" },
      { key: "risk_end_date", label: "New Expiry Date" },
      { key: "gross_premium", label: "Gross Premium" },
      { key: "net_premium", label: "Net Premium" }
    ]
  },
  "policies-added": {
    title: "Policies Added Today",
    endpoint: "/reports/policies-added",
    emptyMessage: "No policies added today.",
    loadingMessage: "Loading policies added...",
    searchKeys: [
      "policy_number",
      "customer_name",
      "customer_group_name",
      "company_name",
      "product_name",
      "policy_type"
    ],
    filters: [
      { key: "customer_name", label: "Customer" },
      { key: "customer_group_name", label: "Group" },
      { key: "company_name", label: "Company" },
      { key: "policy_type", label: "Policy Type" },
      { key: "business_type", label: "Business Type" }
    ],
    columns: [
      { key: "policy_number", label: "Policy No." },
      { key: "issue_date", label: "Issue Date" },
      { key: "customer_name", label: "Customer", highlight: true },
      { key: "customer_group_name", label: "Customer Group", highlight: true },
      { key: "company_name", label: "Insurance Company", highlight: true },
      { key: "product_name", label: "Product Name", highlight: true },
      { key: "policy_type", label: "Policy Type" },
      { key: "business_type", label: "Business Type" },
      { key: "gross_premium", label: "Gross Premium" },
      { key: "net_premium", label: "Net Premium" }
    ]
  },
  "policies-this-week": {
    title: "Policies This Week",
    endpoint: "/reports/policies-this-week",
    emptyMessage: "No policies found for this week.",
    loadingMessage: "Loading weekly policies...",
    searchKeys: [
      "policy_number",
      "customer_name",
      "customer_group_name",
      "company_name",
      "product_name",
      "policy_type"
    ],
    filters: [
      { key: "customer_name", label: "Customer" },
      { key: "customer_group_name", label: "Group" },
      { key: "company_name", label: "Company" },
      { key: "policy_type", label: "Policy Type" },
      { key: "business_type", label: "Business Type" }
    ],
    columns: [
      { key: "policy_number", label: "Policy No." },
      { key: "issue_date", label: "Issue Date" },
      { key: "customer_name", label: "Customer", highlight: true },
      { key: "customer_group_name", label: "Customer Group", highlight: true },
      { key: "company_name", label: "Insurance Company", highlight: true },
      { key: "product_name", label: "Product Name", highlight: true },
      { key: "policy_type", label: "Policy Type" },
      { key: "business_type", label: "Business Type" },
      { key: "gross_premium", label: "Gross Premium" },
      { key: "net_premium", label: "Net Premium" }
    ]
  },
  "policies-this-month": {
    title: "Policies This Month",
    endpoint: "/reports/policies-this-month",
    emptyMessage: "No policies found for this month.",
    loadingMessage: "Loading monthly policies...",
    searchKeys: [
      "policy_number",
      "customer_name",
      "customer_group_name",
      "company_name",
      "product_name",
      "policy_type"
    ],
    filters: [
      { key: "customer_name", label: "Customer" },
      { key: "customer_group_name", label: "Group" },
      { key: "company_name", label: "Company" },
      { key: "policy_type", label: "Policy Type" },
      { key: "business_type", label: "Business Type" }
    ],
    columns: [
      { key: "policy_number", label: "Policy No." },
      { key: "issue_date", label: "Issue Date" },
      { key: "customer_name", label: "Customer", highlight: true },
      { key: "customer_group_name", label: "Customer Group", highlight: true },
      { key: "company_name", label: "Insurance Company", highlight: true },
      { key: "product_name", label: "Product Name", highlight: true },
      { key: "policy_type", label: "Policy Type" },
      { key: "business_type", label: "Business Type" },
      { key: "gross_premium", label: "Gross Premium" },
      { key: "net_premium", label: "Net Premium" }
    ]
  },
  "payments-received": {
    title: "Payments Received",
    endpoint: "/reports/payments-received",
    emptyMessage: "No payments received found.",
    loadingMessage: "Loading received payments...",
    searchKeys: [
      "policy_number",
      "customer_name",
      "company_name",
      "payment_mode",
      "payment_status",
      "reference_number"
    ],
    filters: [
      { key: "customer_name", label: "Customer" },
      { key: "company_name", label: "Company" },
      { key: "payment_mode", label: "Payment Mode" },
      { key: "payment_status", label: "Payment Status" }
    ],
    columns: [
      { key: "payment_date", label: "Payment Date" },
      { key: "policy_number", label: "Policy No." },
      { key: "customer_name", label: "Customer", highlight: true },
      { key: "company_name", label: "Company", highlight: true },
      { key: "payment_mode", label: "Payment Mode" },
      { key: "payment_status", label: "Payment Status" },
      { key: "amount", label: "Amount" },
      { key: "reference_number", label: "Reference No." },
      { key: "remarks", label: "Remarks" }
    ]
  }
};
