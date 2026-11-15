import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import { rateLimit } from 'express-rate-limit';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const securityMiddleware = [
  helmet(),
  mongoSanitize(),
  hpp(),
  rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests, please try again later.'
    }
  })
];

export const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Try again later.' }
});

export const refreshAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.cookies?.refreshToken,
  message: { success: false, message: 'Too many refresh attempts. Please sign in again later.' }
});

export const authAccountRateLimitKey = (email) => crypto.createHash('sha256')
  .update(String(email || '').trim().toLowerCase())
  .digest('hex');

export const authAccountAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => authAccountRateLimitKey(req.body?.email),
  message: { success: false, message: 'Too many attempts for this account. Try again later.' }
});
