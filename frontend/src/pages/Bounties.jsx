import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { requestAPI } from '../services/api';

export default function Bounties() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeResponseId, setActiveResponseId] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [formData, setFormData] = useState({ title: '', description: '', category: 'Borrow', location: '' });
  const { user } = useAuth();
  const currentUserId = user?.id || user?._id;

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await requestAPI.getAll();
      setRequests(response.data.data || []);
    } catch (error) {
      setNotice(error.userMessage || 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const openRequests = useMemo(() => requests.filter((request) => request.status === 'open'), [requests]);
  const completedRequests = useMemo(() => requests.filter((request) => request.status !== 'open'), [requests]);

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setNotice('');
    try {
      await requestAPI.create(formData);
      setFormData({ title: '', description: '', category: 'Borrow', location: '' });
      setShowForm(false);
      setNotice('Request published');
      fetchRequests();
    } catch (error) {
      setNotice(error.userMessage || 'Failed to create request');
    }
  };

  const submitResponse = async (requestId) => {
    if (!responseMessage.trim()) {
      setNotice('Write a response before sending');
      return;
    }

    setNotice('');
    try {
      await requestAPI.respond(requestId, responseMessage);
      setResponseMessage('');
      setActiveResponseId(null);
      setNotice('Response sent');
      fetchRequests();
    } catch (error) {
      setNotice(error.userMessage || 'Failed to respond');
    }
  };

  const markFulfilled = async (id, fulfilledBy) => {
    setNotice('');
    try {
      await requestAPI.updateStatus(id, 'fulfilled', fulfilledBy);
      setNotice('Request marked fulfilled');
      fetchRequests();
    } catch (error) {
      setNotice(error.userMessage || 'Failed to update request');
    }
  };

  const closeRequest = async (id) => {
    setNotice('');
    try {
      await requestAPI.updateStatus(id, 'closed');
      setNotice('Request closed');
      fetchRequests();
    } catch (error) {
      setNotice(error.userMessage || 'Failed to close request');
    }
  };

  const renderRequest = (request) => {
    const isOwner = request.user?._id === currentUserId;
    const hasResponded = request.responses?.some((response) => response.user?._id === currentUserId);

    return (
      <PremiumCard key={request._id}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h3 className="text-feature-title mb-2">{request.title}</h3>
              <p className="text-body-sm mb-2">{request.description || 'No extra details provided.'}</p>
              <p className="text-body-sm">{request.category} | {request.location || 'Campus'} | Requested by {request.user?.name}</p>
              <p className="text-xs mt-2 text-slate-500">Status: {request.status}{request.fulfilledBy?.name ? ` by ${request.fulfilledBy.name}` : ''}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isOwner && request.status === 'open' && (
                <Button variant="secondary" onClick={() => setActiveResponseId(activeResponseId === request._id ? null : request._id)}>
                  {hasResponded ? 'Update Response' : 'Respond'}
                </Button>
              )}
              {isOwner && request.status === 'open' && request.responses?.length === 0 && (
                <Button variant="secondary" onClick={() => closeRequest(request._id)}>Close</Button>
              )}
            </div>
          </div>

          {activeResponseId === request._id && (
            <div className="rounded-xl border border-slate-200/60 bg-white/60 p-4">
              <textarea
                className="premium-surface w-full px-4 py-3"
                rows="3"
                placeholder="Tell them how you can help and when you are available."
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
              />
              <div className="mt-3 flex gap-2">
                <Button variant="gradient" onClick={() => submitResponse(request._id)}>Send Response</Button>
                <Button variant="secondary" onClick={() => setActiveResponseId(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {request.responses?.length > 0 && (
            <div className="space-y-3 border-t border-slate-200/40 pt-4">
              <p className="text-sm font-semibold text-slate-700">Responses</p>
              {request.responses.map((response) => (
                <div key={`${request._id}-${response.user?._id}`} className="flex flex-col gap-3 rounded-xl bg-slate-50/80 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{response.user?.name || 'Student'} <span className="text-xs font-normal text-slate-500">{response.status}</span></p>
                    <p className="text-body-sm">{response.message}</p>
                  </div>
                  {isOwner && request.status === 'open' && (
                    <Button variant="gradient" size="sm" onClick={() => markFulfilled(request._id, response.user?._id)}>
                      Accept and Fulfill
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PremiumCard>
    );
  };

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen py-12">
          <div className="section-container space-y-8">
            <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex justify-between items-start md:items-center gap-6">
                <div>
                  <h1 className="text-section-title mb-2">Community Requests</h1>
                  <p className="text-body-sm">Ask for urgent help and let other students offer support dynamically.</p>
                </div>
                <Button variant="gradient" onClick={() => setShowForm(!showForm)} size="lg">
                  {showForm ? 'Cancel' : 'New Request'}
                </Button>
              </div>
            </motion.div>

            {notice && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">{notice}</p>}

            {showForm && (
              <PremiumCard>
                <form onSubmit={handleCreateRequest} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Need calculator for tomorrow exam"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-slate-300/30 rounded-xl bg-white/60"
                  />
                  <textarea
                    placeholder="Add details, urgency, and preferred response method..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    className="w-full px-4 py-3 border border-slate-300/30 rounded-xl bg-white/60"
                  />
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Category (Borrow, Notes, Help, Other)"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300/30 rounded-xl bg-white/60"
                    />
                    <input
                      type="text"
                      placeholder="Location / Hostel"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300/30 rounded-xl bg-white/60"
                    />
                  </div>
                  <Button variant="gradient" type="submit">Publish Request</Button>
                </form>
              </PremiumCard>
            )}

            {loading ? (
              <div className="grid md:grid-cols-2 gap-6">{[1, 2, 3].map((item) => <div key={item} className="skeleton h-44" />)}</div>
            ) : requests.length === 0 ? (
              <PremiumCard><p className="text-body-sm">No requests yet. Start the community help thread.</p></PremiumCard>
            ) : (
              <div className="space-y-8">
                <div className="space-y-5">
                  <h2 className="text-feature-title">Open Requests</h2>
                  {openRequests.length > 0 ? openRequests.map(renderRequest) : <PremiumCard><p className="text-body-sm">No open requests right now.</p></PremiumCard>}
                </div>

                {completedRequests.length > 0 && (
                  <div className="space-y-5">
                    <h2 className="text-feature-title">Completed Requests</h2>
                    {completedRequests.map(renderRequest)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
