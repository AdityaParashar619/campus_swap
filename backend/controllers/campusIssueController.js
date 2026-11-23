import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import CampusIssue from '../models/CampusIssue.js';
import CampusLocation from '../models/CampusLocation.js';
import { publishedCampusLocationFilter } from '../utils/campusLocationVisibility.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/AppError.js';
import { issueId, normalizeIssue, normalizeIssueReview, parseIssueList } from '../utils/campusIssueValidation.js';
import { requireFields } from '../utils/campusLocationValidation.js';
import { checkEvidenceStorage, evidenceUnavailable, isEvidenceMetadata, limitEvidenceStream, openIssuePhoto, sanitizeIssuePhotos } from '../services/campusIssueEvidence.js';
import {
  availableIssue, cleanupIssueAssets, issueBySubmissionKey, publishedIssue, submitIssueWithEvidence, testReportDeletionEnabled
} from '../services/campusIssueLifecycle.js';

const visibleLocation = () => ({ path: 'campusLocation', select: 'name', match: publishedCampusLocationFilter() });
const privateResponse = (res) => res.set('Cache-Control', 'no-store');
const changed = () => new Conflict('Campus issue changed. Reload it before retrying.');
const privateFields = '+attachments +testFixture +cleanupPendingAt';

function issueView(issue, admin = false, detail = false) {
  return {
    id: String(issue._id),
    title: issue.title, description: issue.description, category: issue.category, status: issue.status,
    locationDescription: issue.locationDescription ?? '',
    campusLocation: issue.campusLocation ? { id: String(issue.campusLocation._id), name: issue.campusLocation.name } : null,
    adminResponse: issue.adminResponse ?? '', resolutionNote: issue.resolutionNote ?? '',
    createdAt: issue.createdAt, updatedAt: issue.updatedAt, reviewedAt: issue.reviewedAt,
    resolvedAt: issue.resolvedAt, closedAt: issue.closedAt,
    ...(admin && { reviewedBy: issue.reviewedBy, version: issue.__v }),
    ...(detail && {
      evidence: issue.cleanupPendingAt ? [] : (issue.attachments ?? []).filter(isEvidenceMetadata)
        .map((photo) => ({ id: String(photo.evidenceId) })),
      ...(admin && {
        canDeleteTestReport: issue.testFixture === true && testReportDeletionEnabled(),
        cleanupPending: Boolean(issue.cleanupPendingAt)
      })
    })
  };
}

const scope = (req, admin) => admin ? {} : { createdBy: req.user.userId };

const list = (admin) => asyncHandler(async (req, res) => {
  const { filter, page, limit, skip } = parseIssueList(req.query, !admin);
  const criteria = { ...filter, ...scope(req, admin), ...(admin ? publishedIssue : availableIssue) };
  const [issues, total] = await Promise.all([
    CampusIssue.find(criteria).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate(visibleLocation()).lean(),
    CampusIssue.countDocuments(criteria)
  ]);
  privateResponse(res).json({ success: true, data: issues.map((issue) => issueView(issue, admin)), pagination: {
    page, limit, total, totalPages: Math.ceil(total / limit)
  } });
});

const detail = (admin) => asyncHandler(async (req, res) => {
  const issue = await CampusIssue.findOne({
    _id: issueId(req.params.id), ...scope(req, admin), ...(admin ? publishedIssue : availableIssue)
  }).select(privateFields)
    .populate(visibleLocation()).lean();
  if (!issue) throw new NotFound('Campus issue not found');
  privateResponse(res).json({ success: true, data: issueView(issue, admin, true) });
});

export const listMyIssues = list(false);
export const listAdminIssues = list(true);
export const getMyIssue = detail(false);
export const getAdminIssue = detail(true);

async function submitIssue(req, res) {
  const multipart = req.is('multipart/form-data');
  let body = req.body;
  let key;
  if (multipart) {
    requireFields(body, new Set(['issue', 'submissionKey']));
    key = body.submissionKey;
    if (typeof body.issue !== 'string' || typeof key !== 'string' ||
        !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(key)) {
      throw new BadRequest('Invalid evidence submission.');
    }
    key = key.toLowerCase();
    try { body = JSON.parse(body.issue); } catch { throw new BadRequest('Invalid report details.'); }
  }
  const input = normalizeIssue(body);
  const owner = req.user.userId;
  if (multipart) {
    const existing = await issueBySubmissionKey(owner, key);
    if (existing) {
      await existing.populate(visibleLocation());
      return privateResponse(res).json({ success: true, data: issueView(existing, false, true) });
    }
  }
  if (input.campusLocation && !await CampusLocation.exists({ _id: input.campusLocation, ...publishedCampusLocationFilter() })) {
    throw new BadRequest('Choose a published campus location or leave the map location blank');
  }
  const files = req.files ?? [];
  if (files.length) checkEvidenceStorage();
  const issue = multipart
    ? await submitIssueWithEvidence(input, owner, key, files.length ? await sanitizeIssuePhotos(files) : [])
    : await CampusIssue.create({ ...input, createdBy: owner });
  await issue.populate(visibleLocation());
  privateResponse(res).status(201).json({ success: true, data: issueView(issue, false, true) });
}

export const createIssue = asyncHandler(async (req, res) => {
  try {
    await submitIssue(req, res);
  } finally {
    req.releaseCampusIssueUpload?.();
  }
});

function requestVersion(req) {
  const version = req.get('If-Match');
  if (!/^"\d+"$/.test(version ?? '')) throw new BadRequest('If-Match must contain the quoted issue version');
  return version;
}

export const updateIssueStatus = asyncHandler(async (req, res) => {
  const id = issueId(req.params.id);
  const version = requestVersion(req);
  const issue = await CampusIssue.findOne({ _id: id, ...publishedIssue }).select(privateFields);
  if (!issue) throw new NotFound('Campus issue not found');
  if (version !== `"${issue.__v}"` || issue.cleanupPendingAt) throw changed();
  const { status, adminResponse, resolutionNote } = normalizeIssueReview(req.body, issue.status);
  const now = new Date();
  issue.status = status;
  issue.reviewedBy = req.user.userId;
  issue.reviewedAt = now;
  if (adminResponse !== undefined) issue.adminResponse = adminResponse;
  if (resolutionNote !== undefined) issue.resolutionNote = resolutionNote;
  if (status === 'resolved') issue.resolvedAt = now;
  if (status === 'closed') issue.closedAt = now;
  try {
    await issue.save();
  } catch (error) {
    if (error instanceof mongoose.Error.VersionError || error instanceof mongoose.Error.DocumentNotFoundError) throw changed();
    throw error;
  }
  await issue.populate(visibleLocation());
  privateResponse(res).json({ success: true, data: issueView(issue, true, true) });
});

const evidence = (admin) => asyncHandler(async (req, res) => {
  privateResponse(res);
  const id = issueId(req.params.id);
  const photoId = issueId(req.params.photoId, 'Evidence ID').toLowerCase();
  const issue = await CampusIssue.findOne({ _id: id, ...scope(req, admin), ...availableIssue }).select('+attachments +evidenceCloud');
  const photo = issue?.attachments?.find((item) => String(item.evidenceId) === photoId && isEvidenceMetadata(item));
  if (!photo) throw new NotFound('Evidence photo not found');
  if (issue.evidenceCloud !== checkEvidenceStorage()) throw evidenceUnavailable();
  const abort = new AbortController();
  const close = () => abort.abort();
  res.once('close', close);
  try {
    const body = await openIssuePhoto(issue._id, photo, abort.signal);
    res.set({ 'Content-Type': photo.mediaType, 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' });
    await pipeline(Readable.fromWeb(body), limitEvidenceStream(), res);
  } catch (error) {
    if (!res.headersSent && !res.destroyed) throw error;
    if (!res.destroyed) res.destroy();
  } finally {
    res.off('close', close);
  }
});

export const getMyIssueEvidence = evidence(false);
export const getAdminIssueEvidence = evidence(true);

export const deleteTestIssue = asyncHandler(async (req, res) => {
  privateResponse(res);
  if (!testReportDeletionEnabled()) throw new Forbidden('Test report deletion is disabled in this environment.');
  const id = issueId(req.params.id);
  requireFields(req.body, new Set(['confirmation']));
  if (req.body.confirmation !== 'DELETE') throw new BadRequest('Type DELETE to confirm permanent removal.');
  const version = requestVersion(req);
  const deletionFields = `${privateFields} +evidenceCloud`;
  let issue = await CampusIssue.findOne({ _id: id, ...publishedIssue }).select(deletionFields);
  if (!issue) throw new NotFound('Campus issue not found or already deleted.');
  if (issue.testFixture !== true) throw new Forbidden('Only explicitly marked test reports can be deleted.');
  if (version !== `"${issue.__v}"`) throw changed();
  if (!issue.cleanupPendingAt) {
    issue = await CampusIssue.findOneAndUpdate({
      _id: id, ...availableIssue, testFixture: true, __v: issue.__v
    }, { $set: { cleanupPendingAt: new Date() }, $inc: { __v: 1 } }, { new: true }).select(deletionFields);
    if (!issue) throw changed();
  }
  await cleanupIssueAssets(issue);
  try {
    const result = await CampusIssue.deleteOne({
      _id: issue._id, ...publishedIssue, testFixture: true, cleanupPendingAt: issue.cleanupPendingAt, __v: issue.__v
    });
    if (result.deletedCount !== 1) throw new NotFound('Campus issue not found or already deleted.');
  } catch (error) {
    if (error instanceof NotFound) throw error;
    throw evidenceUnavailable('Report removal could not be confirmed. Reload before retrying.');
  }
  privateResponse(res).json({ success: true });
});
