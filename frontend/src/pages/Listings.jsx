import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { getApiErrorMessage, listingAPI } from '../services/api';
import { createListingSubmissionLock, LISTING_CATEGORIES, validateListingForm } from '../utils/listingForm';

const defaultFilters = { search: '', category: 'all', condition: 'all', availability: 'all' };
const formInit = { title: '', description: '', category: 'General', price: '', location: '', condition: 'good' };
const FieldError = ({ id, children }) => children ? <p id={id} className="mt-1 text-sm text-red-600">{children}</p> : null;

function ListingForm({ initialValues, isEditing, submitting, errors, onCancel, onSubmit }) {
  const [values, setValues] = useState(initialValues);
  useEffect(() => setValues(initialValues), [initialValues]);
  const update = (field) => (event) => setValues((previous) => ({ ...previous, [field]: event.target.value }));
  const inputClass = 'premium-surface w-full px-4 py-3';
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(values); }} className="grid gap-4 md:grid-cols-2" noValidate>
    <div><label className="mb-1 block text-sm font-semibold" htmlFor="listing-title">Title</label><input id="listing-title" className={inputClass} value={values.title} onChange={update('title')} maxLength={120} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'listing-title-error' : undefined} required /><FieldError id="listing-title-error">{errors.title}</FieldError></div>
    <div><label className="mb-1 block text-sm font-semibold" htmlFor="listing-category">Category</label><select id="listing-category" className={inputClass} value={values.category} onChange={update('category')} aria-invalid={Boolean(errors.category)}>{LISTING_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><FieldError id="listing-category-error">{errors.category}</FieldError></div>
    <div><label className="mb-1 block text-sm font-semibold" htmlFor="listing-price">Price (INR)</label><input id="listing-price" className={inputClass} type="number" min="0" max="10000000" step="0.01" inputMode="decimal" value={values.price} onChange={update('price')} aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? 'listing-price-error' : undefined} /><FieldError id="listing-price-error">{errors.price}</FieldError></div>
    <div><label className="mb-1 block text-sm font-semibold" htmlFor="listing-location">Location / Hostel</label><input id="listing-location" className={inputClass} value={values.location} onChange={update('location')} maxLength={120} aria-invalid={Boolean(errors.location)} aria-describedby={errors.location ? 'listing-location-error' : undefined} /><FieldError id="listing-location-error">{errors.location}</FieldError></div>
    <div><label className="mb-1 block text-sm font-semibold" htmlFor="listing-condition">Condition</label><select id="listing-condition" className={inputClass} value={values.condition} onChange={update('condition')} aria-invalid={Boolean(errors.condition)}><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select><FieldError id="listing-condition-error">{errors.condition}</FieldError></div>
    <div className="md:col-span-2"><label className="mb-1 block text-sm font-semibold" htmlFor="listing-description">Description</label><textarea id="listing-description" className={inputClass} rows="4" value={values.description} onChange={update('description')} maxLength={5000} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'listing-description-error' : undefined} /><FieldError id="listing-description-error">{errors.description}</FieldError></div>
    <div className="flex flex-wrap gap-3 md:col-span-2"><Button type="submit" variant="gradient" disabled={submitting} aria-busy={submitting}>{submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Publish listing'}</Button><Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Cancel</Button></div>
  </form>;
}

export default function Listings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [formMode, setFormMode] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState(null);
  const submissionLock = useRef(createListingSubmissionLock());
  const { user } = useAuth();
  const { showToast } = useToast();
  const currentUserId = user?.id || user?._id;
  const navigate = useNavigate();

  const fetchListings = async () => {
    setLoading(true); setLoadError('');
    try { const response = await listingAPI.getAll(); setListings(response.data.data || []); }
    catch (error) { setLoadError(getApiErrorMessage(error, 'Could not load listings.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchListings(); }, []);

  const filteredListings = useMemo(() => listings.filter((listing) => {
    const search = filters.search.trim().toLowerCase();
    return (!search || listing.title?.toLowerCase().includes(search) || listing.description?.toLowerCase().includes(search)) && (filters.category === 'all' || listing.category?.toLowerCase() === filters.category.toLowerCase()) && (filters.condition === 'all' || listing.condition === filters.condition) && (filters.availability === 'all' || listing.availability === filters.availability);
  }), [listings, filters]);

  const closeForm = () => { setFormMode(null); setFormErrors({}); };
  const handleSubmit = async (values) => {
    if (!submissionLock.current.tryLock()) return;
    const validation = validateListingForm(values);
    if (Object.keys(validation.errors).length) { setFormErrors(validation.errors); submissionLock.current.release(); return; }
    setSubmitting(true); setFormErrors({});
    try {
      if (formMode?.listing) await listingAPI.update(formMode.listing._id, validation.values); else await listingAPI.create(validation.values);
      showToast(formMode?.listing ? 'Listing updated.' : 'Listing published.', 'success'); closeForm(); await fetchListings();
    } catch (error) { setFormErrors({ form: getApiErrorMessage(error, 'Could not save listing.') }); }
    finally { setSubmitting(false); submissionLock.current.release(); }
  };
  const handleDelete = async (listing) => {
    if (pendingActionId || !window.confirm(`Delete “${listing.title}”? This cannot be undone.`)) return;
    setPendingActionId(listing._id);
    try { await listingAPI.delete(listing._id); setListings((items) => items.filter((item) => item._id !== listing._id)); showToast('Listing deleted.', 'success'); }
    catch (error) { showToast(getApiErrorMessage(error, 'Could not delete listing.'), 'error'); await fetchListings(); }
    finally { setPendingActionId(null); }
  };
  const markSold = async (listing) => {
    if (pendingActionId) return; setPendingActionId(listing._id);
    try { const response = await listingAPI.update(listing._id, { availability: 'sold' }); setListings((items) => items.map((item) => item._id === listing._id ? response.data.data : item)); showToast('Listing marked as sold.', 'success'); }
    catch (error) { showToast(getApiErrorMessage(error, 'Could not update listing status.'), 'error'); }
    finally { setPendingActionId(null); }
  };
  const editingValues = formMode?.listing ? { title: formMode.listing.title || '', description: formMode.listing.description || '', category: LISTING_CATEGORIES.find((category) => category.toLowerCase() === formMode.listing.category?.toLowerCase()) || 'Other', price: formMode.listing.price ?? '', location: formMode.listing.location || '', condition: formMode.listing.condition || 'good' } : formInit;

  return <PageTransition><Layout><div className="min-h-screen py-10"><div className="section-container space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="chip mb-3">Campus marketplace</p><h1 className="text-section-title">Discover Student Listings</h1><p className="text-body-sm mt-2">Buy, sell, and swap campus essentials.</p></div><Button variant="gradient" size="lg" onClick={() => formMode ? closeForm() : setFormMode({ listing: null })}>{formMode ? 'Close form' : 'Create listing'}</Button></div>
    {formMode && <PremiumCard className="p-6 md:p-8" hover={false}><h2 className="text-feature-title mb-4">{formMode.listing ? 'Edit Listing' : 'New Listing'}</h2>{formErrors.form && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formErrors.form}</p>}<ListingForm key={formMode.listing?._id || 'new'} initialValues={editingValues} isEditing={Boolean(formMode.listing)} submitting={submitting} errors={formErrors} onCancel={closeForm} onSubmit={handleSubmit} /></PremiumCard>}
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]"><PremiumCard className="h-fit p-5 lg:sticky lg:top-24" hover={false}><h2 className="mb-4 text-lg font-bold">Filters</h2><div className="space-y-3"><label className="sr-only" htmlFor="listing-search">Search listings</label><input id="listing-search" className="premium-surface w-full px-3 py-2.5 text-sm" placeholder="Search listings" value={filters.search} onChange={(event) => setFilters((value) => ({ ...value, search: event.target.value }))} /><label className="sr-only" htmlFor="category-filter">Category</label><select id="category-filter" className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.category} onChange={(event) => setFilters((value) => ({ ...value, category: event.target.value }))}><option value="all">All categories</option>{LISTING_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><select aria-label="Condition" className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.condition} onChange={(event) => setFilters((value) => ({ ...value, condition: event.target.value }))}><option value="all">All conditions</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select><select aria-label="Availability" className="premium-surface w-full px-3 py-2.5 text-sm" value={filters.availability} onChange={(event) => setFilters((value) => ({ ...value, availability: event.target.value }))}><option value="all">Any status</option><option value="available">Available</option><option value="sold">Sold</option><option value="swapped">Swapped</option></select><Button className="w-full" variant="secondary" onClick={() => setFilters(defaultFilters)}>Reset filters</Button></div></PremiumCard>
      <div>{loadError ? <PremiumCard className="p-10 text-center" hover={false}><h2 className="text-feature-title">Listings unavailable</h2><p role="alert" className="text-body-sm mt-2">{loadError}</p><Button className="mt-4" onClick={fetchListings}>Retry</Button></PremiumCard> : loading ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="premium-card p-4"><div className="skeleton mb-4 h-40" /><div className="skeleton mb-2 h-5 w-2/3" /><div className="skeleton h-4 w-full" /></div>)}</div> : filteredListings.length === 0 ? <PremiumCard className="p-10 text-center" hover={false}><h2 className="text-feature-title">No listings found</h2><p className="text-body-sm mt-2">Try another filter combination or create a new listing.</p></PremiumCard> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filteredListings.map((listing) => { const isOwner = listing.user?._id === currentUserId; const busy = pendingActionId === listing._id; return <motion.div key={listing._id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}><PremiumCard className="flex h-full flex-col overflow-hidden p-0"><div className="h-40 border-b border-slate-200/30 bg-gradient-to-br from-blue-500/20 via-violet-500/15 to-cyan-500/20" /><div className="flex flex-1 flex-col p-4"><div className="flex items-start justify-between gap-2"><h2 className="text-lg font-bold leading-snug">{listing.title}</h2><span className="chip">{listing.category || 'General'}</span></div><p className="text-body-sm mt-2 line-clamp-3">{listing.description || 'No description provided.'}</p><div className="mt-4 flex flex-wrap gap-2"><span className="chip">INR {listing.price || 0}</span><span className="chip">{listing.condition || 'good'}</span><span className={`chip ${listing.availability === 'sold' ? 'text-red-700' : ''}`}>{listing.availability || 'available'}</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/25 pt-4"><p className="text-xs text-slate-500">by {listing.user?.name || 'Student'}</p><div className="flex flex-wrap gap-2">{!isOwner && <Button size="sm" variant="secondary" onClick={() => navigate('/chat', { state: { selectedUserId: listing.user?._id } })}>Chat</Button>}{isOwner && <><Button size="sm" variant="secondary" disabled={busy} onClick={() => { setFormErrors({}); setFormMode({ listing }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</Button>{listing.availability === 'available' && <Button size="sm" disabled={busy} onClick={() => markSold(listing)}>{busy ? 'Updating…' : 'Mark sold'}</Button>}<Button size="sm" variant="danger" disabled={busy} onClick={() => handleDelete(listing)}>{busy ? 'Working…' : 'Delete'}</Button></>}</div></div></div></PremiumCard></motion.div>; })}</div>}</div></div>
  </div></div></Layout></PageTransition>;
}
