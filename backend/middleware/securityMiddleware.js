import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import { rateLimit } from 'express-rate-limit';
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
