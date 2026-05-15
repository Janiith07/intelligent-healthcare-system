import mongoose from 'mongoose';

const configSchema = new mongoose.Schema({
  morningSessionStart: { type: String, default: '07:00' },
  morningSessionEnd:   { type: String, default: '07:45' },
  eveningSessionStart: { type: String, default: '16:30' },
  eveningSessionEnd:   { type: String, default: '20:00' },
  minutesPerPatient:   { type: Number, default: 3 },
}, { timestamps: true });

export default mongoose.model('Config', configSchema);