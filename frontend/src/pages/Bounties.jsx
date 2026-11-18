import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { requestAPI } from '../services/api';
import { buildHelpChatState, getRequestAction } from '../utils/requestView';

const emptyForm = { title: '', description: '', category: 'Borrow', location: '' };
const getInitials = (name) => name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

export default function Bounties() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentUserId = user?.id || user?._id;

  const fetchRequests = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await requestAPI.getAll({ page: 1, limit: 50 });
      setRequests(response.data.data || []);
    } catch (error) {
      setLoadError(error.userMessage || 'Could not load community requests.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleCreateRequest = async (event) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setNotice({ type: '', text: '' });
    try {
      await requestAPI.create(formData);
      setFormData(emptyForm);
      setShowForm(false);
      setNotice({ type: 'success', text: 'Request published.' });
      await fetchRequests();
    } catch (error) {
      setNotice({ type: 'error', text: error.userMessage || 'Could not publish this request.' });
    } finally { setCreating(false); }
  };

  const closeRequest = async (request) => {
    if (busyId || !window.confirm(`Close “${request.title}”? It will be removed from the public requests feed.`)) return;
    setBusyId(request._id);
    setNotice({ type: '', text: '' });
    try {
      await requestAPI.updateStatus(request._id, 'closed');
      setRequests((current) => current.filter((item) => item._id !== request._id));
      setNotice({ type: 'success', text: 'Request closed and removed from the public feed.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.userMessage || 'Could not close this request. The request remains visible.' });
    } finally { setBusyId(''); }
  };

  const markFulfilled = async (request, fulfilledBy) => {
    if (busyId || !window.confirm(`Accept this offer and complete “${request.title}”?`)) return;
    setBusyId(request._id);
    try {
      await requestAPI.updateStatus(request._id, 'fulfilled', fulfilledBy);
      setRequests((current) => current.filter((item) => item._id !== request._id));
      setNotice({ type: 'success', text: 'Offer accepted and request completed.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.userMessage || 'Could not complete this request.' });
    } finally { setBusyId(''); }
  };

  const offerHelp = (request) => navigate('/chat', { state: buildHelpChatState(request) });

  return <PageTransition><Layout><main className="min-h-screen py-6 sm:py-10"><div className="section-container space-y-6 sm:space-y-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Campus help board</p><h1 className="text-section-title">Community Requests</h1><p className="mt-2 max-w-2xl text-body-sm">Ask for practical campus help or offer support through the existing secure Chat experience.</p></div><Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => setShowForm((visible) => !visible)}>{showForm ? 'Cancel' : 'New Request'}</Button></header>

    {notice.text && <div role={notice.type === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm font-semibold ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>{notice.text}</div>}
    {loadError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{loadError} <button type="button" className="font-bold underline" onClick={fetchRequests}>Retry</button></div>}

    {showForm && <PremiumCard hover={false}><form onSubmit={handleCreateRequest} className="space-y-4"><div><h2 className="text-feature-title">Create a request</h2><p className="mt-1 text-body-sm">Give students enough context to decide whether they can help.</p></div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Title<input type="text" value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} required maxLength={120} className="form-control mt-1" placeholder="Need calculator for tomorrow's exam" /></label><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Description<textarea value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} maxLength={1000} rows="4" className="form-control mt-1" placeholder="Add useful details, timing, and any constraints." /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Request type<select value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value })} className="form-control mt-1">{['Borrow', 'Notes', 'Help', 'Other'].map((category) => <option key={category}>{category}</option>)}</select></label><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Location<input type="text" value={formData.location} onChange={(event) => setFormData({ ...formData, location: event.target.value })} maxLength={120} className="form-control mt-1" placeholder="Library, hostel, or campus area" /></label></div><div className="flex justify-end"><Button type="submit" variant="primary" disabled={creating}>{creating ? 'Publishing…' : 'Publish Request'}</Button></div></form></PremiumCard>}

    <section aria-labelledby="open-requests-heading"><div className="mb-4 flex items-end justify-between gap-3"><div><h2 id="open-requests-heading" className="text-feature-title">Open Requests</h2><p className="mt-1 text-body-sm">Only active requests are shown publicly.</p></div>{!loading && <span className="chip">{requests.length} open</span>}</div>
      {loading ? <div className="grid gap-5 md:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-64" />)}</div> : requests.length === 0 ? <PremiumCard hover={false} className="py-12 text-center"><h3 className="text-lg font-black text-slate-950 dark:text-white">No open requests</h3><p className="mt-2 text-body-sm">Everything has been handled. Create a request when you need campus help.</p><Button className="mt-5" onClick={() => setShowForm(true)}>Create a Request</Button></PremiumCard> : <div className="grid gap-5 md:grid-cols-2">{requests.map((request) => {
        const action = getRequestAction(request, currentUserId);
        return <PremiumCard key={request._id} hover={false} className="flex min-w-0 flex-col"><div className="flex items-start justify-between gap-3"><span className="chip">{request.category || 'General'}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">Open</span></div><h3 className="mt-4 break-words text-xl font-black text-slate-950 dark:text-white">{request.title}</h3><p className="mt-2 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{request.description || 'No additional details provided.'}</p><div className="mt-5 flex items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-700"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-blue-600 text-sm font-bold text-white">{request.user?.profilePicture ? <img src={request.user.profilePicture} alt="" className="h-full w-full object-cover" /> : getInitials(request.user?.name)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{request.user?.name || 'Student'}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{request.location || 'Campus location not specified'}</p></div></div><div className="mt-4 flex flex-wrap justify-end gap-2">{action === 'offer-help' && <Button variant="primary" onClick={() => offerHelp(request)}>Offer Help</Button>}{action === 'close' && <Button variant="secondary" disabled={busyId === request._id} onClick={() => closeRequest(request)}>{busyId === request._id ? 'Closing…' : 'Close Request'}</Button>}</div>
          {request.responses?.length > 0 && action === 'close' && <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Previous offers</p>{request.responses.map((response) => <div key={`${request._id}-${response.user?._id}`} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-slate-900 dark:text-white">{response.user?.name || 'Student'}</p><p className="text-xs text-slate-600 dark:text-slate-300">{response.message}</p></div><Button size="sm" disabled={busyId === request._id} onClick={() => markFulfilled(request, response.user?._id)}>Accept Offer</Button></div>)}</div>}
        </PremiumCard>;
      })}</div>}
    </section>
  </div></main></Layout></PageTransition>;
}
