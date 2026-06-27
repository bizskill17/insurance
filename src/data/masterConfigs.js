import { menuViewGroups } from "./menu";

const mobileFieldValidation = {
  pattern: "^\\d{10}$",
  message: "Mobile number must be exactly 10 digits."
};

export const masterConfigs = {
  organizations: {
    title: "Organizations",
    resource: "organizations",
    tableColumns: [
      { key: "organization_code", label: "Organization Id" },
      { key: "organization_name", label: "Organization Name" },
      { key: "gst", label: "GST" },
      { key: "address", label: "Address" },
      { key: "logo", label: "Logo", type: "image" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "organization_code", label: "Organization Id", type: "text", required: true },
      { name: "organization_name", label: "Organization Name", type: "text", required: true },
      { name: "gst", label: "GST", type: "text" },
      { name: "address", label: "Address", type: "textarea" },
      { name: "logo", label: "Logo", type: "file" },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  customers: {
    title: "Customers",
    resource: "customers",
    tableColumns: [
      { key: "full_name", label: "Customer Name" },
      { key: "group_name", label: "Group" },
      { key: "mobile", label: "Mobile" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "group_id", label: "Customer Group", templateLabel: "Group Name", importAliases: ["Group Name", "Customer Group Name"], type: "select", optionsFrom: "customer-groups", required: true },
      { name: "full_name", label: "Customer Name", type: "text", required: true },
      { name: "mobile", label: "Mobile", type: "text", validation: mobileFieldValidation },
      {
        name: "alternate_mobile",
        label: "Alternate Mobile",
        type: "text",
        validation: mobileFieldValidation
      },
      { name: "email", label: "Email", type: "email" },
      { name: "gstin", label: "GSTIN", type: "text" },
      {
        name: "state",
        label: "State",
        type: "select",
        optionsFrom: "states",
        optionValueKey: "state_name",
        optionLabelKey: "state_name",
        resetsFields: ["city"]
      },
      {
        name: "city",
        label: "City",
        type: "select",
        optionsFrom: "cities",
        optionValueKey: "city_name",
        optionLabelKey: "city_name",
        dependsOn: "state",
        dependsOnKey: "state_name"
      },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  "customer-groups": {
    title: "Customer Groups",
    resource: "customer-groups",
    tableColumns: [
      { key: "group_name", label: "Group Name" },
      { key: "notes", label: "Notes" }
    ],
    fields: [
      { name: "group_name", label: "Group Name", type: "text", required: true },
      { name: "notes", label: "Notes", type: "textarea" }
    ]
  },
  "insurance-companies": {
    title: "Insurance Companies",
    resource: "insurance-companies",
    tableColumns: [
      { key: "company_name", label: "Company Name" },
      { key: "company_short_name", label: "Short Name" },
      { key: "company_type", label: "Type" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "company_name", label: "Company Name", type: "text", required: true },
      { name: "company_short_name", label: "Short Name", type: "text" },
      {
        name: "company_type",
        label: "Company Type",
        type: "select",
        staticOptions: [
          { value: "", label: "Select Type" },
          { value: "General", label: "General" },
          { value: "Life", label: "Life" },
          { value: "Health", label: "Health" }
        ]
      },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  states: {
    title: "States",
    resource: "states",
    tableColumns: [
      { key: "state_name", label: "State Name" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "state_name", label: "State Name", type: "text", required: true },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  cities: {
    title: "Cities",
    resource: "cities",
    tableColumns: [
      { key: "city_name", label: "City Name" },
      { key: "state_name", label: "State" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "state_id", label: "State", type: "select", optionsFrom: "states", required: true },
      { name: "city_name", label: "City Name", type: "text", required: true },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  "product-categories": {
    title: "Product Categories",
    resource: "product-categories",
    tableColumns: [
      { key: "category_name", label: "Category" },
      { key: "parent_category_name", label: "Parent Category" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "category_name", label: "Category Name", type: "text", required: true },
      { name: "parent_category_id", label: "Parent Category", type: "select", optionsFrom: "product-categories" },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  "insurance-products": {
    title: "Product",
    resource: "insurance-products",
    tableColumns: [
      { key: "product_name", label: "Product" },
      { key: "company_name", label: "Company" },
      { key: "category_name", label: "Category" },
      { key: "sub_category_name", label: "Sub Category" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "company_id", label: "Company", type: "select", optionsFrom: "insurance-companies", required: true },
      { name: "product_name", label: "Product Name", type: "text", required: true },
      {
        name: "category_id",
        label: "Category",
        type: "select",
        optionsFrom: "product-categories",
        optionLabelKey: "category_name",
        optionFilter: (option) => !option.parent_category_id,
        resetsFields: ["sub_category_name"],
        required: true
      },
      {
        name: "sub_category_name",
        label: "Sub Category",
        type: "select",
        optionsFrom: "product-categories",
        optionValueKey: "category_name",
        optionLabelKey: "category_name",
        dependsOn: "category_id",
        dependsOnKey: "parent_category_id"
      },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  "document-types": {
    title: "Document Types",
    resource: "document-types",
    tableColumns: [
      { key: "name", label: "Name" },
      { key: "entity_level", label: "Entity Level" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      {
        name: "entity_level",
        label: "Entity Level",
        type: "select",
        required: true,
        staticOptions: [
          { value: "", label: "Select Entity Level" },
          { value: "customer", label: "Customer" },
          { value: "policy", label: "Policy" },
          { value: "payment", label: "Payment" }
        ]
      },
      { name: "description", label: "Description", type: "textarea" },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  users: {
    title: "Users",
    resource: "users",
    tableColumns: [
      { key: "full_name", label: "User Name" },
      { key: "login_id", label: "Log In Id" },
      { key: "password", label: "Password" },
      { key: "email", label: "Email" },
      { key: "mobile", label: "Mobile" },
      { key: "role_name", label: "Role" },
      { key: "linked_agent_name", label: "Linked Agent" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "full_name", label: "Full Name", type: "text", required: true },
      { name: "login_id", label: "Log In Id", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "mobile", label: "Mobile", type: "text", validation: mobileFieldValidation },
      {
        name: "role_name",
        label: "Role",
        type: "select",
        required: true,
        staticOptions: [
          { value: "", label: "Select Role" },
          { value: "Admin", label: "Admin" },
          { value: "Manager", label: "Manager" },
          { value: "Executive", label: "Executive" }
        ]
      },
      {
        name: "views",
        label: "View",
        type: "checklist",
        required: true,
        actionFields: [
          { name: "add_permissions", label: "Add" },
          { name: "edit_permissions", label: "Edit" },
          { name: "delete_permissions", label: "Delete" }
        ],
        optionGroups: menuViewGroups
      },
      { name: "add_permissions", label: "Add", type: "permission-list" },
      { name: "edit_permissions", label: "Edit", type: "permission-list" },
      { name: "delete_permissions", label: "Delete", type: "permission-list" },
      { name: "linked_agent_id", label: "Linked Agent", type: "select", optionsFrom: "agents" },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  agents: {
    title: "Agents",
    resource: "agents",
    tableColumns: [
      { key: "employee_code", label: "Employee Code" },
      { key: "full_name", label: "Agent Name" },
      { key: "mobile", label: "Mobile" },
      { key: "email", label: "Email" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "employee_code", label: "Employee Code", type: "text", required: true },
      { name: "full_name", label: "Full Name", type: "text", required: true },
      { name: "mobile", label: "Mobile", type: "text", validation: mobileFieldValidation },
      { name: "email", label: "Email", type: "email" },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  "agent-accounts": {
    title: "Agent Accounts",
    resource: "agent-accounts",
    tableColumns: [
      { key: "agent_name", label: "Agent" },
      { key: "account_label", label: "Account Label" },
      { key: "account_type", label: "Account Type", formatter: "account_type" },
      { key: "bank_name", label: "Bank" },
      { key: "is_default", label: "Default", type: "boolean" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "agent_id", label: "Agent", type: "select", optionsFrom: "agents", required: true },
      { name: "account_label", label: "Account Label", type: "text", required: true },
      {
        name: "account_type",
        label: "Account Type",
        type: "select",
        required: true,
        staticOptions: [
          { value: "", label: "Select Type" },
          { value: "Bank Account", label: "Bank Account" },
          { value: "Credit Card", label: "Credit Card" },
          { value: "Debit Card", label: "Debit Card" },
          { value: "UPI", label: "UPI" },
          { value: "Wallet", label: "Wallet" },
          { value: "Cash", label: "Cash" }
        ]
      },
      { name: "bank_name", label: "Bank Name", type: "text" },
      { name: "account_holder_name", label: "Account Holder", type: "text" },
      { name: "masked_account_number", label: "Masked Account No.", type: "text" },
      { name: "card_last4", label: "Card Last 4", type: "text" },
      { name: "upi_id", label: "UPI ID", type: "text" },
      { name: "branch_name", label: "Branch Name", type: "text" },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "is_default", label: "Default Account", type: "checkbox" },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  }
};

