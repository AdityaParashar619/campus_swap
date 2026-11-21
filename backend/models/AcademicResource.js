import mongoose from 'mongoose';

export const ACADEMIC_RESOURCE_TYPES = Object.freeze(['syllabus', 'timetable', 'scheme', 'faculty', 'academic_calendar', 'department_overview', 'other']);
export const ACADEMIC_RESOURCE_SCOPES = Object.freeze(['college', 'department', 'program']);
export const ACADEMIC_VERIFICATION_STATUSES = Object.freeze(['unverified', 'verified', 'stale']);

const httpsUrl = {
  validator(value) {
    if (value == null || value === '') return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  },
  message: 'URL must be a safe HTTPS URL without embedded credentials'
};

const academicResourceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', trim: true, maxlength: 2000 },
  resourceType: { type: String, required: true, enum: ACADEMIC_RESOURCE_TYPES },
  scope: { type: String, required: true, enum: ACADEMIC_RESOURCE_SCOPES },
  departmentCode: { type: String, default: null, trim: true, uppercase: true },
  programCode: { type: String, default: null, trim: true, uppercase: true },
  semester: { type: String, default: null, enum: [null, '1', '2', '3', '4', '5', '6', '7', '8'] },
  academicSession: { type: String, default: null, trim: true, match: [/^\d{4}-\d{2}$/, 'Academic session must use YYYY-YY format'] },
  admissionBatch: { type: String, default: null, trim: true, match: [/^\d{4}$/, 'Admission batch must use YYYY format'] },
  url: { type: String, required: true, trim: true, validate: httpsUrl },
  sourceUrl: { type: String, default: null, trim: true, validate: httpsUrl },
  sourceType: { type: String, required: true, enum: ['official_external', 'admin_verified'] },
  resourceKind: { type: String, required: true, enum: ['exact_document', 'official_index'], default: 'exact_document' },
  applicabilityMode: { type: String, required: true, enum: ['exact_applicable', 'reference_only'], default: 'exact_applicable' },
  applicabilityEvidence: { type: String, default: '', trim: true, maxlength: 2000 },
  uncertainty: { type: String, default: '', trim: true, maxlength: 1000 },
  checkedAt: { type: Date, default: null },
  importBatchId: { type: String, default: null, trim: true, maxlength: 100 },
  publicationStatus: { type: String, required: true, enum: ['draft', 'published'], default: 'draft' },
  publishedAt: { type: Date, default: null },
  verificationStatus: { type: String, required: true, enum: ACADEMIC_VERIFICATION_STATUSES, default: 'unverified' },
  lastVerifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isActive: { type: Boolean, default: true },
  retiredAt: { type: Date, default: null },
  history: [{ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, action: { type: String, required: true }, changedFields: [{ type: String }], at: { type: Date, default: Date.now } }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

academicResourceSchema.pre('validate', function validateScope() {
  if (this.scope === 'college' && (this.departmentCode || this.programCode)) this.invalidate('scope', 'College resources cannot target a department or program');
  if (this.scope === 'department' && (!this.departmentCode || this.programCode)) this.invalidate('scope', 'Department resources require departmentCode and cannot target a program');
  if (this.scope === 'program' && (!this.departmentCode || !this.programCode)) this.invalidate('scope', 'Program resources require departmentCode and programCode');
  if (this.verificationStatus === 'verified' && (!this.lastVerifiedAt || !this.verifiedBy)) this.invalidate('lastVerifiedAt', 'Verified resources require verifier and lastVerifiedAt');
  if (this.resourceKind === 'official_index' && (this.semester || this.academicSession || this.admissionBatch)) this.invalidate('resourceKind', 'Official index pages cannot claim semester, session, or batch applicability');
  if (this.resourceKind === 'official_index' && this.applicabilityMode === 'reference_only') this.invalidate('applicabilityMode', 'Official index pages are already browsing fallbacks');
  if (this.applicabilityMode === 'reference_only' && (this.resourceKind !== 'exact_document' || this.scope !== 'program' || !this.programCode || !this.semester)) this.invalidate('applicabilityMode', 'Reference documents require an exact program-scoped document and semester');
  if (this.publicationStatus === 'published' && this.resourceKind === 'exact_document' && ['syllabus', 'timetable'].includes(this.resourceType) && (this.scope !== 'program' || !this.programCode || !this.semester)) this.invalidate('publicationStatus', 'Published syllabus and timetable documents require a canonical program and semester');
  if (this.publicationStatus === 'published' && !this.isActive) this.invalidate('publicationStatus', 'Retired resources cannot remain published');
});

academicResourceSchema.index({ isActive: 1, publicationStatus: 1, verificationStatus: 1, scope: 1, departmentCode: 1, programCode: 1, semester: 1 });

export default mongoose.model('AcademicResource', academicResourceSchema);
