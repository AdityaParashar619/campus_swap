import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { listingAPI } from '../services/api';

const defaultFilters = { search: '', category: 'all', condition: 'all', availability: 'all' };
const formInit = { title: '', description: '', category: '', price: '', location: '', condition: 'good' };

const listingCategories = ['all', 'books', 'electronics', 'notes', 'furniture', 'hostel', 'other'];

export default function Listings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(defaultFilters);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(formInit);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const currentUserId = user?.id || user?._id;
  const navigate = useNavigate();

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const response = await listingAPI.getAll();
      setListings(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      const bySearch =
        !filters.search ||
        listing.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
        listing.description?.toLowerCase().includes(filters.search.toLowerCase());
      const byCategory = filters.category === 'all' || (listing.category || '').toLowerCase() === filters.category;
      const byCondition = filters.condition === 'all' || (listing.condition || '').toLowerCase() === filters.condition;
      const byAvailability = filters.availability === 'all' || (listing.availability || '').toLowerCase() === filters.availability;
      return bySearch && byCategory && byCondition && byAvailability;
    });
  }, [listings, filters]);

  const handleCreateListing = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await listingAPI.create({
        ...formData,
        price: formData.price ? Number(formData.price) : 0,
        availability: 'available'
      });
      setFormData(formInit);
      setShowForm(false);
      fetchListings();
    } catch (error) {
      console.error('Failed to create listing:', error);
      setError(error.userMessage || 'Failed to create listing');
    }
  };

  const handleDeleteListing = async (id) => {
    setError('');
    try {
      await listingAPI.delete(id);
      fetchListings();
    } catch (error) {
      console.error('Failed to delete listing:', error);
      setError(error.userMessage || 'Failed to delete listing');
    }
  };

  const ListingSkeleton = () => (
    <div className="premium-card p-4">
      <div className="skeleton h-40 mb-4" />
      <div className="skeleton h-5 w-2/3 mb-2" />
      <div className="skeleton h-4 w-full mb-2" />
      <div className="skeleton h-4 w-1/2 mb-4" />
      <div className="skeleton h-9 w-full" />
    </div>
  );

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen py-10">
          <div className="section-container space-y-8">
            <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="chip mb-3">Campus marketplace</p>
                <h1 className="text-section-title">Discover Student Listings</h1>
                <p className="text-body-sm mt-2">Search by category, condition, and availability with a cleaner buying experience.</p>
              </div>
              <Button variant="gradient" size="lg" onClick={() => setShowForm((v) => !v)}>
                {showForm ? 'Close form' : 'Create listing'}
              </Button>
            </motion.div>

            {showForm && (
              <PremiumCard className="p-6 md:p-8">
                <h2 className="text-feature-title mb-4">New Listing</h2>
                {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
                <form onSubmit={handleCreateListing} className="grid md:grid-cols-2 gap-4">
                  <input className="premium-surface px-4 py-3" placeholder="Title" value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} required />
                  <input className="premium-surface px-4 py-3" placeholder="Category (books, electronics, ...)" value={formData.category} onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))} />
                  <input className="premium-surface px-4 py-3" placeholder="Price" type="number" value={formData.price} onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))} />
                  <input className="premium-surface px-4 py-3" placeholder="Location / Hostel" value={formData.location} onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))} />
                  <select className="premium-surface px-4 py-3" value={formData.condition} onChange={(e) => setFormData((p) => ({ ...p, condition: e.target.value }))}>
                    <option value="new">New</option>
                    <option value="like_new">Like new</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                  <textarea className="premium-surface px-4 py-3 md:col-span-2" rows="4" placeholder="Description" value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} />
                  <div className="md:col-span-2 flex gap-3">
                    <Button type="submit" variant="gradient">Publish</Button>
                    <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                  </div>
                </form>
              </PremiumCard>
            )}

            <div className="grid lg:grid-cols-[280px_1fr] gap-6">
              <PremiumCard className="p-5 h-fit sticky top-24">
                <h3 className="font-bold text-lg mb-4">Filters</h3>
                <div className="space-y-3">
                  <input
                    className="premium-surface w-full px-3 py-2.5 text-sm"
                    placeholder="Search listings"
                    value={filters.search}
                    onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                  />
                  <select className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
                    {listingCategories.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
                  </select>
                  <select className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.condition} onChange={(e) => setFilters((p) => ({ ...p, condition: e.target.value }))}>
                    <option value="all">All conditions</option>
                    <option value="new">New</option>
                    <option value="like_new">Like new</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                  <select className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.availability} onChange={(e) => setFilters((p) => ({ ...p, availability: e.target.value }))}>
                    <option value="all">Any status</option>
                    <option value="available">Available</option>
                    <option value="sold">Sold</option>
                    <option value="swapped">Swapped</option>
                  </select>
                  <Button className="w-full" variant="secondary" onClick={() => setFilters(defaultFilters)}>Reset filters</Button>
                </div>
              </PremiumCard>

              <div>
                {loading ? (
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {Array.from({ length: 6 }).map((_, i) => <ListingSkeleton key={i} />)}
                  </div>
                ) : filteredListings.length === 0 ? (
                  <PremiumCard className="p-10 text-center">
                    <h3 className="text-feature-title">No listings found</h3>
                    <p className="text-body-sm mt-2">Try another filter combination or create a new listing.</p>
                  </PremiumCard>
                ) : (
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredListings.map((listing, i) => (
                      <motion.div key={listing._id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <PremiumCard className="p-0 overflow-hidden h-full flex flex-col">
                          <div className="h-40 bg-gradient-to-br from-blue-500/20 via-violet-500/15 to-cyan-500/20 border-b border-slate-200/30" />
                          <div className="p-4 flex-1 flex flex-col">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-bold text-lg leading-snug">{listing.title}</h3>
                              <span className="chip">{listing.category || 'General'}</span>
                            </div>
                            <p className="text-body-sm mt-2 line-clamp-3">{listing.description || 'No description provided.'}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="chip">INR {listing.price || 0}</span>
                              <span className="chip">{listing.condition || 'used'}</span>
                              <span className="chip">{listing.location || 'Campus'}</span>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200/25 flex items-center justify-between gap-2">
                              <p className="text-xs text-slate-500">by {listing.user?.name || 'Student'}</p>
                              <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => navigate('/chat', { state: { selectedUserId: listing.user?._id } })}>Chat</Button>
                                {listing.user?._id === currentUserId && (
                                  <Button size="sm" variant="danger" onClick={() => handleDeleteListing(listing._id)}>Delete</Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </PremiumCard>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
