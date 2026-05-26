import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import ReportDialog from '../components/ReportDialog';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { authAPI, messageAPI } from '../services/api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const getInitials = (name) => name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatPreview, setChatPreview] = useState({});
  const [unreadByUser, setUnreadByUser] = useState({});
  const [typingByUser, setTypingByUser] = useState({});
  const [onlineMap, setOnlineMap] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMobileList, setShowMobileList] = useState(true);
  const { user } = useAuth();
  const location = useLocation();
  const preselectedUserId = location.state?.selectedUserId;
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    newSocket.emit('register', user?.id);
    setSocket(newSocket);

    newSocket.on('receiveMessage', (message) => {
      const senderId = message.sender?._id || message.sender?.id || message.senderId;
      if (senderId) {
        setChatPreview((prev) => ({ ...prev, [senderId]: message.text }));
      }

      if (selectedUser && senderId === selectedUser._id) {
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
  }, [user?.id, selectedUser?._id]);

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
              return [u._id, last?.text || 'Start a conversation'];
            } catch {
              return [u._id, 'Start a conversation'];
            }
          })
        );
        setChatPreview(Object.fromEntries(previewEntries));
      } catch (error) {
        console.error('Failed to fetch users:', error);
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
    const loadMessages = async () => {
      if (!selectedUser) return;
      try {
        const response = await messageAPI.getChat(selectedUser._id);
        setMessages(response.data.data || []);
        setUnreadByUser((prev) => ({ ...prev, [selectedUser._id]: 0 }));
      } catch (error) {
        console.error('Failed to load messages:', error);
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
    if (!newMessage.trim() || !selectedUser) return;
    try {
      const message = { text: newMessage, receiverId: selectedUser._id, sender: { _id: user?.id }, createdAt: new Date() };
      if (socket) socket.emit('sendMessage', message);
      await messageAPI.send({ receiverId: selectedUser._id, text: newMessage });
      setMessages((prev) => [...prev, message]);
      setChatPreview((prev) => ({ ...prev, [selectedUser._id]: newMessage }));
      setNewMessage('');
      sendTyping(false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen py-4 sm:py-8 lg:py-10">
          <div className="section-container space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="chip mb-3">Realtime messaging</p>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">Campus Chat</h1>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-300">
                Clear, direct conversations for campus exchanges, borrowing, notes, and connection follow-ups.
              </p>
            </div>

            <div className="grid min-h-[calc(100vh-170px)] gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6">
              <PremiumCard className={`${showMobileList ? 'flex' : 'hidden'} min-h-[calc(100vh-190px)] flex-col overflow-hidden border-slate-200/80 bg-white p-3 dark:border-slate-700/50 dark:bg-slate-900/85 sm:p-4 lg:flex lg:min-h-[72vh] shadow-md`} hover={false}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950 dark:text-white">Conversations</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{users.length} students available</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">Live</span>
                </div>
                <div className="mb-3">
                  <input className="premium-surface w-full px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 dark:text-white" placeholder="Search chats" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-14" />)
                  ) : (
                    users.map((u) => (
                      <button
                        key={u._id}
                        onClick={() => {
                          setSelectedUser(u);
                          setShowMobileList(false);
                        }}
                        className={`w-full rounded-lg border p-3 text-left transition ${selectedUser?._id === u._id ? 'border-cyan-400/60 bg-cyan-50 text-slate-950 shadow-md dark:border-cyan-400/40 dark:bg-cyan-950/40 dark:text-cyan-100' : 'border-slate-200/60 bg-white/70 hover:border-cyan-300/50 hover:bg-cyan-50/30 dark:border-slate-700/70 dark:bg-slate-800/60 dark:hover:border-cyan-400/30 dark:hover:bg-slate-800/80'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 via-blue-600 to-slate-900 font-black text-white">
                            {getInitials(u.name)}
                            {onlineMap[u._id] && <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between gap-2">
                              <p className="truncate font-bold">{u.name}</p>
                              {(unreadByUser[u._id] || 0) > 0 && <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full">{unreadByUser[u._id]}</span>}
                            </div>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{chatPreview[u._id] || 'Start a conversation'}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PremiumCard>

              <PremiumCard className={`${selectedUser || !showMobileList ? 'flex' : 'hidden'} min-h-[calc(100vh-190px)] flex-col overflow-hidden border-slate-200/80 bg-white p-0 dark:border-slate-700/50 dark:bg-slate-900/85 lg:flex lg:min-h-[72vh] shadow-md`} hover={false}>
                {!selectedUser ? (
                  <div className="grid flex-1 place-items-center p-8 text-center text-slate-500">
                    <div>
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Select a conversation</p>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose a student from the list to start chatting.</p>
                      <button className="mt-5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white lg:hidden" onClick={() => setShowMobileList(true)}>Open conversations</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 border-b border-slate-200/70 bg-gradient-to-r from-slate-950 to-slate-900 px-3 py-3 text-white dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-900 sm:px-5 sm:py-4 shadow-sm">
                      <button className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold lg:hidden" onClick={() => setShowMobileList(true)}>Back</button>
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 via-blue-500 to-amber-400 font-black text-slate-950">
                        {getInitials(selectedUser.name)}
                        {onlineMap[selectedUser._id] && <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{selectedUser.name}</p>
                        <p className="text-xs text-slate-300">{onlineMap[selectedUser._id] ? 'Online now' : 'Offline'}</p>
                      </div>
                      <Button size="sm" variant="danger" className="shrink-0" onClick={() => setReportOpen(true)}>Report</Button>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto bg-white/95 px-3 py-4 dark:bg-slate-800/60 sm:px-5">
                      {messages.map((msg, i) => {
                        const own = (msg.sender?._id || msg.sender?.id) === user?.id;
                        return (
                          <motion.div key={`${msg.createdAt || i}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[88%] break-words rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[76%] ${own ? 'rounded-br-md bg-slate-950 text-white dark:bg-teal-700' : 'rounded-bl-md border border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50'}`}>
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

                    <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-slate-200/70 bg-white p-3 dark:border-slate-700/50 dark:bg-slate-900/85 sm:gap-3 sm:p-4 shadow-sm">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => onMessageChange(e.target.value)}
                        placeholder="Write a message"
                        className="premium-surface min-w-0 flex-1 px-4 py-3 text-slate-950 placeholder:text-slate-500 dark:placeholder:text-slate-400 dark:text-white bg-slate-50 dark:bg-slate-900"
                      />
                      <Button variant="gradient" type="submit" className="shrink-0">Send</Button>
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
