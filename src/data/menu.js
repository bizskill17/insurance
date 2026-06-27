export const menuSections = [
  {
    label: "Dashboard",
    path: "/dashboard",
    standalone: true,
    icon: "dashboard",
    items: [{ label: "Dashboard", path: "/dashboard" }]
  },
  {
    label: "Masters",
    path: "/masters",
    icon: "masters",
    items: [
      { label: "Organizations", path: "/masters/organizations", countKey: "organizations" },
      { label: "Customers", path: "/masters/customers", countKey: "customers" },
      { label: "Customer Groups", path: "/masters/customer-groups", countKey: "customer-groups" },
      { label: "Insurance Companies", path: "/masters/insurance-companies", countKey: "insurance-companies" },
      { label: "States", path: "/masters/states", countKey: "states" },
      { label: "Cities", path: "/masters/cities", countKey: "cities" },
      { label: "Product Categories", path: "/masters/product-categories", countKey: "product-categories" },
      { label: "Products", path: "/masters/insurance-products", countKey: "insurance-products" },
      { label: "Document Types", path: "/masters/document-types", countKey: "document-types" },
      { label: "Users", path: "/masters/users", countKey: "users" },
      { label: "Agents", path: "/masters/agents", countKey: "agents" },
      { label: "Agent Accounts", path: "/masters/agent-accounts", countKey: "agent-accounts" }
    ]
  },
  {
    label: "Leads",
    path: "/leads",
    icon: "leads",
    items: [
      { label: "All Leads", path: "/leads/all", countKey: "leads-all" },
      { label: "Add Lead", path: "/leads/add", requiresAddPermission: true },
      { label: "Pending Assigning", path: "/leads/pending-assigning", countKey: "leads-pending-assigning" },
      {
        label: "Pending First Follow Up",
        path: "/leads/pending-first-follow-up",
        countKey: "leads-pending-first-follow-up"
      },
      {
        label: "Pending Repeat Follow Up",
        path: "/leads/pending-repeat-follow-up",
        countKey: "leads-pending-repeat-follow-up"
      },
      { label: "Converted", path: "/leads/converted", countKey: "leads-converted" },
      { label: "Lost", path: "/leads/lost", countKey: "leads-lost" },
      { label: "Canceled", path: "/leads/canceled", countKey: "leads-canceled" },
      { label: "Activity Log", path: "/leads/activity-log", countKey: "leads-activity-log" }
    ]
  },
  {
    label: "Tasks",
    path: "/tasks",
    icon: "tasks",
    items: [
      { label: "All Tasks", path: "/tasks/all", countKey: "tasks-all" },
      { label: "Add Task", path: "/tasks/add", requiresAddPermission: true },
      { label: "Pending Tasks", path: "/tasks/pending", countKey: "tasks-pending" },
      { label: "Completed", path: "/tasks/completed", countKey: "tasks-completed" },
      { label: "Canceled", path: "/tasks/canceled", countKey: "tasks-canceled" },
      { label: "Action Log", path: "/tasks/action-log", countKey: "tasks-activity-log" }
    ]
  },
  {
    label: "Policies",
    path: "/policies",
    icon: "policies",
    items: [
      { label: "All Policies", path: "/policies/all", countKey: "all-policies" },
      { label: "Issue Policy", path: "/policies/issue", requiresAddPermission: true },
      { label: "Renew Policy", path: "/policies/renew", countKey: "renew-policy" },
      {
        label: "Renew Policy - Upcoming 45 Days",
        path: "/policies/renew/upcoming-45-days",
        countKey: "renew-policy-upcoming-45-days",
        fallbackView: "/policies/renew"
      },
      {
        label: "Renew Policy - Overdue",
        path: "/policies/renew/overdue",
        countKey: "renew-policy-overdue",
        fallbackView: "/policies/renew"
      },
      { label: "Inactivated Policies", path: "/policies/inactivated", countKey: "inactivated-policies" },
      { label: "Attach Documents", path: "/policies/attach-documents", countKey: "attach-documents" }
    ]
  },
  {
    label: "Payments",
    path: "/payments",
    icon: "payments",
    items: [
      { label: "Pending Payments from Clients", path: "/payments/pending", countKey: "pending-payments" },
      { label: "Payments Received", path: "/payments/received" }
    ]
  },
  {
    label: "Reports",
    path: "/reports",
    icon: "reports",
    items: [
      { label: "Policies Added Today", path: "/reports/policies-added", countKey: "policies-added" },
      { label: "Policies This Week", path: "/reports/policies-this-week", countKey: "policies-this-week" },
      { label: "Policies This Month", path: "/reports/policies-this-month", countKey: "policies-this-month" },
      { label: "Pending Payments from Clients", path: "/reports/pending-payments", countKey: "pending-payments" },
      { label: "Pending Document Uploads", path: "/reports/pending-document-uploads", countKey: "attach-documents" }
    ]
  },
  {
    label: "Expiry Reports",
    path: "/reports/expiry-reports",
    icon: "reports",
    items: [
      {
        label: "Monthly Expiry Reports",
        path: "/reports/expiry-reports/section/monthly",
        matchPrefixes: ["/reports/expiry-reports/month/"]
      },
      {
        label: "Daily Expiry Reports",
        path: "/reports/expiry-reports/section/daily",
        matchPrefixes: ["/reports/expiry-reports/day/"]
      },
      {
        label: "Weekly Expiry Reports",
        path: "/reports/expiry-reports/section/weekly",
        matchPrefixes: ["/reports/expiry-reports/week/"]
      },
      {
        label: "Yearly Expiry Reports",
        path: "/reports/expiry-reports/section/yearly",
        matchPrefixes: ["/reports/expiry-reports/year/"]
      }
    ]
  }
];

export function getMenuRouteEntries(sections = menuSections) {
  return sections.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      section: section.label,
      resourceKey: section.label === "Masters" ? item.path.replace("/masters/", "") : undefined
    }))
  );
}

export function filterMenuSectionsByViews(allowedViews = [], sections = menuSections, addPermissions = allowedViews) {
  const allowedSet = new Set(allowedViews);
  const addPermissionSet = new Set(addPermissions);

  return sections
    .map((section) => {
      const filteredItems = (section.items || []).filter(
        (item) =>
          (allowedSet.has(item.path) || (item.fallbackView && allowedSet.has(item.fallbackView))) &&
          (!item.requiresAddPermission || addPermissionSet.has(item.path))
      );

      if (!filteredItems.length) {
        return null;
      }

      return {
        ...section,
        items: filteredItems
      };
    })
    .filter(Boolean);
}

export const menuViewOptions = menuSections.flatMap((section) =>
  (section.items || []).map((item) => ({
    value: item.path,
    label: `${section.label} / ${item.label}`
  }))
);

export const menuViewGroups = menuSections.map((section) => ({
  label: section.label,
  options: (section.items || []).map((item) => ({
    value: item.path,
    label: item.label
  }))
}));

export function formatMenuViews(value) {
  if (!value) {
    return "";
  }

  let selectedViews = value;

  if (typeof value === "string") {
    try {
      selectedViews = JSON.parse(value);
    } catch {
      selectedViews = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (!Array.isArray(selectedViews)) {
    return String(value);
  }

  const labelMap = new Map(menuViewOptions.map((option) => [option.value, option.label]));

  return selectedViews
    .map((item) => labelMap.get(item) || item)
    .join(", ");
}

