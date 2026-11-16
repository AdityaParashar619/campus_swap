import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import FavoriteButton from '../components/FavoriteButton';
import ListingCard from '../components/ListingCard';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { getApiErrorMessage, listingAPI } from '../services/api';
import { buildListingQuery, createLatestRequestGuard, createListingSubmissionLock, DEFAULT_DISCOVERY_FILTERS, LISTING_CATEGORIES, mergeListingUpdate, scheduleDiscoverySearch, validateDiscoveryPrices, validateListingForm, validateSelectedImages } from '../utils/listingForm';

const formInit = { title: '', description: '', category: 'General', price: '', location: '', condition: 'good' };
const FieldError = ({ id, children }) => children ? <p id={id} className="mt-1 text-sm text-red-600">{children}</p> : null;

function ListingForm({ initialValues, initialImages, isEditing, submitting, errors, onCancel, onSubmit }) {
  const [values, setValues] = useState(initialValues);
  const [images, setImages] = useState(initialImages);
  const [imageError, setImageError] = useState('');
  const objectUrls = useRef(new Set());
  useEffect(() => setValues(initialValues), [initialValues]);
  useEffect(() => setImages(initialImages), [initialImages]);
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const update = (field) => (event) => setValues((previous) => ({ ...previous, [field]: event.target.value }));
  const inputClass = 'form-control';
  const selectImages = (event) => {
    const files = [...event.target.files];
    event.target.value = '';
    const duplicateKeys = new Set(images.filter((image) => image.file).map((image) => `${image.file.name}:${image.file.size}:${image.file.lastModified}`));
    const uniqueFiles = files.filter((file) => !duplicateKeys.has(`${file.name}:${file.size}:${file.lastModified}`));
    const validation = validateSelectedImages(uniqueFiles, images.length);
    if (validation.errors.length) { setImageError(validation.errors[0]); return; }
    setImageError('');
    setImages((current) => [...current, ...validation.accepted.map((file) => {
      const previewUrl = URL.createObjectURL(file); objectUrls.current.add(previewUrl);
      return { key: crypto.randomUUID(), file, url: previewUrl, pending: false };
    })]);
  };
  const removeImage = async (index) => {
    const image = images[index];
    if (image.file) { URL.revokeObjectURL(image.url); objectUrls.current.delete(image.url); }
    if (image.pending && image.id) void listingAPI.deletePendingImage(image.id).catch(() => undefined);
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };
  const moveImage = (index, direction) => setImages((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(values, images, setImages); }} className="grid gap-4 md:grid-cols-2" noValidate>
    <div><label className="mb-1 block text-sm font-semibold" htmlFor="listing-title">Title <span className="text-rose-600" aria-hidden="true">*</span></label><input id="listing-title" className={inputClass} value={values.title} onChange={update('title')} maxLength={120} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'listing-title-error' : undefined} required /><FieldError id="listing-title-error">{errors.title}</FieldError></div>
    <div><label className="mb-1 block text-sm font-semibold" htmlFor="listing-category">Category</label><select id="listing-category" className={inputClass} value={values.category} onChange={update('category')} aria-invalid={Boolean(errors.category)}>{LISTING_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><FieldError id="listing-category-error">{errors.category}</FieldError></div>
    <div><label className="mb-1 block text-sm font-semibold" htmlFor="listing-price">Price (INR)</label><input id="listing-price" className={inputClass} type="number" min="0" max="10000000" step="0.01" inputMode="decimal" value={values.price} onChange={update('price')} aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? 'listing-price-error' : undefined} /><FieldError id="listing-price-error">{errors.price}</FieldError></div>
    <div><label className="mb-1 block text-sm font-semibold" htmlFor="listing-location">Location / Hostel</label><input id="listing-location" className={inputClass} value={values.location} onChange={update('location')} maxLength={120} aria-invalid={Boolean(errors.location)} aria-describedby={errors.location ? 'listing-location-error' : undefined} /><FieldError id="listing-location-error">{errors.location}</FieldError></div>
    <div><label className="mb-1 block text-sm font-semibold" htmlFor="listing-condition">Condition</label><select id="listing-condition" className={inputClass} value={values.condition} onChange={update('condition')} aria-invalid={Boolean(errors.condition)}><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select><FieldError id="listing-condition-error">{errors.condition}</FieldError></div>
    <div className="md:col-span-2"><label className="mb-1 block text-sm font-semibold" htmlFor="listing-description">Description <span className="text-rose-600" aria-hidden="true">*</span></label><textarea id="listing-description" className={inputClass} rows="5" value={values.description} onChange={update('description')} maxLength={5000} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'listing-description-error' : undefined} /><div className="mt-1 flex justify-between gap-3"><FieldError id="listing-description-error">{errors.description}</FieldError><span className="ml-auto text-xs text-slate-500">{values.description.length}/5000</span></div></div>
    <div className="md:col-span-2">
      <label className="mb-1 block text-sm font-semibold" htmlFor="listing-images">Product images</label>
      <input id="listing-images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectImages} disabled={submitting || images.length >= 5} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white" aria-describedby="listing-images-help listing-images-error" />
      <p id="listing-images-help" className="mt-1 text-xs text-slate-500">Up to 5 JPEG, PNG, or WebP images, 5 MB each. Minimum 200 × 200 pixels.</p>
      {(imageError || errors.images) && <p id="listing-images-error" role="alert" className="mt-1 text-sm text-red-600">{imageError || errors.images}</p>}
      {images.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{images.map((image, index) => <div key={image.key || image.url} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
        <img src={image.url} alt={`Product preview ${index + 1}`} className="aspect-square w-full rounded-lg object-cover" />
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          <button type="button" onClick={() => moveImage(index, -1)} disabled={submitting || index === 0} aria-label={`Move image ${index + 1} earlier`} className="rounded px-2 py-1 text-xs disabled:opacity-40">←</button>
          <button type="button" onClick={() => moveImage(index, 1)} disabled={submitting || index === images.length - 1} aria-label={`Move image ${index + 1} later`} className="rounded px-2 py-1 text-xs disabled:opacity-40">→</button>
          <button type="button" onClick={() => removeImage(index)} disabled={submitting} aria-label={`Remove image ${index + 1}`} className="rounded px-2 py-1 text-xs text-red-700 disabled:opacity-40">Remove</button>
        </div>
      </div>)}</div>}
    </div>
    <p className="text-xs text-slate-500 md:col-span-2"><span className="text-rose-600">*</span> Required fields</p><div className="flex flex-wrap gap-3 md:col-span-2"><Button type="submit" disabled={submitting} aria-busy={submitting}>{submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Publish listing'}</Button><Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Cancel</Button></div>
  </form>;
}

export default function Listings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState({ ...DEFAULT_DISCOVERY_FILTERS });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false });
  const [filterErrors, setFilterErrors] = useState({});
  const [favoriteById, setFavoriteById] = useState({});
  const [formMode, setFormMode] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState(null);
  const submissionLock = useRef(createListingSubmissionLock());
  const requestGuard = useRef(createLatestRequestGuard());
  const { user } = useAuth();
  const { showToast } = useToast();
  const currentUserId = user?.id || user?._id;
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.editListing) {
      setFormErrors({}); setFormMode({ listing: location.state.editListing });
      window.history.replaceState({}, document.title);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (location.state?.createListing) {
      setFormMode({ listing: null });
      window.history.replaceState({}, document.title);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.state]);

  const fetchListings = async ({ signal, requestedPage = page, activeFilters = filters, search = debouncedSearch } = {}) => {
    const requestId = requestGuard.current.start();
    const priceErrors = validateDiscoveryPrices(activeFilters);
    setFilterErrors(priceErrors);
    if (Object.keys(priceErrors).length) { setLoading(false); return; }
    setLoading(true); setLoadError('');
    try {
      const response = await listingAPI.getAll(buildListingQuery({ ...activeFilters, search }, requestedPage), { signal });
      if (!requestGuard.current.isLatest(requestId)) return;
      const items = response.data.data || [];
      setListings(items);
      try { const favoriteResponse = await listingAPI.getFavoriteStatuses(items.map((item) => item._id), { signal }); if (requestGuard.current.isLatest(requestId)) setFavoriteById(favoriteResponse.data.data || {}); } catch (favoriteError) { if (favoriteError?.code !== 'ERR_CANCELED') setFavoriteById({}); }
      setPagination(response.data.pagination || { page: requestedPage, limit: 12, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: requestedPage > 1 });
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED' && requestGuard.current.isLatest(requestId)) setLoadError(getApiErrorMessage(error, 'Could not load listings.'));
    } finally { if (requestGuard.current.isLatest(requestId)) setLoading(false); }
  };
  useEffect(() => {
    return scheduleDiscoverySearch(() => { setDebouncedSearch(filters.search.trim()); setPage(1); }, 300, window);
  }, [filters.search]);
  useEffect(() => {
    const controller = new AbortController();
    fetchListings({ signal: controller.signal });
    return () => controller.abort();
  }, [page, debouncedSearch, filters.category, filters.condition, filters.minPrice, filters.maxPrice, filters.availability, filters.sort]);

  const changeFilter = (field) => (event) => {
    setFilters((current) => ({ ...current, [field]: event.target.value }));
    if (field !== 'search') setPage(1);
  };
  const resetFilters = () => { setFilters({ ...DEFAULT_DISCOVERY_FILTERS }); setDebouncedSearch(''); setFilterErrors({}); setPage(1); };

  const closeForm = () => { setFormMode(null); setFormErrors({}); };
  const handleSubmit = async (values, imageItems, setImageItems) => {
    if (!submissionLock.current.tryLock()) return;
    const validation = validateListingForm(values);
    if (Object.keys(validation.errors).length) { setFormErrors(validation.errors); submissionLock.current.release(); return; }
    setSubmitting(true); setFormErrors({});
    try {
      let savedImages = imageItems;
      const newFiles = imageItems.filter((image) => image.file).map((image) => image.file);
      if (newFiles.length) {
        const uploadResponse = await listingAPI.uploadImages(newFiles);
        let uploadIndex = 0;
        savedImages = imageItems.map((image) => image.file ? { key: uploadResponse.data.data[uploadIndex].id, ...uploadResponse.data.data[uploadIndex++], pending: true } : image);
        setImageItems(savedImages);
      }
      const payload = { ...validation.values, images: savedImages.map((image) => image.url) };
      if (formMode?.listing) await listingAPI.update(formMode.listing._id, payload); else await listingAPI.create(payload);
      showToast(formMode?.listing ? 'Listing updated.' : 'Listing published.', 'success'); closeForm(); setPage(1); await fetchListings({ requestedPage: 1 });
    } catch (error) { setFormErrors({ form: getApiErrorMessage(error, 'Could not save listing.') }); }
    finally { setSubmitting(false); submissionLock.current.release(); }
  };
  const handleDelete = async (listing) => {
    if (pendingActionId || !window.confirm(`Delete “${listing.title}”? This cannot be undone.`)) return;
    setPendingActionId(listing._id);
    try { await listingAPI.delete(listing._id); showToast('Listing deleted.', 'success'); await fetchListings(); }
    catch (error) { showToast(getApiErrorMessage(error, 'Could not delete listing.'), 'error'); await fetchListings(); }
    finally { setPendingActionId(null); }
  };
  const markSold = async (listing) => {
    if (pendingActionId) return; setPendingActionId(listing._id);
    try { const response = await listingAPI.update(listing._id, { availability: 'sold' }); setListings((items) => items.map((item) => item._id === listing._id ? mergeListingUpdate(item, response.data.data) : item)); showToast('Listing marked as sold.', 'success'); }
    catch (error) { showToast(getApiErrorMessage(error, 'Could not update listing status.'), 'error'); }
    finally { setPendingActionId(null); }
  };
  const editingValues = useMemo(() => formMode?.listing ? { title: formMode.listing.title || '', description: formMode.listing.description || '', category: LISTING_CATEGORIES.find((category) => category.toLowerCase() === formMode.listing.category?.toLowerCase()) || 'Other', price: formMode.listing.price ?? '', location: formMode.listing.location || '', condition: formMode.listing.condition || 'good' } : formInit, [formMode?.listing]);
  const editingImages = useMemo(() => (formMode?.listing?.images || []).map((url) => ({ key: url, url, pending: false })), [formMode?.listing]);

  return <PageTransition><Layout><div className="min-h-screen py-10"><div className="section-container space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Campus marketplace</p><h1 className="text-section-title">Discover student listings</h1><p className="text-body-sm mt-2">Buy, sell, and swap campus essentials.</p></div><Button size="lg" onClick={() => formMode ? closeForm() : setFormMode({ listing: null })}>{formMode ? 'Close form' : 'Create listing'}</Button></div>
    {formMode && <PremiumCard className="p-6 md:p-8" hover={false}><h2 className="text-feature-title mb-4">{formMode.listing ? 'Edit Listing' : 'New Listing'}</h2>{formErrors.form && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formErrors.form}</p>}<ListingForm key={formMode.listing?._id || 'new'} initialValues={editingValues} initialImages={editingImages} isEditing={Boolean(formMode.listing)} submitting={submitting} errors={formErrors} onCancel={closeForm} onSubmit={handleSubmit} /></PremiumCard>}
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <PremiumCard className="h-fit p-5 lg:sticky lg:top-24" hover={false}>
        <h2 className="mb-4 text-lg font-bold">Find listings</h2>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm font-semibold" htmlFor="listing-search">Search</label><input id="listing-search" className="form-control" placeholder="Title or description" maxLength={100} value={filters.search} onChange={changeFilter('search')} /></div>
          <div><label className="mb-1 block text-sm font-semibold" htmlFor="category-filter">Category</label><select id="category-filter" className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.category} onChange={changeFilter('category')}><option value="">All categories</option>{LISTING_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div>
          <div><label className="mb-1 block text-sm font-semibold" htmlFor="condition-filter">Condition</label><select id="condition-filter" className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.condition} onChange={changeFilter('condition')}><option value="">All conditions</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="mb-1 block text-sm font-semibold" htmlFor="min-price">Min price</label><input id="min-price" type="number" min="0" max="10000000" step="0.01" inputMode="decimal" className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.minPrice} onChange={changeFilter('minPrice')} aria-invalid={Boolean(filterErrors.minPrice)} /></div>
            <div><label className="mb-1 block text-sm font-semibold" htmlFor="max-price">Max price</label><input id="max-price" type="number" min="0" max="10000000" step="0.01" inputMode="decimal" className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.maxPrice} onChange={changeFilter('maxPrice')} aria-invalid={Boolean(filterErrors.maxPrice)} /></div>
          </div>
          {(filterErrors.minPrice || filterErrors.maxPrice) && <p role="alert" className="text-sm text-red-600">{filterErrors.minPrice || filterErrors.maxPrice}</p>}
          <div><label className="mb-1 block text-sm font-semibold" htmlFor="availability-filter">Availability</label><select id="availability-filter" className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.availability} onChange={changeFilter('availability')}><option value="">Any status</option><option value="available">Available</option><option value="sold">Sold</option><option value="swapped">Swapped</option></select></div>
          <div><label className="mb-1 block text-sm font-semibold" htmlFor="sort-listings">Sort</label><select id="sort-listings" className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.sort} onChange={changeFilter('sort')}><option value="newest">Newest</option><option value="price_asc">Price: Low to High</option><option value="price_desc">Price: High to Low</option></select></div>
          <Button className="w-full" variant="secondary" onClick={resetFilters}>Reset filters</Button>
        </div>
      </PremiumCard>
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2" aria-live="polite"><p className="text-sm text-slate-600">{pagination.total} matching {pagination.total === 1 ? 'listing' : 'listings'}</p>{pagination.totalPages > 0 && <p className="text-sm text-slate-600">Page {pagination.page} of {pagination.totalPages}</p>}</div>
        {loadError ? <PremiumCard className="p-10 text-center" hover={false}><h2 className="text-feature-title">Listings unavailable</h2><p role="alert" className="text-body-sm mt-2">{loadError}</p><Button className="mt-4" onClick={() => fetchListings()}>Retry</Button></PremiumCard> : loading ? <div aria-label="Loading listings" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="premium-card overflow-hidden"><div className="skeleton aspect-[4/3] rounded-none" /><div className="space-y-3 p-4"><div className="skeleton h-5" /><div className="skeleton h-7 w-24" /></div></div>)}</div> : listings.length === 0 ? <PremiumCard className="p-10 text-center" hover={false}><h2 className="text-feature-title">No listings found</h2><p className="text-body-sm mt-2">Try changing or resetting the discovery filters.</p><Button className="mt-5" variant="secondary" onClick={resetFilters}>Reset filters</Button></PremiumCard> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => { const isOwner = listing.user?._id === currentUserId; const busy = pendingActionId === listing._id; return <ListingCard key={listing._id} listing={listing} showDescription sellerLabel={`Listed by ${listing.user?.name || 'Student'}`} actions={<><Button size="sm" variant="secondary" onClick={() => navigate(`/listings/${listing._id}`)}>View details</Button><FavoriteButton listingId={listing._id} initialFavorite={Boolean(favoriteById[listing._id])} onChange={(value) => setFavoriteById((current) => ({ ...current, [listing._id]: value }))} />{isOwner && <><Button size="sm" variant="secondary" disabled={busy} onClick={() => { setFormErrors({}); setFormMode({ listing }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</Button>{listing.availability === 'available' && <Button size="sm" disabled={busy} onClick={() => markSold(listing)}>{busy ? 'Updating…' : 'Mark sold'}</Button>}<Button size="sm" variant="danger" disabled={busy} onClick={() => handleDelete(listing)}>{busy ? 'Working…' : 'Delete'}</Button></>}</>} />; })}</div>}
        {!loadError && !loading && <nav aria-label="Listing pages" className="mt-6 flex items-center justify-center gap-3"><Button variant="secondary" disabled={!pagination.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button><span className="text-sm">Page {pagination.page}{pagination.totalPages ? ` of ${pagination.totalPages}` : ''}</span><Button variant="secondary" disabled={!pagination.hasNextPage} onClick={() => setPage((current) => current + 1)}>Next</Button></nav>}
      </div>
    </div>
  </div></div></Layout></PageTransition>;
}
