import express from 'express';
import { predict } from '../controllers/Vitaminpredictcontroller.js';

const vitaminPredictRoutes = express.Router();

// Only doctors can access this route
vitaminPredictRoutes.post('/predict', predict);

export default vitaminPredictRoutes;