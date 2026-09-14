import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import Loader from "../components/common/Loader";

const National = lazy(() => import("../pages/National"));
const Economic = lazy(() => import("../pages/Economic"));
const Tourism = lazy(() => import("../pages/Tourism"));
const Predictions = lazy(() => import("../pages/Predictions"));
const Compare = lazy(() => import("../pages/Compare"));
const Provinces = lazy(() => import("../pages/Provinces"));
const News = lazy(() => import("../pages/News"));
const Reports = lazy(() => import("../pages/Reports"));
const Research = lazy(() => import("../pages/Research"));
const Login = lazy(() => import("../pages/Login"));
const Signup = lazy(() => import("../pages/Signup"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const VerifyOtp = lazy(() => import("../pages/VerifyOtp"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const Support = lazy(() => import("../pages/Support"));
const NotFound = lazy(() => import("../pages/NotFound"));
const CSVExplorer = lazy(() => import("../pages/CSVExplorer"));

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader fullScreen />}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <National />
              </ProtectedRoute>
            }
          />
          <Route
            path="/national"
            element={
              <ProtectedRoute>
                <National />
              </ProtectedRoute>
            }
          />
          <Route
            path="/economic"
            element={
              <ProtectedRoute>
                <Economic />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tourism"
            element={
              <ProtectedRoute>
                <Tourism />
              </ProtectedRoute>
            }
          />
          <Route
            path="/predictions"
            element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare"
            element={
              <ProtectedRoute>
                <Compare />
              </ProtectedRoute>
            }
          />
          <Route
            path="/provinces"
            element={
              <ProtectedRoute>
                <Provinces />
              </ProtectedRoute>
            }
          />
          <Route
            path="/provinces/:id"
            element={
              <ProtectedRoute>
                <Provinces />
              </ProtectedRoute>
            }
          />
          <Route
            path="/news"
            element={
              <ProtectedRoute>
                <News />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/research"
            element={
              <ProtectedRoute>
                <Research />
              </ProtectedRoute>
            }
          />
          <Route
            path="/support"
            element={
              <ProtectedRoute>
                <Support />
              </ProtectedRoute>
            }
          />
          <Route
            path="/csv-explorer"
            element={
              <ProtectedRoute>
                <CSVExplorer />
              </ProtectedRoute>
            }
          />

          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}