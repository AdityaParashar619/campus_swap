import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { Forbidden, Unauthorized } from '../utils/AppError.js';

export const authMiddleware = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) throw new Unauthorized('No token provided');

    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.userId).select('_id email role isBlocked accountType emailVerified verificationStatus accountStatus permissions tokenVersion');

    if (!user) throw new Unauthorized('User not found');
    if (user.isBlocked || ['blocked', 'suspended'].includes(user.accountStatus)) throw new Forbidden('Account is unavailable');
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.tokenVersion || 0)) throw new Unauthorized('Session revoked');
    if (user.accountStatus === 'pending') {
      throw new Forbidden('Account verification is pending');
    }
    if (user.accountType === 'student' && user.emailVerified === false && user.verificationStatus !== 'verified') throw new Forbidden('Account verification is pending');

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role || 'student',
      permissions: user.permissions || [],
      emailVerified: user.emailVerified,
      accountStatus: user.accountStatus || 'active'
    };

    next();
  } catch (error) {
    next(error instanceof Unauthorized || error instanceof Forbidden ? error : new Unauthorized('Invalid or expired token'));
  }
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new Forbidden('Insufficient permissions'));
  }
  next();
};
