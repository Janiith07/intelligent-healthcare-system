import express from 'express';
import {
  addStock, getAllStocks, getStocksByDrug,
  getStock, updateStock, deleteStock, getStockDashboard,
} from '../controllers/Stockcontroller.js';
import { protect }   from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';

const stockRouter = express.Router();

stockRouter.use(protect);
stockRouter.use(authorize('pharmacy', 'admin'));

// ── Static / named routes MUST come before wildcard /:id ────────
stockRouter.get  ('/dashboard',    getStockDashboard);   // GET /api/stocks/dashboard
stockRouter.get  ('/',             getAllStocks);          // GET /api/stocks
stockRouter.post ('/',             addStock);              // POST /api/stocks
stockRouter.get  ('/drug/:drugId', getStocksByDrug);      // GET /api/stocks/drug/:drugId

// ── Parameterised ───────────────────────────────────────────────
stockRouter.get   ('/:id', getStock);    // GET    /api/stocks/:id
stockRouter.put   ('/:id', updateStock); // PUT    /api/stocks/:id
stockRouter.delete('/:id', deleteStock); // DELETE /api/stocks/:id

export default stockRouter;