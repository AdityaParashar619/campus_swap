import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { authAPI, messageAPI } from '../services/api';

const SOCKET_URL = 'http://localhost:5000';

const getInitials = (name) => {
  return name
    ?.split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
};

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const location = useLocation();
  const preselectedUserId = location.state?.selectedUserId;

  // Initialize Socket.io connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    newSocket.emit('register', user?.id);
    setSocket(newSocket);

    newSocket.on('receiveMessage', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => newSocket.close();
  }, [user?.id]);

  // Fetch users from auth API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await authAPI.getUsers();
        setUsers(response.data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [user?.id]);

  // Auto-select user if coming from Listings page
  useEffect(() => {
    if (preselectedUserId && users.length > 0 && !selectedUser) {
      const preselectedUser = users.find((u) => u._id === preselectedUserId);
      if (preselectedUser) {
        setSelectedUser(preselectedUser);
      }
    }
  }, [preselectedUserId, users, selectedUser]);

  // Load messages when user is selected
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedUser) return;
      try {
        const response = await messageAPI.getChat(selectedUser._id);
        setMessages(response.data);
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };
    loadMessages();
  }, [selectedUser]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    try {
      const message = {
        text: newMessage,
        receiverId: selectedUser._id,
        sender: user
      };

      // Send via Socket.io
      if (socket) {
        socket.emit('sendMessage', { ...message, receiverId: selectedUser._id });
      }

      // Also save to database
      await messageAPI.send({ receiverId: selectedUser._id, text: newMessage });
      setMessages((prev) => [...prev, { ...message, createdAt: new Date() }]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/20 to-white py-12">
          <div className="section-container">
            <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-section-title mb-2 text-gray-900"
              >
                💬 Chat
              </motion.h1>
              <p className="text-lg text-gray-600">Connect and communicate with other students</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 h-[600px]">
              {/* Users List */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="md:h-full"
              >
                <PremiumCard className="h-full overflow-hidden flex flex-col">
                  <h3 className="font-bold text-xl mb-4 text-gray-900">Conversations</h3>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {loading ? (
                      <p className="text-gray-500 text-center py-4">Loading...</p>
                    ) : users.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No active conversations</p>
                    ) : (
                      users.map((u) => (
                        <motion.button
                          key={u?._id}
                          onClick={() => setSelectedUser(u)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full text-left p-4 rounded-xl transition-all duration-300 flex items-center gap-3 ${
                            selectedUser?._id === u?._id
                              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                              : 'hover:bg-white/40 text-gray-900'
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                              selectedUser?._id === u?._id
                                ? 'bg-white/30 text-white'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                            }`}
                          >
                            {getInitials(u?.name)}
                          </div>
                          <div className="flex-1 truncate">
                            <p className="font-semibold">{u?.name}</p>
                            <p className="text-xs opacity-80 truncate">{u?.email}</p>
                          </div>
                        </motion.button>
                      ))
                    )}
                  </div>
                </PremiumCard>
              </motion.div>

              {/* Chat Area */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="md:col-span-2"
              >
                <PremiumCard className="h-full flex flex-col">
                  {!selectedUser ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-center"
                      >
                        <div className="text-6xl mb-4">💭</div>
                        <p className="text-xl font-semibold">Select a user to start chatting</p>
                      </motion.div>
                    </div>
                  ) : (
                    <>
                      {/* Chat Header */}
                      <div className="border-b border-white/20 pb-4 mb-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                          {getInitials(selectedUser.name)}
                        </div>
                        <div>
                          <motion.h3
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="font-bold text-2xl text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text"
                          >
                            {selectedUser.name}
                          </motion.h3>
                          <p className="text-sm text-gray-600">{selectedUser.email}</p>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                        {messages.map((msg, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`flex ${msg.sender?.id === user?.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-xs px-5 py-3 rounded-2xl shadow-md ${
                                msg.sender?.id === user?.id
                                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                                  : 'bg-white/40 backdrop-blur-md text-gray-900 border border-white/20'
                              }`}
                            >
                              <p className="text-sm font-medium">{msg.text}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Message Input */}
                      <form onSubmit={handleSendMessage} className="flex gap-3">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 px-5 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 backdrop-blur-sm font-medium"
                        />
                        <Button variant="gradient" type="submit" className="!px-8">
                          Send
                        </Button>
                      </form>
                    </>
                  )}
                </PremiumCard>
              </motion.div>
            </div>
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
