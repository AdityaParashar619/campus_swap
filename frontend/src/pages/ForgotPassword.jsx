import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const response = await authAPI.forgotPassword({ email });
    setMessage(response.data.data?.resetUrl ? `Reset link: ${response.data.data.resetUrl}` : response.data.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="premium-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-2">Forgot Password</h1>
        <p className="text-body-sm mb-6">We will generate a reset link for your account.</p>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" className="w-full px-4 py-3 rounded-xl border border-slate-300/30 mb-4" />
        <button className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 text-white font-semibold">Generate Reset Link</button>
        <p className="text-body-sm mt-4 break-all">{message}</p>
        <Link to="/login" className="text-sm text-blue-600 mt-4 inline-block">Back to Login</Link>
      </motion.form>
    </div>
  );
}
