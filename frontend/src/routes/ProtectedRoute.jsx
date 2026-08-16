import { Navigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth } from "../services/auth";
import Loader from "../components/common/Loader";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await auth.getCurrentUser();
        if (!mounted) return;
        setAuthed(!!user);
      } catch (err) {
        console.warn('Auth check failed', err);
        if (!mounted) return;
        setError(err);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  if (loading) return <Loader fullScreen />;

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

  if (!authed) return <Navigate to="/login" replace />;
  return children;
}