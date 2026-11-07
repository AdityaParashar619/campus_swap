import { Forbidden } from '../utils/AppError.js';
import { hasPermission } from '../utils/permissions.js';

export const requirePermission = (permission) => (req, _res, next) => {
  if (!req.user || !hasPermission(req.user, permission)) return next(new Forbidden('Insufficient permissions'));
  next();
};
