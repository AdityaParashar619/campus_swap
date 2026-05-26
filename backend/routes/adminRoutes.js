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
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

router.get('/overview', getAdminOverview);
router.get('/reports', getReportsQueue);
router.patch('/reports/:id/status', updateReportStatus);
router.patch('/reports/:id/action', takeReportAction);
router.get('/users', listUsers);
router.patch('/users/:id/block', setUserBlockStatus);
router.get('/listings', listListings);
router.patch('/listings/:id/hide', setListingHiddenStatus);

export default router;
