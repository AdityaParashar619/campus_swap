import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import ReportDialog from '../components/ReportDialog';
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
      if (preselectedUser) setSelectedUser(preselectedUser);
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
        <div className="min-h-screen py-10">
          <div className="section-container space-y-6">
            <div>
              <p className="chip mb-3">Realtime messaging</p>
              <h1 className="text-section-title">Campus Chat</h1>
            </div>

            <div className="grid lg:grid-cols-[320px_1fr] gap-6 h-[72vh]">
              <PremiumCard className="p-4 overflow-hidden flex flex-col">
                <div className="mb-3">
                  <input className="premium-surface w-full px-3 py-2.5 text-sm" placeholder="Search chats" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-14" />)
                  ) : (
                    users.map((u) => (
                      <button
                        key={u._id}
                        onClick={() => setSelectedUser(u)}
                        className={`w-full text-left p-3 rounded-xl border transition ${selectedUser?._id === u._id ? 'bg-blue-50 dark:bg-slate-800/65 border-blue-300/40' : 'premium-surface hover:bg-white/80 dark:hover:bg-slate-800/40'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white flex items-center justify-center font-semibold">
                            {getInitials(u.name)}
                            {onlineMap[u._id] && <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between gap-2">
                              <p className="font-semibold truncate">{u.name}</p>
                              {(unreadByUser[u._id] || 0) > 0 && <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full">{unreadByUser[u._id]}</span>}
                            </div>
                            <p className="text-xs text-slate-500 truncate">{chatPreview[u._id] || 'Start a conversation'}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PremiumCard>

              <PremiumCard className="p-0 overflow-hidden flex flex-col">
                {!selectedUser ? (
                  <div className="flex-1 grid place-items-center text-slate-500">
                    Select a conversation to start chatting.
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-4 border-b border-slate-200/20 flex items-center gap-3 premium-surface rounded-none">
                      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white flex items-center justify-center font-semibold">
                        {getInitials(selectedUser.name)}
                        {onlineMap[selectedUser._id] && <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold">{selectedUser.name}</p>
                        <p className="text-xs text-slate-500">{onlineMap[selectedUser._id] ? 'Online now' : 'Offline'}</p>
                      </div>
                      <Button size="sm" variant="danger" onClick={() => setReportOpen(true)}>Report</Button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                      {messages.map((msg, i) => {
                        const own = (msg.sender?._id || msg.sender?.id) === user?.id;
                        return (
                          <motion.div key={`${msg.createdAt || i}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${own ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white' : 'premium-surface text-slate-800 dark:text-slate-100'}`}>
                              <p className="text-sm leading-relaxed">{msg.text}</p>
                              <p className={`text-[10px] mt-1 ${own ? 'text-white/75' : 'text-slate-500'}`}>
                                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                      {isTypingFromSelected && <p className="text-xs text-slate-500">{selectedUser.name} is typing...</p>}
                      <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200/20 flex gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => onMessageChange(e.target.value)}
                        placeholder="Write a message"
                        className="flex-1 premium-surface px-4 py-3"
                      />
                      <Button variant="gradient" type="submit">Send</Button>
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
