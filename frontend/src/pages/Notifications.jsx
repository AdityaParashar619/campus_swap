import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTransition, PremiumCard, Button } from '../components/ui';
import Layout from '../layouts/Layout';
import { notificationAPI } from '../services/api';

const getNotificationAction = (item) => {
  if (item.type === 'message' && item.metadata?.senderId) {
    return {
      label: 'Reply',
      to: '/chat',
      state: { selectedUserId: item.metadata.senderId }
    };
  }

  if (item.type === 'connection') {
    return { label: 'View request', to: '/network' };
  }

  if (item.type === 'request') {
    return { label: 'View request', to: '/bounties' };
  }

  if (item.type === 'report' || item.type === 'admin') {
    return { label: 'View admin', to: '/admin' };
  }

  return { label: 'View', to: '/dashboard' };
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      const response = await notificationAPI.getAll();
      setItems(response.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markRead = async (id) => {
    await notificationAPI.markRead(id);
    setItems((prev) => prev.map((item) => (item._id === id ? { ...item, isRead: true } : item)));
  };

  const markReadBeforeView = async (item) => {
    if (!item.isRead) await markRead(item._id);
  };

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen py-10">
          <div className="section-container">
            <h1 className="text-section-title mb-2">Notifications Center</h1>
            <p className="text-body-sm mb-8">Track message alerts, connection updates, and platform actions.</p>

            {loading ? (
              <div className="space-y-4">{[1,2,3].map((i) => <div key={i} className="skeleton h-24" />)}</div>
            ) : items.length === 0 ? (
              <PremiumCard><p className="text-body-sm">No notifications yet.</p></PremiumCard>
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  const action = getNotificationAction(item);

                  return (
                    <PremiumCard key={item._id} className={item.isRead ? 'opacity-80' : 'ring-1 ring-cyan-400/40'} hover={false}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="chip capitalize">{item.type}</span>
                            {!item.isRead && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">Unread</span>}
                          </div>
                          <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-body-sm">{item.body}</p>
                        <p className="text-xs text-slate-500 mt-2">{new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Link
                            to={action.to}
                            state={action.state}
                            onClick={() => markReadBeforeView(item)}
                            className="rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20"
                          >
                            {action.label}
                          </Link>
                          {!item.isRead && <Button size="sm" variant="secondary" onClick={() => markRead(item._id)}>Mark Read</Button>}
                        </div>
                      </div>
                    </PremiumCard>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
