import express from 'express';
import { protect } from '../middleware/auth.js';
import { sseStream, getNotifications, getUnreadCount, markRead } from '../controllers/NotificationController.js';

const router = express.Router();

// SSE stream — token passed as query param (EventSource can't set headers)
router.get('/stream', sseStream);

// REST endpoints — require JWT in Authorization header
router.use(protect);
router.get('/',             getNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/mark-read',   markRead);

export default router;