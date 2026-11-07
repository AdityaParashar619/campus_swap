import { useEffect, useState } from 'react';
import { adminAPI } from '../services/api';

const roles = ['student', 'alumni', 'faculty', 'department_coordinator', 'club_coordinator', 'grievance_officer', 'marketplace_moderator'];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [userResponse, verificationResponse] = await Promise.all([adminAPI.iamUsers({ q: query }), adminAPI.alumniVerifications()]);
      setUsers(userResponse.data.data || []); setVerifications(verificationResponse.data.data || []);
    } catch (requestError) { setError(requestError.userMessage || 'Could not load IAM data.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const changeStatus = async (user, status) => {
    const reason = window.prompt(`Reason for setting ${user.name} to ${status}:`);
    if (!reason?.trim()) return;
    try { await adminAPI.updateIamStatus(user.id, { status, reason }); await load(); }
    catch (requestError) { setError(requestError.userMessage || 'Could not update account status.'); }
  };
  const changeRole = async (user, role) => {
    if (role === user.role) return;
    const scope = ['department_coordinator', 'club_coordinator'].includes(role) ? window.prompt(`Enter configured ${role === 'department_coordinator' ? 'department' : 'club'} scope:`) : '';
    if (['department_coordinator', 'club_coordinator'].includes(role) && !scope?.trim()) return;
    try { await adminAPI.updateIamRole(user.id, { role, departmentScope: role === 'department_coordinator' ? scope : '', clubScope: role === 'club_coordinator' ? scope : '', reason: 'Authorized administrative role assignment' }); await load(); }
    catch (requestError) { setError(requestError.userMessage || 'Could not update role.'); }
  };
  const review = async (request, decision) => {
    const reason = decision === 'rejected' ? window.prompt('Reason for rejection:') : 'Institutional alumni review approved';
    if (decision === 'rejected' && !reason?.trim()) return;
    try { await adminAPI.reviewAlumni(request._id, { decision, reason }); await load(); }
    catch (requestError) { setError(requestError.userMessage || 'Could not review request.'); }
  };
  return <main className="section-container py-8 space-y-8"><header><h1 className="text-3xl font-black">Identity and access management</h1><p className="mt-2 text-slate-500">Search users, manage account status and review alumni requests.</p></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    <section className="premium-surface rounded-xl p-5"><h2 className="text-xl font-bold mb-4">Alumni verification queue</h2>{loading ? <p>Loading…</p> : verifications.length ? <div className="space-y-3">{verifications.map((request) => <article key={request._id} className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{request.user?.name} · {request.user?.email}</p><p className="text-sm text-slate-500">{request.department} · {request.branch} · Graduated {request.graduationYear}</p><p className="text-sm text-slate-500">{request.company} {request.jobTitle}</p><p className="text-xs text-emerald-700">Email verified</p></div><div className="flex gap-2"><button onClick={() => review(request, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-white">Approve</button><button onClick={() => review(request, 'rejected')} className="rounded-lg bg-rose-600 px-3 py-2 text-white">Reject</button></div></article>)}</div> : <p className="text-slate-500">No pending requests.</p>}</section>
    <section className="premium-surface rounded-xl p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl font-bold">Users</h2><form onSubmit={(event) => { event.preventDefault(); load(); }} className="flex gap-2"><label className="sr-only" htmlFor="user-search">Search users</label><input id="user-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or email" className="rounded-lg border px-3 py-2"/><button className="rounded-lg bg-indigo-600 px-4 py-2 text-white">Search</button></form></div>
      {loading ? <p className="py-5">Loading…</p> : <div className="mt-4 divide-y">{users.map((user) => <article key={user.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-bold">{user.name} <span className="font-normal text-slate-500">{user.email}</span></p><p className="text-sm text-slate-500">{user.accountType} · {user.verificationStatus} · {user.accountStatus}</p></div><div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor={`role-${user.id}`}>Role for {user.name}</label><select id={`role-${user.id}`} value={user.role} onChange={(event) => changeRole(user, event.target.value)} className="rounded border px-2 py-1">{roles.map((role) => <option key={role}>{role}</option>)}</select>{user.accountStatus === 'active' ? <button onClick={() => changeStatus(user, 'suspended')} className="rounded bg-amber-100 px-3 py-1 text-amber-900">Suspend</button> : <button onClick={() => changeStatus(user, 'active')} className="rounded bg-emerald-100 px-3 py-1 text-emerald-900">Reactivate</button>}<button onClick={() => changeStatus(user, 'blocked')} className="rounded bg-rose-100 px-3 py-1 text-rose-900">Block</button></div></article>)}</div>}</section>
  </main>;
}
