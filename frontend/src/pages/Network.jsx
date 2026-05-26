import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { connectionAPI } from '../services/api';

const getId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || '');
};

const getInitials = (name) => name?.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2) || '?';

export default function Network() {
  const [connections, setConnections] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const { user } = useAuth();
  const currentUserId = String(user?.id || user?._id || '');

  const fetchNetwork = async () => {
    setLoading(true);
    try {
      const [connectionsResponse, suggestionsResponse] = await Promise.all([
        connectionAPI.getAll(),
        connectionAPI.getSuggestions()
      ]);
      setConnections(connectionsResponse.data.data || []);
      setStudents(suggestionsResponse.data.data || []);
    } catch (error) {
      setMessage(error.userMessage || 'Failed to load network');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetwork();
  }, []);

  const pendingIncoming = useMemo(
    () => connections.filter((connection) => connection.status === 'pending' && getId(connection.recipient) === currentUserId),
    [connections, currentUserId]
  );

  const pendingOutgoing = useMemo(
    () => connections.filter((connection) => connection.status === 'pending' && getId(connection.requester) === currentUserId),
    [connections, currentUserId]
  );

  const acceptedConnections = useMemo(
    () => connections.filter((connection) => connection.status === 'accepted'),
    [connections]
  );

  const getOtherStudent = (connection) =>
    getId(connection.requester) === currentUserId ? connection.recipient : connection.requester;

  const sendRequest = async (recipientId) => {
    setMessage('');
    try {
      await connectionAPI.create(recipientId);
      setMessage('Connection request sent');
      fetchNetwork();
    } catch (error) {
      setMessage(error.userMessage || 'Failed to send connection request');
    }
  };

  const respondToRequest = async (connectionId, status) => {
    setMessage('');
    try {
      await connectionAPI.respond(connectionId, status);
      setMessage(`Connection ${status}`);
      fetchNetwork();
    } catch (error) {
      setMessage(error.userMessage || 'Failed to update connection');
    }
  };

  const renderConnectionAction = (student) => {
    const connection = student.connection;
    if (!connection) {
      return <Button size="sm" variant="gradient" onClick={() => sendRequest(student._id)}>Connect</Button>;
    }

    if (connection.status === 'accepted') return <span className="chip">Connected</span>;
    if (connection.direction === 'outgoing') return <span className="chip">Pending</span>;
    if (connection.status === 'pending') {
      return (
        <div className="flex gap-2">
          <Button size="sm" variant="gradient" onClick={() => respondToRequest(connection.id, 'accepted')}>Accept</Button>
          <Button size="sm" variant="secondary" onClick={() => respondToRequest(connection.id, 'rejected')}>Reject</Button>
        </div>
      );
    }

    return <Button size="sm" variant="gradient" onClick={() => sendRequest(student._id)}>Connect</Button>;
  };

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen py-10">
          <div className="section-container space-y-8">
            <div>
              <h1 className="text-section-title mb-2">Student Network</h1>
              <p className="text-body-sm">Connect to unlock trusted chat, contact visibility, priority updates, and safer campus exchanges.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {[
                ['Unlimited chat', 'Continue conversations after the first starter message.'],
                ['Trusted contacts', 'Share phone or WhatsApp only with accepted connections.'],
                ['Priority inbox', 'Connected students stay higher in chat and network lists.'],
                ['Trust score', 'Accepted campus links improve student reputation.']
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/80">
                  <p className="text-sm font-black text-slate-950 dark:text-white">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
                </div>
              ))}
            </div>

            {message && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-200 border border-blue-300/30 dark:border-blue-400/20 shadow-sm">{message}</p>}

            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <PremiumCard hover={false} className="border-slate-200/70 bg-white dark:border-slate-700/50 dark:bg-slate-900/90 shadow-md">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-feature-title text-slate-950 dark:text-white">Incoming Requests</h2>
                    <p className="text-body-sm text-slate-600 dark:text-slate-300">Students waiting for your confirmation.</p>
                  </div>
                  <span className="chip bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200">{pendingIncoming.length} pending</span>
                </div>
                {pendingIncoming.length === 0 ? (
                  <p className="text-body-sm">No incoming connection requests right now.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingIncoming.map((connection) => (
                      <div key={connection._id} className="flex flex-col gap-3 rounded-lg border border-slate-200/70 bg-white/90 p-4 dark:border-slate-700/60 dark:bg-slate-900/80 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-950 dark:text-white">{connection.requester?.name || 'Student'}</p>
                          <p className="text-body-sm text-slate-600 dark:text-slate-300">{connection.requester?.course || 'Student'} {connection.requester?.yearSemester || ''}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="gradient" onClick={() => respondToRequest(connection._id, 'accepted')}>Accept</Button>
                          <Button size="sm" variant="secondary" onClick={() => respondToRequest(connection._id, 'rejected')}>Reject</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PremiumCard>

              <PremiumCard hover={false} className="border-slate-200/70 bg-white dark:border-slate-700/50 dark:bg-slate-900/90 shadow-md">
                <h2 className="text-feature-title mb-4 text-slate-950 dark:text-white">Connection Status</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ['Connected', acceptedConnections.length],
                    ['Sent', pendingOutgoing.length],
                    ['Received', pendingIncoming.length]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200/70 bg-white/90 p-3 text-center dark:border-slate-700/60 dark:bg-slate-900/80">
                      <p className="text-2xl font-black text-slate-950 dark:text-white">{value}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p>
                    </div>
                  ))}
                </div>
                {pendingOutgoing.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">Sent requests</p>
                    {pendingOutgoing.slice(0, 5).map((connection) => (
                      <div key={connection._id} className="flex items-center justify-between rounded-lg bg-white/90 px-3 py-2 text-sm dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-700/60">
                        <span className="text-slate-950 dark:text-white">{connection.recipient?.name || 'Student'}</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Pending</span>
                      </div>
                    ))}
                  </div>
                )}
              </PremiumCard>
            </div>

            <div>
              <h2 className="text-feature-title mb-4">Trusted Connections</h2>
              {acceptedConnections.length === 0 ? (
                <PremiumCard className="border-slate-200/70 bg-white dark:border-slate-700/50 dark:bg-slate-900/90 shadow-md">
                  <p className="text-body-sm">No trusted connections yet. Accept requests or connect with students below to unlock contact sharing and unlimited chat.</p>
                </PremiumCard>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {acceptedConnections.map((connection) => {
                    const student = getOtherStudent(connection) || {};
                    return (
                      <PremiumCard key={connection._id} className="border-slate-200/70 bg-white dark:border-slate-700/50 dark:bg-slate-900/90 shadow-md">
                        <div className="flex items-start gap-3">
                          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-blue-600 to-slate-900 font-black text-white">
                            {student.profilePicture ? <img src={student.profilePicture} alt="" className="h-full w-full object-cover" /> : getInitials(student.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-950 dark:text-white">{student.name || 'Student'}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">{student.course || 'Student'} {student.yearSemester || ''}</p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/70">
                          {student.phoneNumber || student.whatsappNumber ? (
                            <>
                              {student.phoneNumber && <p className="text-slate-700 dark:text-slate-200">Phone: <span className="font-semibold">{student.phoneNumber}</span></p>}
                              {student.whatsappNumber && <p className="text-slate-700 dark:text-slate-200">WhatsApp: <span className="font-semibold">{student.whatsappNumber}</span></p>}
                            </>
                          ) : (
                            <p className="text-slate-600 dark:text-slate-300">Contact details are private.</p>
                          )}
                        </div>
                        <Link
                          to="/chat"
                          state={{ selectedUserId: getId(student) }}
                          className="mt-4 inline-flex w-full justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Open trusted chat
                        </Link>
                      </PremiumCard>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-feature-title mb-4">Discover Students</h2>
              {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="skeleton h-44" />)}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {students.map((student) => (
                    <PremiumCard key={student._id} className="flex h-full flex-col justify-between border-slate-200/70 bg-white dark:border-slate-700/50 dark:bg-slate-900/90 shadow-md">
                      <div>
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-feature-title text-slate-950 dark:text-white">{student.name}</h3>
                            <p className="text-body-sm text-slate-600 dark:text-slate-300">{student.course || 'Student'} {student.yearSemester || ''}</p>
                          </div>
                          <span className="chip bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200">{student.trustScore || 0} trust</span>
                        </div>
                        <p className="text-body-sm line-clamp-3 text-slate-700 dark:text-slate-300">{student.bio || 'No bio added yet.'}</p>
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{student.collegeName || 'CampusSwap'}</span>
                        {renderConnectionAction(student)}
                      </div>
                    </PremiumCard>
                  ))}
                  {students.length === 0 && <PremiumCard className="border-slate-200/70 bg-white dark:border-slate-700/50 dark:bg-slate-900/90 shadow-md"><p className="text-body-sm">No other students found yet.</p></PremiumCard>}
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
