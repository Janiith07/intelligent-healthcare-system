import express from 'express';
import {
  createDrug, getAllDrugs, getDrug,
  updateDrug, deleteDrug, searchDrugs,
} from '../controllers/Drugcontroller.js';
import { protect }   from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';
import { getInventoryReportData } from '../controllers/inventoryReportController.js';

const drugRouter = express.Router();

drugRouter.use(protect);

drugRouter.post ('/',            authorize('pharmacy', 'admin'),             createDrug);
drugRouter.get  ('/',            authorize('pharmacy', 'admin', 'doctor'),   getAllDrugs);
drugRouter.get  ('/search',      authorize('pharmacy', 'admin', 'doctor'),   searchDrugs);
drugRouter.get  ('/report/pdf',  authorize('pharmacy', 'admin'),             getInventoryReportData);
drugRouter.get  ('/:id',         authorize('pharmacy', 'admin'),             getDrug);
drugRouter.put  ('/:id',         authorize('pharmacy', 'admin'),             updateDrug);
drugRouter.delete('/:id',        authorize('pharmacy', 'admin'),             deleteDrug);

export default drugRouter;