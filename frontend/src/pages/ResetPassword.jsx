import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { auth } from "../services/auth";

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const resetToken = location.state?.resetToken || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!resetToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center"><p className="mb-4">Your reset session has expired.</p><Link className="text-red-600 underline" to="/forgot-password">Request a new code</Link></div>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");
    setLoading(true);
    try {
      await auth.confirmPasswordReset(resetToken, password);
      navigate("/login", { replace: true, state: { resetSuccess: true } });
    } catch (err) {
      setError(err.message || "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#fdf2f2] via-[#f8f9fa] to-[#eef2f7]">
      <form onSubmit={handleSubmit} className="bg-white shadow-xl rounded-2xl p-10 w-full max-w-[420px]">
        <h1 className="text-3xl font-bold text-black mb-2">Set a new password</h1>
        <p className="text-gray-600 mb-8">Your code was verified. Choose a new password for your account.</p>
        {error && <p className="text-red-700 text-sm mb-5 p-3 bg-red-50 rounded-lg" role="alert">{error}</p>}
        <div className="space-y-4">
          <input type="password" className="w-full border rounded-lg p-3" placeholder="New password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
          <input type="password" className="w-full border rounded-lg p-3" placeholder="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
        </div>
        <button type="submit" disabled={loading} className="w-full mt-8 bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white p-3 rounded-lg font-semibold">{loading ? "Saving..." : "Change password"}</button>
      </form>
    </div>
  );
}
