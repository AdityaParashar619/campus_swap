import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authAPI, getApiErrorMessage } from '../services/api';

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [devOtp, setDevOtp] = useState(location.state?.devOtp || '');

  useEffect(() => {
    if (!countdown) return undefined;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const verify = async (event) => {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const response = await authAPI.verifyEmail({ email, otp });
      login(response.data.user, response.data.token);
      navigate('/dashboard');
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Verification failed')); }
    finally { setLoading(false); }
  };

  const resend = async () => {
    setError('');
    try { const response = await authAPI.resendOtp({ email }); setDevOtp(response.data.devOtp || ''); setCountdown(60); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not resend code')); }
  };

  return <main className="min-h-screen bg-indigo-50 flex items-center justify-center p-4"><section className="w-full max-w-md bg-white rounded-2xl p-7 shadow-lg"><h1 className="text-2xl font-bold">Verify your college email</h1><p className="text-slate-600 mt-2 mb-5">Enter the six digit code sent to your email.</p>{devOtp && <p className="text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded mb-4">Development email preview code: <strong>{devOtp}</strong></p>}{error && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded mb-4">{error}</p>}<form onSubmit={verify} className="space-y-4"><label className="block text-sm font-medium">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1 w-full border rounded-lg px-3 py-2" /></label><label className="block text-sm font-medium">Verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required className="mt-1 w-full border rounded-lg px-3 py-2 tracking-[0.4em]" /></label><button disabled={loading} className="w-full rounded-lg bg-indigo-600 text-white font-bold py-3 disabled:opacity-50">{loading ? 'Verifying…' : 'Verify and continue'}</button></form><button type="button" disabled={countdown > 0} onClick={resend} className="w-full mt-4 text-indigo-700 disabled:text-slate-400">{countdown ? `Resend code in ${countdown}s` : 'Resend code'}</button><Link to="/signup" className="block text-center text-sm text-indigo-700 mt-4">Back to registration</Link></section></main>;
}
