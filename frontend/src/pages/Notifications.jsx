import { useEffect, useState } from 'react';
import { PageTransition, PremiumCard, Button } from '../components/ui';
import Layout from '../layouts/Layout';
import { notificationAPI } from '../services/api';

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
                {items.map((item) => (
                  <PremiumCard key={item._id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-body-sm">{item.body}</p>
                        <p className="text-xs text-slate-500 mt-2">{new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                      {!item.isRead && <Button size="sm" variant="secondary" onClick={() => markRead(item._id)}>Mark Read</Button>}
                    </div>
                  </PremiumCard>
                ))}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
