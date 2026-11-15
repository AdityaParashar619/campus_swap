import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI, getApiErrorMessage } from '../services/api';
import { createPasswordResetOtpPayload } from '../utils/passwordResetOtp';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await authAPI.forgotPassword({ email });
      setMessage(response.data.message);
      setRequested(true);
      if (response.data.devMailPreviewToken) {
        const preview = await authAPI.previewDevelopmentMail(response.data.devMailPreviewToken);
        setOtp(preview.data.code || '');
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to request a password reset.'));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const response = await authAPI.verifyPasswordResetOtp(createPasswordResetOtpPayload(email, otp));
      navigate('/reset-password', { state: { authorization: response.data.resetAuthorization } });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to verify the code.'));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.form onSubmit={requested ? verify : submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="premium-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-2">Forgot Password</h1>
        <p className="text-body-sm mb-6">Enter your registered student email to receive a password-reset code.</p>
        <input type="email" required readOnly={requested} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@satiengg.in" autoComplete="email" className="w-full px-4 py-3 rounded-xl border border-slate-300/30 mb-4" />
        {!requested && <button disabled={loading} className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 text-white font-semibold disabled:opacity-50">{loading ? 'Requesting...' : 'Send Reset Code'}</button>}
        {requested && <>
          <p role="status" className="text-body-sm mb-4">{message}</p>
          <label className="block text-sm font-medium mb-4">Six-digit code<input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-300/30" /></label>
          <button type="submit" disabled={loading || otp.length !== 6} className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 text-white font-semibold disabled:opacity-50">{loading ? 'Verifying...' : 'Verify Code'}</button>
        </>}
        {error && <p className="text-sm mt-4 text-red-600">{error}</p>}
        <Link to="/login" className="text-sm text-blue-600 mt-4 inline-block">Back to Login</Link>
      </motion.form>
    </div>
  );
}
