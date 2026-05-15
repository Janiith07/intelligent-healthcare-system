import mongoose from 'mongoose';

export const LAB_LOCATIONS = ['Lab A', 'Lab B', 'Lab C', 'Lab D'];

export const MACHINE_SUBCATEGORIES = [
  'Diagnostic & Testing Machines',
  'Sample Processing Equipment',
  'Storage Equipment',
  'Safety & Laboratory Infrastructure',
  'Digital & Power Equipment',
];

export const CONSUMABLE_SUBCATEGORIES = [
  'Sample Collection Materials',
  'Blood Collection Tubes',
  'Testing Consumables',
  'Reagents & Testing Kits',
  'Patient Safety & Infection Control Items',
  'Waste Management Materials',
  'General Laboratory Use Items',
];

export const MACHINE_NAMES = {
  'Diagnostic & Testing Machines': [
    'Hematology Analyzer', 'ESR Analyzer', 'Fully Automated Biochemistry Analyzer',
    'Semi-Auto Biochemistry Analyzer', 'Electrolyte Analyzer',
    'Immunoassay Analyzer (CLIA / ELISA)', 'ELISA Reader', 'ELISA Washer',
  ],
  'Sample Processing Equipment': [
    'Laboratory Centrifuge', 'Blood Tube Mixer / Roller Mixer', 'Vortex Mixer',
    'Laboratory Incubator', 'Water Bath', 'Automated Pipetting System',
  ],
  'Storage Equipment': [
    'Laboratory Refrigerator (2–8°C)', 'Reagent Refrigerator',
    'Deep Freezer (-20°C)', 'Deep Freezer (-80°C)', 'Sample Storage Freezer',
  ],
  'Safety & Laboratory Infrastructure': [
    'Biosafety Cabinet', 'Laminar Air Flow Cabinet',
    'Laboratory Exhaust / Ventilation System', 'Air Conditioning System',
    'Hand Washing Sink Unit',
  ],
  'Digital & Power Equipment': [
    'Laboratory Computer Systems', 'Laboratory Information System (LIS) Server',
    'Barcode Scanner', 'Label Printer', 'Report Printer',
    'UPS (Uninterruptible Power Supply)', 'Power Backup Generator', 'Voltage Stabilizer',
  ],
};

export const CONSUMABLE_NAMES = {
  'Sample Collection Materials': [
    'Disposable Syringes', 'Vacutainer Needles', 'Blood Collection Sets',
    'Tourniquets', 'Lancets',
  ],
  'Blood Collection Tubes': [
    'EDTA Tubes (Purple cap)', 'Sodium Citrate Tubes (Black cap)',
    'Fluoride Oxalate Tubes (Grey cap)', 'Plain Tubes (Red cap)',
    'Serum Separator Tubes – SST (Yellow cap)', 'ESR Tubes', 'Micro Collection Tubes',
  ],
  'Testing Consumables': [
    'Micropipette Tips', 'Sample Cups', 'Reaction Cuvettes', 'Test Tubes',
    'Glass Slides', 'Cover Slips', 'ELISA Plates', 'Test Cartridges',
    'Rapid Test Cassettes / Strips', 'Dropper Pipettes',
  ],
  'Reagents & Testing Kits': [
    'Biochemistry Reagent Kits', 'Liver Profile Reagents', 'Renal Profile Reagents',
    'Thyroid Profile Reagents', 'Vitamin D Test Kits', 'Dengue NS1 Antigen Test Kits',
    'Electrolyte Reagents', 'Calibration Solutions', 'Quality Control Materials',
    'Buffer Solutions',
  ],
  'Patient Safety & Infection Control Items': [
    'Cotton Packs', 'Alcohol Swabs', 'Gauze Pieces', 'Adhesive Plasters',
    'Disposable Gloves', 'Face Masks', 'Surgical Masks', 'Protective Gowns',
    'Shoe Covers', 'Disposable Caps',
  ],
  'Waste Management Materials': [
    'Biohazard Waste Bags', 'Sharps Disposal Containers',
    'Specimen Disposal Bags', 'Chemical Waste Containers',
  ],
  'General Laboratory Use Items': [
    'Tissue Paper / Wipes', 'Distilled Water', 'Cleaning Disinfectants',
    'Surface Sanitizers', 'Hand Sanitizer',
  ],
};

// ─── Embedded schemas ──────────────────────────────────────────────────────
const serviceRequestSchema = new mongoose.Schema({
  requestType:    { type: String, enum: ['scheduled_service','emergency','replacement'], required: true },
  urgency:        { type: String, enum: ['5_day_warning','1_day_warning','emergency','routine'], required: true },
  notes:          { type: String, default: '' },
  sentAt:         { type: Date,   default: Date.now },
  status:         { type: String, enum: ['pending','acknowledged','resolved'], default: 'pending' },
  acknowledgedAt: { type: Date,   default: null },
  resolvedAt:     { type: Date,   default: null },
}, { _id: true });

const stockRequestSchema = new mongoose.Schema({
  quantityAtTime: { type: Number, required: true },
  notes:          { type: String, default: '' },
  sentAt:         { type: Date,   default: Date.now },
  status:         { type: String, enum: ['pending','acknowledged','resolved'], default: 'pending' },
  acknowledgedAt: { type: Date,   default: null },
  resolvedAt:     { type: Date,   default: null },
}, { _id: true });

// ─── Main schema ───────────────────────────────────────────────────────────
const equipmentSchema = new mongoose.Schema({
  category:    { type: String, enum: ['machine','consumable'], required: true },
  subCategory: { type: String, required: true },
  name:        { type: String, required: true },

  // ── Machine fields ──────────────────────────────────────────────────────
  // serialNumber differentiates two identical machines.
  // e.g. two Hematology Analyzers → SN-001 and SN-002
  serialNumber:    { type: String, default: '' },
  testFor:         { type: String, default: '' },
  installedDate:   { type: Date,   default: null },
  expiryDate:      { type: Date,   default: null },
  nextServiceDate: { type: Date,   default: null },
  // location is one of LAB_LOCATIONS: Lab A | Lab B | Lab C | Lab D
  location:        { type: String, default: '' },
  machineStatus:   {
    type: String,
    enum: ['operational','service_due','under_repair','decommissioned',''],
    default: 'operational',
  },
  serviceRequests: [serviceRequestSchema],

  // ── Consumable fields ───────────────────────────────────────────────────
  quantity:          { type: Number, default: 0 },
  unit:              { type: String, default: 'units' },
  consumableExpiry:  { type: Date,   default: null },
  lowStockThreshold: { type: Number, default: 10 },
  lastRestocked:     { type: Date,   default: null },
  stockRequests:     [stockRequestSchema],

}, { timestamps: true, autoIndex: true });

// ─── Unique index: same machine name + location + serial number is one record
// This allows:
//   • Same machine in two locations  (name=ESR, loc=Lab A vs loc=Lab B)
//   • Same machine twice in one room (name=ESR, loc=Lab A, sn=001 vs sn=002)
// But blocks exact duplicates        (name=ESR, loc=Lab A, sn=001 twice)
// ─── Unique index: MACHINES ONLY ──────────────────────────────────────────────────
// Blocks exact duplicates: same machine name + location + serialNumber.
// Consumables are NOT covered — they have no serial number concept.
equipmentSchema.index(
  { name: 1, location: 1, serialNumber: 1 },
  { unique: true, partialFilterExpression: { category: 'machine' } }
);

equipmentSchema.index({ category: 1 });
equipmentSchema.index({ subCategory: 1 });
equipmentSchema.index({ location: 1 });
equipmentSchema.index({ machineStatus: 1 });
equipmentSchema.index({ nextServiceDate: 1 });

// ─── Drop stale indexes on every connection ───────────────────────────────
// serialNumber_1 is the main culprit: an old schema had serialNumber as a
// standalone unique field. All consumables have serialNumber="" so every
// save throws E11000 duplicate key.  We drop it on every connect event so
// it cannot survive a server restart.
const STALE_INDEX_NAMES = [
  'equipment_id_1',
  'name_1_category_1',
  'serialNumber_1',
  'name_1_location_1_serialNumber_1_category_1',
];

async function dropStaleIndexes() {
  try {
    const col     = mongoose.connection.collection('equipment');
    const indexes = await col.indexes();
    for (const idx of indexes) {
      if (STALE_INDEX_NAMES.includes(idx.name)) {
        try {
          await col.dropIndex(idx.name);
          console.log('[Equipment] Dropped stale index:', idx.name);
        } catch (_) { /* already gone */ }
      }
    }
  } catch (_) { /* collection may not exist yet */ }
}

// Fire on every reconnect AND immediately if already open
mongoose.connection.on('connected', dropStaleIndexes);
if (mongoose.connection.readyState === 1) dropStaleIndexes();

export default mongoose.model('Equipment', equipmentSchema);