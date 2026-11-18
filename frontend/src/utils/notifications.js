const validId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

export const formatUnreadCount = (count) => {
  const safe = Math.max(0, Number.isFinite(Number(count)) ? Math.floor(Number(count)) : 0);
  return safe > 99 ? '99+' : String(safe);
};

export const mergeNotifications = (current = [], incoming = []) => {
  const byId = new Map();
  [...current, ...incoming].forEach((item) => {
    if (item?._id) byId.set(String(item._id), { ...byId.get(String(item._id)), ...item });
  });
  return [...byId.values()].sort((a, b) => {
    const timeDifference = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    return timeDifference || String(b._id).localeCompare(String(a._id));
  });
};

export const getNotificationAction = (item = {}) => {
  const metadata = item.metadata || {};
  if (item.type === 'message' && validId(String(metadata.senderId || ''))) {
    return { label: 'Open chat', to: '/chat', state: { selectedUserId: String(metadata.senderId) } };
  }
  if (item.type === 'connection') {
    return {
      label: 'View network',
      to: validId(String(metadata.studentId || '')) ? `/students/${metadata.studentId}` : '/network',
      state: validId(String(metadata.connectionId || '')) ? { connectionId: String(metadata.connectionId) } : undefined
    };
  }
  if (item.type === 'request') return { label: 'View requests', to: '/bounties' };
  if (item.type === 'report' || item.type === 'admin') return { label: 'View admin', to: '/admin' };
  if (item.type === 'listing' && validId(String(metadata.listingId || ''))) return { label: 'View listing', to: `/listings/${metadata.listingId}` };
  return { label: 'Open dashboard', to: '/dashboard' };
};

export const applyReadState = (items, id) => items.map((item) => String(item._id) === String(id) ? { ...item, isRead: true } : item);
