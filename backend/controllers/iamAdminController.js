import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, Forbidden, NotFound } from '../utils/AppError.js';
import User from '../models/User.js';
import AlumniVerification from '../models/AlumniVerification.js';
import RefreshSession from '../models/RefreshSession.js';
import AuditLog from '../models/AuditLog.js';
import { getPermissions } from '../utils/permissions.js';
import { env } from '../config/env.js';

const safeAdminUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  accountType: user.accountType || 'student',
  department: user.department || '',
  branch: user.branch || '',
  emailVerified: user.emailVerified ?? true,
  verificationStatus: user.verificationStatus || (user.isVerifiedStudent ? 'verified' : 'pending'),
  verificationMethod: user.verificationMethod || 'legacy',
  accountStatus: user.accountStatus || (user.isBlocked ? 'blocked' : 'active'),
  createdAt: user.createdAt
});

export const searchUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const filter = {};
  if (req.query.status) filter.accountStatus = req.query.status;
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) {
    const query = String(req.query.q).trim().slice(0, 80);
    filter.$or = [{ name: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { email: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).select('name email role accountType department branch emailVerified verificationStatus accountStatus isBlocked createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter)
  ]);
  res.json({ success: true, data: users.map(safeAdminUser), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

export const getUserAdminView = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('name email role accountType department branch semester graduationYear company jobTitle emailVerified verificationStatus accountStatus statusReason isBlocked createdAt').lean();
  if (!user) throw new NotFound('User not found.');
  res.json({ success: true, data: safeAdminUser(user) });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  if (!['active', 'suspended', 'blocked'].includes(status) || !String(reason || '').trim()) throw new BadRequest('A valid account status and reason are required.');
  if (String(req.params.id) === req.user.userId) throw new Forbidden('You cannot change your own account status.');
  const target = await User.findById(req.params.id);
  if (!target) throw new NotFound('User not found.');
  if (['college_admin', 'super_admin', 'admin'].includes(target.role) && req.user.role !== 'super_admin') throw new Forbidden('Only a super administrator can modify this account.');
  if (status === 'active' && target.accountStatus === 'pending') throw new BadRequest('Pending accounts must complete their verification workflow.');
  if (status === 'active' && target.accountType === 'alumni') throw new BadRequest('Alumni accounts must be activated through the alumni approval workflow.');
  target.accountStatus = status;
  target.isBlocked = status === 'blocked';
  target.statusReason = String(reason).trim().slice(0, 500);
  target.tokenVersion = (target.tokenVersion || 0) + 1;
  await target.save();
  await RefreshSession.updateMany({ user: target._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await AuditLog.create({ actor: req.user.userId, action: `user.status.${status}`, targetUser: target._id, reason: target.statusReason, ipAddress: req.ip });
  res.json({ success: true, data: safeAdminUser(target) });
});

const updateUserRoleLogic = async (req, res) => {
  const role = String(req.body.role || '');
  const departmentScope = String(req.body.departmentScope || '').trim();
  const clubScope = String(req.body.clubScope || '').trim();
  const permittedRoles = ['student', 'alumni', 'faculty', 'department_coordinator', 'club_coordinator', 'grievance_officer', 'marketplace_moderator', 'college_admin', 'admin', 'super_admin'];
  if (!permittedRoles.includes(role)) throw new BadRequest('Role is not recognized.');
  const target = await User.findById(req.params.id);
  if (!target) throw new NotFound('User not found.');
  if (!validateRoleAssignment({ actorId: req.user.userId, actorRole: req.user.role, targetId: target._id, targetRole: target.role, nextRole: role })) throw new Forbidden('Role assignment is not permitted.');
  const privilegedRoles = ['faculty', 'department_coordinator', 'club_coordinator', 'grievance_officer', 'marketplace_moderator', 'college_admin', 'super_admin', 'admin'];
  if (privilegedRoles.includes(role) && (target.accountStatus === 'pending' || target.verificationStatus === 'rejected')) throw new BadRequest('The account must be active and verified before assigning staff privileges.');
  if (role === 'department_coordinator' && (!departmentScope || !env.institutionDepartments.includes(departmentScope))) throw new BadRequest('Choose a configured department scope for this coordinator.');
  if (role === 'club_coordinator' && (!clubScope || !env.institutionClubs.includes(clubScope))) throw new BadRequest('Choose a configured club scope for this coordinator.');
  target.role = role;
  target.departmentScope = role === 'department_coordinator' ? departmentScope : '';
  target.clubScope = role === 'club_coordinator' ? clubScope : '';
  target.tokenVersion = (target.tokenVersion || 0) + 1;
  await target.save();
  await RefreshSession.updateMany({ user: target._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await AuditLog.create({ actor: req.user.userId, action: 'user.role.updated', targetUser: target._id, reason: String(req.body.reason || '').slice(0, 500), metadata: { role, departmentScope: target.departmentScope, clubScope: target.clubScope }, ipAddress: req.ip });
  res.json({ success: true, data: safeAdminUser(target), permissions: getPermissions(target) });
};

export const updateUserRole = asyncHandler(updateUserRoleLogic);
export const validateRoleAssignment = ({ actorId, actorRole, targetId, targetRole, nextRole }) => {
  if (String(targetId) === String(actorId)) return false;
  if ((nextRole === 'super_admin' || nextRole === 'admin' || targetRole === 'super_admin') && actorRole !== 'super_admin') return false;
  if (targetRole === 'college_admin' && actorRole !== 'super_admin') return false;
  if (nextRole === 'college_admin' && actorRole !== 'super_admin') return false;
  if (['faculty', 'department_coordinator', 'club_coordinator', 'grievance_officer', 'marketplace_moderator'].includes(nextRole) && !['college_admin', 'super_admin'].includes(actorRole)) return false;
  return true;
};

export const listAlumniVerifications = asyncHandler(async (_req, res) => {
  const data = await AlumniVerification.find({ status: 'pending', user: { $ne: null } }).populate('user', 'name email department branch graduationYear company jobTitle').sort({ createdAt: 1 }).limit(100).lean();
  res.json({ success: true, data });
});

export const reviewAlumniVerification = asyncHandler(async (req, res) => {
  const { decision, reason = '' } = req.body;
  if (!['approved', 'rejected'].includes(decision)) throw new BadRequest('Decision must be approved or rejected.');
  const verification = await AlumniVerification.findById(req.params.id);
  if (!verification || verification.status !== 'pending' || !verification.user) throw new NotFound('Pending verification request not found.');
  verification.status = decision;
  verification.reviewedBy = req.user.userId;
  verification.reviewedAt = new Date();
  verification.reviewReason = String(reason).trim().slice(0, 500);
  await verification.save();
  const user = await User.findById(verification.user);
  if (!user) throw new NotFound('User not found.');
  user.verificationStatus = decision === 'approved' ? 'verified' : 'rejected';
  user.accountStatus = decision === 'approved' && user.emailVerified ? 'active' : 'pending';
  user.isVerifiedStudent = false;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  if (decision === 'rejected') {
    user.accountStatus = 'blocked';
    user.isBlocked = true;
    await user.save();
  }
  await RefreshSession.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await AuditLog.create({ actor: req.user.userId, action: `alumni.verification.${decision}`, targetUser: user._id, reason: verification.reviewReason, ipAddress: req.ip });
  res.json({ success: true, data: { verificationId: verification._id, status: verification.status, user: safeAdminUser(user) } });
});
