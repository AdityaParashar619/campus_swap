import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import ListingCard from '../components/ListingCard';
import { useToast } from '../context/ToastContext';
import Layout from '../layouts/Layout';
import { getApiErrorMessage, listingAPI } from '../services/api';

export default function MyListings() {
  const [listings, setListings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate(); const { showToast } = useToast();
  const load = async (signal) => { setLoading(true); setError(''); try { const response = await listingAPI.getMine({ page, limit: 12 }, { signal }); setListings(response.data.data || []); setPagination(response.data.pagination); } catch (requestError) { if (requestError?.code !== 'ERR_CANCELED') setError(getApiErrorMessage(requestError, 'Could not load your listings.')); } finally { if (!signal?.aborted) setLoading(false); } };
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [page]);
  const updateStatus = async (listing) => { if (busyId) return; setBusyId(listing._id); try { const response = await listingAPI.update(listing._id, { availability: 'sold' }); setListings((items) => items.map((item) => item._id === listing._id ? { ...item, ...response.data.data, user: item.user } : item)); showToast('Listing marked as sold.', 'success'); } catch (requestError) { showToast(getApiErrorMessage(requestError, 'Could not update listing.'), 'error'); } finally { setBusyId(null); } };
  const remove = async (listing) => { if (busyId || !window.confirm(`Delete “${listing.title}”? This cannot be undone.`)) return; setBusyId(listing._id); try { await listingAPI.delete(listing._id); showToast('Listing deleted.', 'success'); await load(); } catch (requestError) { showToast(getApiErrorMessage(requestError, 'Could not delete listing.'), 'error'); } finally { setBusyId(null); } };
  return <PageTransition><Layout><main className="min-h-screen overflow-x-hidden py-8 sm:py-10"><div className="section-container space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="chip mb-3">Seller workspace</p><h1 className="text-section-title">My Listings</h1><p className="mt-2 text-body-sm">Manage your active, sold, and swapped listings.</p></div><Button variant="gradient" onClick={() => navigate('/listings', { state: { createListing: true } })}>Create listing</Button></div>
    {error ? <PremiumCard className="p-10 text-center" hover={false}><h2 className="text-feature-title">Could not load listings</h2><p role="alert" className="mt-2 text-body-sm">{error}</p><Button className="mt-4" onClick={() => load()}>Retry</Button></PremiumCard> : loading ? <div aria-label="Loading your listings" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="premium-card overflow-hidden"><div className="skeleton aspect-[4/3] rounded-none" /><div className="space-y-3 p-4"><div className="skeleton h-5" /><div className="skeleton h-7 w-24" /></div></div>)}</div> : listings.length === 0 ? <PremiumCard className="p-10 text-center" hover={false}><h2 className="text-feature-title">No listings yet</h2><p className="mt-2 text-body-sm">Publish your first campus marketplace listing.</p><Button className="mt-5" onClick={() => navigate('/listings', { state: { createListing: true } })}>Create listing</Button></PremiumCard> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => <ListingCard key={listing._id} listing={listing} actions={<><Button size="sm" variant="secondary" onClick={() => navigate('/listings', { state: { editListing: listing } })}>Edit</Button>{listing.availability === 'available' && <Button size="sm" disabled={busyId === listing._id} onClick={() => updateStatus(listing)}>Mark sold</Button>}<Button size="sm" variant="danger" disabled={busyId === listing._id} onClick={() => remove(listing)}>Delete</Button></>} />)}</div>}
    {!loading && !error && pagination.totalPages > 1 && <nav aria-label="My listing pages" className="flex items-center justify-center gap-3"><Button variant="secondary" disabled={!pagination.hasPreviousPage} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {pagination.page} of {pagination.totalPages}</span><Button variant="secondary" disabled={!pagination.hasNextPage} onClick={() => setPage((value) => value + 1)}>Next</Button></nav>}
  </div></main></Layout></PageTransition>;
}
