import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../config/api";

const monthlyReports = [
  { label: "April", path: "/reports/expiry-reports/month/4", countKey: "4" },
  { label: "May", path: "/reports/expiry-reports/month/5", countKey: "5" },
  { label: "June", path: "/reports/expiry-reports/month/6", countKey: "6" },
  { label: "July", path: "/reports/expiry-reports/month/7", countKey: "7" },
  { label: "August", path: "/reports/expiry-reports/month/8", countKey: "8" },
  { label: "September", path: "/reports/expiry-reports/month/9", countKey: "9" },
  { label: "October", path: "/reports/expiry-reports/month/10", countKey: "10" },
  { label: "November", path: "/reports/expiry-reports/month/11", countKey: "11" },
  { label: "December", path: "/reports/expiry-reports/month/12", countKey: "12" },
  { label: "January", path: "/reports/expiry-reports/month/1", countKey: "1" },
  { label: "February", path: "/reports/expiry-reports/month/2", countKey: "2" },
  { label: "March", path: "/reports/expiry-reports/month/3", countKey: "3" }
];

const dailyReports = [
  { label: "Today", path: "/reports/expiry-reports/day/today", countKey: "today" },
  { label: "Tomorrow", path: "/reports/expiry-reports/day/tomorrow", countKey: "tomorrow" },
  { label: "Day after Tomorrow", path: "/reports/expiry-reports/day/day-after-tomorrow", countKey: "day-after-tomorrow" }
];

const weeklyReports = [{ label: "Next 7 Days", path: "/reports/expiry-reports/week/7-days", countKey: "7-days" }];
const yearlyReports = [
  { label: "Current Financial Years", path: "/reports/expiry-reports/year/current", countKey: "current" },
  { label: "Future Financial Years", path: "/reports/expiry-reports/year/future", countKey: "future" }
];

const expirySections = {
  monthly: { title: "Monthly Expiry Reports", items: monthlyReports },
  daily: { title: "Daily Expiry Reports", items: dailyReports },
  weekly: { title: "Weekly Expiry Reports", items: weeklyReports, compact: true },
  yearly: { title: "Yearly Expiry Reports", items: yearlyReports }
};

function ExpirySection({
  title,
  items,
  compact = false,
  stacked = false,
  onOpen,
  hideTitle = false,
  counts = {}
}) {
  return (
    <section className={`expiry-reports__section ${stacked ? "expiry-reports__section--stacked" : ""}`}>
      {!hideTitle ? <h3>{title}</h3> : null}
      <div className={`expiry-reports__grid ${compact ? "expiry-reports__grid--compact" : ""}`}>
        {items.map((item) => (
          <button
            key={item.path}
            type="button"
            className="expiry-reports__button"
            onClick={() => onOpen(item.path)}
          >
            <span>{item.label}</span>
            <span className="expiry-reports__count">{counts[item.countKey] ?? 0}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function ExpiryReportsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sectionId } = useParams();
  const inferredSectionId =
    sectionId ||
    (location.pathname.includes("/reports/expiry-reports/section/")
      ? location.pathname.split("/").filter(Boolean).at(-1)
      : "");
  const activeSection = inferredSectionId ? expirySections[inferredSectionId] : null;
  const [counts, setCounts] = useState({
    monthly: {},
    daily: {},
    weekly: {},
    yearly: {}
  });

  useEffect(() => {
    fetch(`${API_BASE}/reports/expiry-counts`)
      .then((res) => res.json())
      .then((json) => {
        if (json.status === "ok") {
          setCounts({
            monthly: json.data?.monthly || {},
            daily: json.data?.daily || {},
            weekly: json.data?.weekly || {},
            yearly: json.data?.yearly || {}
          });
        }
      })
      .catch(() => {});
  }, []);

  const activeCounts = useMemo(() => {
    if (inferredSectionId === "monthly") return counts.monthly;
    if (inferredSectionId === "daily") return counts.daily;
    if (inferredSectionId === "weekly") return counts.weekly;
    if (inferredSectionId === "yearly") return counts.yearly;
    return {};
  }, [counts, inferredSectionId]);

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card expiry-reports">
        {activeSection ? (
          <ExpirySection
            title={activeSection.title}
            items={activeSection.items}
            compact={activeSection.compact}
            onOpen={navigate}
            hideTitle
            counts={activeCounts}
          />
        ) : (
          <>
            <ExpirySection title="Monthly Expiry Reports" items={monthlyReports} onOpen={navigate} counts={counts.monthly} />
            <ExpirySection title="Daily Expiry Reports" items={dailyReports} onOpen={navigate} counts={counts.daily} />
            <ExpirySection title="Weekly Expiry Reports" items={weeklyReports} compact onOpen={navigate} counts={counts.weekly} />
            <ExpirySection title="Yearly Expiry Reports" items={yearlyReports} onOpen={navigate} counts={counts.yearly} />
          </>
        )}
      </section>
    </div>
  );
}
