import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

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
import Support from "../pages/Support";
import NotFound from "../pages/NotFound";

export default function AppRoutes() {
  return (
    <BrowserRouter>
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

        {/* Public route */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}