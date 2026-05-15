import express from 'express';
import {
  createStaff,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  restoreUser,
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(protect);
router.use(authorize('admin'));

router.post('/staff', createStaff);

router.route('/')
  .get(getAllUsers);

router.route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

router.put('/:id/restore', restoreUser);

export default router;