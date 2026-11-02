import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authAPI, getApiErrorMessage } from '../services/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await authAPI.resetPassword({ token: params.get('token'), password });
      setMessage('Password updated. You can login now.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to reset password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="premium-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
        <p className="text-body-sm mb-6">Set a new secure password for your account.</p>
        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="w-full px-4 py-3 rounded-xl border border-slate-300/30 mb-4" />
        <button disabled={loading} className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 text-white font-semibold disabled:opacity-50">{loading ? 'Updating...' : 'Update Password'}</button>
        <p className="text-body-sm mt-4">{message}</p>
        {error && <p className="text-sm mt-4 text-red-600">{error}</p>}
      </motion.form>
    </div>
  );
}
