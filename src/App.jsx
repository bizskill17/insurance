import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AllPoliciesPage from "./components/AllPoliciesPage";
import AttachDocumentsPage from "./components/AttachDocumentsPage";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./components/DashboardPage";
import ExpiryReportsPage from "./components/ExpiryReportsPage";
import ExpiryReportDetailPage from "./components/ExpiryReportDetailPage";
import IssuePolicyPage from "./components/IssuePolicyPage";
import InactivatedPoliciesPage from "./components/InactivatedPoliciesPage";
import LeadsPage from "./components/LeadsPage";
import LoginPage from "./components/LoginPage";
import MasterPage from "./components/MasterPage";
import PendingPaymentsPage from "./components/PendingPaymentsPage";
import PagePlaceholder from "./components/PagePlaceholder";
import ReportsTablePage from "./components/ReportsTablePage";
import RenewPolicyPage from "./components/RenewPolicyPage";
import TasksPage from "./components/TasksPage";
import { filterMenuSectionsByViews, getMenuRouteEntries } from "./data/menu";
import { masterConfigs } from "./data/masterConfigs";
import { clearStoredAuthUser, getStoredAuthUser, setStoredAuthUser } from "./utils/auth";

function buildRoutes(items, currentUser) {
  return items.map((item) => (
    <Route
      key={item.path}
      path={item.path}
      element={
        item.path === "/policies/all" ? (
          <AllPoliciesPage />
        ) : item.path === "/dashboard" ? (
          <DashboardPage />
        ) : item.path === "/payments/pending" ? (
          <PendingPaymentsPage />
        ) : item.path === "/policies/attach-documents" ? (
          <AttachDocumentsPage />
        ) : item.path === "/payments/received" ? (
          <ReportsTablePage reportKey="payments-received" />
        ) : item.path === "/reports/pending-payments" ? (
          <PendingPaymentsPage />
        ) : item.path === "/reports/pending-document-uploads" ? (
          <AttachDocumentsPage />
        ) : item.path === "/reports/expiry-reports" || item.path.startsWith("/reports/expiry-reports/section/") ? (
          <ExpiryReportsPage />
        ) : [
          "/reports/policies-added",
          "/reports/policies-this-week",
          "/reports/policies-this-month"
        ].includes(item.path) ? (
          <ReportsTablePage reportKey={item.path.replace("/reports/", "")} />
        ) : item.path === "/policies/issue" ? (
          <IssuePolicyPage />
        ) : item.path === "/policies/renew" ? (
          <RenewPolicyPage />
        ) : item.path === "/policies/renew/upcoming-45-days" ? (
          <RenewPolicyPage viewMode="upcoming-45-days" />
        ) : item.path === "/policies/renew/overdue" ? (
          <RenewPolicyPage viewMode="overdue" />
        ) : item.path === "/policies/inactivated" ? (
          <InactivatedPoliciesPage />
        ) : item.section === "Leads" ? (
          <LeadsPage viewPath={item.path} />
        ) : item.section === "Tasks" ? (
          <TasksPage viewPath={item.path} />
        ) : item.section === "Masters" && masterConfigs[item.resourceKey] ? (
          <MasterPage resourceKey={item.resourceKey} currentUser={currentUser} />
        ) : (
          <PagePlaceholder title={item.label} section={item.section} />
        )
      }
    />
  ));
}



export default function App() {
  const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
  const nativeFetchRef = useRef(window.fetch.bind(window));
  const hasValidAuth = Boolean(authUser?.organization_id);
  const effectiveViews = useMemo(() => {
    const views = authUser?.views || [];

    if (authUser?.can_manage_organizations) {
      return views;
    }

    return views.filter((view) => view !== "/masters/organizations");
  }, [authUser]);
  const allowedMenuSections = useMemo(
    () => filterMenuSectionsByViews(effectiveViews),
    [effectiveViews]
  );
  const allowedRoutes = useMemo(() => getMenuRouteEntries(allowedMenuSections), [allowedMenuSections]);
  const defaultPath = allowedRoutes[0]?.path || "/dashboard";

  useLayoutEffect(() => {
    const nativeFetch = nativeFetchRef.current;

    if (!authUser?.organization_id) {
      window.fetch = nativeFetch;
      return () => {
        window.fetch = nativeFetch;
      };
    }

    window.fetch = (input, init) => {
      const request = input instanceof Request ? input : null;
      const headers = new Headers(init?.headers ?? request?.headers ?? undefined);

      if (!headers.has("X-Organization-Id")) {
        headers.set("X-Organization-Id", String(authUser.organization_id));
      }

      return nativeFetch(input, {
        ...init,
        headers
      });
    };

    return () => {
      window.fetch = nativeFetch;
    };
  }, [authUser?.organization_id]);

  const handleLogin = (user) => {
    setStoredAuthUser(user);
    setAuthUser(getStoredAuthUser());
  };

  const handleLogout = () => {
    clearStoredAuthUser();
    setAuthUser(null);
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={hasValidAuth ? <Navigate to={defaultPath} replace /> : <LoginPage onLogin={handleLogin} />}
      />
      <Route
        element={
          hasValidAuth ? (
            <AppLayout
              currentUser={authUser}
              allowedMenuSections={allowedMenuSections}
              allowedRoutes={allowedRoutes}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<Navigate to={defaultPath} replace />} />
        <Route path="/reports/payments-received" element={<Navigate to="/payments/received" replace />} />
        <Route path="/reports/expiry-reports/section/:sectionId" element={<ExpiryReportsPage />} />
        <Route path="/reports/expiry-reports/:reportType/:reportValue" element={<ExpiryReportDetailPage />} />
        {buildRoutes(allowedRoutes, authUser)}
      </Route>
      <Route path="*" element={<Navigate to={hasValidAuth ? defaultPath : "/login"} replace />} />
    </Routes>
  );
}




