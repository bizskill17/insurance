import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "./Spinner";
import { API_BASE } from "../config/api";

const attentionItems = [
  {
    key: "renewals_overdue",
    label: "Renewals overdue",
    hint: "Expired and not yet renewed",
    tone: "danger",
    icon: "alert",
    urgent: true,
    path: "/policies/renew?view=overdue"
  },
  {
    key: "renewals_next_7_days",
    label: "Renewals due in 7 days",
    hint: "Expiring this week",
    tone: "warning",
    icon: "calendar",
    path: "/policies/renew?view=next-7-days"
  },
  {
    key: "pending_client_collections",
    label: "Payments to collect",
    hint: "Pending from clients",
    tone: "teal",
    icon: "card",
    path: "/payments/pending"
  },
  {
    key: "pending_document_uploads",
    label: "Documents to upload",
    hint: "Policies without a document",
    tone: "info",
    icon: "upload",
    path: "/policies/attach-documents"
  }
];

const todayItems = [
  { key: "policies-renewed-today", label: "Policies renewed", section: "policies", path: "/reports/policies-renewed-today" },
  { key: "policies-added", label: "Policies added", section: "policies", path: "/reports/policies-added" },
  { key: "leads-added-today", label: "Leads added", section: "leads", path: "/leads/all" },
  { key: "tasks-added-today", label: "Tasks added", section: "tasks", path: "/tasks/all" }
];

const leadsPanel = {
  title: "Leads",
  section: "leads",
  allLabel: "All leads",
  allPath: "/leads/all",
  open: [
    { key: "leads-pending-assigning", label: "Pending assigning", path: "/leads/pending-assigning" },
    { key: "leads-pending-first-follow-up", label: "Pending first follow up", path: "/leads/pending-first-follow-up" },
    { key: "leads-pending-repeat-follow-up", label: "Pending repeat follow up", path: "/leads/pending-repeat-follow-up" }
  ],
  closed: [
    { key: "leads-converted-today", label: "Converted", tone: "good", path: "/leads/converted" },
    { key: "leads-lost-today", label: "Lost", tone: "bad", path: "/leads/lost" },
    { key: "leads-canceled-today", label: "Canceled", tone: "neutral", path: "/leads/canceled" }
  ]
};

const tasksPanel = {
  title: "Tasks",
  section: "tasks",
  allLabel: "All tasks",
  allPath: "/tasks/all",
  open: [{ key: "tasks-pending", label: "Pending tasks", path: "/tasks/pending" }],
  closed: [
    { key: "tasks-completed-today", label: "Completed", tone: "good", path: "/tasks/completed" },
    { key: "tasks-canceled-today", label: "Canceled", tone: "neutral", path: "/tasks/canceled" }
  ]
};

const quickActions = [
  { label: "Issue Policy", path: "/policies/issue", section: "policies", requiresAdd: true, primary: true },
  { label: "Renew Policy", path: "/policies/renew", section: "policies", icon: "renew" },
  { label: "Add Lead", path: "/leads/add", section: "leads", requiresAdd: true },
  { label: "Add Task", path: "/tasks/add", section: "tasks", requiresAdd: true }
];

const dashIconPaths = {
  alert: ["M12 7v5", "M12 16h.01"],
  calendar: ["M3 10h18", "M8 3v4", "M16 3v4"],
  card: ["M2 10h20", "M6 15h4"],
  upload: ["M12 15V3", "M7 8l5-5 5 5", "M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"]
};

function DashIcon({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {name === "alert" ? <circle cx="12" cy="12" r="9" /> : null}
      {name === "calendar" ? <rect x="3" y="5" width="18" height="16" rx="2" /> : null}
      {name === "card" ? <rect x="2" y="5" width="20" height="14" rx="2" /> : null}
      {(dashIconPaths[name] || []).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
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

export default function DashboardPage({ currentUser }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({
    renewals_next_7_days: 0,
    pending_document_uploads: 0,
    renewals_overdue: 0,
    pending_client_collections: 0
  });
  const [menuCounts, setMenuCounts] = useState({
    "leads-added-today": 0,
    "leads-pending-first-follow-up": 0,
    "leads-pending-repeat-follow-up": 0,
    "leads-pending-assigning": 0,
    "leads-converted-today": 0,
    "leads-lost-today": 0,
    "leads-canceled-today": 0,
    "tasks-added-today": 0,
    "tasks-pending": 0,
    "tasks-completed-today": 0,
    "tasks-canceled-today": 0,
    "policies-renewed-today": 0,
    "policies-added": 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      try {
        const [summaryResponse, countsResponse] = await Promise.all([
          fetch(`${API_BASE}/dashboard/policy-summary`),
          fetch(`${API_BASE}/menu/counts`)
        ]);
        const [summaryJson, countsJson] = await Promise.all([
          readApiJson(summaryResponse),
          readApiJson(countsResponse)
        ]);

        if (!summaryResponse.ok) {
          throw new Error(summaryJson.message || "Failed to load dashboard summary.");
        }

        setSummary({
          renewals_next_7_days: Number(summaryJson.data.renewals_next_7_days || 0),
          pending_document_uploads: Number(summaryJson.data.pending_document_uploads || 0),
          renewals_overdue: Number(summaryJson.data.renewals_overdue || 0),
          pending_client_collections: Number(summaryJson.data.pending_client_collections || 0)
        });

        if (!countsResponse.ok) {
          throw new Error(countsJson.message || "Failed to load menu counts.");
        }

        setMenuCounts({
          "leads-added-today": Number(countsJson.data["leads-added-today"] || 0),
          "leads-pending-first-follow-up": Number(countsJson.data["leads-pending-first-follow-up"] || 0),
          "leads-pending-repeat-follow-up": Number(countsJson.data["leads-pending-repeat-follow-up"] || 0),
          "leads-pending-assigning": Number(countsJson.data["leads-pending-assigning"] || 0),
          "leads-converted-today": Number(countsJson.data["leads-converted-today"] || 0),
          "leads-lost-today": Number(countsJson.data["leads-lost-today"] || 0),
          "leads-canceled-today": Number(countsJson.data["leads-canceled-today"] || 0),
          "tasks-added-today": Number(countsJson.data["tasks-added-today"] || 0),
          "tasks-pending": Number(countsJson.data["tasks-pending"] || 0),
          "tasks-completed-today": Number(countsJson.data["tasks-completed-today"] || 0),
          "tasks-canceled-today": Number(countsJson.data["tasks-canceled-today"] || 0),
          "policies-renewed-today": Number(countsJson.data["policies-renewed-today"] || 0),
          "policies-added": Number(countsJson.data["policies-added"] || 0)
        });
      } catch (loadError) {
        console.warn("Dashboard counts could not be loaded:", loadError);
        setSummary((current) => Object.fromEntries(Object.keys(current).map((key) => [key, null])));
        setMenuCounts((current) => Object.fromEntries(Object.keys(current).map((key) => [key, null])));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const countFor = (key) => {
    const value = key in menuCounts ? menuCounts[key] : summary[key];
    return value === null || value === undefined ? "\u2014" : Number(value).toLocaleString("en-IN");
  };

  const userViews = new Set(currentUser?.views || []);
  const userAddPermissions = new Set(currentUser?.add_permissions || currentUser?.views || []);
  const visibleQuickActions = quickActions.filter(
    (action) => userViews.has(action.path) && (!action.requiresAdd || userAddPermissions.has(action.path))
  );

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <div className="dashboard-page dash">
      <div className="dash__top">
        <p className="dash__date">{todayLabel}</p>
        {visibleQuickActions.length ? (
          <div className="dash__actions">
            {visibleQuickActions.map((action) => (
              <button
                key={action.path}
                type="button"
                className={`dash__action ${action.primary ? "dash__action--primary" : ""}`}
                data-section={action.section}
                onClick={() => navigate(action.path)}
              >
                <span aria-hidden="true">{action.icon === "renew" ? "\u21bb" : "+"}</span>
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <section className="master-card">
          <div className="table-state">
            <Spinner label="Loading dashboard..." />
          </div>
        </section>
      ) : (
        <>
          <section className="dash__group" aria-labelledby="dash-attention">
            <h2 id="dash-attention" className="dash__heading">Needs attention</h2>
            <div className="dash__attention">
              {attentionItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`dash-stat dash-stat--${item.tone}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="dash-stat__top">
                    <span className="dash-stat__icon" aria-hidden="true">
                      <DashIcon name={item.icon} />
                    </span>
                    {item.urgent && Number(summary[item.key] || 0) > 0 ? (
                      <span className="dash-stat__badge">Urgent</span>
                    ) : null}
                  </span>
                  <span className="dash-stat__value">{countFor(item.key)}</span>
                  <span className="dash-stat__label">{item.label}</span>
                  <span className="dash-stat__hint">{item.hint} · View list →</span>
                </button>
              ))}
            </div>
          </section>

          <section className="dash__group dash__panel" aria-labelledby="dash-today">
            <h2 id="dash-today" className="dash__heading">Today</h2>
            <div className="dash__today">
              {todayItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="dash-today"
                  data-section={item.section}
                  onClick={() => navigate(item.path)}
                >
                  <span>{item.label}</span>
                  <strong>{countFor(item.key)}</strong>
                </button>
              ))}
            </div>
          </section>

          <div className="dash__split">
            {[leadsPanel, tasksPanel].map((panel) => (
              <section
                key={panel.title}
                className="dash-panel"
                data-section={panel.section}
                aria-labelledby={`dash-${panel.section}`}
              >
                <div className="dash-panel__header">
                  <h2 id={`dash-${panel.section}`}>{panel.title}</h2>
                  <button type="button" onClick={() => navigate(panel.allPath)}>
                    {panel.allLabel} →
                  </button>
                </div>
                <div className="dash-panel__body">
                  {panel.open.map((item) => (
                    <button key={item.key} type="button" className="dash-panel__row" onClick={() => navigate(item.path)}>
                      <span>{item.label}</span>
                      <strong>{countFor(item.key)}</strong>
                    </button>
                  ))}
                  <p className="dash-panel__subheading">Closed today</p>
                  <div className="dash-panel__closed" style={{ "--closed-count": panel.closed.length }}>
                    {panel.closed.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`dash-closed dash-closed--${item.tone}`}
                        onClick={() => navigate(item.path)}
                      >
                        <strong>{countFor(item.key)}</strong>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
