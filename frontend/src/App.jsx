import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";
import { LoadingScreen } from "./components/ui/LoadingScreen";
import MainLayout from "./components/layout/MainLayout";

import LoginPage         from "./pages/LoginPage";
import RegisterPage      from "./pages/RegisterPage";
import DashboardPage     from "./pages/DashboardPage";
import FarmsPage       from "./pages/FarmsPage";
import WeatherPage       from "./pages/WeatherPage";
import AnalyticsPage     from "./pages/AnalyticsPage";
import NotificationsPage from "./pages/NotificationsPage";
import AdminPage         from "./pages/AdminPage";
import SettingsPage      from "./pages/SettingsPage";
import AIPage from "./pages/AiPage";


function AuthGuard({ children }) {
  const { fbUser, dbUser, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <LoadingScreen />;

  if (!fbUser || !dbUser) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }

  return children;
}

function GuestGuard({ children }) {
  const { fbUser, dbUser, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (fbUser && dbUser) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AdminGuard({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<GuestGuard><LoginPage /></GuestGuard>} />
          <Route path="/register" element={<GuestGuard><RegisterPage /></GuestGuard>} />

          <Route path="/" element={<AuthGuard><MainLayout /></AuthGuard>}>
            <Route index                element={<DashboardPage />} />
            <Route path="farms"         element={<FarmsPage />} />
            <Route path="weather"       element={<WeatherPage />} />
            <Route path="analytics"     element={<AnalyticsPage />} />
            <Route path="ai"           element={<AIPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings"      element={<SettingsPage />} />
            <Route path="admin"         element={<AdminGuard><AdminPage /></AdminGuard>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "white",
            color: "#1A3028",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: "12px",
            fontFamily: "'DM Sans',sans-serif",
            fontSize: "0.875rem",
            fontWeight: 500,
            boxShadow: "0 4px 20px rgba(16,185,129,0.15)",
          },
          success: { iconTheme: { primary: "#10B981", secondary: "white" } },
          error:   { iconTheme: { primary: "#EF4444", secondary: "white" } },
          duration: 3500,
        }}
      />
    </AuthProvider>
  );
}

export default App;