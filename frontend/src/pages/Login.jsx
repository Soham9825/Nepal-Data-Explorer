import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, BarChart3, MapPinned } from "lucide-react";
import { auth } from "../services/auth";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    (async () => {
      try {
        await auth.login({ username: email, password });
        navigate("/national");
      } catch (err) {
        alert(err.message || 'Login failed');
      }
    })();
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-gray-100">
      {/* Left */}
      <div className="hidden md:flex flex-col justify-center bg-white px-16">
        <div className="flex items-center gap-3">
          <div className="bg-red-700 p-3 rounded-xl">
            <MapPinned className="text-white" />
          </div>

          <div>
            <h1 className="text-4xl font-bold">Nepal Data Explorer</h1>
            <p className="text-gray-500">National Data Intelligence Platform</p>
          </div>
        </div>

        <div className="mt-12 space-y-6">
          <div className="bg-gray-50 rounded-xl p-5 shadow">
            <BarChart3 className="text-red-700 mb-2" />
            <h3 className="font-semibold">National Analytics</h3>
            <p className="text-gray-500 text-sm">
              Explore real-time national statistics and insights.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-5 shadow">
            <h3 className="font-semibold">AI Predictions</h3>
            <p className="text-gray-500 text-sm">
              Forecast future economic and social indicators.
            </p>
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex justify-center items-center">
        <form
          onSubmit={handleLogin}
          className="bg-white shadow-xl rounded-2xl p-10 w-[420px]"
        >
          <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
          <p className="text-gray-500 mb-8">Login to continue</p>

          <input
            type="email"
            placeholder="Email Address"
            className="w-full border rounded-lg p-3 mb-5 focus:outline-red-700"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="relative">
            <input
              type={show ? "text" : "password"}
              placeholder="Password"
              className="w-full border rounded-lg p-3 pr-12 focus:outline-red-700"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              className="absolute right-4 top-4"
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            className="w-full mt-8 bg-red-700 hover:bg-red-800 text-white p-3 rounded-lg font-semibold transition"
          >
            Sign In
          </button>

          <p className="text-center mt-8 text-gray-500 text-sm">
            © Nepal Data Explorer 2026
          </p>
        </form>
      </div>
    </div>
  );
}