import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const decoded = jwt.verify(socket.handshake.auth?.token || '', env.jwtSecret);
    const user = await User.findById(decoded.userId).select('_id accountStatus isBlocked tokenVersion emailVerified');
    if (!user || user.isBlocked || ['pending', 'suspended', 'blocked'].includes(user.accountStatus) || (decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return next(new Error('Unauthorized'));
    }
    socket.data.userId = user._id.toString();
    return next();
  } catch {
    return next(new Error('Unauthorized'));
  }
};
