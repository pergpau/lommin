import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { SnackbarProvider } from "./components/ui/Snackbar";
import Onboarding from "./pages/Onboarding";
import Connect from "./pages/Connect";
import Dashboard from "./pages/Dashboard";
import Account from "./pages/Account";
import Settings from "./pages/Settings";
import Duplicates from "./pages/Duplicates";
import { loadKey } from "./lib/auth";
import { getAccounts } from "./lib/store";
import Spinner from "./components/ui/Spinner";
import ErrorBoundary from "./components/ErrorBoundary";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import OAuthCallback from "./pages/OAuthCallback";
import { useDriveSync } from "./hooks/useDriveSync";

function RequireKey({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");
  useEffect(() => {
    Promise.all([loadKey(), getAccounts()]).then(([kv, accounts]) =>
      setStatus(kv || accounts.length > 0 ? "ok" : "missing"),
    );
  }, []);
  if (status === "loading")
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  if (status === "missing") return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const [dest, setDest] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([loadKey(), getAccounts()]).then(([kv, accounts]) =>
      setDest(kv || accounts.length > 0 ? "/dashboard" : "/onboarding"),
    );
  }, []);
  if (!dest)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  return <Navigate to={dest} replace />;
}

function AppContent() {
  useDriveSync();
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/setup" element={<Navigate to="/onboarding" replace />} />
            <Route path="/connect" element={<Connect />} />
            <Route
              path="/dashboard"
              element={
                <RequireKey>
                  <Dashboard />
                </RequireKey>
              }
            />
            <Route
              path="/account/:uid"
              element={
                <RequireKey>
                  <Account />
                </RequireKey>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireKey>
                  <Settings />
                </RequireKey>
              }
            />
            <Route
              path="/duplicates"
              element={
                <RequireKey>
                  <Duplicates />
                </RequireKey>
              }
            />
            <Route path="/oauth/google" element={<OAuthCallback />} />
<Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
  );
}

export default function App() {
  return (
    <SnackbarProvider>
      <AppContent />
    </SnackbarProvider>
  );
}
