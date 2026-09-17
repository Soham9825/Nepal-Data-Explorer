import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { auth } from "../services/auth";
import { API_BASE_URL } from "../config";

const OAUTH_URL = `${API_BASE_URL}/accounts`;

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" />
    <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.75 9.75 0 0 0 12 21.75Z" />
    <path fill="#FBBC05" d="M6.53 13.83A5.86 5.86 0 0 1 6.22 12c0-.64.11-1.26.31-1.83V7.64H3.28A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.03 4.36l3.25-2.53Z" />
    <path fill="#EA4335" d="M12 6.14c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.2 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.72 5.39l3.25 2.53C7.3 7.86 9.46 6.14 12 6.14Z" />
  </svg>
);

const GithubLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.03c-3.22.7-3.9-1.37-3.9-1.37-.52-1.3-1.25-1.65-1.25-1.65-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.57-.29-5.28-1.29-5.28-5.73 0-1.27.45-2.3 1.2-3.11-.12-.3-.52-1.47.11-3.06 0 0 .98-.31 3.17 1.19a10.98 10.98 0 0 1 5.76 0c2.2-1.5 3.17-1.19 3.17-1.19.63 1.59.23 2.76.11 3.06.75.81 1.2 1.84 1.2 3.11 0 4.45-2.71 5.43-5.29 5.72.42.36.78 1.08.78 2.18v3.23c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
  </svg>
);

const STUPA_PHOTO = "https://commons.wikimedia.org/wiki/Special:FilePath/Boudhanath%20stupa%2C%20Kathmandu%2001.jpg";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get("oauth");
    const oauthError = params.get("oauth_error");

    if (oauthError) {
      window.history.replaceState({}, document.title, "/login");
      const message = oauthError === "database_unavailable"
        ? "Google sign-in reached the server, but the database is unavailable. Please start PostgreSQL or restore the Neon connection."
        : oauthError === "provider_token_failed"
          ? "Google did not return an access token. Check the OAuth client configuration."
          : oauthError === "token_invalid_grant"
            ? "Google rejected the sign-in code. Check that the redirect URI exactly matches Google Cloud Console, then try again."
            : oauthError === "token_invalid_client"
              ? "Google rejected the OAuth client credentials. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
              : oauthError === "provider_unreachable"
                ? "The backend could not reach Google. Check your internet connection or firewall."
                : oauthError === "provider_not_configured"
                  ? "GitHub sign-in is not configured yet. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to the backend environment."
          : `Google sign-in failed: ${oauthError}`;
      alert(message);
      return;
    }

    if (oauthResult !== "success") return;

    const oauthCode = params.get("code");
    if (!oauthCode) {
      alert("Google sign-in did not return an authentication token.");
      window.history.replaceState({}, document.title, "/login");
      return;
    }
    setLoading(true);
    window.history.replaceState({}, document.title, "/login");
    auth.exchangeOAuthCode(oauthCode)
      .then((user) => {
        auth.storeTokens(user);
        navigate("/national", { replace: true });
      })
      .catch((err) => alert(err.message || "Google sign-in failed"))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogin = (e) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);
    (async () => {
      try {
        await auth.login({ username: email, password });
        navigate("/national");
      } catch (err) {
        setFormError(err.message || "Login failed");
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="nepal-auth min-h-screen grid md:grid-cols-2" style={{ background: "var(--snow)" }}>
      <style>{`
        .nepal-auth {
          --crimson: #C81E3A;
          --crimson-deep: #A5152E;
          --snow: #FAFAF8;
          --stone: #8B8378;
          --ink: #171512;
          --navy: #131b2e;
          font-family: 'Hanken Grotesk', sans-serif;
        }
        .nepal-auth .display { font-family: inherit; letter-spacing: -0.02em; font-weight: 700; }
        .field {
          width: 100%;
          border: none;
          border-bottom: 1px solid rgba(23,21,18,0.16);
          background: transparent;
          padding: 10px 2px;
          font-size: 14px;
          transition: border-color 0.15s ease;
        }
        .field:focus { outline: none; border-bottom-color: var(--crimson); box-shadow: 0 1px 0 var(--crimson); }
        .field::placeholder { color: rgba(23,21,18,0.32); }
      `}</style>

      {/* Left: photo */}
      <div
        className="hidden md:flex relative flex-col justify-between px-12 py-10"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(10,9,8,0.15) 0%, rgba(10,9,8,0.05) 40%, rgba(10,9,8,0.75) 100%), url(${STUPA_PHOTO})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex items-center">
          <span className="text-white text-base font-bold tracking-tight">Nepal Data <span className="text-white/70">Explorer</span></span>
        </div>
        <div className="max-w-xs">
          <p className="text-white/90 text-sm leading-relaxed">
            A national dashboard for Nepal's economy, tourism and demographics.
          </p>
          <p className="text-white/45 text-xs mt-4">Boudhanath Stupa, Kathmandu</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex justify-center items-center px-6 py-16">
        <form onSubmit={handleLogin} className="w-full max-w-[390px] rounded-2xl border border-black/[0.07] bg-white p-8 shadow-[0_20px_60px_rgba(23,21,18,0.08)] sm:p-10">
          <h2 className="display text-2xl" style={{ color: "var(--ink)" }}>Welcome back</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--stone)" }}>Sign in to continue.</p>

          <div className="mt-10">
            <input
              type="text"
              placeholder="Username or email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="mt-6 relative">
            <input
              type={show ? "text" : "password"}
              placeholder="Password"
              className="field pr-8"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2"
              style={{ color: "var(--stone)" }}
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {formError && (
            <p
              className="mt-4 rounded-md px-3 py-2.5 text-sm font-medium"
              role="alert"
              style={{ background: "rgba(200,30,58,0.08)", color: "var(--crimson-deep)" }}
            >
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-10 flex w-full items-center justify-center gap-2 rounded p-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: loading ? "var(--crimson-deep)" : "var(--crimson)" }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "var(--crimson-deep)")}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = "var(--crimson)")}
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                Signing in
              </>
            ) : (
              "Sign in"
            )}
          </button>

          <Link to="/forgot-password" className="mt-4 block text-center text-xs font-medium hover:underline" style={{ color: "var(--crimson)" }}>
            Forgot password?
          </Link>

          <div className="mt-8 flex items-center gap-3 text-xs" style={{ color: "var(--stone)" }}>
            <span className="h-px flex-1" style={{ background: "rgba(23,21,18,0.1)" }} />
            <span>or</span>
            <span className="h-px flex-1" style={{ background: "rgba(23,21,18,0.1)" }} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <a
              href={`${OAUTH_URL}/oauth/google/`}
              className="flex items-center justify-center gap-2 rounded border p-2.5 text-xs transition hover:border-black/25"
              style={{ borderColor: "rgba(23,21,18,0.14)", color: "var(--ink)" }}
            >
              <GoogleLogo /> Google
            </a>
            <a
              href={`${OAUTH_URL}/oauth/github/`}
              className="flex items-center justify-center gap-2 rounded border p-2.5 text-xs transition hover:border-black/25"
              style={{ borderColor: "rgba(23,21,18,0.14)", color: "var(--ink)" }}
            >
              <GithubLogo /> GitHub
            </a>
          </div>

          <p className="mt-9 text-center text-sm" style={{ color: "var(--stone)" }}>
            Don't have an account?{" "}
            <Link to="/signup" className="font-medium hover:underline" style={{ color: "var(--crimson)" }}>
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}