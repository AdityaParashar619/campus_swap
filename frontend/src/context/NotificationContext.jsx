import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { notificationAPI } from '../services/api';
import { disconnectSocket, getSocket } from '../services/socket';
import { applyReadState, mergeNotifications } from '../utils/notifications';

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used within NotificationProvider');
  return value;
};

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const userId = String(user?.id || user?._id || '');
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const refreshCount = useCallback(async () => {
    if (!userId) return;
    const response = await notificationAPI.getUnreadCount();
    setUnreadCount(Math.max(0, response.data.unreadCount || 0));
  }, [userId]);

  const load = useCallback(async ({ page = 1, append = false } = {}) => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const [response] = await Promise.all([notificationAPI.getAll({ page, limit: 20 }), refreshCount()]);
      setItems((current) => append ? mergeNotifications(current, response.data.data || []) : mergeNotifications([], response.data.data || []));
      setPagination(response.data.pagination || { page, totalPages: 1, total: (response.data.data || []).length });
    } catch (loadError) {
      setError(loadError.userMessage || 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [refreshCount, userId]);

  useEffect(() => {
    setItems([]); setUnreadCount(0); setError('');
    if (!userId) { disconnectSocket(); return undefined; }
    void load();
    const socket = getSocket();
    const onNotification = (notification) => {
      if (!notification?._id) return;
      setItems((current) => mergeNotifications(current, [notification]));
      void refreshCount();
    };
    const reconcile = () => { void load(); };
    socket.on('notification:new', onNotification);
    socket.on('connect', reconcile);
    window.addEventListener('focus', reconcile);
    return () => {
      socket.off('notification:new', onNotification);
      socket.off('connect', reconcile);
      window.removeEventListener('focus', reconcile);
    };
  }, [load, refreshCount, userId]);

  const markRead = useCallback(async (id) => {
    const existing = items.find((item) => String(item._id) === String(id));
    if (!existing || existing.isRead) return;
    await notificationAPI.markRead(id);
    setItems((current) => applyReadState(current, id));
    setUnreadCount((count) => Math.max(0, count - 1));
  }, [items]);

  const markAllRead = useCallback(async () => {
    if (!unreadCount) return;
    await notificationAPI.markAllRead();
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
  }, [unreadCount]);

  const value = useMemo(() => ({ items, unreadCount, loading, error, pagination, load, refreshCount, markRead, markAllRead }), [items, unreadCount, loading, error, pagination, load, refreshCount, markRead, markAllRead]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
