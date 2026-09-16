
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center">
      <div className="surface-panel rounded-3xl px-8 py-10 max-w-lg w-full">
        <h1 className="text-7xl font-bold text-primary leading-none">404</h1>
        <p className="mt-3 text-lg font-semibold text-onSurface">Page Not Found</p>
        <p className="mt-2 text-sm text-onSurface-variant">
          The page you are looking for does not exist or has been moved.
        </p>

        <Link
          to="/"
          className="ui-button mt-6 inline-flex px-5 py-2.5 bg-primary text-white rounded-sm"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}