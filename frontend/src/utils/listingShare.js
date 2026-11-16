export const getCanonicalListingUrl = (listingId, origin = globalThis.location?.origin || '') =>
  `${origin.replace(/\/$/, '')}/listings/${encodeURIComponent(listingId)}`;

export const shareListing = async ({ listing, navigatorApi = globalThis.navigator || {}, origin = globalThis.location?.origin || '' }) => {
  const url = getCanonicalListingUrl(listing._id, origin);
  const payload = { title: listing.title, text: `View ${listing.title} on CampusSwap`, url };
  if (typeof navigatorApi.share === 'function') {
    try { await navigatorApi.share(payload); return { status: 'shared', url }; }
    catch (error) {
      if (error?.name === 'AbortError') return { status: 'cancelled', url };
      // A denied or unsupported native share may still succeed through the clipboard fallback.
    }
  }
  if (typeof navigatorApi.clipboard?.writeText !== 'function') throw new Error('Sharing and clipboard access are unavailable.');
  await navigatorApi.clipboard.writeText(url);
  return { status: 'copied', url };
};

