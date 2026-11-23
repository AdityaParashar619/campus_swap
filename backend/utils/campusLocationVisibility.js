export const publishedCampusLocationFilter = () => ({
  status: 'published',
  coordinateVerificationStatus: 'verified',
  latitude: { $gte: -90, $lte: 90 },
  longitude: { $gte: -180, $lte: 180 },
  coordinateSource: { $type: 'string', $ne: '' },
  coordinateVerifiedAt: { $type: 'date' },
  coordinateVerifiedBy: { $type: 'objectId' },
  publishedAt: { $type: 'date', $lte: new Date() }
});
