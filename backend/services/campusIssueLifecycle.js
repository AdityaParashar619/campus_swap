import mongoose from 'mongoose';
import CampusIssue from '../models/CampusIssue.js';
import { ensureCampusIssueIndexes } from '../config/db.js';
import { Conflict, NotFound } from '../utils/AppError.js';
import { checkEvidenceStorage, destroyIssuePhoto, evidenceUnavailable, uploadIssuePhoto } from './campusIssueEvidence.js';

export const publishedIssue = { evidenceStage: { $exists: false } };
export const availableIssue = { ...publishedIssue, cleanupPendingAt: { $exists: false } };

export function testReportDeletionEnabled() {
  const target = process.env.CAMPUS_ISSUE_TEST_DATABASE;
  return ['development', 'test'].includes(process.env.NODE_ENV) &&
    process.env.CAMPUS_ISSUE_TEST_DELETE_ENABLED === 'true' &&
    typeof target === 'string' && /^campusswap_[a-z0-9_]+_test$/.test(target) &&
    mongoose.connection.name === target &&
    ['127.0.0.1', 'localhost', 'e2e-mongodb'].includes(mongoose.connection.host);
}

export async function issueBySubmissionKey(createdBy, submissionKey) {
  const existing = await CampusIssue.findOne({ createdBy, submissionKey }).select('+evidenceStage +cleanupPendingAt +attachments');
  if (existing?.evidenceStage || existing?.cleanupPendingAt) {
    throw new Conflict('This submission is still processing or unavailable. Check My Reports before retrying.');
  }
  return existing;
}

export async function submitIssueWithEvidence(input, createdBy, submissionKey, photos) {
  // Wait for the compound uniqueness constraint before accepting concurrent retries.
  await ensureCampusIssueIndexes();
  let stage;
  try {
    stage = await CampusIssue.create({
      ...input, createdBy, submissionKey, ...(photos.length && {
        evidenceStage: 'uploading', evidenceCloud: checkEvidenceStorage(),
        attachments: photos.map((photo) => photo.metadata)
      })
    });
  } catch (error) {
    if (error.code === 11000) {
      const saved = await issueBySubmissionKey(createdBy, submissionKey);
      if (saved) return saved;
      throw new Conflict('Please retry your submission.');
    }
    throw error;
  }
  if (!photos.length) return stage;

  const uploaded = [];
  try {
    for (const photo of photos) {
      await uploadIssuePhoto(stage._id, photo);
      uploaded.push(photo.metadata);
    }
  } catch (error) {
    try {
      // Retain every allocated ID for delayed reconciliation, including an upload with an unknown outcome.
      await CampusIssue.updateOne({ _id: stage._id, evidenceStage: 'uploading' }, {
        $set: { evidenceStage: 'abandoned' }, $unset: { submissionKey: 1 }
      });
    } catch {
      // A failed Mongo write leaves the original journal for recovery.
    }
    await Promise.allSettled(uploaded.map((photo) => destroyIssuePhoto(stage._id, photo)));
    throw error;
  }

  // If the acknowledgement is lost, never remove assets that may now belong to a published report.
  const saved = await CampusIssue.findOneAndUpdate({ _id: stage._id, evidenceStage: 'uploading' },
    { $unset: { evidenceStage: 1 } }, { new: true }).select('+attachments');
  if (!saved) throw evidenceUnavailable('Could not confirm submission. Check My Reports before retrying.');
  return saved;
}

export async function cleanupIssueAssets(issue) {
  if (issue.attachments?.length && issue.evidenceCloud !== checkEvidenceStorage()) {
    throw evidenceUnavailable('Evidence storage account does not match this report. Cleanup is pending.');
  }
  await Promise.all((issue.attachments ?? []).map((photo) => destroyIssuePhoto(issue._id, photo)));
}

export async function recoverAbandonedIssue(issueId, now = new Date()) {
  // Recovery is explicitly invoked by an operator after the upload window has well elapsed.
  const issue = await CampusIssue.findOneAndUpdate({
    _id: issueId, evidenceStage: { $in: ['uploading', 'abandoned', 'recovering'] },
    createdAt: { $lte: new Date(now.getTime() - 60 * 60 * 1000) }
  }, { $set: { evidenceStage: 'recovering' } }, { new: true }).select('+attachments +evidenceCloud');
  if (!issue) throw new NotFound('No eligible abandoned upload journal for this report');
  await cleanupIssueAssets(issue);
  await CampusIssue.deleteOne({ _id: issue._id, evidenceStage: 'recovering' });
}
