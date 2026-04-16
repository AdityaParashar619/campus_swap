import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { listingAPI } from '../services/api';

export default function Listings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', category: '' });
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const response = await listingAPI.getAll();
      setListings(response.data);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    try {
      await listingAPI.create(formData);
      setFormData({ title: '', description: '', category: '' });
      setShowForm(false);
      fetchListings();
    } catch (error) {
      console.error('Failed to create listing:', error);
    }
  };

  const handleDeleteListing = async (id) => {
    try {
      await listingAPI.delete(id);
      fetchListings();
    } catch (error) {
      console.error('Failed to delete listing:', error);
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
                  <h1 className="text-section-title mb-2 text-gray-900">📦 Listings</h1>
                  <p className="text-lg text-gray-600">Buy and sell items on campus</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Button variant="gradient" onClick={() => setShowForm(!showForm)} size="lg">
                    {showForm ? '✕ Cancel' : '📝 New Listing'}
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
                  ✏️ Create New Listing
                </motion.h3>
                <form onSubmit={handleCreateListing} className="space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Item Title</label>
                    <input
                      type="text"
                      placeholder="e.g., Used Organic Chemistry Textbook"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium transition-all"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                    <textarea
                      placeholder="Describe the condition, details, and price you're asking..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium transition-all"
                      rows="4"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                    <input
                      type="text"
                      placeholder="e.g., Textbooks, Electronics, Furniture"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium transition-all"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="flex gap-4 pt-4"
                  >
                    <Button variant="gradient" type="submit" size="md">✓ Post Listing</Button>
                    <Button variant="secondary" onClick={() => setShowForm(false)} size="md">✕ Cancel</Button>
                  </motion.div>
                </form>
              </motion.div>
            )}

            {/* Listings Grid */}
            {loading ? (
              <div className="text-center py-20">
                <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                  <p className="text-lg font-semibold text-gray-600">Loading listings...</p>
                </motion.div>
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg font-semibold text-gray-600">No listings yet. Post one to get started!</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {listings.map((listing, i) => (
                  <motion.div
                    key={listing._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ y: -5 }}
                  >
                    <PremiumCard className="h-full">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <h3 className="text-feature-title mb-3 text-gray-900 line-clamp-2">{listing.title}</h3>
                        <p className="text-body-sm mb-4 line-clamp-3">{listing.description}</p>
                        {listing.category && (
                          <motion.p
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-xs font-semibold text-indigo-600 mb-4"
                          >
                            📂 {listing.category}
                          </motion.p>
                        )}
                        <div className="flex justify-between items-center pt-4 border-t border-gray-200/30 gap-2">
                          <span className="text-sm font-medium text-gray-600">by {listing.user?.name}</span>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => navigate('/chat', { state: { selectedUserId: listing.user?._id } })}
                              size="sm"
                            >
                              💬 Chat
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                            >
                              🔄 Trade
                            </Button>
                            {listing.user?._id === user?.id && (
                              <Button
                                variant="danger"
                                onClick={() => handleDeleteListing(listing._id)}
                                size="sm"
                              >
                                🗑️ Delete
                              </Button>
                            )}
                          </div>
                        </div>
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
