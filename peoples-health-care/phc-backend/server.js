import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import dotenv  from 'dotenv';
import cors    from 'cors';
import connectDB from './config/db.js';

// ── Core routes ─────────────────────────────────────────────────
import authRoutes         from './routes/auth.js';
import userRoutes         from './routes/users.js';
import patientRoutes      from './routes/patients.js';
import prescriptionRoutes from './routes/Prescriptions.js';
import labRequestRoutes   from './routes/labRequests.js';
import feedbackRoutes     from './routes/Feedback.js';
import labTestResultRoutes from './routes/Labtestresults.js';
import publicRoutes       from './routes/public.js';
import appointmentRoutes  from './routes/appointments.js';

// ── Lab — equipment & notifications (new) ───────────────────────
import equipmentRoutes    from './routes/equipment.js';
import notificationRoutes from './routes/notifications.js';

// ── Pharmacy & billing routes ────────────────────────────────────
import drugRoutes           from './routes/Drugs.js';
import stockRoutes          from './routes/Stocks.js';
import pharmacyRoutes       from './routes/Pharmacy.js';
import billRoutes           from './routes/Bills.js';
import patientBillRoutes    from './routes/Patientbills.js';
import labBillRoutes            from './routes/Labbills.js';
import labRequestBillRoutes    from './routes/LabRequestBills.js';
import turnoverRoutes       from './routes/Turnoverreports.js';
import vitaminPredictRoutes from './routes/Vitaminpredict.js';
import chatbotRoutes        from './routes/chatbot.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();

// ══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════════════════════════

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ══════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'People\'s Health Care API',
    version: '1.0.0',
  });
});

// Core API routes
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/patients',      patientRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/lab-requests',  labRequestRoutes);
app.use('/api/feedback',      feedbackRoutes);
app.use('/api/lab-results',   labTestResultRoutes);
app.use('/api/public',        publicRoutes);
app.use('/api/appointments',  appointmentRoutes);

// Lab — equipment & notifications
app.use('/api/equipment',     equipmentRoutes);
app.use('/api/notifications', notificationRoutes);

// Pharmacy & billing routes
app.use('/api/drugs',            drugRoutes);
app.use('/api/stocks',           stockRoutes);
app.use('/api/pharmacy',         pharmacyRoutes);
app.use('/api/bills',            billRoutes);
app.use('/api/patient-bills',    patientBillRoutes);
app.use('/api/vitamin-predict',  vitaminPredictRoutes);
app.use('/api/chatbot',          chatbotRoutes);
app.use('/api/lab-bills',         labBillRoutes);
app.use('/api/lab-request-bills', labRequestBillRoutes);
app.use('/api/turnover-reports', turnoverRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ══════════════════════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}\n`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});