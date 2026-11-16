import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import FavoriteButton from '../components/FavoriteButton';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import Layout from '../layouts/Layout';
import { getApiErrorMessage, listingAPI } from '../services/api';
import { getMarketplaceImageUrl, mergeListingUpdate } from '../utils/listingForm';
import { canContactListingSeller, createListingChatContext, isListingOwner, normalizeGalleryImages } from '../utils/listingDetails';
import { shareListing } from '../utils/listingShare';

const statusLabel = (status) => ({ available: 'Available', sold: 'Sold', swapped: 'Swapped' }[status] || status || 'Available');

export default function ListingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const currentUserId = user?.id || user?._id;
  const images = useMemo(() => normalizeGalleryImages(listing?.images), [listing?.images]);
  const owner = isListingOwner(listing, currentUserId);

  const load = async (signal) => {
    setLoading(true); setError('');
    try { const response = await listingAPI.getById(id, { signal }); setListing(response.data.data); try { const status = await listingAPI.getFavoriteStatuses([id], { signal }); setFavorite(Boolean(status.data.data[id])); } catch (favoriteError) { if (favoriteError?.code === 'ERR_CANCELED') throw favoriteError; setFavorite(false); } }
    catch (requestError) { if (requestError?.code !== 'ERR_CANCELED') setError(requestError?.response?.status === 404 ? 'This listing is unavailable or no longer exists.' : getApiErrorMessage(requestError, 'Could not load this listing.')); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [id]);

  const markSold = async () => {
    if (busy) return; setBusy(true);
    try { const response = await listingAPI.update(id, { availability: 'sold' }); setListing((current) => mergeListingUpdate(current, response.data.data)); showToast('Listing marked as sold.', 'success'); }
    catch (requestError) { showToast(getApiErrorMessage(requestError, 'Could not update listing.'), 'error'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy || !window.confirm(`Delete “${listing.title}”? This cannot be undone.`)) return;
    setBusy(true);
    try { await listingAPI.delete(id); showToast('Listing deleted.', 'success'); navigate('/my-listings', { replace: true }); }
    catch (requestError) { showToast(getApiErrorMessage(requestError, 'Could not delete listing.'), 'error'); setBusy(false); }
  };
  const share = async () => {
    try { const result = await shareListing({ listing }); if (result.status === 'shared') showToast('Listing shared.', 'success'); else if (result.status === 'copied') showToast('Listing link copied.', 'success'); }
    catch (shareError) { showToast(shareError.message || 'Could not share this listing.', 'error'); }
  };

  return <PageTransition><Layout><main className="min-h-screen overflow-x-hidden py-8 sm:py-10"><div className="section-container">
    {loading ? <div aria-label="Loading listing" className="grid gap-6 lg:grid-cols-2"><div className="skeleton aspect-[4/3]" /><div className="space-y-4"><div className="skeleton h-10" /><div className="skeleton h-6" /><div className="skeleton h-40" /></div></div> : error ? <PremiumCard className="p-10 text-center" hover={false}><h1 className="text-feature-title">Listing unavailable</h1><p role="alert" className="mt-2 text-body-sm">{error}</p><div className="mt-5 flex justify-center gap-3"><Button onClick={() => load()}>Retry</Button><Button variant="secondary" onClick={() => navigate('/listings')}>Back to marketplace</Button></div></PremiumCard> : listing && <div className="space-y-6">
      <Button variant="secondary" onClick={() => navigate('/listings')}>← Back to marketplace</Button>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section aria-label="Product images" className="space-y-3">
          <div className="premium-card grid aspect-[4/3] place-items-center overflow-hidden bg-slate-100">
            {images[selectedImage] && !brokenImages.has(selectedImage) ? <img src={getMarketplaceImageUrl(images[selectedImage])} alt={`${listing.title}, image ${selectedImage + 1}`} onError={() => setBrokenImages((current) => new Set(current).add(selectedImage))} className="h-full w-full object-contain" /> : <div role="img" aria-label="No product image available" className="grid h-full w-full place-items-center bg-gradient-to-br from-blue-500/15 via-violet-500/10 to-cyan-500/15 text-sm font-semibold text-slate-500">Image unavailable</div>}
          </div>
          {images.length > 1 && <div className="grid grid-cols-5 gap-2">{images.map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => setSelectedImage(index)} aria-label={`View product image ${index + 1}`} aria-pressed={selectedImage === index} className={`aspect-square overflow-hidden rounded-xl border-2 ${selectedImage === index ? 'border-blue-600' : 'border-transparent'}`}><img src={getMarketplaceImageUrl(image)} alt="" className="h-full w-full object-cover" /></button>)}</div>}
        </section>
        <PremiumCard className="h-fit p-6 sm:p-8" hover={false}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="chip">{listing.category || 'General'}</span><h1 className="mt-3 text-3xl font-black tracking-tight">{listing.title}</h1></div><span className="chip">{statusLabel(listing.availability)}</span></div>
          <p className="mt-5 text-3xl font-black">INR {Number(listing.price || 0).toLocaleString('en-IN')}</p>
          <div className="mt-5 flex flex-wrap gap-2"><span className="chip">Condition: {(listing.condition || 'good').replace('_', ' ')}</span>{listing.location && <span className="chip">Location: {listing.location}</span>}</div>
          <section className="mt-7"><h2 className="text-lg font-bold">Description</h2><p className="mt-2 whitespace-pre-wrap text-body-sm">{listing.description || 'No description provided.'}</p></section>
          <section className="mt-7 border-t border-slate-200/40 pt-5"><h2 className="text-lg font-bold">Seller</h2><p className="mt-2 font-semibold">{listing.user?.name || 'Campus user'}</p>{listing.user?.verifiedInstitutionalAccount && <p className="mt-1 text-sm text-emerald-700">✓ Verified institutional account</p>}<p className="mt-2 text-xs text-slate-500">Listed {new Date(listing.createdAt).toLocaleDateString()}</p></section>
          <div className="mt-7 flex flex-wrap gap-3"><Button variant="secondary" onClick={share}>Share</Button><FavoriteButton listingId={listing._id} initialFavorite={favorite} onChange={setFavorite} />{owner ? <><Button onClick={() => navigate('/listings', { state: { editListing: listing } })}>Edit listing</Button>{listing.availability === 'available' && <Button disabled={busy} onClick={markSold}>Mark as sold</Button>}<Button variant="danger" disabled={busy} onClick={remove}>Delete</Button></> : <Button variant="gradient" disabled={!canContactListingSeller(listing, currentUserId)} onClick={() => navigate('/chat', { state: { selectedUserId: listing.user._id, listingContext: createListingChatContext(listing) } })}>{listing.availability === 'available' ? 'Contact seller' : `Listing ${statusLabel(listing.availability).toLowerCase()}`}</Button>}</div>
        </PremiumCard>
      </div>
    </div>}
  </div></main></Layout></PageTransition>;
}

