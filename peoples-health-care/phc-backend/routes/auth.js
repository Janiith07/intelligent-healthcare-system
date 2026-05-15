import express from 'express';
import { register, login, getMe, updateMe, adminCreateUser } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';

const router = express.Router();

// PUBLIC ROUTES
router.post('/register', register);
router.post('/login', login);

// PROTECTED ROUTES
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);   // ← NEW: self-update route

// ADMIN ROUTES
router.post('/admin/create-user', protect, authorize('admin'), adminCreateUser);

export default router;