import { Link } from 'react-router-dom';
import { getMarketplaceImageUrl } from '../utils/listingForm';
import { formatListingCondition, formatListingStatus } from '../utils/listingPresentation';

export default function ListingCard({ listing, actions, showDescription = false, sellerLabel }) {
  const cover = listing.images?.[0];
  const href = `/listings/${listing._id}`;
  return (
    <article className="premium-card flex h-full min-w-0 flex-col overflow-hidden">
      <Link to={href} aria-label={`View ${listing.title}`} className="relative block overflow-hidden bg-slate-100 dark:bg-slate-800">
        {cover
          ? <img src={getMarketplaceImageUrl(cover)} alt={`${listing.title} product`} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover transition-transform duration-200 hover:scale-[1.02]" />
          : <div role="img" aria-label="No product image available" className="grid aspect-[4/3] place-items-center bg-slate-100 px-4 text-center text-sm font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">No image available</div>}
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${listing.availability === 'available' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100'}`}>{formatListingStatus(listing.availability)}</span>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{listing.category || 'General'}</p>
        <Link to={href} className="mt-1 line-clamp-2 text-base font-bold leading-snug text-slate-950 hover:text-blue-700 dark:text-white dark:hover:text-blue-300">{listing.title}</Link>
        <p className="mt-3 text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">₹{Number(listing.price || 0).toLocaleString('en-IN')}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs capitalize text-slate-600 dark:text-slate-400"><span>{formatListingCondition(listing.condition)}</span>{listing.location && <span className="truncate">{listing.location}</span>}</div>
        {showDescription && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{listing.description || 'No description provided.'}</p>}
        {sellerLabel && <p className="mt-3 truncate text-xs text-slate-500 dark:text-slate-400">{sellerLabel}</p>}
        {actions && <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">{actions}</div>}
      </div>
    </article>
  );
}
