import multer from 'multer';
import { BadRequest } from '../utils/AppError.js';
import { EVIDENCE_MAX_BYTES, EVIDENCE_MAX_FILES, evidenceUnavailable } from '../services/campusIssueEvidence.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: EVIDENCE_MAX_BYTES + 1, files: EVIDENCE_MAX_FILES, fields: 2, fieldSize: 16_384, parts: 6 }
}).array('photos', EVIDENCE_MAX_FILES);

let uploadsInFlight = 0;
export function campusIssueEvidenceUpload(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  if (uploadsInFlight >= 4) return next(evidenceUnavailable('Evidence uploads are busy. Please retry.'));
  uploadsInFlight++;
  let processing = false;
  let released = false;
  res.once('finish', release);
  res.once('close', closed);
  function closed() {
    if (!processing) release();
  }
  function release() {
    if (released) return;
    released = true;
    res.off('finish', release);
    res.off('close', closed);
    uploadsInFlight--;
  }
  upload(req, res, (error) => {
    if (!error) {
      if (res.destroyed) return;
      processing = true;
      req.releaseCampusIssueUpload = release;
      return next();
    }
    if (error.code === 'LIMIT_FILE_SIZE') return next(new BadRequest('Each photo must be 5 MB or smaller.'));
    if (['LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT', 'LIMIT_UNEXPECTED_FILE'].includes(error.code)) {
      return next(new BadRequest('Select at most 3 photos.'));
    }
    return next(new BadRequest('Invalid evidence upload request.'));
  });
}
