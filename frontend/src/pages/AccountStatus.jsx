import { Link, useLocation } from 'react-router-dom';

export default function AccountStatus() {
  const { state } = useLocation();
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><section className="max-w-lg bg-white rounded-2xl shadow p-8 text-center"><h1 className="text-2xl font-bold text-slate-900">Account review pending</h1><p className="mt-3 text-slate-600">{state?.message || 'Your account is awaiting institutional review.'}</p><Link to="/login" className="inline-block mt-6 rounded-lg bg-indigo-600 px-5 py-3 text-white font-semibold">Return to login</Link></section></main>;
}
