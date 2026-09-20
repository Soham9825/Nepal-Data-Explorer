import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../services/auth";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!token) {
        setState("error");
        setMessage("This verification link is invalid. Please request a new verification email.");
        return;
      }
      try {
        const result = await auth.verifyEmail(token);
        if (result.access) auth.storeTokens(result);
        setState("success");
        navigate("/national", { replace: true });
      } catch (err) {
        setState("error");
        setMessage(err.message || "This verification link is invalid or has expired. Please request a new one.");
      }
    })();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#fdf2f2] via-[#f8f9fa] to-[#eef2f7]">
      <div className="bg-white shadow-xl rounded-2xl p-10 w-full max-w-[460px] text-center">
        {state === "loading" && (
          <>
            <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-2 border-red-200 border-t-red-600" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-black mb-2">Verifying your email</h1>
            <p className="text-gray-600">Please wait a moment...</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-100" aria-hidden="true">
              <svg className="h-7 w-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black mb-2">Email verified</h1>
            <p className="text-gray-600 mb-8">Your email address has been verified successfully. Redirecting to the dashboard...</p>
          </>
        )}

        {state === "error" && (
          <>
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-100" aria-hidden="true">
              <svg className="h-7 w-7 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black mb-2">Verification failed</h1>
            <p className="text-gray-600 mb-8">{message}</p>
            <Link
              to="/login"
              className="inline-block w-full rounded-lg bg-red-600 hover:bg-red-700 p-3 font-semibold text-white"
            >
              Go to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}