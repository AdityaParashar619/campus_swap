export const getSellerId = (listing) => listing?.user?._id || listing?.user?.id || null;

export const isListingOwner = (listing, currentUserId) => Boolean(currentUserId && getSellerId(listing) === currentUserId);

export const canContactListingSeller = (listing, currentUserId) => Boolean(
  getSellerId(listing) && !isListingOwner(listing, currentUserId) && listing?.availability === 'available'
);

export const createListingChatContext = (listing) => ({
  listingId: listing._id,
  title: listing.title,
  draft: `Hi, I'm interested in “${listing.title}”. Is it still available?`
});

export const normalizeGalleryImages = (images) => Array.isArray(images)
  ? images.filter((image) => typeof image === 'string' && image.trim()).slice(0, 5)
  : [];

