import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useNotifications } from '../context/NotificationContext';
import Layout from '../layouts/Layout';
import { getNotificationAction } from '../utils/notifications';

export default function Notifications() {
  const { items, unreadCount, loading, error, pagination, load, markRead, markAllRead } = useNotifications();
  const [busy, setBusy] = useState('');
  const [mutationError, setMutationError] = useState('');
  const run = async (key, action) => {
    if (busy) return false;
    setBusy(key); setMutationError('');
    try { await action(); return true; }
    catch (requestError) { setMutationError(requestError.userMessage || 'The notification could not be updated.'); return false; }
    finally { setBusy(''); }
  };

  return <PageTransition><Layout><div className="min-h-screen py-8 sm:py-10"><div className="section-container max-w-4xl">
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-section-title">Notifications</h1><p className="text-body-sm mt-1">{unreadCount ? `${unreadCount} notification${unreadCount === 1 ? '' : 's'} need your attention.` : 'You are all caught up.'}</p></div><Button variant="secondary" disabled={!unreadCount || Boolean(busy)} onClick={() => run('all', markAllRead)}>{busy === 'all' ? 'Updating…' : 'Mark all as read'}</Button></div>
    {(error || mutationError) && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{mutationError || error} {error && <button type="button" className="font-bold underline" onClick={() => load()}>Retry</button>}</div>}
    {loading && !items.length ? <div className="space-y-3">{[1,2,3].map((key) => <div key={key} className="skeleton h-28" />)}</div> : !items.length ? <PremiumCard hover={false}><div className="py-8 text-center"><h2 className="font-bold text-slate-950 dark:text-white">No notifications yet</h2><p className="text-body-sm mt-1">Connection, message, and community activity will appear here.</p></div></PremiumCard> : <div className="space-y-3">{items.map((item) => {
      const action = getNotificationAction(item);
      return <PremiumCard key={item._id} hover={false} className={item.isRead ? 'border-slate-200 dark:border-slate-700' : 'border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20'}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="mb-2 flex items-center gap-2"><span className="chip capitalize">{item.type}</span>{!item.isRead && <span className="rounded-full bg-blue-600 px-2 py-1 text-[11px] font-bold text-white">Unread</span>}</div><h2 className="break-words font-bold text-slate-950 dark:text-white">{item.title}</h2><p className="text-body-sm mt-1 break-words">{item.body}</p><time dateTime={item.createdAt} className="mt-2 block text-xs text-slate-500 dark:text-slate-400">{new Date(item.createdAt).toLocaleString()}</time></div><div className="flex shrink-0 flex-wrap gap-2"><Link to={action.to} state={action.state} onClick={async (event) => { if (!item.isRead && !(await run(item._id, () => markRead(item._id)))) event.preventDefault(); }} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950">{action.label}</Link>{!item.isRead && <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => run(item._id, () => markRead(item._id))}>{busy === item._id ? 'Updating…' : 'Mark read'}</Button>}</div></div></PremiumCard>;
    })}</div>}
    {pagination.page < pagination.totalPages && <div className="mt-6 text-center"><Button variant="secondary" disabled={loading} onClick={() => load({ page: pagination.page + 1, append: true })}>{loading ? 'Loading…' : 'Load older notifications'}</Button></div>}
  </div></div></Layout></PageTransition>;
}
