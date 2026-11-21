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
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Try again later.' }
});

export const refreshAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.refreshRateLimitMax,
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

export const productImageUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: { success: false, message: 'Too many image uploads. Try again later.' }
});

const userRateLimit = ({ windowMs, max, message }) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: { success: false, message }
});

export const messageSendLimiter = userRateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many messages. Please wait before sending more.'
});

export const creationLimiter = userRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many creation requests. Please try again later.'
});
