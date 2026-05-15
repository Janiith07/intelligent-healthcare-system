import express from 'express';
import { getPublicDoctor } from '../controllers/userController.js';
const router = express.Router();
router.get('/doctor', getPublicDoctor);
export default router;