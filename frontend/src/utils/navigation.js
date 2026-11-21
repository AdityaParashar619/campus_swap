const ADMIN_ROLES = new Set(['admin', 'college_admin', 'super_admin']);
const freezeItems = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

export const COLLEGE_SERVICE_ITEMS = freezeItems([
  { href: '/my-department', label: 'My Department' },
  { href: '/notices', label: 'Notice Board' },
  { label: 'Campus Map', disabled: true, status: 'Coming soon' },
  { label: 'Campus Issues', disabled: true, status: 'Coming soon' }
]);

export const BASE_NAVIGATION_SECTIONS = Object.freeze([
  Object.freeze({ id: 'college-services', label: 'College Services', items: COLLEGE_SERVICE_ITEMS }),
  Object.freeze({ id: 'student-community', label: 'Student Community', items: freezeItems([
    { href: '/listings', label: 'Marketplace' },
    { href: '/my-listings', label: 'My Listings' },
    { href: '/saved-listings', label: 'Favorites' },
    { href: '/chat', label: 'Chat' },
    { href: '/network', label: 'Network' },
    { href: '/bounties', label: 'Community Requests' },
    { href: '/notes', label: 'Notes' }
  ]) }),
  Object.freeze({ id: 'account', label: 'Account', items: freezeItems([
    { href: '/profile', label: 'Profile & Settings' },
    { href: '/about', label: 'About CampusSwap' }
  ]) })
]);

export const getNavigationSections = (role) => BASE_NAVIGATION_SECTIONS.map((section) => ({
  ...section,
  items: section.id === 'account' && ADMIN_ROLES.has(role) ? [...section.items, { href: '/admin', label: 'Admin' }] : [...section.items]
}));

export const getNavigationLinks = (role) => getNavigationSections(role).flatMap((section) => section.items.filter((item) => item.href));
export const BASE_NAVIGATION = Object.freeze(getNavigationLinks('student'));
export const getBrandDestination = (user) => user ? '/dashboard' : '/';
export const isNavigationActive = (pathname, href) => pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

export const getAccountIdentity = (name) => {
  const displayName = typeof name === 'string' && name.trim() ? name.trim() : 'Profile';
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return { displayName, initials };
};
