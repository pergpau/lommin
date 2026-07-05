import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import DriveReconnectModal from "./components/DriveReconnectModal";
import DriveRestoreWarningModal from "./components/DriveRestoreWarningModal";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import { SnackbarProvider } from "./components/ui/Snackbar";
import Spinner from "./components/ui/Spinner";
import { DEMO_ONLY } from "./constants";
import { useDriveSync } from "./hooks/useDriveSync";
import { loadKey } from "./lib/auth";
import { getAccounts } from "./lib/data";
import { seedDemoData } from "./lib/demoData";
import Account from "./pages/Account";
import Connect from "./pages/Connect";
import Dashboard from "./pages/Dashboard";
import Duplicates from "./pages/Duplicates";
import OAuthCallback from "./pages/OAuthCallback";
import Onboarding from "./pages/Onboarding";
import PrivacyTerms from "./pages/PrivacyTerms";
import Settings from "./pages/Settings";

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

function useDemoBootstrap(): boolean {
  const [ready, setReady] = useState(!DEMO_ONLY);
  useEffect(() => {
    if (!DEMO_ONLY) return;
    getAccounts().then(async (accounts) => {
      if (accounts.length === 0) await seedDemoData();
      setReady(true);
    });
  }, []);
  return ready;
}

function AppContent() {
  const demoReady = useDemoBootstrap();
  const { pendingRestore, confirmRestore, dismissRestore } = useDriveSync();

  if (!demoReady)
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size={24} />
      </div>
    );

  return (
    <>
      {!DEMO_ONLY && !window.opener && <DriveReconnectModal />}
      {!DEMO_ONLY && pendingRestore && (
        <DriveRestoreWarningModal
          backupCount={pendingRestore.backupCount}
          localCount={pendingRestore.localCount}
          onConfirm={() => void confirmRestore()}
          onCancel={dismissRestore}
        />
      )}
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route
              path="/onboarding"
              element={DEMO_ONLY ? <Navigate to="/dashboard" replace /> : <Onboarding />}
            />
            <Route path="/setup" element={<Navigate to="/onboarding" replace />} />
            <Route
              path="/connect"
              element={DEMO_ONLY ? <Navigate to="/dashboard" replace /> : <Connect />}
            />
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
            <Route path="/privacy-terms" element={<PrivacyTerms />} />
            <Route path="/privacy" element={<Navigate to="/privacy-terms" replace />} />
            <Route path="/terms" element={<Navigate to="/privacy-terms" replace />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </>
  );
}

export default function App() {
  return (
    <SnackbarProvider>
      <AppContent />
    </SnackbarProvider>
  );
}
