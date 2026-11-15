import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function AccountStatus() {
  const { state } = useLocation();
  const [previewUrl, setPreviewUrl] = useState('');
  const consumedPreview = useRef(false);
  useEffect(() => {
    if (!state?.devMailPreviewToken || consumedPreview.current) return;
    consumedPreview.current = true;
    authAPI.previewDevelopmentMail(state.devMailPreviewToken).then((response) => setPreviewUrl(response.data.url || '')).catch(() => {});
  }, [state?.devMailPreviewToken]);
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><section className="max-w-lg bg-white rounded-2xl shadow p-8 text-center"><h1 className="text-2xl font-bold text-slate-900">Account review pending</h1><p className="mt-3 text-slate-600">{state?.message || 'Your account is awaiting institutional review.'}</p>{previewUrl && <a href={previewUrl} className="mt-4 inline-block break-all text-indigo-700 underline">Open local captured alumni verification email</a>}<Link to="/login" className="inline-block mt-6 rounded-lg bg-indigo-600 px-5 py-3 text-white font-semibold">Return to login</Link></section></main>;
}
