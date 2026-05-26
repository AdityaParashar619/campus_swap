import { useEffect, useMemo, useState } from 'react';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { connectionAPI } from '../services/api';

export default function Network() {
  const [connections, setConnections] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

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
    () => connections.filter((connection) => connection.status === 'pending' && students.some((student) => student.connection?.id === connection._id && student.connection.direction === 'incoming')),
    [connections, students]
  );

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
              <p className="text-body-sm">Find students, send requests, and accept incoming connections.</p>
            </div>

            {message && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">{message}</p>}

            {pendingIncoming.length > 0 && (
              <PremiumCard>
                <h2 className="text-feature-title mb-4">Incoming Requests</h2>
                <div className="space-y-3">
                  {pendingIncoming.map((connection) => (
                    <div key={connection._id} className="flex flex-col gap-3 border-b border-slate-200/40 pb-3 last:border-0 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold">{connection.requester?.name}</p>
                        <p className="text-body-sm">{connection.requester?.course || 'Student'} {connection.requester?.yearSemester || ''}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="gradient" onClick={() => respondToRequest(connection._id, 'accepted')}>Accept</Button>
                        <Button size="sm" variant="secondary" onClick={() => respondToRequest(connection._id, 'rejected')}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            )}

            {loading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="skeleton h-44" />)}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {students.map((student) => (
                  <PremiumCard key={student._id} className="flex h-full flex-col justify-between">
                    <div>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-feature-title">{student.name}</h3>
                          <p className="text-body-sm">{student.course || 'Student'} {student.yearSemester || ''}</p>
                        </div>
                        <span className="chip">{student.trustScore || 0} trust</span>
                      </div>
                      <p className="text-body-sm line-clamp-3">{student.bio || 'No bio added yet.'}</p>
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">{student.collegeName || 'CampusSwap'}</span>
                      {renderConnectionAction(student)}
                    </div>
                  </PremiumCard>
                ))}
                {students.length === 0 && <PremiumCard><p className="text-body-sm">No other students found yet.</p></PremiumCard>}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
