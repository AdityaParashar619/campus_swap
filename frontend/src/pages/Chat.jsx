import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ReportDialog from '../components/ReportDialog';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { authAPI, connectionAPI, messageAPI } from '../services/api';
import { getSocket } from '../services/socket';
import { getConversationClasses, getMessageBubbleClasses } from '../utils/chatPresentation';
import { appendUniqueMessage, filterConversations, formatConversationTime, formatMessageDate, isNearScrollBottom, mergeConversationSummaries, shouldShowDateSeparator, updateConversationActivity } from '../utils/chatView';
import { getConnectionActionState } from '../utils/connectionView';
import { preserveExistingDraft } from '../utils/requestView';

const getInitials = (name) => name?.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2) || '?';
const ChatAvatar = ({ participant }) => participant.profilePicture ? (
  <img src={participant.profilePicture} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
) : (
  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-white" aria-hidden="true">{getInitials(participant.name)}</div>
);

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatAccessByUser, setChatAccessByUser] = useState({});
  const [typingByUser, setTypingByUser] = useState({});
  const [draftByUser, setDraftByUser] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageLoadError, setMessageLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMobileList, setShowMobileList] = useState(true);
  const [conversationReloadKey, setConversationReloadKey] = useState(0);
  const [messageReloadKey, setMessageReloadKey] = useState(0);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState(null);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipBusy, setRelationshipBusy] = useState(false);
  const [relationshipError, setRelationshipError] = useState('');
  const { user } = useAuth();
  const location = useLocation();
  const preselectedUserId = location.state?.selectedUserId;
  const listingContext = location.state?.listingContext;
  const communityRequestContext = location.state?.communityRequestContext;
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageViewportRef = useRef(null);
  const selectedUserRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  useEffect(() => {
    const newSocket = getSocket();
    setSocket(newSocket);
    const onReceiveMessage = (message) => {
      const senderId = message.sender?._id || message.sender?.id || message.senderId;
      if (!senderId) return;
      setUsers((current) => updateConversationActivity(current, senderId, { text: message.text, createdAt: message.createdAt }));
      if (selectedUserRef.current?._id === senderId) {
        shouldAutoScrollRef.current = isNearScrollBottom(messageViewportRef.current || {});
        setMessages((current) => appendUniqueMessage(current, message));
      }
    };
    const onTyping = ({ senderId, isTyping }) => {
      if (senderId) setTypingByUser((current) => ({ ...current, [senderId]: isTyping }));
    };
    newSocket.on('receiveMessage', onReceiveMessage);
    newSocket.on('typing', onTyping);
    return () => {
      newSocket.off('receiveMessage', onReceiveMessage);
      newSocket.off('typing', onTyping);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchConversations = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [usersResponse, summariesResponse] = await Promise.all([
          authAPI.getUsers({ signal: controller.signal }),
          messageAPI.getSummaries({ limit: 100 }, { signal: controller.signal }),
        ]);
        setUsers(mergeConversationSummaries(usersResponse.data.data || [], summariesResponse.data.data || []));
      } catch (error) {
        if (error.code !== 'ERR_CANCELED') setLoadError(error.userMessage || 'Could not load conversations. Please try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchConversations();
    return () => controller.abort();
  }, [conversationReloadKey]);

  const selectConversation = useCallback((candidate) => {
    setSelectedUser(candidate);
    setSelectedRelationship(null);
    setRelationshipError('');
    setNewMessage(draftByUser[candidate._id] || '');
    setShowMobileList(false);
    setSendError('');
  }, [draftByUser]);

  useEffect(() => {
    if (preselectedUserId && users.length > 0 && !selectedUser) {
      const preselected = users.find((candidate) => candidate._id === preselectedUserId);
      if (preselected) selectConversation(preselected);
    }
  }, [preselectedUserId, users, selectedUser, selectConversation]);

  useEffect(() => {
    const suggestedDraft = communityRequestContext?.draft || listingContext?.draft;
    if (!suggestedDraft || !preselectedUserId || selectedUser?._id !== preselectedUserId) return;
    setNewMessage((current) => {
      const next = preserveExistingDraft(current, suggestedDraft);
      setDraftByUser((drafts) => ({ ...drafts, [preselectedUserId]: next }));
      return next;
    });
  }, [communityRequestContext, listingContext, preselectedUserId, selectedUser?._id]);

  const useSuggestedRequestDraft = () => {
    if (!selectedUser || !communityRequestContext?.draft) return;
    setNewMessage(communityRequestContext.draft);
    setDraftByUser((drafts) => ({ ...drafts, [selectedUser._id]: communityRequestContext.draft }));
  };

  useEffect(() => {
    if (!selectedUser) return undefined;
    const controller = new AbortController();
    const loadMessages = async () => {
      setMessagesLoading(true);
      setMessageLoadError('');
      setMessages([]);
      shouldAutoScrollRef.current = true;
      try {
        const [response, relationshipResponse] = await Promise.all([
          messageAPI.getChat(selectedUser._id, { signal: controller.signal }),
          connectionAPI.getStudent(selectedUser._id, { signal: controller.signal })
        ]);
        const history = response.data.data || [];
        setMessages(history);
        setSelectedRelationship(relationshipResponse.data.data?.connection || null);
        setRelationshipError('');
        setChatAccessByUser((current) => ({ ...current, [selectedUser._id]: response.data.chatAccess }));
        const last = history.at(-1);
        if (last) setUsers((current) => updateConversationActivity(current, selectedUser._id, { text: last.text, createdAt: last.createdAt }));
      } catch (error) {
        if (error.code !== 'ERR_CANCELED') setMessageLoadError(error.userMessage || 'Could not load this conversation.');
      } finally {
        if (!controller.signal.aborted) setMessagesLoading(false);
      }
    };
    loadMessages();
    return () => controller.abort();
  }, [selectedUser, messageReloadKey]);

  const refreshRelationship = useCallback(async (studentId, { refreshAccess = false } = {}) => {
    setRelationshipLoading(true);
    try {
      const requests = [connectionAPI.getStudent(studentId)];
      if (refreshAccess) requests.push(messageAPI.getChat(studentId));
      const [relationshipResponse, chatResponse] = await Promise.all(requests);
      setSelectedRelationship(relationshipResponse.data.data?.connection || null);
      if (chatResponse) setChatAccessByUser((current) => ({ ...current, [studentId]: chatResponse.data.chatAccess }));
      setRelationshipError('');
    } catch (error) {
      setRelationshipError(error.userMessage || 'Could not refresh connection status.');
    } finally {
      setRelationshipLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (selectedUserRef.current?._id) refreshRelationship(selectedUserRef.current._id, { refreshAccess: true });
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [refreshRelationship]);

  useEffect(() => {
    if (!messages.length || messagesLoading) return;
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShowJumpToLatest(false);
    } else setShowJumpToLatest(true);
  }, [messages, messagesLoading]);

  const displayedUsers = useMemo(() => filterConversations(users, searchQuery), [users, searchQuery]);
  const isTypingFromSelected = Boolean(selectedUser && typingByUser[selectedUser._id]);
  const selectedChatAccess = selectedUser ? chatAccessByUser[selectedUser._id] : null;
  const canSendToSelected = !selectedUser || selectedChatAccess?.canSend !== false;
  const relationshipAction = getConnectionActionState({
    connection: selectedRelationship,
    isSelf: selectedUser?._id === user?.id,
    restricted: Boolean(relationshipError && !selectedRelationship)
  });

  const mutateRelationship = async (action) => {
    if (!selectedUser || relationshipBusy) return;
    setRelationshipBusy(true);
    setRelationshipError('');
    try {
      if (action === 'connect') await connectionAPI.create(selectedUser._id);
      else await connectionAPI.respond(selectedRelationship.id, action === 'accept' ? 'accepted' : 'rejected');
      await refreshRelationship(selectedUser._id, { refreshAccess: true });
    } catch (error) {
      setRelationshipError(error.userMessage || 'Could not update this connection.');
    } finally {
      setRelationshipBusy(false);
    }
  };

  const sendTyping = (isTyping) => {
    if (socket && selectedUser) socket.emit('typing', { receiverId: selectedUser._id, isTyping });
  };
  const onMessageChange = (value) => {
    setNewMessage(value);
    if (selectedUser) setDraftByUser((current) => ({ ...current, [selectedUser._id]: value }));
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 900);
  };
  const jumpToLatest = () => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  const handleMessageScroll = () => {
    const nearBottom = isNearScrollBottom(messageViewportRef.current || {});
    shouldAutoScrollRef.current = nearBottom;
    if (nearBottom) setShowJumpToLatest(false);
  };
  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!newMessage.trim() || !selectedUser || isSending) return;
    if (!canSendToSelected) return setSendError('Send a connection request to continue this chat.');
    setIsSending(true);
    try {
      const response = await messageAPI.send({ receiverId: selectedUser._id, text: newMessage });
      const message = response.data.data;
      shouldAutoScrollRef.current = true;
      setMessages((current) => appendUniqueMessage(current, message));
      setUsers((current) => updateConversationActivity(current, selectedUser._id, { text: message.text, createdAt: message.createdAt }));
      setChatAccessByUser((current) => ({ ...current, [selectedUser._id]: response.data.chatAccess }));
      setNewMessage('');
      setDraftByUser((current) => ({ ...current, [selectedUser._id]: '' }));
      setSendError('');
      sendTyping(false);
    } catch (error) {
      setSendError(error.userMessage || 'Failed to send message. Your draft has been kept.');
    } finally { setIsSending(false); }
  };

  return (
    <PageTransition><Layout><div className="py-4 sm:py-8 lg:py-10"><div className="section-container space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Realtime messaging</p><h1 className="text-section-title">Campus Chat</h1></div><p className="max-w-xl text-body-sm">Clear, direct conversations for campus exchanges, borrowing, notes, and connection follow-ups.</p></header>
      <div className="grid h-[calc(100dvh-9rem)] min-h-[34rem] max-h-[52rem] gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-5">
        <PremiumCard className={`${showMobileList ? 'flex' : 'hidden'} min-h-0 flex-col overflow-hidden bg-white p-3 dark:bg-slate-900 sm:p-4 lg:flex`} hover={false}>
          <div className="mb-3"><p className="text-sm font-black text-slate-950 dark:text-white">Conversations</p><p className="text-xs text-slate-600 dark:text-slate-400">{users.length} students</p></div>
          <div className="mb-3"><label htmlFor="conversation-search" className="sr-only">Search conversations</label><input id="conversation-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="form-control" placeholder="Search names or messages" /></div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {loading ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton h-16" />) : loadError ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><p>{loadError}</p><button type="button" className="mt-2 font-bold underline" onClick={() => setConversationReloadKey((key) => key + 1)}>Retry</button></div> : displayedUsers.length === 0 ? <p className="p-4 text-center text-sm text-slate-500">{searchQuery ? 'No conversations match your search.' : 'No students are available to message.'}</p> : displayedUsers.map((candidate) => <button key={candidate._id} type="button" onClick={() => selectConversation(candidate)} className={`w-full rounded-lg border p-3 text-left ${getConversationClasses(selectedUser?._id === candidate._id)}`}><div className="flex items-center gap-3"><ChatAvatar participant={candidate} /><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><p className="truncate font-bold text-slate-950 dark:text-white">{candidate.name}</p><time className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">{formatConversationTime(candidate.lastMessage?.createdAt)}</time></div><p className="truncate text-xs text-slate-600 dark:text-slate-400">{candidate.lastMessage?.text || 'Start a conversation'}</p></div></div></button>)}
          </div>
        </PremiumCard>

        <PremiumCard className={`${selectedUser || !showMobileList ? 'flex' : 'hidden'} min-h-0 flex-col overflow-hidden bg-white p-0 dark:bg-slate-900 lg:flex`} hover={false}>
          {!selectedUser ? <div className="grid flex-1 place-items-center p-8 text-center text-slate-500"><div><p className="text-lg font-bold text-slate-800 dark:text-slate-100">Select a conversation</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose a student from the list to start chatting.</p><button type="button" className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 lg:hidden" onClick={() => setShowMobileList(true)}>Open conversations</button></div></div> : <>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:px-5 sm:py-4"><button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold dark:border-slate-600 lg:hidden" onClick={() => setShowMobileList(true)} aria-label="Back to conversations">Back</button><ChatAvatar participant={selectedUser} /><div className="min-w-0 flex-1"><p className="truncate font-bold">{selectedUser.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{selectedRelationship?.status === 'accepted' ? 'Trusted connection · unlimited chat' : 'Not connected · one starter message only'}</p></div><div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {relationshipAction === 'connect' && <Button size="sm" variant="primary" disabled={relationshipBusy || relationshipLoading} onClick={() => mutateRelationship('connect')}>{relationshipBusy ? 'Sending…' : 'Connect'}</Button>}
              {relationshipAction === 'outgoing' && <Button size="sm" variant="secondary" disabled>Request Sent</Button>}
              {relationshipAction === 'incoming' && <><Button size="sm" variant="primary" disabled={relationshipBusy} onClick={() => mutateRelationship('accept')}>{relationshipBusy ? 'Updating…' : 'Accept'}</Button><Button size="sm" variant="secondary" disabled={relationshipBusy} onClick={() => mutateRelationship('decline')}>Decline</Button></>}
              {relationshipAction === 'connected' && <Button size="sm" variant="secondary" disabled>Connected</Button>}
              <Button size="sm" variant="danger" onClick={() => setReportOpen(true)}>Report</Button>
            </div></div>
            {relationshipError && <div role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{relationshipError} <button type="button" className="font-bold underline" onClick={() => refreshRelationship(selectedUser._id, { refreshAccess: true })}>Retry</button></div>}
            {listingContext?.listingId && selectedUser._id === preselectedUserId && <div className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">Regarding <strong>{listingContext.title}</strong> · <Link to={`/listings/${listingContext.listingId}`} className="underline">View listing</Link></div>}
            {communityRequestContext?.requestId && selectedUser._id === preselectedUserId && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"><span>Community Request: <strong>{communityRequestContext.title}</strong></span>{newMessage !== communityRequestContext.draft && <button type="button" onClick={useSuggestedRequestDraft} className="font-bold underline">Use suggested message</button>}</div>}
            <div className="relative min-h-0 flex-1"><div ref={messageViewportRef} onScroll={handleMessageScroll} className="h-full space-y-3 overflow-y-auto bg-slate-50 px-3 py-4 dark:bg-slate-950 sm:px-5" aria-live="polite">
              {messagesLoading ? <div className="grid h-full place-items-center text-sm text-slate-500">Loading messages…</div> : messageLoadError ? <div role="alert" className="grid h-full place-items-center text-center text-sm text-rose-700 dark:text-rose-200"><div><p>{messageLoadError}</p><button type="button" className="mt-2 font-bold underline" onClick={() => setMessageReloadKey((key) => key + 1)}>Retry</button></div></div> : messages.length === 0 ? <div className="grid h-full place-items-center text-center text-sm text-slate-500">No messages yet. Start the conversation when you are ready.</div> : messages.map((message, index) => {
                const own = (message.sender?._id || message.sender?.id) === user?.id;
                return <div key={message._id || `${message.createdAt}-${index}`}>{shouldShowDateSeparator(messages, index) && <div className="my-4 flex items-center gap-3" aria-label={formatMessageDate(message.createdAt)}><span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /><span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{formatMessageDate(message.createdAt)}</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /></div>}<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] overflow-hidden break-words rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[76%] ${getMessageBubbleClasses(own)}`}><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p><time className={`mt-1 block text-[10px] ${own ? 'text-white/80' : 'text-slate-500 dark:text-slate-300'}`}>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time></div></motion.div></div>;
              })}
              {isTypingFromSelected && <p className="text-xs text-slate-500">{selectedUser.name} is typing…</p>}<div ref={messagesEndRef} />
            </div>{showJumpToLatest && <button type="button" onClick={jumpToLatest} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-lg dark:bg-white dark:text-slate-900">Jump to latest</button>}</div>
            {!canSendToSelected && <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-950/40 dark:text-amber-100">You already sent a starter message. Connect with {selectedUser.name} to continue chatting and unlock contact details.</div>}
            {sendError && <div role="alert" className="border-t border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-950/40 dark:text-rose-100">{sendError}</div>}
            <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-700 dark:bg-slate-900 sm:p-4"><div className="flex gap-2 sm:gap-3"><label htmlFor="chat-message" className="sr-only">Message to {selectedUser.name}</label><input id="chat-message" type="text" value={newMessage} onChange={(event) => onMessageChange(event.target.value)} disabled={!canSendToSelected} maxLength={2000} placeholder={canSendToSelected ? 'Write a message' : 'Connect to continue chatting'} className="form-control min-w-0 flex-1" /><Button variant="primary" type="submit" disabled={!canSendToSelected || isSending || !newMessage.trim()} className="shrink-0">{isSending ? 'Sending…' : 'Send'}</Button></div><p className={`mt-1 text-right text-[10px] ${newMessage.length > 1800 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>{newMessage.length}/2000</p></form>
            <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="chat" targetId={selectedUser._id} targetUserId={selectedUser._id} title={`Report ${selectedUser.name}`} />
          </>}
        </PremiumCard>
      </div>
    </div></div></Layout></PageTransition>
  );
}
