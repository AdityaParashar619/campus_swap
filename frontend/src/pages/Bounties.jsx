import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { bountyAPI } from '../services/api';

export default function Bounties() {
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '' });

  useEffect(() => {
    fetchBounties();
  }, []);

  const fetchBounties = async () => {
    try {
      const response = await bountyAPI.getAll();
      setBounties(response.data);
    } catch (error) {
      console.error('Failed to fetch bounties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBounty = async (e) => {
    e.preventDefault();
    try {
      await bountyAPI.create(formData);
      setFormData({ title: '', description: '' });
      setShowForm(false);
      fetchBounties();
    } catch (error) {
      console.error('Failed to create bounty:', error);
    }
  };

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/20 to-white py-12">
          <div className="section-container">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <div className="flex justify-between items-start md:items-center gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h1 className="text-section-title mb-2 text-gray-900">🎯 Bounties</h1>
                  <p className="text-lg text-gray-600">Post requests and earn rewards from peers</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Button variant="gradient" onClick={() => setShowForm(!showForm)} size="lg">
                    {showForm ? '✕ Cancel' : '💰 New Bounty'}
                  </Button>
                </motion.div>
              </div>
            </motion.div>

            {/* Create Form */}
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mb-12 p-8 bg-white rounded-2xl shadow-lg border border-gray-100"
              >
                <motion.h3
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-feature-title mb-6 text-gray-900"
                >
                  📌 Post a Bounty
                </motion.h3>
                <form onSubmit={handleCreateBounty} className="space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Bounty Title</label>
                    <input
                      type="text"
                      placeholder="e.g., Need help with Calculus homework"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium transition-all"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                    <textarea
                      placeholder="Describe what you need help with and the reward you're offering..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium transition-all"
                      rows="4"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex gap-4 pt-4"
                  >
                    <Button variant="gradient" type="submit" size="md">✓ Post Bounty</Button>
                    <Button variant="secondary" onClick={() => setShowForm(false)} size="md">✕ Cancel</Button>
                  </motion.div>
                </form>
              </motion.div>
            )}

            {/* Bounties List */}
            {loading ? (
              <div className="text-center py-20">
                <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                  <p className="text-lg font-semibold text-gray-600">Loading bounties...</p>
                </motion.div>
              </div>
            ) : bounties.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg font-semibold text-gray-600">No bounties yet. Be the first to post!</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
                className="space-y-6"
              >
                {bounties.map((bounty, i) => (
                  <motion.div
                    key={bounty._id}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ x: 5 }}
                  >
                    <PremiumCard>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex justify-between items-start gap-6"
                      >
                        <div className="flex-1">
                          <h3 className="text-feature-title mb-3 text-gray-900">{bounty.title}</h3>
                          <p className="text-body-sm mb-4">{bounty.description}</p>
                          <p className="text-sm font-medium text-indigo-600">Posted by {bounty.user?.name}</p>
                        </div>
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-shrink-0"
                        >
                          <Button variant="gradient" size="md">💬 Respond</Button>
                        </motion.div>
                      </motion.div>
                    </PremiumCard>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
