export const mergeConversationSummaries = (users, summaries) => {
  const byParticipant = new Map(summaries.map((item) => [item.participantId, item.lastMessage]));
  return users.map((user) => ({ ...user, lastMessage: byParticipant.get(user._id) || null })).sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ? Date.parse(a.lastMessage.createdAt) : 0;
    const bTime = b.lastMessage?.createdAt ? Date.parse(b.lastMessage.createdAt) : 0;
    return bTime - aTime || a.name.localeCompare(b.name);
  });
};

export const filterConversations = (users, query) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return users;
  return users.filter((user) => user.name?.toLowerCase().includes(normalized) || user.lastMessage?.text?.toLowerCase().includes(normalized));
};

export const updateConversationActivity = (users, participantId, lastMessage) => users.map((user) => (
  user._id === participantId ? { ...user, lastMessage } : user
)).sort((a, b) => {
  const aTime = a.lastMessage?.createdAt ? Date.parse(a.lastMessage.createdAt) : 0;
  const bTime = b.lastMessage?.createdAt ? Date.parse(b.lastMessage.createdAt) : 0;
  return bTime - aTime || a.name.localeCompare(b.name);
});

export const formatConversationTime = (value, now = new Date()) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const formatMessageDate = (value, now = new Date()) => {
  const date = new Date(value);
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};

export const shouldShowDateSeparator = (messages, index) => index === 0 || new Date(messages[index - 1].createdAt).toDateString() !== new Date(messages[index].createdAt).toDateString();

export const appendUniqueMessage = (messages, message) => {
  if (!message?._id || messages.some((item) => item._id === message._id)) return messages;
  return [...messages, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

export const isNearScrollBottom = ({ scrollHeight, scrollTop, clientHeight }, threshold = 120) => scrollHeight - scrollTop - clientHeight <= threshold;
