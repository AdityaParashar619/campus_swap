import express from 'express';
import {
  getAdminOverview,
  getReportsQueue,
  listListings,
  listUsers,
  setListingHiddenStatus,
  setUserBlockStatus,
  takeReportAction,
  updateReportStatus
} from '../controllers/adminController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { getUserAdminView, listAlumniVerifications, reviewAlumniVerification, searchUsers, updateUserRole, updateUserStatus } from '../controllers/iamAdminController.js';
import { createAcademicResource, listAcademicResources, setAcademicResourceStatus, updateAcademicResource } from '../controllers/academicAdminController.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { archiveNotice, createNotice, getAdminNotice, listAdminNotices, publishNotice, removeAttachment, updateNotice, uploadAttachments } from '../controllers/noticeAdminController.js';
import { creationLimiter } from '../middleware/securityMiddleware.js';
import { noticeAttachmentUploadMiddleware } from '../middleware/noticeAttachmentUploadMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

const noticeAdmin = requireRole('admin', 'college_admin', 'super_admin');
router.post('/notices', noticeAdmin, creationLimiter, createNotice);
router.get('/notices', noticeAdmin, listAdminNotices);
router.get('/notices/:id', noticeAdmin, getAdminNotice);
router.patch('/notices/:id', noticeAdmin, updateNotice);
router.post('/notices/:id/attachments', noticeAdmin, creationLimiter, noticeAttachmentUploadMiddleware, uploadAttachments);
router.delete('/notices/:id/attachments/:attachmentId', noticeAdmin, removeAttachment);
router.post('/notices/:id/publish', noticeAdmin, publishNotice);
router.post('/notices/:id/archive', noticeAdmin, archiveNotice);

router.get('/academic-resources', requireRole('admin', 'college_admin', 'super_admin'), listAcademicResources);
router.post('/academic-resources', requireRole('admin', 'college_admin', 'super_admin'), createAcademicResource);
router.patch('/academic-resources/:id', requireRole('admin', 'college_admin', 'super_admin'), updateAcademicResource);
router.patch('/academic-resources/:id/status', requireRole('admin', 'college_admin', 'super_admin'), setAcademicResourceStatus);

router.get('/iam/users', requirePermission('users:read'), searchUsers);
router.get('/iam/users/:id', requirePermission('users:read'), getUserAdminView);
router.patch('/iam/users/:id/status', requirePermission('users:manage'), updateUserStatus);
router.patch('/iam/users/:id/role', requirePermission('users:manage'), updateUserRole);
router.get('/iam/verifications/alumni', requirePermission('verifications:review'), listAlumniVerifications);
router.patch('/iam/verifications/alumni/:id', requirePermission('verifications:review'), reviewAlumniVerification);

router.get('/overview', requirePermission('users:read'), getAdminOverview);
router.get('/reports', requirePermission('grievances:review'), getReportsQueue);
router.patch('/reports/:id/status', requirePermission('grievances:review'), updateReportStatus);
router.patch('/reports/:id/action', requirePermission('grievances:review'), takeReportAction);
router.get('/users', requirePermission('users:read'), listUsers);
router.patch('/users/:id/block', requirePermission('users:block'), setUserBlockStatus);
router.get('/listings', requirePermission('marketplace:moderate'), listListings);
router.patch('/listings/:id/hide', requirePermission('marketplace:moderate'), setListingHiddenStatus);

export default router;
