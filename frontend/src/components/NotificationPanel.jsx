import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { getNotificationAction } from '../utils/notifications';

const relativeTime = (value) => {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  if (!Number.isFinite(seconds)) return '';
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const intervals = [[86400, 'day'], [3600, 'hour'], [60, 'minute']];
  for (const [size, unit] of intervals) if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  return formatter.format(seconds, 'second');
};

export default function NotificationPanel({ onClose }) {
  const { items, unreadCount, loading, error, load, markRead, markAllRead } = useNotifications();
  const [mutationError, setMutationError] = useState('');
  const [busy, setBusy] = useState('');
  const preview = items.slice(0, 6);

  const run = async (key, action) => {
    if (busy) return false;
    setBusy(key); setMutationError('');
    try { await action(); return true; }
    catch (requestError) { setMutationError(requestError.userMessage || 'The notification could not be updated.'); return false; }
    finally { setBusy(''); }
  };

  return (
    <div id="notification-panel" role="dialog" aria-label="Notifications" className="fixed inset-x-2 top-[4.5rem] z-50 max-h-[min(75vh,36rem)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[25rem]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div><h2 className="font-bold">Notifications</h2><p className="text-xs text-slate-500 dark:text-slate-400">{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</p></div>
        <button type="button" disabled={!unreadCount || Boolean(busy)} onClick={() => run('all', markAllRead)} className="rounded-md px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950/40">{busy === 'all' ? 'Updating…' : 'Mark all read'}</button>
      </div>
      <div className="max-h-[min(58vh,28rem)] overflow-y-auto overscroll-contain">
        {(error || mutationError) && <div role="alert" className="m-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{mutationError || error} {error && <button type="button" className="font-bold underline" onClick={() => load()}>Retry</button>}</div>}
        {loading && !preview.length ? <div className="space-y-2 p-3">{[1,2,3].map((key) => <div key={key} className="skeleton h-16" />)}</div> : !preview.length ? <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p> : preview.map((item) => {
          const action = getNotificationAction(item);
          return <div key={item._id} className={`border-b border-slate-100 p-3 last:border-0 dark:border-slate-800 ${item.isRead ? '' : 'bg-blue-50/70 dark:bg-blue-950/25'}`}>
            <div className="flex gap-3"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.isRead ? 'bg-slate-300 dark:bg-slate-600' : 'bg-blue-600'}`} aria-label={item.isRead ? 'Read' : 'Unread'} /><div className="min-w-0 flex-1"><p className="break-words text-sm font-bold">{item.title}</p><p className="mt-0.5 break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.body}</p><time className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400" dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time><div className="mt-2 flex flex-wrap gap-2"><Link to={action.to} state={action.state} onClick={async (event) => { if (!item.isRead && !(await run(item._id, () => markRead(item._id)))) { event.preventDefault(); return; } onClose(); }} className="rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-slate-950">{action.label}</Link>{!item.isRead && <button type="button" disabled={Boolean(busy)} onClick={() => run(item._id, () => markRead(item._id))} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-bold dark:border-slate-600">{busy === item._id ? 'Updating…' : 'Mark read'}</button>}</div></div></div>
          </div>;
        })}
      </div>
      <Link to="/notifications" onClick={onClose} className="block border-t border-slate-200 px-4 py-3 text-center text-sm font-bold text-blue-700 hover:bg-slate-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800">View all notifications</Link>
    </div>
  );
}
