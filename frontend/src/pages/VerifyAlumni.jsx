import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authAPI, getApiErrorMessage } from '../services/api';

export default function VerifyAlumni() {
  const [params] = useSearchParams();
  const [message, setMessage] = useState('Verifying your email…');
  const [error, setError] = useState('');
  useEffect(() => {
    authAPI.verifyAlumniEmail({ email: params.get('email'), token: params.get('token') })
      .then((response) => setMessage(response.data.message))
      .catch((requestError) => { setError(getApiErrorMessage(requestError, 'Verification failed')); setMessage(''); });
  }, [params]);
  return <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4"><section className="max-w-md rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-2xl font-bold">Alumni email verification</h1>{message && <p className="mt-3 text-slate-600">{message}</p>}{error && <p role="alert" className="mt-3 text-rose-700">{error}</p>}<Link className="mt-6 inline-block text-indigo-700" to="/login">Continue to login</Link></section></main>;
}
