export const BASE_NAVIGATION = Object.freeze([
  { href: '/listings', label: 'Marketplace' },
  { href: '/my-listings', label: 'My Listings' },
  { href: '/saved-listings', label: 'Saved' },
  { href: '/notes', label: 'Notes' },
  { href: '/bounties', label: 'Requests' },
  { href: '/network', label: 'Network' },
  { href: '/chat', label: 'Chat' },
  { href: '/about', label: 'About' }
]);

const ADMIN_ROLES = new Set(['admin', 'college_admin', 'super_admin']);

export const getNavigationLinks = (role) => ADMIN_ROLES.has(role)
  ? [...BASE_NAVIGATION, { href: '/admin', label: 'Admin' }]
  : [...BASE_NAVIGATION];

export const getAccountIdentity = (name) => {
  const displayName = typeof name === 'string' && name.trim() ? name.trim() : 'Profile';
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return { displayName, initials };
};
