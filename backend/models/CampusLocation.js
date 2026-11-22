import mongoose from 'mongoose';

export const LOCATION_CATEGORIES = Object.freeze([
  'academic', 'administration', 'library', 'hostel', 'sports', 'food',
  'medical', 'parking', 'facility', 'other'
]);
export const LOCATION_STATUSES = Object.freeze(['draft', 'published', 'archived']);
export const LOCATION_TEXT_LIMITS = Object.freeze({
  name: 120, description: 2000, addressDescription: 500, floorInformation: 500,
  accessibilityNotes: 500, openingHoursText: 300, contactInformation: 300,
  imageUrl: 2048, externalMapUrl: 2048
});
export const COORDINATE_LIMITS = Object.freeze({ latitude: 90, longitude: 180 });
export const isCoordinate = (value, limit) => Number.isFinite(value) && Math.abs(value) <= limit;
export const isLocationUrl = (value) => {
  try {
    const url = new URL(value);
    return /^https:\/\//i.test(value) && url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
};

const textFields = Object.fromEntries(Object.entries(LOCATION_TEXT_LIMITS).map(([field, maxlength]) => [
  field, {
    type: String, trim: true, maxlength, required: field === 'name',
    ...(field.endsWith('Url') && { validate: (value) => !value || isLocationUrl(value) })
  }
]));
const coordinateFields = Object.fromEntries(Object.entries(COORDINATE_LIMITS).map(([field, limit]) => [
  field, {
    type: Number, default: null,
    set(value) {
      // Reject coercion before Mongoose's Number caster runs.
      if (value != null && !isCoordinate(value, limit)) {
        throw new mongoose.Error.CastError('Number', value, field);
      }
      return value;
    }
  }
]));
const schema = new mongoose.Schema({
  ...textFields,
  ...coordinateFields,
  category: { type: String, required: true, enum: LOCATION_CATEGORIES },
  buildingCode: { type: String, trim: true, uppercase: true, match: /^[A-Z0-9][A-Z0-9_-]{0,23}$/ },
  aliases: {
    type: [{ type: String, trim: true, required: true, maxlength: 120 }],
    validate: (aliases) => aliases.length <= 10
  },
  status: { type: String, enum: LOCATION_STATUSES, required: true, default: 'draft' },
  coordinateVerificationStatus: { type: String, enum: ['unverified', 'verified'], required: true, default: 'unverified' },
  coordinateSource: { type: String, trim: true, maxlength: 500, default: '' },
  coordinateVerifiedAt: { type: Date, default: null },
  coordinateVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  publishedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, optimisticConcurrency: true });

export const hasCoordinatePair = (location) => Object.entries(COORDINATE_LIMITS)
  .every(([field, limit]) => isCoordinate(location[field], limit));

schema.pre('validate', function enforcePublication() {
  if (this.coordinateVerificationStatus === 'verified' && (
    !hasCoordinatePair(this) || !this.coordinateSource || !this.coordinateVerifiedAt || !this.coordinateVerifiedBy
  )) this.invalidate('coordinateVerificationStatus', 'Verified coordinates require a valid pair and verification audit');
  if (this.status === 'published' && (this.coordinateVerificationStatus !== 'verified' || !this.publishedAt)) {
    this.invalidate('status', 'Publication requires verified coordinates and a publication timestamp');
  }
  if (this.status === 'archived' && !this.archivedAt) this.invalidate('archivedAt', 'Archival requires a timestamp');
});

schema.index({ buildingCode: 1 }, { unique: true, partialFilterExpression: { buildingCode: { $type: 'string' } } });
schema.index({ status: 1, name: 1, _id: 1 });

export default mongoose.model('CampusLocation', schema);
