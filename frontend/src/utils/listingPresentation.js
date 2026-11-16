export const formatListingStatus = (status) => ({ available: 'Available', sold: 'Sold', swapped: 'Swapped' }[status] || 'Available');
export const formatListingCondition = (condition) => (condition || 'good').replaceAll('_', ' ');
