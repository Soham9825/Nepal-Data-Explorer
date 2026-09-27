import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";
import DashboardLayout from "../components/layout/DashboardLayout";

import National from "../pages/National";
import Economic from "../pages/Economic";
import Tourism from "../pages/Tourism";
import Predictions from "../pages/Predictions";
import Compare from "../pages/Compare";
import Provinces from "../pages/Provinces";
import News from "../pages/News";
import Reports from "../pages/Reports";
import Research from "../pages/Research";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import ForgotPassword from "../pages/ForgotPassword";
import VerifyOtp from "../pages/VerifyOtp";
import ResetPassword from "../pages/ResetPassword";
import VerifyEmail from "../pages/VerifyEmail";
import Support from "../pages/Support";
import Admin from "../pages/Admin";
import NotFound from "../pages/NotFound";

import CSVExplorer from "../pages/CSVExplorer";
import Hotels from "../pages/Hotels";

const PAGE_TITLES = {
  "/": "National Dashboard",
  "/national": "National Dashboard",
  "/economic": "Economic Data",
  "/tourism": "Tourism",
  "/predictions": "AI Predictions",
  "/compare": "Compare Indicators",
  "/provinces": "Province Explorer",
  "/provinces/:id": "Province Explorer",
  "/news": "National Headlines",
  "/reports": "Reports & Exports",
  "/research": "Research Data Access",
  "/support": "Support & Help",
  "/admin": "Admin Panel",
  "/csv-explorer": "CSV Explorer",
  "/hotels": "Hotel Intelligence",
};

// Persistent shell: the sidebar and topbar stay mounted while the
// routed page below them swaps, so navigating never looks like a reload.
function ProtectedLayout({ children }) {
  const { pathname } = useLocation();
  const pageTitle =
    PAGE_TITLES[pathname] ||
    (/^\/provinces\//.test(pathname) ? "Province Explorer" : PAGE_TITLES["/"]);

  return <DashboardLayout pageTitle={pageTitle}>{children}</DashboardLayout>;
}

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <ProtectedLayout>{children}</ProtectedLayout>
    </ProtectedRoute>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Protected>
              <National />
            </Protected>
          }
        />
        <Route
          path="/national"
          element={
            <Protected>
              <National />
            </Protected>
          }
        />
        <Route
          path="/economic"
          element={
            <Protected>
              <Economic />
            </Protected>
          }
        />
        <Route
          path="/tourism"
          element={
            <Protected>
              <Tourism />
            </Protected>
          }
        />
        <Route
          path="/predictions"
          element={
            <Protected>
              <Predictions />
            </Protected>
          }
        />
        <Route
          path="/compare"
          element={
            <Protected>
              <Compare />
            </Protected>
          }
        />
        <Route
          path="/provinces"
          element={
            <Protected>
              <Provinces />
            </Protected>
          }
        />
        <Route
          path="/provinces/:id"
          element={
            <Protected>
              <Provinces />
            </Protected>
          }
        />
        <Route
          path="/news"
          element={
            <Protected>
              <News />
            </Protected>
          }
        />
        <Route
          path="/reports"
          element={
            <Protected>
              <Reports />
            </Protected>
          }
        />
        <Route
          path="/research"
          element={
            <Protected>
              <Research />
            </Protected>
          }
        />
        <Route
          path="/support"
          element={
            <Protected>
              <Support />
            </Protected>
          }
        />

       <Route
        path="/csv-explorer"
        element={
          <Protected>
            <CSVExplorer />
          </Protected>
        }
        />

        <Route
          path="/hotels"
          element={
            <Protected>
              <Hotels />
            </Protected>
          }
        />

        {/* Admin-only route (non-admins see the 404 page) */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <ProtectedLayout>
                <Admin />
              </ProtectedLayout>
            </AdminRoute>
          }
        />

        {/* Public route */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}