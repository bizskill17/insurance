import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { menuSections } from "../data/menu";
import { API_BASE } from "../config/api";

function matchesMenuPath(currentPath, item) {
  if (currentPath === item.path) {
    return true;
  }

  return (item.matchPrefixes || []).some((prefix) => currentPath.startsWith(prefix));
}

function Icon({ name }) {
  const icons = {
    dashboard: (
      <path d="M4 4h7v7H4V4Zm9 0h7v5h-7V4ZM4 13h5v7H4v-7Zm7 0h9v7h-9v-7Z" />
    ),
    masters: (
      <path d="M6 3h12l3 4v14H3V7l3-4Zm1 2-1.5 2H18.5L17 5H7Zm-2 4v10h14V9H5Zm3 2h8v2H8v-2Zm0 4h6v2H8v-2Z" />
    ),
    leads: (
      <path d="M6 4h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm8 1.5V10h4.5M8 12h8v2H8v-2Zm0 4h5v2H8v-2Z" />
    ),
    tasks: (
      <path d="M9 4h6l1 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1-2Zm0 6h6v2H9v-2Zm0 4h6v2H9v-2Z" />
    ),
    policies: (
      <path d="M6 2h9l5 5v15H6V2Zm2 2v16h10V8h-4V4H8Zm2 7h6v2h-6v-2Zm0 4h6v2h-6v-2Z" />
    ),
    payments: (
      <path d="M3 6c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm2 0v2h14V6H5Zm0 5v7h14v-7H5Zm9 2h3v2h-3v-2Z" />
    ),
    claims: (
      <path d="M6 3h9l5 5v13H6V3Zm2 2v14h10V9h-5V5H8Zm2 7h6v2h-6v-2Zm0 4h4v2h-4v-2Z" />
    ),
    reports: (
      <path d="M5 3h14v18H5V3Zm2 2v14h10V5H7Zm2 9h2v3H9v-3Zm4-4h2v7h-2v-7Zm-4-3h2v10H9V7Z" />
    )
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

export default function Sidebar({
  isOpen: isSidebarOpen,
  isMobile = false,
  onClose = () => {},
  menuSections: providedMenuSections,
  currentUser = null,
  onLogout = () => {}
}) {
  const location = useLocation();
  const visibleMenuSections = providedMenuSections || menuSections;
  const [counts, setCounts] = useState({});
  const [appBrandName, setAppBrandName] = useState(currentUser?.organization_name || "Policy Management System");

  useEffect(() => {
    let isActive = true;

    const loadCounts = () => {
      fetch(`${API_BASE}/menu/counts`)
        .then((res) => res.json())
        .then((json) => {
          if (isActive && json.status === "ok") {
            setCounts(json.data || {});
          }
        })
        .catch((err) => console.error("Failed to fetch menu counts", err));
    };

    const loadBrand = () => {
      if (isActive) {
        setAppBrandName(currentUser?.organization_name || "Policy Management System");
      }
    };

    const handleFocus = () => {
      loadCounts();
      loadBrand();
    };

    const handleRefreshCounts = () => {
      loadCounts();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadCounts();
        loadBrand();
      }
    };

    loadCounts();
    loadBrand();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("refresh-counts", handleRefreshCounts);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("refresh-counts", handleRefreshCounts);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUser?.organization_name, location.pathname]);

  const defaultOpenKey = useMemo(() => {
    const matched = visibleMenuSections.find((section) =>
      section.items.some((item) => matchesMenuPath(location.pathname, item))
    );
    return matched?.standalone ? null : matched?.label ?? "Masters";
  }, [location.pathname, visibleMenuSections]);

  const [openGroup, setOpenGroup] = useState(defaultOpenKey);

  useEffect(() => {
    setOpenGroup(defaultOpenKey);
  }, [defaultOpenKey]);

  return (
    <>
      {isMobile && isSidebarOpen ? <button type="button" className="sidebar-backdrop" onClick={onClose} aria-label="Close menu" /> : null}
      <aside
        className={`sidebar ${isSidebarOpen ? "" : "sidebar--collapsed"} ${isMobile ? "sidebar--mobile" : ""}`}
      >
        <div className="brand-panel">
          <div className="brand-panel__main">
            <div className="brand-copy">
              <h1>{appBrandName}</h1>
            </div>
          </div>
          {isMobile ? (
            <button type="button" className="sidebar-close-button" onClick={onClose} aria-label="Close menu">
              <span className="sidebar-close-button__icon" aria-hidden="true">
                x
              </span>
            </button>
          ) : null}
        </div>
      

        <nav className="menu" aria-label="Primary">
        {visibleMenuSections.map((section) => {
          if (section.standalone) {
            return (
              <NavLink
                key={section.label}
                to={section.path}
                className={({ isActive }) =>
                  `menu-card menu-card--link ${isActive ? "is-active" : ""}`
                }
                onClick={() => {
                  setOpenGroup(null);
                  if (isMobile) {
                    onClose();
                  }
                }}
              >
                <span className="menu-card__left">
                  <span className="menu-icon">
                    <Icon name={section.icon} />
                  </span>
                  <span>{section.label}</span>
                </span>
              </NavLink>
            );
          }

          const isOpen = openGroup === section.label;

          return (
            <section
              className={`menu-group ${isOpen ? "is-open" : ""}`}
              key={section.label}
            >
              <button
                className="menu-card menu-card--collapsible"
                type="button"
                aria-expanded={isOpen}
                onClick={() => {
                  setOpenGroup(isOpen ? null : section.label);
                }}
              >
                <span className="menu-card__left">
                  <span className="menu-icon">
                    <Icon name={section.icon} />
                  </span>
                  <span>{section.label}</span>
                </span>
                <span className="chevron" aria-hidden="true"></span>
              </button>

              <div className="submenu">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={() =>
                      `submenu-item ${matchesMenuPath(location.pathname, item) ? "is-current" : ""}`
                    }
                    onClick={() => {
                      if (isMobile) {
                        onClose();
                      }
                    }}
                  >
                    <span>{item.label}</span>
                    {item.countKey && counts[item.countKey] !== undefined && (
                      <span className="menu-item-count">{counts[item.countKey]}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </section>
          );
        })}
        </nav>

        <div className="sidebar-footer">
          <p className="user-line">
            Logged in as: <strong>{currentUser?.full_name || currentUser?.login_id || "User"}</strong>
          </p>
          <button className="logout-button" type="button" onClick={onLogout}>
            <span className="menu-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8v-2h8V6h-8V4Zm1.7 4.3L13 9.6 11.6 11H5v2h6.6L13 14.4l-1.3 1.3L8 12l3.7-3.7Z" />
              </svg>
            </span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

