import { Navigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth } from "../services/auth";
import NotFound from "../pages/NotFound";

export default function AdminRoute({ children }) {
  const [state, setState] = useState(() => {
    const cached = auth.getCachedUser();
    if (cached) {
      return cached.is_staff || cached.is_superuser ? "admin" : "user";
    }
    return auth.getAccessToken() ? "rechecking" : "guest";
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    auth
      .getCurrentUser()
      .then((user) => {
        if (!mounted) return;
        setState(user && (user.is_staff || user.is_superuser) ? "admin" : user ? "user" : "guest");
      })
      .catch((err) => {
        console.warn("Admin check failed", err);
        if (mounted && !auth.getCachedUser()) setError(err);
      });
    return () => (mounted = false);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded shadow p-6 max-w-lg text-center">
          <h3 className="text-lg font-bold mb-2">Unable to verify session</h3>
          <p className="text-sm text-gray-600 mb-4">The application could not contact the authentication service.</p>
          <div className="flex justify-center gap-3">
            <button
              className="px-4 py-2 bg-primary text-white rounded"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            <Link to="/login" className="px-4 py-2 border rounded">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state === "guest") return <Navigate to="/login" replace />;
  if (state === "user") return <NotFound />;
  return children;
}