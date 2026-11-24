import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { API_BASE } from "../config/api";
import { menuSections } from "../data/menu";
import Sidebar from "./Sidebar";
import TableDragScroll from "./TableDragScroll";

function getIsMobileViewport() {
  return window.innerWidth <= 900;
}

function getCurrentViewName(pathname) {
  const monthLabels = {
    "1": "January",
    "2": "February",
    "3": "March",
    "4": "April",
    "5": "May",
    "6": "June",
    "7": "July",
    "8": "August",
    "9": "September",
    "10": "October",
    "11": "November",
    "12": "December"
  };

  const dayLabels = {
    today: "Today",
    tomorrow: "Tomorrow",
    "day-after-tomorrow": "Day after Tomorrow"
  };

  const weekLabels = {
    "7-days": "Next 7 Days"
  };

  const yearLabels = {
    current: "Current Financial Years",
    future: "Future Financial Years"
  };

  for (const section of menuSections) {
    if (section.standalone && section.path === pathname) {
      return section.label;
    }

    const matchedItem = section.items.find((item) => item.path === pathname);
    if (matchedItem) {
      return matchedItem.label;
    }
  }

  const monthMatch = pathname.match(/^\/reports\/expiry-reports\/month\/(\d{1,2})$/);
  if (monthMatch) {
    const monthLabel = monthLabels[monthMatch[1]];
    return monthLabel ? `${monthLabel} Expiry Report` : "Monthly Expiry Report";
  }

  const dayMatch = pathname.match(/^\/reports\/expiry-reports\/day\/([a-z-]+)$/);
  if (dayMatch) {
    const dayLabel = dayLabels[dayMatch[1]];
    return dayLabel ? `${dayLabel} Expiry Report` : "Daily Expiry Report";
  }

  const weekMatch = pathname.match(/^\/reports\/expiry-reports\/week\/([a-z0-9-]+)$/);
  if (weekMatch) {
    const weekLabel = weekLabels[weekMatch[1]];
    return weekLabel ? `${weekLabel} Expiry Report` : "Weekly Expiry Report";
  }

  const yearMatch = pathname.match(/^\/reports\/expiry-reports\/year\/([a-z-]+)$/);
  if (yearMatch) {
    const yearLabel = yearLabels[yearMatch[1]];
    return yearLabel ? `${yearLabel} Expiry Report` : "Yearly Expiry Report";
  }

  if (pathname === "/reports/payments-received") {
    return "Payments Received";
  }

  return "";
}

// Pages that open a form on top of another list keep that list's state.
function pageStateKey(pathname) {
  if (pathname === "/leads/add") return "/leads/all";
  if (pathname === "/tasks/add") return "/tasks/all";
  return pathname;
}

export default function AppLayout({ currentUser, allowedMenuSections, allowedRoutes, onLogout }) {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(() => getIsMobileViewport());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [appBrand, setAppBrand] = useState({
    name: currentUser?.organization_name || "Policy Management System",
    logo: currentUser?.organization_logo || ""
  });
  const currentViewName = getCurrentViewName(location.pathname);
  const fallbackPath = allowedRoutes[0]?.path || "/login";
  const isAllowedPath = allowedRoutes.some((item) => {
    if (item.path === location.pathname) {
      return true;
    }

    return (item.matchPrefixes || []).some((prefix) => location.pathname.startsWith(prefix));
  });
  const isLegacyAliasAllowed =
    location.pathname === "/reports/payments-received" &&
    allowedRoutes.some((item) => item.path === "/payments/received");

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = getIsMobileViewport();
      setIsMobile(nextIsMobile);
      setIsSidebarOpen(!nextIsMobile);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setAppBrand({
      name: currentUser?.organization_name || "Policy Management System",
      logo: currentUser?.organization_logo || ""
    });
  }, [currentUser?.organization_logo, currentUser?.organization_name]);

  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTo(0, 0);
      document.body.scrollTo(0, 0);
    };

    scrollToTop();
    const timer = setTimeout(scrollToTop, 100);

    setIsSidebarOpen(false);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Shared mouse horizontal scrolling for every tabular view.
  useEffect(() => {
    let drag = null;
    let suppressClick = false;
    const findTable = (target) => target instanceof Element
      ? target.closest(".table-wrap") : null;
    const onMouseDown = (event) => {
      if (event.button !== 0 || event.altKey || event.detail > 1 ||
          event.target.closest("a, button, input, textarea, select, [role='button'], [contenteditable='true']")) return;
      const table = findTable(event.target);
      if (!table || !table.querySelector("table") || table.scrollWidth <= table.clientWidth) return;
      drag = { table, startX: event.clientX, startScroll: table.scrollLeft, moved: false };
      suppressClick = false;
      event.preventDefault();
    };
    const onMouseMove = (event) => {
      if (!drag) return;
      if (!(event.buttons & 1)) { drag = null; return; }
      const delta = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(delta) < 6) return;
      drag.moved = true;
      drag.table.scrollLeft = drag.startScroll - delta;
      event.preventDefault();
    };
    const onMouseUp = () => {
      if (drag?.moved) suppressClick = true;
      drag = null;
    };
    const onClick = (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onWheel = (event) => {
      if (!event.shiftKey) return;
      const table = findTable(event.target);
      if (!table || !table.querySelector("table")) return;
      const delta = event.deltaY || event.deltaX;
      const next = Math.max(0, Math.min(table.scrollWidth - table.clientWidth, table.scrollLeft + delta));
      if (next !== table.scrollLeft) {
        table.scrollLeft = next;
        event.preventDefault();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("click", onClick, true);
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("wheel", onWheel);
    };
  }, []);

  const handleSidebarToggle = () => {
    setIsSidebarOpen((current) => !current);
  };

  if (!isAllowedPath && !isLegacyAliasAllowed) {
    return <Navigate to={fallbackPath} replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={isSidebarOpen}
        isMobile={isMobile}
        onClose={() => setIsSidebarOpen(false)}
        onExpand={() => setIsSidebarOpen(true)}
        menuSections={allowedMenuSections}
        currentUser={currentUser}
        onLogout={onLogout}
      />
      <main className="content-area">
        <div className="content-topbar">
          <button
            className="sidebar-toggle"
            type="button"
            onClick={handleSidebarToggle}
            aria-label={isSidebarOpen ? "Hide menu" : "Show menu"}
          >
            <span className="sidebar-toggle__line" aria-hidden="true"></span>
            <span className="sidebar-toggle__line" aria-hidden="true"></span>
            <span className="sidebar-toggle__line" aria-hidden="true"></span>
          </button>
          <div className="content-topbar__copy">
            {currentViewName ? <h1 className="content-topbar__title">{currentViewName}</h1> : null}
          </div>
          {appBrand.logo ? (
            <div className="content-topbar__brand">
              <img
                src={
                  /^https?:\/\//i.test(appBrand.logo)
                    ? appBrand.logo
                    : `${API_BASE}/${String(appBrand.logo).replace(/^\/+/, "")}`
                }
                alt={appBrand.name}
                className="content-topbar__brand-logo"
              />
            </div>
          ) : null}
        </div>
        <div className="content-body">
          {/* A new key per menu page, so filters and other state of the previous page are not carried over.
              Add Lead / Add Task open a form over the All list, so they share its key. */}
          <Outlet key={pageStateKey(location.pathname)} />
        </div>
        <TableDragScroll />
      </main>
    </div>
  );
}


