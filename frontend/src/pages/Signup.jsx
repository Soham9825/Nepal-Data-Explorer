import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../services/auth";

export default function Signup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await auth.signup({ username, email, password, confirm_password: confirm });
      navigate('/national');
    } catch (err) {
      alert(err.message || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-gray-100">
      <div className="hidden md:flex flex-col justify-center bg-white px-16">
        <h1 className="text-4xl font-bold">Create an account</h1>
        <p className="text-gray-500">Join Nepal Data Explorer</p>
      </div>

      <div className="flex justify-center items-center">
        <form onSubmit={handleSignup} className="bg-white shadow-xl rounded-2xl p-10 w-[420px]">
          <h2 className="text-3xl font-bold mb-2">Sign Up</h2>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" className="w-full border rounded-lg p-3 mb-3" />
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" className="w-full border rounded-lg p-3 mb-3" />
          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" className="w-full border rounded-lg p-3 mb-3" />
          <input value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirm Password" type="password" className="w-full border rounded-lg p-3 mb-3" />
          <button type="submit" className="w-full mt-4 bg-red-700 hover:bg-red-800 text-white p-3 rounded-lg font-semibold">Create Account</button>
        </form>
      </div>
    </div>
  );
}
