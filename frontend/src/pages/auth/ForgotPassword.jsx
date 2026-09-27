import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, MapPinned, Mail } from 'lucide-react';
import { auth } from '../../services/auth';

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      await auth.requestPasswordReset(email.trim());
      setLoading(false);
      setSuccess(true);
      navigate('/verify-otp', { state: { email: email.trim() } });
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Could not send reset code');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-gradient-to-br from-[#fdf2f2] via-[#f8f9fa] to-[#eef2f7]">
      {/* Red and blue accent glows */}
      <div
        className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(231, 76, 60, 0.08) 0%, transparent 70%)',
        }}
      ></div>
      <div
        className="absolute -bottom-32 -left-24 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(52, 152, 219, 0.08) 0%, transparent 70%)',
        }}
      ></div>

      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-xl rounded-2xl p-10 w-[420px] relative"
        style={{ boxShadow: '0 20px 60px rgba(255, 0, 0, 0.15), 0 0 40px rgba(52, 152, 219, 0.1)' }}
      >
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-red-600 p-3 rounded-xl">
            <MapPinned className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black">Nepal Data Explorer</h1>
            <p className="text-gray-600 text-sm">National Data Intelligence Platform</p>
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-2 text-black">Forgot Password</h2>
        <p className="text-gray-600 mb-8">
          Enter the email on your account and we'll send you a one-time code.
        </p>

        {error && (
          <p
            className="flex items-center gap-2 text-red-700 text-sm font-medium mb-5 p-3 bg-red-50 rounded-lg border border-red-200"
            role="alert"
          >
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {success && (
          <p
            className="flex items-center gap-2 text-green-700 text-sm font-medium mb-5 p-3 bg-green-50 rounded-lg border border-green-200"
            role="status"
          >
            <CheckCircle2 size={16} className="flex-shrink-0" />
            <span>If an account exists for {email}, a reset code has been sent.</span>
          </p>
        )}

        <label className="block text-sm font-semibold text-black mb-2">Email Address</label>
        <div className="relative">
          <Mail size={18} className="absolute left-4 top-4 text-gray-400" />
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full border rounded-lg p-3 pl-11 focus:outline-red-600 focus:ring-2 focus:ring-red-200 focus:shadow-[0_0_12px_rgba(52,152,219,0.15)] disabled:opacity-60 disabled:cursor-not-allowed"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="email"
          />
        </div>

        <button
          type="submit"
          className="w-full mt-8 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-70 disabled:cursor-not-allowed text-white p-3 rounded-lg font-semibold transition hover:shadow-[0_5px_15px_rgba(231,76,60,0.3),0_0_20px_rgba(52,152,219,0.2)] hover:-translate-y-0.5"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Reset Code'}
        </button>

        <p className="text-center mt-6 text-gray-700 text-sm">
          Remembered your password?{' '}
          <Link
            to="/login"
            className="font-semibold text-red-600 hover:text-blue-500 hover:underline"
          >
            Back to Sign In
          </Link>
        </p>

        <p className="text-center mt-8 text-gray-500 text-sm">© Nepal Data Explorer 2026</p>
      </form>
    </div>
  );
}
