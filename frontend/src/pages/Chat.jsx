import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import ReportDialog from '../components/ReportDialog';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { authAPI, getAccessToken, messageAPI } from '../services/api';
import { resolveSocketUrl } from '../utils/securityLinks';
import { getConversationClasses, getMessageBubbleClasses } from '../utils/chatPresentation';

const SOCKET_URL = resolveSocketUrl(import.meta.env.VITE_SOCKET_URL, window.location.origin);

const getInitials = (name) => name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatPreview, setChatPreview] = useState({});
  const [chatAccessByUser, setChatAccessByUser] = useState({});
  const [unreadByUser, setUnreadByUser] = useState({});
  const [typingByUser, setTypingByUser] = useState({});
  const [onlineMap, setOnlineMap] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendError, setSendError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMobileList, setShowMobileList] = useState(true);
  const { user } = useAuth();
  const location = useLocation();
  const preselectedUserId = location.state?.selectedUserId;
  const listingContext = location.state?.listingContext;
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(null);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { path: '/socket.io/', auth: { token: getAccessToken() } });
    newSocket.emit('register', user?.id);
    setSocket(newSocket);

    newSocket.on('receiveMessage', (message) => {
      const senderId = message.sender?._id || message.sender?.id || message.senderId;
      if (senderId) {
        setChatPreview((prev) => ({ ...prev, [senderId]: { text: message.text, createdAt: message.createdAt } }));
      }

      if (selectedUserRef.current && senderId === selectedUserRef.current._id) {
        setMessages((prev) => [...prev, message]);
      } else if (senderId) {
        setUnreadByUser((prev) => ({ ...prev, [senderId]: (prev[senderId] || 0) + 1 }));
      }
    });

    newSocket.on('typing', ({ senderId, isTyping }) => {
      if (senderId) setTypingByUser((prev) => ({ ...prev, [senderId]: isTyping }));
    });

    newSocket.on('presence:update', ({ userId, online }) => {
      if (userId) setOnlineMap((prev) => ({ ...prev, [userId]: online }));
    });

    return () => newSocket.close();
  }, [user?.id]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await authAPI.getUsers();
        const usersData = response.data.data || [];
        setUsers(usersData);

        const previewEntries = await Promise.all(
          usersData.map(async (u) => {
            try {
              const res = await messageAPI.getChat(u._id);
              const chat = res.data.data || [];
              const last = chat.at(-1);
              setChatAccessByUser((prev) => ({ ...prev, [u._id]: res.data.chatAccess }));
              return [u._id, { text: last?.text || 'Start a conversation', createdAt: last?.createdAt || null }];
            } catch {
              return [u._id, { text: 'Start a conversation', createdAt: null }];
            }
          })
        );
        setChatPreview(Object.fromEntries(previewEntries));
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setLoadError(error.userMessage || 'Could not load conversations. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (preselectedUserId && users.length > 0 && !selectedUser) {
      const preselectedUser = users.find((u) => u._id === preselectedUserId);
      if (preselectedUser) {
        setSelectedUser(preselectedUser);
        setShowMobileList(false);
      }
    }
  }, [preselectedUserId, users, selectedUser]);

  useEffect(() => {
    if (listingContext?.draft && preselectedUserId && selectedUser?._id === preselectedUserId) setNewMessage((current) => current || listingContext.draft);
  }, [listingContext, preselectedUserId, selectedUser?._id]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedUser) return;
      setMessagesLoading(true);
      try {
        const response = await messageAPI.getChat(selectedUser._id);
        setMessages(response.data.data || []);
        setChatAccessByUser((prev) => ({ ...prev, [selectedUser._id]: response.data.chatAccess }));
        setUnreadByUser((prev) => ({ ...prev, [selectedUser._id]: 0 }));
        setSendError('');
      } catch (error) {
        console.error('Failed to load messages:', error);
        setSendError(error.userMessage || 'Could not load this conversation.');
      } finally {
        setMessagesLoading(false);
      }
    };
    loadMessages();
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUser]);

  const isTypingFromSelected = useMemo(() => {
    if (!selectedUser) return false;
    return Boolean(typingByUser[selectedUser._id]);
  }, [typingByUser, selectedUser]);

  const selectedChatAccess = selectedUser ? chatAccessByUser[selectedUser._id] : null;
  const canSendToSelected = !selectedUser || selectedChatAccess?.canSend !== false;

  const sortedUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return users.filter((candidate) => !normalizedQuery || candidate.name?.toLowerCase().includes(normalizedQuery)).sort((a, b) => {
      const unreadDiff = (unreadByUser[b._id] || 0) - (unreadByUser[a._id] || 0);
      if (unreadDiff) return unreadDiff;
      const connectedDiff = Number(Boolean(b.isConnected)) - Number(Boolean(a.isConnected));
      if (connectedDiff) return connectedDiff;
      const aHasPreview = chatPreview[a._id]?.text && chatPreview[a._id].text !== 'Start a conversation';
      const bHasPreview = chatPreview[b._id]?.text && chatPreview[b._id].text !== 'Start a conversation';
      return Number(bHasPreview) - Number(aHasPreview);
    });
  }, [users, unreadByUser, chatPreview, searchQuery]);

  const sendTyping = (isTyping) => {
    if (!socket || !selectedUser) return;
    socket.emit('typing', { receiverId: selectedUser._id, senderId: user?.id, isTyping });
  };

  const onMessageChange = (value) => {
    setNewMessage(value);
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 900);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || isSending) return;
    if (!canSendToSelected) {
      setSendError('Send a connection request to continue this chat.');
      return;
    }
    setIsSending(true);
    try {
      const response = await messageAPI.send({ receiverId: selectedUser._id, text: newMessage });
      const message = response.data.data;
      setMessages((prev) => [...prev, message]);
      setChatPreview((prev) => ({ ...prev, [selectedUser._id]: { text: message.text, createdAt: message.createdAt } }));
      setChatAccessByUser((prev) => ({ ...prev, [selectedUser._id]: response.data.chatAccess }));
      setNewMessage('');
      setSendError('');
      sendTyping(false);
    } catch (error) {
      setSendError(error.userMessage || 'Failed to send message');
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <PageTransition>
      <Layout>
        <div className="py-4 sm:py-8 lg:py-10">
          <div className="section-container space-y-4 sm:space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Realtime messaging</p>
                <h1 className="text-section-title">Campus Chat</h1>
              </div>
              <p className="max-w-xl text-body-sm">Clear, direct conversations for campus exchanges, borrowing, notes, and connection follow-ups.</p>
            </header>

            <div className="grid h-[calc(100dvh-9rem)] min-h-[34rem] max-h-[52rem] gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-5">
              <PremiumCard className={`${showMobileList ? 'flex' : 'hidden'} min-h-0 flex-col overflow-hidden bg-white p-3 dark:bg-slate-900 sm:p-4 lg:flex`} hover={false}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950 dark:text-white">Conversations</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{users.length} students available</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">Live</span>
                </div>
                <div className="mb-3">
                  <label htmlFor="conversation-search" className="sr-only">Search conversations</label>
                  <input id="conversation-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="form-control" placeholder="Search conversations" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-14" />)
                  ) : loadError ? (
                    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{loadError}</div>
                  ) : sortedUsers.length === 0 ? (
                    <p className="p-4 text-center text-sm text-slate-500">No conversations match your search.</p>
                  ) : (
                    sortedUsers.map((u) => (
                      <button
                        key={u._id}
                        onClick={() => {
                          setSelectedUser(u);
                          setShowMobileList(false);
                        }}
                        className={`w-full rounded-lg border p-3 text-left ${getConversationClasses(selectedUser?._id === u._id)}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
                            {getInitials(u.name)}
                            {onlineMap[u._id] && <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between gap-2">
                              <p className="truncate font-bold text-slate-950 dark:text-white">{u.name}</p>
                              <div className="flex items-center gap-1">
                                {u.isConnected && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">Trusted</span>}
                                {(unreadByUser[u._id] || 0) > 0 && <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full">{unreadByUser[u._id]}</span>}
                              </div>
                            </div>
                              <p className="truncate text-xs text-slate-600 dark:text-slate-400">{chatPreview[u._id]?.text || 'Start a conversation'}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PremiumCard>

              <PremiumCard className={`${selectedUser || !showMobileList ? 'flex' : 'hidden'} min-h-0 flex-col overflow-hidden bg-white p-0 dark:bg-slate-900 lg:flex`} hover={false}>
                {!selectedUser ? (
                  <div className="grid flex-1 place-items-center p-8 text-center text-slate-500">
                    <div>
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Select a conversation</p>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose a student from the list to start chatting.</p>
                      <button className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 lg:hidden" onClick={() => setShowMobileList(true)}>Open conversations</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:px-5 sm:py-4">
                      <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold dark:border-slate-600 lg:hidden" onClick={() => setShowMobileList(true)} aria-label="Back to conversations">Back</button>
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
                        {getInitials(selectedUser.name)}
                        {onlineMap[selectedUser._id] && <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{selectedUser.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {selectedUser.isConnected ? 'Trusted connection - unlimited chat' : 'Not connected - one starter message only'}
                        </p>
                      </div>
                      <Button size="sm" variant="danger" className="shrink-0" onClick={() => setReportOpen(true)}>Report</Button>
                    </div>

                    {listingContext?.listingId && selectedUser._id === preselectedUserId && <div className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Regarding <strong>{listingContext.title}</strong> · <Link to={`/listings/${listingContext.listingId}`} className="underline">View listing</Link></div>}
                    <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4 dark:bg-slate-950 sm:px-5" aria-live="polite">
                      {messagesLoading ? <div className="grid h-full place-items-center text-sm text-slate-500">Loading messages…</div> : messages.length === 0 ? <div className="grid h-full place-items-center text-center text-sm text-slate-500">No messages yet. Start the conversation when you are ready.</div> : messages.map((msg, i) => {
                        const own = (msg.sender?._id || msg.sender?.id) === user?.id;
                        return (
                          <motion.div key={`${msg.createdAt || i}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[88%] break-words rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[76%] ${getMessageBubbleClasses(own)}`}>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                              <p className={`mt-1 text-[10px] ${own ? 'text-white/80' : 'text-slate-500 dark:text-slate-300'}`}>
                                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                      {isTypingFromSelected && <p className="text-xs text-slate-500">{selectedUser.name} is typing...</p>}
                      <div ref={messagesEndRef} />
                    </div>

                    {!canSendToSelected && (
                      <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-950/40 dark:text-amber-100">
                        You already sent a starter message. Connect with {selectedUser.name} to continue chatting and unlock contact details.
                      </div>
                    )}
                    {sendError && (
                      <div className="border-t border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-950/40 dark:text-rose-100">
                        {sendError}
                      </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:gap-3 sm:p-4">
                      <label htmlFor="chat-message" className="sr-only">Message to {selectedUser.name}</label>
                      <input
                        id="chat-message"
                        type="text"
                        value={newMessage}
                        onChange={(e) => onMessageChange(e.target.value)}
                        disabled={!canSendToSelected}
                        maxLength={2000}
                        placeholder={canSendToSelected ? 'Write a message' : 'Connect to continue chatting'}
                        className="form-control min-w-0 flex-1"
                      />
                      <Button variant="primary" type="submit" disabled={!canSendToSelected || isSending || !newMessage.trim()} className="shrink-0">{isSending ? 'Sending…' : 'Send'}</Button>
                    </form>

                    <ReportDialog
                      open={reportOpen}
                      onClose={() => setReportOpen(false)}
                      targetType="chat"
                      targetId={selectedUser._id}
                      targetUserId={selectedUser._id}
                      title={`Report ${selectedUser.name}`}
                    />
                  </>
                )}
              </PremiumCard>
            </div>
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
