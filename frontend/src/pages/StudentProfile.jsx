import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { connectionAPI } from '../services/api';
import { getConnectionActionState } from '../utils/connectionView';

const getInitials = (name) => name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

export default function StudentProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await connectionAPI.getStudent(id);
      setStudent(response.data.data?.student || null);
      setConnection(response.data.data?.connection || null);
    } catch (requestError) {
      setError(requestError.userMessage || 'Could not load this student profile.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const actionState = getConnectionActionState({ connection, isSelf: id === user?.id, restricted: Boolean(error) });
  const mutate = async (action) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (action === 'connect') await connectionAPI.create(id);
      else await connectionAPI.respond(connection.id, action === 'accept' ? 'accepted' : 'rejected');
      await load();
    } catch (requestError) {
      setError(requestError.userMessage || 'Could not update this connection.');
    } finally { setBusy(false); }
  };

  return <PageTransition><Layout><main className="section-container py-6 sm:py-10">
    {loading ? <div className="grid gap-5 lg:grid-cols-[18rem_1fr]"><div className="skeleton h-72" /><div className="skeleton h-72" /></div> : error && !student ? <PremiumCard hover={false}><div role="alert" className="text-center"><p className="text-rose-700 dark:text-rose-200">{error}</p><Button className="mt-4" onClick={load}>Retry</Button></div></PremiumCard> : student && <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <PremiumCard hover={false} className="text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-2xl bg-blue-600 text-3xl font-black text-white">{student.profilePicture ? <img src={student.profilePicture} alt="" className="h-full w-full object-cover" /> : getInitials(student.name)}</div>
        <h1 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">{student.name}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{student.course || 'Student'} {student.yearSemester || ''}</p>
        {student.isVerifiedStudent && <p className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">Verified student</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {actionState === 'connect' && <Button size="sm" disabled={busy} onClick={() => mutate('connect')}>{busy ? 'Sending…' : 'Connect'}</Button>}
          {actionState === 'outgoing' && <Button size="sm" variant="secondary" disabled>Request Sent</Button>}
          {actionState === 'incoming' && <><Button size="sm" disabled={busy} onClick={() => mutate('accept')}>Accept</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => mutate('decline')}>Decline</Button></>}
          {actionState === 'connected' && <Button size="sm" variant="secondary" disabled>Connected</Button>}
          {actionState === 'self' && <Link to="/profile" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white">Edit profile</Link>}
          {actionState !== 'self' && <Link to="/chat" state={{ selectedUserId: student._id }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 dark:border-slate-600 dark:text-slate-100">Open chat</Link>}
        </div>
      </PremiumCard>
      <div className="space-y-5">
        {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}
        <PremiumCard hover={false}><h2 className="text-feature-title">About</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{student.bio || 'This student has not added a bio yet.'}</p><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Institution</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{student.collegeName || 'CampusSwap'}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Academic information</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{[student.course, student.yearSemester].filter(Boolean).join(' · ') || 'Not provided'}</dd></div></dl></PremiumCard>
        <div className="grid gap-5 md:grid-cols-2"><PremiumCard hover={false}><h2 className="font-black text-slate-950 dark:text-white">Skills</h2><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{student.skills?.length ? student.skills.join(' · ') : 'No skills listed.'}</p></PremiumCard><PremiumCard hover={false}><h2 className="font-black text-slate-950 dark:text-white">Interests</h2><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{student.interests?.length ? student.interests.join(' · ') : 'No interests listed.'}</p></PremiumCard></div>
        {(student.phoneNumber || student.whatsappNumber) && <PremiumCard hover={false}><h2 className="font-black text-slate-950 dark:text-white">Shared contact details</h2><div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">{student.phoneNumber && <p>Phone: {student.phoneNumber}</p>}{student.whatsappNumber && <p>WhatsApp: {student.whatsappNumber}</p>}</div></PremiumCard>}
      </div>
    </div>}
  </main></Layout></PageTransition>;
}
