import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { NotFound } from '../utils/AppError.js';
import { buildPersonalizedAcademicResources } from '../services/academicResourceService.js';

export const getMyAcademicResources = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select('branch department semester').lean();
  if (!user) throw new NotFound('User not found');
  const result = await buildPersonalizedAcademicResources(user);
  res.status(200).json({ success: true, data: result });
});
