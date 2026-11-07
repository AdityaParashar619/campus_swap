import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signAuthToken = (payload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.accessTokenTtl });

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const createOpaqueToken = () => crypto.randomBytes(48).toString('base64url');

export const createOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

export const hashOtp = (email, otp) => crypto.createHmac('sha256', env.otpPepper).update(`${email}:${otp}`).digest('hex');

export const secureHashEquals = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
};

export const createResetToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = Date.now() + 1000 * 60 * 15;

  return { rawToken, hashedToken, expiresAt };
};
