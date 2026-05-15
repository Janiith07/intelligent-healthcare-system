import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'lab_request_created',      // doctor sent lab request → lab + cashier
      'payment_confirmed',         // cashier confirmed payment → lab
      'results_uploaded',          // lab uploaded results → doctor + patient
      'equipment_alert_sent',      // lab sent service/stock alert → admin + lab
      'equipment_added',           // admin added machine/consumable → admin + lab
      'equipment_restocked',       // admin restocked consumable → admin + lab
      'service_acknowledged',      // admin acknowledged service request → admin + lab
    ],
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },

  // Who should receive this notification (by role)
  targetRoles: [{ type: String, enum: ['doctor', 'patient', 'lab', 'cashier', 'admin'] }],

  // Specific user IDs (for doctor/patient personal notifications)
  targetUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Track which users have seen/read it
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Extra context data
  data: { type: mongoose.Schema.Types.Mixed, default: {} },

}, { timestamps: true });

// Index for efficient polling
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ targetRoles: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;