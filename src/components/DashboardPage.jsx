import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "./Spinner";
import { API_BASE } from "../config/api";

const dashboardItems = [
  {
    key: "renew-policy-today",
    label: "Policies Renewed Today",
    tone: "warning",
    path: "/policies/renew"
  },
  {
    key: "policies-added",
    label: "Policies Added Today",
    tone: "info",
    path: "/reports/policies-added"
  },
  {
    key: "renewals_next_7_days",
    label: "Policies Pending for Renewal in next 7 days",
    tone: "warning",
    path: "/policies/renew"
  },
  {
    key: "pending_document_uploads",
    label: "Policies Pending for Document Upload",
    tone: "info",
    path: "/policies/attach-documents"
  },
  {
    key: "renewals_overdue",
    label: "Renewals Pending beyond due date",
    tone: "danger",
    path: "/policies/renew"
  },
  {
    key: "pending_client_collections",
    label: "Policies Pending for Payment Collection from Client",
    tone: "success",
    path: "/payments/pending"
  }
];

const pendingLeadItems = [
  {
    key: "leads-added-today",
    label: "Add Leads Today",
    tone: "success",
    path: "/leads/all"
  },
  {
    key: "leads-pending-first-follow-up",
    label: "Pending First Follow Up",
    tone: "info",
    path: "/leads/pending-first-follow-up"
  },
  {
    key: "leads-pending-repeat-follow-up",
    label: "Pending Repeat Follow Up",
    tone: "warning",
    path: "/leads/pending-repeat-follow-up"
  },
  {
    key: "leads-pending-assigning",
    label: "Pending Assigning",
    tone: "warning",
    path: "/leads/pending-assigning"
  },
  {
    key: "leads-converted-today",
    label: "Converted Today",
    tone: "info",
    path: "/leads/converted"
  },
  {
    key: "leads-lost-today",
    label: "Lost Today",
    tone: "danger",
    path: "/leads/lost"
  },
  {
    key: "leads-canceled-today",
    label: "Canceled Today",
    tone: "warning",
    path: "/leads/canceled"
  }
];

const pendingTaskItems = [
  {
    key: "tasks-added-today",
    label: "Add Tasks Today",
    tone: "success",
    path: "/tasks/all"
  },
  {
    key: "tasks-pending",
    label: "Pending Tasks",
    tone: "success",
    path: "/tasks/pending"
  },
  {
    key: "tasks-completed-today",
    label: "Completed Today",
    tone: "info",
    path: "/tasks/completed"
  },
  {
    key: "tasks-canceled-today",
    label: "Canceled Today",
    tone: "danger",
    path: "/tasks/canceled"
  }
];

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

export default function DashboardPage() {
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
    "renew-policy-today": 0,
    "policies-added": 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

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
          "renew-policy-today": Number(countsJson.data["renew-policy-today"] || 0),
          "policies-added": Number(countsJson.data["policies-added"] || 0)
        });
      } catch (loadError) {
        if (String(loadError.message || "").includes("organization_id")) {
          setError("");
          return;
        }

        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="dashboard-page">
      <section className="master-card dashboard-card">
        <div className="master-card__header">
          <h3 className="responsive-data-view__title">Insurance</h3>
          <div className="master-card__actions master-card__actions--header"></div>
        </div>

        {loading ? (
          <div className="table-state">
            <Spinner label="Loading dashboard..." />
          </div>
        ) : error ? (
          <p className="feedback feedback--error">{error}</p>
        ) : (
          <>
            <div className="dashboard-list">
              {dashboardItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="dashboard-tile"
                  onClick={() => navigate(item.path)}
                >
                  <span className="dashboard-tile__content">
                    <span className="dashboard-table__item">
                      <span className="text-blue">{item.label}</span>
                    </span>
                    <span className={`dashboard-table__count dashboard-table__count--${item.tone}`}>
                      {item.key in menuCounts ? menuCounts[item.key] : summary[item.key]}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="dashboard-section">
              <div className="master-card__header">
                <h3 className="responsive-data-view__title">Leads</h3>
              </div>
              <div className="dashboard-list">
                {pendingLeadItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="dashboard-tile"
                    onClick={() => navigate(item.path)}
                  >
                    <span className="dashboard-tile__content">
                      <span className="dashboard-table__item">
                        <span className="text-blue">{item.label}</span>
                      </span>
                      <span className={`dashboard-table__count dashboard-table__count--${item.tone}`}>
                        {menuCounts[item.key]}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-section">
              <div className="master-card__header">
                <h3 className="responsive-data-view__title">Tasks</h3>
              </div>
              <div className="dashboard-list">
                {pendingTaskItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="dashboard-tile"
                    onClick={() => navigate(item.path)}
                  >
                    <span className="dashboard-tile__content">
                      <span className="dashboard-table__item">
                        <span className="text-blue">{item.label}</span>
                      </span>
                      <span className={`dashboard-table__count dashboard-table__count--${item.tone}`}>
                        {menuCounts[item.key]}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

