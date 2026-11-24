import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionIconButton } from "./ActionIcon";
import FormLabel from "./FormLabel";
import MasterPage from "./MasterPage";
import ResponsiveDataView from "./ResponsiveDataView";
import { API_BASE } from "../config/api";
import { getStoredAuthUser } from "../utils/auth";
import { ButtonSpinner, Spinner } from "./Spinner";
import { buildFilterOptions } from "../utils/dataView";
import { formatCellValue } from "../utils/formatting";
import SearchableSelect from "./SearchableSelect";

const leadViewConfigs = {
  "/leads/all": {
    title: "All Leads",
    endpoint: `${API_BASE}/leads?view=all`,
    emptyMessage: "No leads found."
  },
  "/leads/add": {
    title: "Add Lead",
    endpoint: `${API_BASE}/leads?view=all`,
    emptyMessage: "No leads found.",
    autoOpenAdd: true
  },
  "/leads/pending-assigning": {
    title: "Pending Assigning",
    endpoint: `${API_BASE}/leads?view=pending-assigning`,
    emptyMessage: "No leads are pending assigning."
  },
  "/leads/pending-first-follow-up": {
    title: "Pending First Follow Up",
    endpoint: `${API_BASE}/leads?view=pending-first-follow-up`,
    emptyMessage: "No leads are pending first follow up."
  },
  "/leads/pending-repeat-follow-up": {
    title: "Pending Repeat Follow Up",
    endpoint: `${API_BASE}/leads?view=pending-repeat-follow-up`,
    emptyMessage: "No leads are pending repeat follow up."
  },
  "/leads/converted": {
    title: "Converted Leads",
    endpoint: `${API_BASE}/leads?view=converted`,
    emptyMessage: "No converted leads found."
  },
  "/leads/lost": {
    title: "Lost Leads",
    endpoint: `${API_BASE}/leads?view=lost`,
    emptyMessage: "No lost leads found."
  },
  "/leads/canceled": {
    title: "Canceled Leads",
    endpoint: `${API_BASE}/leads?view=canceled`,
    emptyMessage: "No canceled leads found."
  },
  "/leads/activity-log": {
    title: "Lead Activity Log",
    endpoint: `${API_BASE}/leads/activity`,
    emptyMessage: "No lead activity found.",
    activityLog: true
  }
};

const leadColumns = [
  { key: "lead_date", label: "Lead Date" },
  { key: "description", label: "Description", width: "220px" },
  { key: "due_date", label: "Due Date" },
  { key: "client_name", label: "Client Name", width: "170px" },
  { key: "priority", label: "Priority" },
  { key: "assigned_to_name", label: "Assigned To", width: "160px" },
  { key: "category_name", label: "Category", width: "160px" },
  { key: "sub_category_name", label: "Sub - Category", width: "170px" },
  { key: "lead_status", label: "Status", width: "170px" },
  { key: "next_follow_up_date", label: "Next Follow Up Date", width: "140px" },
  { key: "update_by_name", label: "Update By", width: "160px" }
];

const pendingAssigningColumns = [
  { key: "lead_date", label: "Lead Date" },
  { key: "description", label: "Description", width: "220px" },
  { key: "due_date", label: "Due Date" },
  { key: "client_name", label: "Client Name", width: "170px" },
  { key: "priority", label: "Priority" },
  { key: "assigned_to_name", label: "Assigned To", width: "160px" },
  { key: "category_name", label: "Category", width: "160px" },
  { key: "sub_category_name", label: "Sub - Category", width: "170px" },
  { key: "lead_status", label: "Status", width: "170px" },
  { key: "update_by_name", label: "Update By", width: "160px" }
];

const activityColumns = [
  { key: "activity_type", label: "Activity Type", width: "130px" },
  { key: "client_name", label: "Client Name", width: "170px" },
  { key: "lead_status", label: "Lead Status", width: "170px" },
  { key: "update_status", label: "Update Status", width: "120px" },
  { key: "activity_date", label: "Date", width: "120px" },
  { key: "assigned_to_name", label: "Assigned To", width: "160px" },
  { key: "update_by_name", label: "Update By", width: "160px" },
  { key: "next_follow_up_date", label: "Next Follow Up Date", width: "140px" },
  { key: "remarks", label: "Remarks", width: "240px" }
];

const priorityOptions = ["High", "Medium", "Low"];
const updateStatusOptions = ["Success", "Follow Up Again", "Lost", "Cancel"];
const finalLeadStatuses = ["Converted", "Lost", "Canceled"];

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyLeadForm() {
  return {
    lead_date: todayInputValue(),
    description: "",
    due_date: todayInputValue(),
    client_name: "",
    priority: "Medium",
    assigned_to_user_id: "",
    category_id: "",
    sub_category_id: "",
    notes: "",
    lead_status: "",
    next_follow_up_date: ""
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// A lead's month is taken from its Next Follow Up Date when filled, otherwise its Due Date.
function leadDate(lead) {
  return String(lead.next_follow_up_date || lead.due_date || "").slice(0, 10);
}

// Financial year (April to March) and month of a lead, from the same date as above.
function leadPeriod(lead) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(leadDate(lead));
  if (!match) {
    return { fyStart: null, monthKey: "no-date" };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  return { fyStart: month >= 4 ? year : year - 1, monthKey: `${match[1]}-${match[2]}` };
}

function currentFyStart() {
  const now = new Date();
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function fyLabel(fyStart) {
  return `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
}

// The 12 months of a financial year, April to March.
function fyMonths(fyStart) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthNumber = ((index + 3) % 12) + 1;
    const year = monthNumber >= 4 ? fyStart : fyStart + 1;
    return {
      key: `${year}-${String(monthNumber).padStart(2, "0")}`,
      name: MONTH_NAMES[monthNumber - 1].slice(0, 3),
      year
    };
  });
}

// One colour per financial-year tile, repeating.
const FY_TILE_COLORS = ["#1d4ed8", "#6d28d9", "#0f766e", "#c2410c", "#a21caf", "#047857", "#b91c1c", "#92400e"];

// Row colour by status: Converted green, Lost orange.
function leadRowClassName(lead) {
  if (lead.lead_status === "Converted") return "row--converted";
  if (lead.lead_status === "Lost") return "row--lost";
  return "";
}

// Statuses that can be chosen in Edit Lead.
const editableLeadStatuses = ["Pending First Follow Up", "Pending Repeat Follow Up", "Converted", "Lost", "Canceled"];

function emptyUpdateForm() {
  return {
    status: "Success",
    update_date: todayInputValue(),
    update_by_user_id: "",
    next_follow_up_date: "",
    remarks: ""
  };
}

async function loadCustomers() {
  const response = await fetch(`${API_BASE}/masters/customers?limit=500000`);
  const json = await readApiJson(response);

  if (!response.ok) {
    throw new Error(json.message || "Failed to load customers.");
  }

  return (json.data || [])
    .filter((customer) => customer.full_name)
    .sort((left, right) => String(left.full_name).localeCompare(String(right.full_name)));
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

function normalizeLeadToForm(lead) {
  return {
    lead_date: String(lead.lead_date || "").slice(0, 10),
    description: lead.description || "",
    due_date: String(lead.due_date || "").slice(0, 10),
    client_name: lead.client_name || "",
    priority: lead.priority || "Medium",
    assigned_to_user_id: lead.assigned_to_user_id ? String(lead.assigned_to_user_id) : "",
    category_id: lead.category_id ? String(lead.category_id) : "",
    sub_category_id: lead.sub_category_id ? String(lead.sub_category_id) : "",
    notes: lead.notes || "",
    lead_status: lead.lead_status || "",
    next_follow_up_date: String(lead.next_follow_up_date || "").slice(0, 10)
  };
}

export default function LeadsPage({ viewPath }) {
  const navigate = useNavigate();
  const viewConfig = leadViewConfigs[viewPath] || leadViewConfigs["/leads/all"];
  const isActivityLog = Boolean(viewConfig.activityLog);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(() => emptyLeadForm());
  const [originalLeadStatus, setOriginalLeadStatus] = useState("");
  const [updateForm, setUpdateForm] = useState(() => emptyUpdateForm());
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadHistory, setLeadHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isAssigneeOnly, setIsAssigneeOnly] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadRecords = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(viewConfig.endpoint);
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to load leads.");
      }

      setRecords(json.data || []);
      setRefreshKey((k) => k + 1);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [viewConfig.endpoint]);

  useEffect(() => {
    if (isActivityLog) {
      return;
    }

    let isActive = true;

    const loadOptions = async () => {
      try {
        const [usersResponse, categoriesResponse, customersResult] = await Promise.all([
          fetch(`${API_BASE}/masters/users?limit=250`),
          fetch(`${API_BASE}/masters/product-categories?limit=250`),
          loadCustomers().catch((customersError) => ({ error: customersError }))
        ]);

        const [usersJson, categoriesJson] = await Promise.all([
          readApiJson(usersResponse),
          readApiJson(categoriesResponse)
        ]);

        if (!usersResponse.ok) {
          throw new Error(usersJson.message || "Failed to load users.");
        }

        if (!categoriesResponse.ok) {
          throw new Error(categoriesJson.message || "Failed to load categories.");
        }

        if (!isActive) {
          return;
        }

        setUsers(usersJson.data || []);
        setCategories(categoriesJson.data || []);
        if (customersResult.error) {
          setError(customersResult.error.message);
        } else {
          setCustomers(customersResult);
        }
      } catch (loadOptionsError) {
        if (isActive) {
          setError(loadOptionsError.message);
        }
      }
    };

    loadOptions();

    return () => {
      isActive = false;
    };
  }, [isActivityLog]);

  useEffect(() => {
    if (viewConfig.autoOpenAdd) {
      setEditingLeadId(null);
      setLeadForm(emptyLeadForm());
      setIsLeadModalOpen(true);
    } else {
      setIsLeadModalOpen(false);
    }
  }, [viewConfig.autoOpenAdd, viewPath]);

  // Client Name options: every customer from Masters > Customers.
  // An older lead whose client is not a customer keeps its name as an extra option.
  const clientOptions = useMemo(() => {
    const currentName = String(leadForm.client_name || "").trim();
    if (currentName && !customers.some((customer) => customer.full_name === currentName)) {
      return [{ id: "current-client", full_name: currentName, mobile: "" }, ...customers];
    }
    return customers;
  }, [customers, leadForm.client_name]);

  const handleCustomerCreated = async (customer) => {
    setIsAddCustomerModalOpen(false);

    try {
      const freshCustomers = await loadCustomers();
      setCustomers(freshCustomers);

      const matchedCustomer =
        (customer && freshCustomers.find((item) => Number(item.id) === Number(customer.id))) ||
        (customer && freshCustomers.find((item) => item.full_name === customer.full_name)) ||
        null;

      if (matchedCustomer) {
        handleLeadFormChange("client_name", matchedCustomer.full_name || "");
      }
    } catch (loadCustomersError) {
      setError(loadCustomersError.message);
    }
  };

  const topLevelCategories = useMemo(
    () => categories.filter((category) => !category.parent_category_id),
    [categories]
  );

  const subCategories = useMemo(
    () =>
      categories.filter(
        (category) => String(category.parent_category_id || "") === String(leadForm.category_id || "")
      ),
    [categories, leadForm.category_id]
  );

  // Financial-year and month tiles: pick a year, then a month, to list its leads.
  // Step by step: nothing chosen at first (only year tiles), then a year (its months), then a month (its leads).
  const [selectedFy, setSelectedFy] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const periodStats = useMemo(() => {
    const fyCounts = new Map();
    const monthCounts = new Map();
    let noDateCount = 0;
    if (!isActivityLog) {
      records.forEach((record) => {
        const { fyStart, monthKey } = leadPeriod(record);
        if (fyStart === null) {
          noDateCount += 1;
          return;
        }
        fyCounts.set(fyStart, (fyCounts.get(fyStart) || 0) + 1);
        monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
      });
    }
    // Always offer the current financial year, newest year first.
    const years = new Set([...fyCounts.keys(), currentFyStart()]);
    return {
      years: [...years].sort((left, right) => right - left),
      fyCounts,
      monthCounts,
      noDateCount
    };
  }, [isActivityLog, records]);

  const visibleLeadRecords = useMemo(() => {
    if (isActivityLog) {
      return records;
    }
    if (selectedMonth === "no-date") {
      return records.filter((record) => leadPeriod(record).fyStart === null);
    }
    return records
      .filter((record) => {
        const { fyStart, monthKey } = leadPeriod(record);
        if (fyStart !== selectedFy) {
          return false;
        }
        return selectedMonth === "all" || monthKey === selectedMonth;
      })
      // Earliest follow-up / due date first.
      .sort((left, right) => leadDate(left).localeCompare(leadDate(right)));
  }, [isActivityLog, records, selectedFy, selectedMonth]);

  const selectFy = (fyStart) => {
    // Clicking the open year again closes it.
    setSelectedFy((current) => (current === fyStart && selectedMonth !== "no-date" ? null : fyStart));
    setSelectedMonth(null);
  };

  const showLeadTable = isActivityLog || Boolean(selectedMonth);

  const filterConfigs = useMemo(() => {
    if (isActivityLog) {
      return [
        { key: "activity_type", label: "Activity Type", options: buildFilterOptions(records, "activity_type") },
        { key: "lead_status", label: "Lead Status", options: buildFilterOptions(records, "lead_status") },
        { key: "assigned_to_name", label: "Assigned To", options: buildFilterOptions(records, "assigned_to_name") }
      ];
    }

    return [
      { key: "priority", label: "Priority", options: buildFilterOptions(records, "priority") },
      { key: "lead_status", label: "Status", options: buildFilterOptions(records, "lead_status") },
      { key: "assigned_to_name", label: "Assigned To", options: buildFilterOptions(records, "assigned_to_name") },
      { key: "category_name", label: "Category", options: buildFilterOptions(records, "category_name") }
    ];
  }, [isActivityLog, records]);

  const resetLeadModal = () => {
    setIsLeadModalOpen(false);
    setIsAssigneeOnly(false);
    setEditingLeadId(null);
    setLeadForm(emptyLeadForm());

    if (viewPath === "/leads/add") {
      navigate("/leads/all");
    }
  };

  const resetUpdateModal = () => {
    setIsUpdateModalOpen(false);
    setSelectedLead(null);
    setLeadHistory([]);
    setHistoryLoading(false);
    setUpdateForm(emptyUpdateForm());
  };

  const openAddLead = () => {
    setMessage("");
    setError("");
    setEditingLeadId(null);
    setLeadForm(emptyLeadForm());
    setIsAssigneeOnly(false);
    setIsLeadModalOpen(true);
  };

  const openEditLead = (lead) => {
    setMessage("");
    setError("");
    setEditingLeadId(lead.id);
    setLeadForm(normalizeLeadToForm(lead));
    setOriginalLeadStatus(lead.lead_status || "");
    setIsAssigneeOnly(false);
    setIsLeadModalOpen(true);
  };

  const openAssignLead = (lead) => {
    setMessage("");
    setError("");
    setEditingLeadId(lead.id);
    setLeadForm(normalizeLeadToForm(lead));
    setOriginalLeadStatus(lead.lead_status || "");
    setIsAssigneeOnly(true);
    setIsLeadModalOpen(true);
  };

  const openUpdateLead = async (lead) => {
    setMessage("");
    setError("");
    setSelectedLead(lead);
    setUpdateForm({
      ...emptyUpdateForm(),
      update_by_user_id: lead.assigned_to_user_id ? String(lead.assigned_to_user_id) : ""
    });
    setIsUpdateModalOpen(true);
    setHistoryLoading(true);

    try {
      const response = await fetch(`${API_BASE}/leads/${lead.id}/updates`);
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to load lead activity.");
      }

      setLeadHistory(json.data || []);
    } catch (historyError) {
      setError(historyError.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleLeadFormChange = (field, value) => {
    setLeadForm((current) => ({
      ...current,
      ...(field === "category_id" ? { sub_category_id: "" } : {}),
      [field]: value
    }));
  };

  const handleUpdateFormChange = (field, value) => {
    setUpdateForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleLeadSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingLead(true);

    try {
      const response = await fetch(
        editingLeadId ? `${API_BASE}/leads/${editingLeadId}` : `${API_BASE}/leads`,
        {
          method: editingLeadId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(
            editingLeadId
              ? { ...leadForm, status_changed_by_user_id: getStoredAuthUser()?.id || "" }
              : leadForm
          )
        }
      );

      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to save lead.");
      }

      setMessage(json.message || "Lead saved successfully.");
      resetLeadModal();
      window.dispatchEvent(new Event("refresh-counts"));
      await loadRecords();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingLead(false);
    }
  };

  const handleUpdateSubmit = async (event) => {
    event.preventDefault();
    if (!selectedLead) {
      return;
    }

    setMessage("");
    setError("");
    setSavingUpdate(true);

    try {
      const response = await fetch(`${API_BASE}/leads/${selectedLead.id}/updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updateForm)
      });

      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to save lead update.");
      }

      setMessage(json.message || "Lead update saved successfully.");
      resetUpdateModal();
      window.dispatchEvent(new Event("refresh-counts"));
      await loadRecords();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingUpdate(false);
    }
  };

  const deleteLead = async (lead) => {
    if (!window.confirm(`Are you sure you want to delete lead for "${lead.client_name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/leads/${lead.id}`, {
        method: "DELETE"
      });

      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to delete lead.");
      }

      window.dispatchEvent(new Event("refresh-counts"));
      await loadRecords();
    } catch (deleteError) {
      alert(deleteError.message);
    }
  };

  const renderLeadActions = (lead) => {
    const isUnassigned = !lead.assigned_to_user_id;

    if (viewPath === "/leads/pending-assigning") {
      return (
        <div className="table-actions">
          {isUnassigned ? (
            <ActionIconButton icon="user" label="Update Assignee" onClick={() => openAssignLead(lead)} />
          ) : null}
          <ActionIconButton icon="pencil" label="Edit Lead" onClick={() => openEditLead(lead)} />
          <ActionIconButton icon="delete" label="Delete Lead" tone="danger" onClick={() => deleteLead(lead)} />
        </div>
      );
    }

    // Lost leads can still be followed up (e.g. the client comes back); Converted and Canceled are closed.
    const canFollowUp = !["Converted", "Canceled"].includes(String(lead.lead_status || ""));

    return (
      <div className="table-actions">
        {isUnassigned ? (
          <ActionIconButton icon="user" label="Update Assignee" onClick={() => openAssignLead(lead)} />
        ) : null}
        <ActionIconButton icon="pencil" label="Edit Lead" onClick={() => openEditLead(lead)} />
        {canFollowUp ? (
          <ActionIconButton icon="call" label="Update Lead" tone="primary" onClick={() => openUpdateLead(lead)} />
        ) : null}
        <ActionIconButton icon="delete" label="Delete Lead" tone="danger" onClick={() => deleteLead(lead)} />
      </div>
    );
  };

  const currentColumns = isActivityLog
    ? activityColumns
    : viewPath === "/leads/pending-assigning"
    ? pendingAssigningColumns
    : leadColumns;
  const currentSearchKeys = isActivityLog
    ? ["activity_type", "client_name", "lead_status", "update_status", "assigned_to_name", "update_by_name", "remarks"]
    : [
        "description",
        "client_name",
        "priority",
        "assigned_to_name",
        "update_by_name",
        "category_name",
        "sub_category_name",
        "lead_status",
        "notes"
      ];

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        {message ? <p className="feedback feedback--success">{message}</p> : null}
        {error ? <p className="feedback feedback--error">{error}</p> : null}

        {!isActivityLog ? (
          <div className="lead-periods">
            {selectedFy === null && !selectedMonth ? (
              <>
                <div className="lead-periods__head">
                  <h2 className="lead-periods__title">Choose a financial year</h2>
                  <button type="button" className="primary-button" onClick={openAddLead}>
                    + Add Lead
                  </button>
                </div>
                <div className="lead-periods__years" role="group" aria-label="Financial year">
                  {periodStats.years.map((fyStart, index) => {
                    const count = periodStats.fyCounts.get(fyStart) || 0;
                    const busyMonths = fyMonths(fyStart).filter((month) => periodStats.monthCounts.get(month.key));
                    const isCurrent = fyStart === currentFyStart();
                    return (
                      <button
                        key={fyStart}
                        type="button"
                        className={`fy-card ${isCurrent ? "is-current" : ""}`}
                        style={{ "--tile-color": FY_TILE_COLORS[index % FY_TILE_COLORS.length] }}
                        onClick={() => selectFy(fyStart)}
                      >
                        <span className="fy-card__top">
                          <span className="fy-card__label">{fyLabel(fyStart)}</span>
                          {isCurrent ? <span className="fy-card__badge">Current year</span> : null}
                        </span>
                        <span className="fy-card__range">
                          Apr {fyStart} – Mar {fyStart + 1}
                        </span>
                        <span className="fy-card__count">
                          {count} <small>{count === 1 ? "lead" : "leads"}</small>
                        </span>
                        <span className="fy-card__chips">
                          {busyMonths.length ? (
                            <>
                              {busyMonths.slice(0, 4).map((month) => (
                                <span key={month.key} className="fy-card__chip">
                                  {month.name} {month.year} · {periodStats.monthCounts.get(month.key)}
                                </span>
                              ))}
                              {busyMonths.length > 4 ? (
                                <span className="fy-card__chip">+{busyMonths.length - 4} more</span>
                              ) : null}
                            </>
                          ) : (
                            <span className="fy-card__none">No leads yet</span>
                          )}
                        </span>
                        <span className="fy-card__open">Open months →</span>
                      </button>
                    );
                  })}
                  {periodStats.noDateCount ? (
                    <button
                      type="button"
                      className="fy-card"
                      style={{ "--tile-color": "#475569" }}
                      onClick={() => {
                        setSelectedFy(null);
                        setSelectedMonth("no-date");
                      }}
                    >
                      <span className="fy-card__top">
                        <span className="fy-card__label">No date</span>
                      </span>
                      <span className="fy-card__range">No due or follow-up date</span>
                      <span className="fy-card__count">
                        {periodStats.noDateCount} <small>{periodStats.noDateCount === 1 ? "lead" : "leads"}</small>
                      </span>
                      <span className="fy-card__open">Open leads →</span>
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <nav className="lead-crumbs" aria-label="Breadcrumb">
                  <button
                    type="button"
                    className="lead-crumbs__back"
                    onClick={() => {
                      if (selectedMonth && selectedMonth !== "no-date") {
                        setSelectedMonth(null);
                      } else {
                        setSelectedFy(null);
                        setSelectedMonth(null);
                      }
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="lead-crumbs__link"
                    onClick={() => {
                      setSelectedFy(null);
                      setSelectedMonth(null);
                    }}
                  >
                    Financial years
                  </button>
                  <span className="lead-crumbs__sep" aria-hidden="true">›</span>
                  {selectedMonth === "no-date" ? (
                    <>
                      <span className="lead-crumbs__current">No date</span>
                      <span className="lead-crumbs__pill">{periodStats.noDateCount} leads</span>
                    </>
                  ) : selectedMonth ? (
                    <>
                      <button type="button" className="lead-crumbs__link" onClick={() => setSelectedMonth(null)}>
                        {fyLabel(selectedFy)}
                      </button>
                      <span className="lead-crumbs__sep" aria-hidden="true">›</span>
                      <span className="lead-crumbs__current">
                        {selectedMonth === "all"
                          ? "All months"
                          : (() => {
                              const [year, month] = selectedMonth.split("-");
                              return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
                            })()}
                      </span>
                      <span className="lead-crumbs__pill">
                        {visibleLeadRecords.length} {visibleLeadRecords.length === 1 ? "lead" : "leads"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="lead-crumbs__current">{fyLabel(selectedFy)}</span>
                      <span className="lead-crumbs__pill">
                        {periodStats.fyCounts.get(selectedFy) || 0}{" "}
                        {(periodStats.fyCounts.get(selectedFy) || 0) === 1 ? "lead" : "leads"}
                      </span>
                    </>
                  )}
                  {!selectedMonth ? (
                    <span className="lead-crumbs__actions">
                      <button
                        type="button"
                        className="lead-crumbs__all"
                        onClick={() => setSelectedMonth("all")}
                      >
                        All months · {periodStats.fyCounts.get(selectedFy) || 0}
                      </button>
                      <button type="button" className="primary-button" onClick={openAddLead}>
                        + Add Lead
                      </button>
                    </span>
                  ) : null}
                </nav>

                {selectedFy !== null && !selectedMonth ? (
                  <div
                    className="lead-month-grid"
                    role="group"
                    aria-label={`Months of ${fyLabel(selectedFy)}`}
                    style={{
                      "--tile-color":
                        FY_TILE_COLORS[Math.max(0, periodStats.years.indexOf(selectedFy)) % FY_TILE_COLORS.length]
                    }}
                  >
                    {fyMonths(selectedFy).map((month) => {
                      const count = periodStats.monthCounts.get(month.key) || 0;
                      const isCurrent = month.key === currentMonthKey();
                      return (
                        <button
                          key={month.key}
                          type="button"
                          className={[
                            "month-card",
                            count === 0 ? "is-empty" : "",
                            isCurrent ? "is-current" : ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          disabled={count === 0}
                          onClick={() => setSelectedMonth(month.key)}
                        >
                          <span className="month-card__top">
                            <span className="month-card__name">{MONTH_NAMES[Number(month.key.slice(5)) - 1]}</span>
                            {isCurrent ? <span className="month-card__badge">This month</span> : null}
                          </span>
                          <span className="month-card__year">{month.year}</span>
                          <span className="month-card__count">
                            {count ? (
                              <>
                                {count} <small>{count === 1 ? "lead" : "leads"}</small>
                              </>
                            ) : (
                              <small>No leads</small>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {selectedFy !== null && selectedMonth ? (
                  <div
                    className="lead-month-chips"
                    role="group"
                    aria-label="Jump to another month"
                    style={{
                      "--tile-color":
                        FY_TILE_COLORS[Math.max(0, periodStats.years.indexOf(selectedFy)) % FY_TILE_COLORS.length]
                    }}
                  >
                    <button
                      type="button"
                      className={`lead-month-chip ${selectedMonth === "all" ? "is-selected" : ""}`}
                      aria-pressed={selectedMonth === "all"}
                      onClick={() => setSelectedMonth("all")}
                    >
                      All <span>{periodStats.fyCounts.get(selectedFy) || 0}</span>
                    </button>
                    {fyMonths(selectedFy).map((month) => {
                      const count = periodStats.monthCounts.get(month.key) || 0;
                      return (
                        <button
                          key={month.key}
                          type="button"
                          className={[
                            "lead-month-chip",
                            selectedMonth === month.key ? "is-selected" : "",
                            count === 0 ? "is-empty" : ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          aria-pressed={selectedMonth === month.key}
                          disabled={count === 0}
                          onClick={() => setSelectedMonth(month.key)}
                        >
                          {month.name}
                          {count ? <span>{count}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {showLeadTable ? (
        <ResponsiveDataView
          key={`${viewPath}-${refreshKey}`}
          title={viewConfig.title}
          records={visibleLeadRecords}
          columns={currentColumns}
          loading={loading}
          error=""
          loadingMessage={isActivityLog ? "Loading lead activity..." : "Loading leads..."}
          emptyMessage={viewConfig.emptyMessage}
          searchKeys={currentSearchKeys}
          filterConfigs={filterConfigs}
          renderActions={isActivityLog ? null : renderLeadActions}
          rowKey={isActivityLog ? "activity_key" : "id"}
          getRowClassName={isActivityLog ? null : leadRowClassName}
          headerExtras={
            !isActivityLog ? (
              <button type="button" className="primary-button" onClick={openAddLead}>
                Add Lead
              </button>
            ) : null
          }
          customFilterContent={
            null
          }
          onClearCustomFilters={() => {}}
        />
        ) : null}
      </section>

      {isLeadModalOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="lead-form-title">
          <div className="master-modal__backdrop" onClick={resetLeadModal} />
          <section className={`master-card master-modal__panel ${isAssigneeOnly ? "master-modal__panel--small" : ""}`}>
            <div className="master-card__header">
              <h3 id="lead-form-title">
                {isAssigneeOnly ? "Update Assignee" : editingLeadId ? "Edit Lead" : "Add Lead"}
              </h3>
              <button type="button" className="text-button" onClick={resetLeadModal}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              <form className={`master-form ${isAssigneeOnly ? "master-form--single" : ""}`} onSubmit={handleLeadSubmit}>
                {!isAssigneeOnly && (
                  <>
                    <label className="form-field">
                      <FormLabel required>Description</FormLabel>
                      <input
                        type="text"
                        required
                        value={leadForm.description}
                        onChange={(event) => handleLeadFormChange("description", event.target.value)}
                      />
                    </label>

                    <label className="form-field">
                      <FormLabel required>Due Date</FormLabel>
                      <input
                        type="date"
                        required
                        value={leadForm.due_date}
                        onChange={(event) => handleLeadFormChange("due_date", event.target.value)}
                      />
                    </label>

                    <label className="form-field">
                      <FormLabel required>Client Name</FormLabel>
                      <div className="form-field__with-action">
                        <SearchableSelect
                          required
                          value={leadForm.client_name}
                          onChange={(event) => handleLeadFormChange("client_name", event.target.value)}
                        >
                          <option value="">Select Client</option>
                          {clientOptions.map((customer) => (
                            <option
                              key={customer.id}
                              value={customer.full_name}
                              data-description={customer.mobile || ""}
                              data-search-text={`${customer.full_name || ""} ${customer.mobile || ""}`.trim()}
                            >
                              {customer.full_name}
                            </option>
                          ))}
                        </SearchableSelect>
                        <button
                          type="button"
                          className="inline-icon-button"
                          onClick={() => setIsAddCustomerModalOpen(true)}
                          aria-label="Add new client"
                          title="Add new client"
                        >
                          +
                        </button>
                      </div>
                    </label>

                    <label className="form-field">
                      <FormLabel required>Priority</FormLabel>
                      <SearchableSelect
                        required
                        value={leadForm.priority}
                        onChange={(event) => handleLeadFormChange("priority", event.target.value)}
                      >
                        {priorityOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </SearchableSelect>
                    </label>
                  </>
                )}

                <label className="form-field">
                  <FormLabel>Assigned To</FormLabel>
                  <SearchableSelect
                    value={leadForm.assigned_to_user_id}
                    onChange={(event) => handleLeadFormChange("assigned_to_user_id", event.target.value)}
                  >
                    <option value="">Select User</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </SearchableSelect>
                </label>

                {!isAssigneeOnly && (
                  <>
                    <label className="form-field">
                      <FormLabel required>Category</FormLabel>
                      <SearchableSelect
                        required
                        value={leadForm.category_id}
                        onChange={(event) => handleLeadFormChange("category_id", event.target.value)}
                      >
                        <option value="">Select Category</option>
                        {topLevelCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.category_name}
                          </option>
                        ))}
                      </SearchableSelect>
                    </label>

                    <label className="form-field">
                      <FormLabel required>Sub - Category</FormLabel>
                      <SearchableSelect
                        required
                        value={leadForm.sub_category_id}
                        onChange={(event) => handleLeadFormChange("sub_category_id", event.target.value)}
                        disabled={!leadForm.category_id}
                      >
                        <option value="">Select Sub - Category</option>
                        {subCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.category_name}
                          </option>
                        ))}
                      </SearchableSelect>
                    </label>

                    {editingLeadId ? (
                      <>
                        <label className="form-field">
                          <FormLabel required>Status</FormLabel>
                          <SearchableSelect
                            required
                            value={leadForm.lead_status}
                            onChange={(event) => handleLeadFormChange("lead_status", event.target.value)}
                          >
                            {[
                              ...(originalLeadStatus && !editableLeadStatuses.includes(originalLeadStatus)
                                ? [originalLeadStatus]
                                : []),
                              ...editableLeadStatuses
                            ].map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </SearchableSelect>
                        </label>
                        {!finalLeadStatuses.includes(leadForm.lead_status) ? (
                          <label className="form-field">
                            <FormLabel
                              required={
                                leadForm.lead_status !== originalLeadStatus && leadForm.lead_status !== "Pending Assigning"
                              }
                            >
                              Next Follow Up Date
                            </FormLabel>
                            <input
                              type="date"
                              required={
                                leadForm.lead_status !== originalLeadStatus && leadForm.lead_status !== "Pending Assigning"
                              }
                              value={leadForm.next_follow_up_date}
                              onChange={(event) => handleLeadFormChange("next_follow_up_date", event.target.value)}
                            />
                          </label>
                        ) : null}
                      </>
                    ) : null}

                    <label className="form-field">
                      <FormLabel>Notes</FormLabel>
                      <textarea
                        rows="4"
                        value={leadForm.notes}
                        onChange={(event) => handleLeadFormChange("notes", event.target.value)}
                      />
                    </label>
                  </>
                )}

                <div className="form-actions">
                  <button type="button" className="secondary-button form-actions__cancel" onClick={resetLeadModal}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" disabled={savingLead}>
                    {savingLead
                      ? <ButtonSpinner label="Saving..." />
                      : isAssigneeOnly
                      ? "Update Assignee"
                      : editingLeadId
                      ? "Update Lead"
                      : "Save Lead"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {isUpdateModalOpen && selectedLead ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="lead-update-title">
          <div className="master-modal__backdrop" onClick={resetUpdateModal} />
          <section className="master-card master-modal__panel master-modal__panel--wide">
            <div className="master-card__header">
              <h3 id="lead-update-title">Lead Update</h3>
              <button type="button" className="text-button" onClick={resetUpdateModal}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              <div className="lead-summary-grid">
                <div className="record-card__field">
                  <span>Client Name</span>
                  <strong>{formatCellValue(selectedLead.client_name)}</strong>
                </div>
                <div className="record-card__field">
                  <span>Assigned To</span>
                  <strong>{formatCellValue(selectedLead.assigned_to_name)}</strong>
                </div>
              </div>

              <form className="master-form" onSubmit={handleUpdateSubmit}>
                <label className="form-field">
                  <FormLabel>Status</FormLabel>
                  <SearchableSelect
                    value={updateForm.status}
                    onChange={(event) => handleUpdateFormChange("status", event.target.value)}
                  >
                    {updateStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </SearchableSelect>
                </label>

                <label className="form-field">
                  <FormLabel required>Update Date</FormLabel>
                  <input
                    type="date"
                    required
                    value={updateForm.update_date}
                    onChange={(event) => handleUpdateFormChange("update_date", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel required>Update By</FormLabel>
                  <SearchableSelect
                    required
                    value={updateForm.update_by_user_id}
                    onChange={(event) => handleUpdateFormChange("update_by_user_id", event.target.value)}
                  >
                    <option value="">Select User</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </SearchableSelect>
                </label>

                <label className="form-field">
                  <FormLabel required={updateForm.status === "Follow Up Again"}>Next Follow Up Date</FormLabel>
                  <input
                    type="date"
                    required={updateForm.status === "Follow Up Again"}
                    value={updateForm.next_follow_up_date}
                    onChange={(event) => handleUpdateFormChange("next_follow_up_date", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel required={updateForm.status !== "Success"}>Remarks</FormLabel>
                  <textarea
                    rows="4"
                    required={updateForm.status !== "Success"}
                    value={updateForm.remarks}
                    onChange={(event) => handleUpdateFormChange("remarks", event.target.value)}
                  />
                </label>

                <div className="form-actions">
                  <button type="button" className="secondary-button form-actions__cancel" onClick={resetUpdateModal}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" disabled={savingUpdate}>
                    {savingUpdate ? <ButtonSpinner label="Saving..." /> : "Save Update"}
                  </button>
                </div>
              </form>

              <div className="lead-history">
                <div className="master-card__header">
                  <h3>Activity History</h3>
                </div>

                {historyLoading ? (
                  <div className="table-state">
                    <Spinner label="Loading lead activity..." />
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="master-table">
                      <thead>
                        <tr>
                          <th>Sl.No.</th>
                          <th>Status</th>
                          <th>Update Date</th>
                          <th>Update By</th>
                          <th>Next Follow Up Date</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadHistory.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="table-state">
                              No follow up activity found for this lead.
                            </td>
                          </tr>
                        ) : (
                          leadHistory.map((item, index) => (
                            <tr key={item.id || `${item.update_date}-${index + 1}`}>
                              <td>{index + 1}</td>
                              <td>{formatCellValue(item.status)}</td>
                              <td>{formatCellValue(item.update_date)}</td>
                              <td>{formatCellValue(item.update_by_name)}</td>
                              <td>{formatCellValue(item.next_follow_up_date)}</td>
                              <td>{formatCellValue(item.remarks)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {isAddCustomerModalOpen ? (
        <MasterPage
          resourceKey="customers"
          embeddedFormOnly
          autoOpenForm
          onFormSaved={handleCustomerCreated}
          onFormCancel={() => setIsAddCustomerModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
