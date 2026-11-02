import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI, getApiErrorMessage } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await authAPI.forgotPassword({ email });
      setMessage(response.data.message);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to request a password reset.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="premium-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-2">Forgot Password</h1>
        <p className="text-body-sm mb-6">Enter your email to request password reset instructions.</p>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" className="w-full px-4 py-3 rounded-xl border border-slate-300/30 mb-4" />
        <button disabled={loading} className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 text-white font-semibold disabled:opacity-50">{loading ? 'Requesting...' : 'Request Reset Instructions'}</button>
        <p className="text-body-sm mt-4 break-all">{message}</p>
        {error && <p className="text-sm mt-4 text-red-600">{error}</p>}
        <Link to="/login" className="text-sm text-blue-600 mt-4 inline-block">Back to Login</Link>
      </motion.form>
    </div>
  );
}
