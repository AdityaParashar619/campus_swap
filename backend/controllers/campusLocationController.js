import mongoose from 'mongoose';
import CampusLocation, { hasCoordinatePair, LOCATION_TEXT_LIMITS } from '../models/CampusLocation.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, Conflict, NotFound } from '../utils/AppError.js';
import { normalizeLocation, parseLocationList, readCoordinateReview, requireFields } from '../utils/campusLocationValidation.js';

const publicFields = [...Object.keys(LOCATION_TEXT_LIMITS), 'category', 'latitude', 'longitude', 'buildingCode', 'aliases'];
const publicFilter = () => ({
  status: 'published',
  coordinateVerificationStatus: 'verified',
  latitude: { $gte: -90, $lte: 90 },
  longitude: { $gte: -180, $lte: 180 },
  coordinateSource: { $type: 'string', $ne: '' },
  coordinateVerifiedAt: { $type: 'date' },
  coordinateVerifiedBy: { $type: 'objectId' },
  publishedAt: { $type: 'date', $lte: new Date() }
});
const publicView = ({ _id, ...data }) => ({ id: String(_id), ...data });
const assertId = (id) => {
  if (!mongoose.isObjectIdOrHexString(id)) throw new BadRequest('Invalid campus location ID');
};

const list = (admin) => asyncHandler(async (req, res) => {
  const { filter, page, limit, skip } = parseLocationList(req.query, admin);
  const criteria = admin ? filter : { ...filter, ...publicFilter() };
  const query = CampusLocation.find(criteria).sort({ name: 1, _id: 1 }).skip(skip).limit(limit);
  if (!admin) query.select(publicFields.join(' '));
  const [locations, total] = await Promise.all([query.lean(), CampusLocation.countDocuments(criteria)]);
  res.json({ success: true, data: admin ? locations : locations.map(publicView), pagination: {
    page, limit, total, totalPages: Math.ceil(total / limit)
  } });
});

const detail = (admin) => asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const criteria = { _id: req.params.id, ...(!admin && publicFilter()) };
  const query = CampusLocation.findOne(criteria);
  if (!admin) query.select(publicFields.join(' '));
  const location = await query.lean();
  if (!location) throw new NotFound('Campus location not found');
  res.json({ success: true, data: admin ? location : publicView(location) });
});

export const listAdminLocations = list(true);
export const listStudentLocations = list(false);
export const getAdminLocation = detail(true);
export const getStudentLocation = detail(false);

export const createLocation = asyncHandler(async (req, res) => {
  const data = normalizeLocation(req.body);
  const admin = req.user.userId;
  const location = await CampusLocation.create({ ...data, createdBy: admin, updatedBy: admin });
  res.status(201).json({ success: true, data: location });
});

const mutate = (change) => asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const location = await CampusLocation.findById(req.params.id);
  if (!location) throw new NotFound('Campus location not found');
  const expectedVersion = req.get('If-Match');
  if (expectedVersion !== undefined) {
    if (!/^"\d+"$/.test(expectedVersion)) throw new BadRequest('If-Match must contain a quoted location version');
    if (expectedVersion !== `"${location.__v}"`) {
      throw new Conflict('Location changed. Reload it before retrying.');
    }
  }
  change(location, req.body, req.user.userId);
  location.updatedBy = req.user.userId;
  try {
    await location.save();
  } catch (error) {
    if (error instanceof mongoose.Error.VersionError) throw new Conflict('Location changed. Reload it before retrying.');
    throw error;
  }
  res.json({ success: true, data: location });
});

export const updateLocation = mutate((location, body) => {
  const data = normalizeLocation(body, true);
  const coordinatesChanged = ['latitude', 'longitude']
    .some((field) => Object.hasOwn(data, field) && data[field] !== location[field]);
  Object.assign(location, data);
  if (coordinatesChanged) {
    location.coordinateVerificationStatus = 'unverified';
    location.coordinateSource = '';
    location.coordinateVerifiedAt = null;
    location.coordinateVerifiedBy = null;
    if (location.status === 'published') {
      location.status = 'draft';
      location.publishedAt = null;
    }
  }
});

export const verifyLocation = mutate((location, body, admin) => {
  const { source, latitude, longitude } = readCoordinateReview(body);
  if (!hasCoordinatePair(location)) throw new BadRequest('Both valid coordinates are required before verification');
  if (latitude !== location.latitude || longitude !== location.longitude) {
    throw new Conflict('Coordinates changed. Reload and review the current pair.');
  }
  location.coordinateSource = source;
  location.coordinateVerificationStatus = 'verified';
  location.coordinateVerifiedAt = new Date();
  location.coordinateVerifiedBy = admin;
});

export const publishLocation = mutate((location, body) => {
  requireFields(body ?? {}, new Set());
  if (!hasCoordinatePair(location) || location.coordinateVerificationStatus !== 'verified') {
    throw new BadRequest('Explicit coordinate verification is required before publication');
  }
  if (location.status !== 'published') location.publishedAt = new Date();
  location.status = 'published';
  location.archivedAt = null;
});

export const archiveLocation = mutate((location, body) => {
  requireFields(body ?? {}, new Set());
  if (location.status !== 'published') throw new BadRequest('Only a published location can be archived');
  location.status = 'archived';
  location.archivedAt = new Date();
});
