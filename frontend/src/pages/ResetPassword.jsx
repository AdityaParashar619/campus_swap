import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { authAPI, getApiErrorMessage } from '../services/api';
import { consumeTokenFragment } from '../utils/securityLinks';
import { Link, useLocation } from 'react-router-dom';
import { getPasswordPolicy, isPasswordStrong } from '../utils/passwordPolicy';

export default function ResetPassword() {
  const location = useLocation();
  const [token, setToken] = useState('');
  const tokenConsumed = useRef(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordPolicy = getPasswordPolicy(password);

  useEffect(() => {
    if (tokenConsumed.current) return;
    tokenConsumed.current = true;
    setToken(location.state?.authorization || consumeTokenFragment(window.location.hash, window.location, window.history));
  }, [location.state]);

  const submit = async (e) => {
    e.preventDefault();
    if (!isPasswordStrong(password)) {
      setError('Password must be 8–128 characters and include uppercase, lowercase, a number, and a special character.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await authAPI.resetPassword({ token, password });
      setMessage('Password updated successfully. Sign in with your new password.');
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
        {!message && <><label className="block text-sm font-medium mb-2">New password<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" aria-describedby="reset-password-policy" className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-300/30" /><span id="reset-password-policy" className="mt-2 block text-xs font-normal text-slate-600">Use 8–128 characters with uppercase, lowercase, a number, and a special character.</span><ul className="mt-1 grid grid-cols-2 gap-x-2 text-xs font-normal" aria-live="polite">{[['minLength', '8+ characters'], ['uppercase', 'Uppercase letter'], ['lowercase', 'Lowercase letter'], ['number', 'Number'], ['special', 'Special character']].map(([rule, label]) => <li key={rule} className={passwordPolicy[rule] ? 'text-green-700' : 'text-slate-500'}>{passwordPolicy[rule] ? '✓' : '○'} {label}</li>)}</ul></label><label className="block text-sm font-medium mb-4">Confirm new password<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Enter the password again" className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-300/30" /></label><button disabled={loading || !token} className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 text-white font-semibold disabled:opacity-50">{loading ? 'Updating...' : 'Update Password'}</button></>}
        {message && <><p role="status" className="text-body-sm mt-4">{message}</p><Link to="/login" className="mt-5 inline-block w-full text-center px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold">Go to Login</Link></>}
        {error && <p className="text-sm mt-4 text-red-600">{error}</p>}
      </motion.form>
    </div>
  );
}
