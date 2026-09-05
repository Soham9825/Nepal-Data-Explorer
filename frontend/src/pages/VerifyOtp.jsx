import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, MapPinned, ShieldCheck } from "lucide-react";
import { auth } from "../services/auth";

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || "";
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!email) navigate("/forgot-password", { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async (event) => {
    event.preventDefault();
    setError("");
    if (otp.length !== 6) return setError("Please enter the 6-digit code");
    setLoading(true);
    try {
      const result = await auth.verifyPasswordResetOtp(email, otp);
      navigate("/reset-password", { replace: true, state: { resetToken: result.reset_token } });
    } catch (err) {
      setError(err.message || "Invalid or expired reset code");
    } finally {
      setLoading(false);
    }
  };


  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    try {
      await auth.requestPasswordReset(email);
      setResendCooldown(60);
      setError("");
    } catch (err) {
      setError(err.message || "Could not resend reset code");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#fdf2f2] via-[#f8f9fa] to-[#eef2f7]">
      <form onSubmit={handleVerify} className="bg-white shadow-xl rounded-2xl p-10 w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-red-600 p-3 rounded-xl"><MapPinned className="text-white" /></div>
          <div><h1 className="text-2xl font-bold text-black">Nepal Data Explorer</h1><p className="text-gray-600 text-sm">National Data Intelligence Platform</p></div>
        </div>
        <div className="flex justify-center mb-4"><div className="bg-blue-50 p-4 rounded-full"><ShieldCheck size={40} className="text-blue-600" /></div></div>
        <h2 className="text-3xl font-bold mb-2 text-black text-center">Verify OTP</h2>
        <p className="text-gray-600 mb-8 text-center">Enter the 6-digit code sent to <span className="font-semibold text-black">{email}</span></p>
        {error && <p className="flex items-center gap-2 text-red-700 text-sm font-medium mb-5 p-3 bg-red-50 rounded-lg border border-red-200" role="alert"><AlertCircle size={16} /><span>{error}</span></p>}
        <input ref={inputRef} type="text" inputMode="numeric" placeholder="••••••" className="w-full border rounded-lg p-3 text-center text-2xl tracking-[0.5em] font-bold" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={loading} autoComplete="one-time-code" maxLength={6} />
        <button type="submit" disabled={loading} className="w-full mt-8 bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white p-3 rounded-lg font-semibold">{loading ? "Verifying..." : "Verify OTP"}</button>
        <button type="button" onClick={handleResend} disabled={resendCooldown > 0 || resendLoading} className="w-full mt-5 text-sm font-semibold text-red-600 disabled:opacity-50">{resendLoading ? "Resending..." : resendCooldown ? `Resend code in ${resendCooldown}s` : "Resend code"}</button>
        <p className="text-center mt-6 text-gray-700 text-sm"><Link to="/forgot-password" className="font-semibold text-red-600 hover:underline">Back to Forgot Password</Link></p>
      </form>
    </div>
  );
}
