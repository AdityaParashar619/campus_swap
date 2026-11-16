import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FavoriteButton from '../components/FavoriteButton';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import ListingCard from '../components/ListingCard';
import Layout from '../layouts/Layout';
import { getApiErrorMessage, listingAPI } from '../services/api';

export default function SavedListings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]); const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false });
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async (signal) => { setLoading(true); setError(''); try { const response = await listingAPI.getSaved({ page, limit: 12 }, { signal }); setListings(response.data.data || []); setPagination(response.data.pagination); } catch (requestError) { if (requestError?.code !== 'ERR_CANCELED') setError(getApiErrorMessage(requestError, 'Could not load saved listings.')); } finally { if (!signal?.aborted) setLoading(false); } };
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [page]);
  const removed = (id) => { setListings((items) => items.filter((item) => item._id !== id)); setPagination((value) => ({ ...value, total: Math.max(0, value.total - 1) })); };
  return <PageTransition><Layout><main className="min-h-screen overflow-x-hidden py-8 sm:py-10"><div className="section-container space-y-6"><div><p className="chip mb-3">Your collection</p><h1 className="text-section-title">Saved Listings</h1><p className="mt-2 text-body-sm">Products you want to revisit.</p></div>
    {error ? <PremiumCard className="p-8 text-center sm:p-10" hover={false}><h2 className="text-feature-title">Could not load favorites</h2><p role="alert" className="mt-2 text-body-sm">{error}</p><Button className="mt-4 min-h-11" onClick={() => load()}>Retry</Button></PremiumCard> : loading ? <div aria-label="Loading saved listings" aria-live="polite" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="premium-card overflow-hidden"><div className="skeleton aspect-[4/3] rounded-none" /><div className="space-y-3 p-4"><div className="skeleton h-5" /><div className="skeleton h-7 w-24" /></div></div>)}</div> : listings.length === 0 ? <PremiumCard className="p-8 text-center sm:p-10" hover={false}><h2 className="text-feature-title">No saved listings</h2><p className="mt-2 text-body-sm">Save products from the marketplace to find them here.</p><Button className="mt-5 min-h-11" onClick={() => navigate('/listings')}>Explore marketplace</Button></PremiumCard> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => <ListingCard key={listing._id} listing={listing} actions={<><Button size="sm" variant="secondary" onClick={() => navigate(`/listings/${listing._id}`)}>View details</Button><FavoriteButton listingId={listing._id} initialFavorite onChange={(value) => { if (!value) removed(listing._id); }} /></>} />)}</div>}
    {!loading && !error && pagination.totalPages > 1 && <nav aria-label="Saved listing pages" className="flex flex-wrap items-center justify-center gap-3"><Button className="min-h-11" variant="secondary" disabled={!pagination.hasPreviousPage} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {pagination.page} of {pagination.totalPages}</span><Button className="min-h-11" variant="secondary" disabled={!pagination.hasNextPage} onClick={() => setPage((value) => value + 1)}>Next</Button></nav>}
  </div></main></Layout></PageTransition>;
}
