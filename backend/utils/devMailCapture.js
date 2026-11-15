import crypto from 'node:crypto';
import { env } from '../config/env.js';

const CAPTURE_TTL_MS = 5 * 60 * 1000;
const captures = new Map();

const enabled = () => env.nodeEnv === 'development' && env.otpMockEnabled;
const hashCapability = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const captureDevelopmentMail = ({ to, purpose, code, url }) => {
  if (!enabled()) throw new Error('Development mail capture is unavailable.');
  clearExpiredDevelopmentMail();
  for (const [key, capture] of captures) {
    if (capture.to === to && capture.purpose === purpose) captures.delete(key);
  }
  const capability = crypto.randomBytes(32).toString('base64url');
  const key = hashCapability(capability);
  const expiresAt = Date.now() + CAPTURE_TTL_MS;
  captures.set(key, { to, purpose, ...(code ? { code } : {}), ...(url ? { url } : {}), expiresAt });
  return { previewToken: capability, expiresAt: new Date(expiresAt).toISOString() };
};

export const consumeDevelopmentMail = (capability) => {
  if (!enabled() || typeof capability !== 'string' || capability.length < 32 || capability.length > 128) return null;
  const key = hashCapability(capability);
  const capture = captures.get(key);
  captures.delete(key);
  if (!capture || capture.expiresAt <= Date.now()) return null;
  return { purpose: capture.purpose, ...(capture.code ? { code: capture.code } : {}), ...(capture.url ? { url: capture.url } : {}) };
};

export const clearExpiredDevelopmentMail = () => {
  const now = Date.now();
  for (const [key, capture] of captures) if (capture.expiresAt <= now) captures.delete(key);
};
