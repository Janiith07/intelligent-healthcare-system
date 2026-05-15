import mongoose from 'mongoose';

// ─── Fasting / waiting hours required before sample can be submitted ───────
// 0  = no fasting needed
// >0 = patient must wait this many hours after pre-conditions are sent
// The frontend uses this to show a countdown / warning to lab staff,
// and to show a "you may now submit your sample" notification to the patient.
export const FASTING_HOURS = {
  FBC:                 0,   // no fasting
  ESR:                 4,   // avoid high-fat meal within 4 h
  FBS:                 8,   // must fast 8 h
  'Liver Profile':     8,   // fast 8 h
  'Renal Profile':    12,   // avoid high-protein meal 12 h
  'Thyroid Profile':   0,   // no fasting (morning collection preferred)
  'Serum Vit D Level': 0,   // no fasting
  'Dengue Ag':         0,   // no fasting
};

// ─── Test prices in LKR — used by Cashier to bill patients ───────────────
export const LAB_TEST_PRICES = {
  FBC:                  800,
  ESR:                  500,
  FBS:                  400,
  'Liver Profile':     2500,
  'Renal Profile':     3000,
  'Thyroid Profile':   2800,
  'Serum Vit D Level': 3500,
  'Dengue Ag':         1800,
};



// ─── Pre-test condition templates ─────────────────────────────────────────
export const PRE_CONDITIONS = {
  FBC: {
    checkboxes: [
      'Patient has NOT taken any blood-thinning medications in the last 48 hours',
      'Patient has NOT had a blood transfusion in the past 3 months',
      'Patient is not currently menstruating (affects RBC count)',
      'Sample collected in EDTA (purple-top) tube',
      'Tube mixed gently by inversion (8–10 times)',
    ],
    shortAnswers: [
      { question: 'Any recent illness or infection?',      placeholder: 'e.g. fever, cold, infection' },
      { question: 'Current medications (if any)?',         placeholder: 'List all medications' },
    ],
  },
  ESR: {
    checkboxes: [
      'Patient has NOT eaten a high-fat meal within 4 hours',
      'Sample collected in citrate (black-top) tube',
      'Sample processed within 2 hours of collection',
      'Patient is well-hydrated',
    ],
    shortAnswers: [
      { question: 'Any recent infection or inflammatory condition?', placeholder: 'e.g. arthritis, TB, etc.' },
      { question: 'Any chronic disease or autoimmune condition?',    placeholder: 'Describe if applicable' },
    ],
  },
  FBS: {
    checkboxes: [
      'Patient has fasted for at least 8 hours (water only allowed)',
      'Patient has NOT smoked in the last 30 minutes',
      'Patient has NOT exercised strenuously in the last hour',
      'Sample collected in fluoride oxalate (grey-top) tube',
    ],
    shortAnswers: [
      { question: 'Fasting start time?',                          placeholder: 'e.g. 10:00 PM last night' },
      { question: 'Known diabetic? Current diabetes medications?', placeholder: 'e.g. Metformin 500mg BD' },
    ],
  },
  'Liver Profile': {
    checkboxes: [
      'Patient has fasted for at least 8 hours',
      'Patient has NOT consumed alcohol in the last 24 hours',
      'Patient has NOT taken paracetamol or hepatotoxic drugs recently',
      'Sample collected in SST/plain (gold or red-top) tube',
    ],
    shortAnswers: [
      { question: 'Any alcohol consumption? Frequency and amount?',                         placeholder: 'e.g. occasional, daily' },
      { question: 'Any medications known to affect liver? (Statins, TB drugs, etc.)',        placeholder: 'List if any' },
      { question: 'Any history of jaundice, hepatitis, or liver disease?',                  placeholder: 'Describe' },
    ],
  },
  'Renal Profile': {
    checkboxes: [
      'Patient is well-hydrated (adequate water intake)',
      'Patient has NOT taken NSAIDs (e.g. Ibuprofen) in the last 24 hours',
      'Patient has NOT done strenuous exercise in the last 24 hours',
      'High-protein meal avoided for the past 12 hours',
      'Sample collected in SST/plain (gold or red-top) tube',
    ],
    shortAnswers: [
      { question: 'Any history of kidney disease, hypertension or diabetes?',  placeholder: 'Describe' },
      { question: 'Any nephrotoxic drugs? (Aminoglycosides, contrast dye, etc.)', placeholder: 'List if any' },
    ],
  },
  'Thyroid Profile': {
    checkboxes: [
      'Sample collected preferably in the morning (TSH peaks at dawn)',
      'Patient has NOT taken thyroid medication (Thyroxine) on the day of test',
      'Patient has NOT undergone thyroid scan/iodine contrast within 4 weeks',
      'Biotin supplements stopped at least 72 hours before (can interfere with results)',
    ],
    shortAnswers: [
      { question: 'Current thyroid medication and dose?',                                       placeholder: 'e.g. Thyroxine 50mcg OD' },
      { question: 'Any symptoms? (fatigue, weight change, hair loss, palpitations)',             placeholder: 'Describe' },
    ],
  },
  'Serum Vit D Level': {
    checkboxes: [
      'No special fasting required',
      'Patient has NOT taken high-dose Vitamin D supplements within 48 hours',
      'Sample collected in SST/plain (gold or red-top) tube',
      'Sample protected from light (wrap in foil) immediately after collection',
    ],
    shortAnswers: [
      { question: 'Current Vitamin D supplement dose (if any)?',  placeholder: 'e.g. 1000 IU daily' },
      { question: 'Sun exposure level (high / moderate / low)?',  placeholder: 'e.g. minimal due to indoor work' },
    ],
  },
  'Dengue Ag': {
    checkboxes: [
      'Test performed within the first 5 days of fever onset for NS1 Ag',
      'Patient has NOT taken antipyretics in the last 4 hours (may mask fever)',
      'Sample collected in EDTA (purple-top) or plain tube as per kit',
      'Tourniquet time minimized (< 1 minute) to avoid haemoconcentration',
    ],
    shortAnswers: [
      { question: 'Exact date and time of fever onset?',               placeholder: 'e.g. 20 Feb 2026, 6:00 PM' },
      { question: 'Any rash, joint pain, bleeding tendency, or vomiting?', placeholder: 'Describe symptoms' },
      { question: 'Any recent travel to dengue-endemic area?',          placeholder: 'Location and date' },
    ],
  },
};

// ─── Result field templates per test type ─────────────────────────────────
// IMPORTANT — every numeric parameter now has min / max fields.
// The frontend uses these to AUTO-FLAG results the moment the lab staff
// types a number — no manual selection needed.
//
//   value < min              → flag = 'Low'
//   value > max              → flag = 'High'
//   min ≤ value ≤ max        → flag = 'Normal'
//   positiveThreshold set    → value ≥ threshold → 'Positive', else 'Negative'
//   min = null & max = null  → qualitative result, manual flag only
// ──────────────────────────────────────────────────────────────────────────
export const RESULT_FIELDS = {
  FBC: {
    checkboxes: [
      { label: 'No morphological abnormalities noted',    defaultChecked: false },
      { label: 'Microcytic hypochromic picture present',  defaultChecked: false },
      { label: 'Normocytic normochromic picture',         defaultChecked: false },
      { label: 'Thrombocytopenia noted',                  defaultChecked: false },
      { label: 'Leukocytosis noted',                      defaultChecked: false },
      { label: 'Leukopenia noted',                        defaultChecked: false },
    ],
    parameters: [
      // Wide ranges cover both male and female reference intervals
      { name: 'Haemoglobin (Hb)',   unit: 'g/dL',      ref: '13.0–17.5 (M) / 12.0–15.5 (F)', min: 12.0, max: 17.5 },
      { name: 'RBC Count',          unit: '× 10⁶/µL',  ref: '4.5–5.5 (M) / 4.0–5.0 (F)',     min: 4.0,  max: 5.5  },
      { name: 'WBC Count',          unit: '× 10³/µL',  ref: '4.5–11.0',                        min: 4.5,  max: 11.0 },
      { name: 'Platelet Count',     unit: '× 10³/µL',  ref: '150–400',                         min: 150,  max: 400  },
      { name: 'Neutrophils',        unit: '%',          ref: '50–70',                           min: 50,   max: 70   },
      { name: 'Lymphocytes',        unit: '%',          ref: '20–40',                           min: 20,   max: 40   },
      { name: 'Monocytes',          unit: '%',          ref: '2–8',                             min: 2,    max: 8    },
      { name: 'Eosinophils',        unit: '%',          ref: '1–4',                             min: 1,    max: 4    },
      { name: 'Haematocrit (PCV)',  unit: '%',          ref: '40–52 (M) / 36–48 (F)',           min: 36,   max: 52   },
      { name: 'MCV',                unit: 'fL',         ref: '80–100',                          min: 80,   max: 100  },
      { name: 'MCH',                unit: 'pg',         ref: '27–33',                           min: 27,   max: 33   },
      { name: 'MCHC',               unit: 'g/dL',       ref: '32–36',                           min: 32,   max: 36   },
    ],
  },

  ESR: {
    checkboxes: [
      { label: 'Normal ESR for age and sex',                       defaultChecked: false },
      { label: 'ESR elevated – possible inflammation/infection',   defaultChecked: false },
      { label: 'ESR markedly elevated – recommend further workup', defaultChecked: false },
    ],
    parameters: [
      // Using female (wider) ceiling as conservative upper limit
      { name: 'ESR (Erythrocyte Sedimentation Rate)', unit: 'mm/hr', ref: '0–15 (M) / 0–20 (F)', min: 0, max: 20 },
    ],
  },

  FBS: {
    checkboxes: [
      { label: 'Fasting glucose within normal range',      defaultChecked: false },
      { label: 'Pre-diabetic range (IFG: 100–125 mg/dL)', defaultChecked: false },
      { label: 'Diabetic range (≥ 126 mg/dL)',             defaultChecked: false },
      { label: 'Hypoglycaemia noted (< 70 mg/dL)',         defaultChecked: false },
    ],
    parameters: [
      // Flag High at 100 because ≥100 is clinically significant (pre-DM)
      { name: 'Fasting Blood Glucose', unit: 'mg/dL', ref: '70–99 Normal | 100–125 Pre-DM | ≥126 DM', min: 70, max: 99 },
    ],
  },

  'Liver Profile': {
    checkboxes: [
      { label: 'Liver enzymes within normal limits',                      defaultChecked: false },
      { label: 'Elevated transaminases – possible hepatocellular damage', defaultChecked: false },
      { label: 'Elevated ALP – possible cholestatic pattern',             defaultChecked: false },
      { label: 'Bilirubin elevated – possible jaundice workup needed',    defaultChecked: false },
      { label: 'Hypoalbuminaemia noted',                                  defaultChecked: false },
    ],
    parameters: [
      { name: 'ALT (SGPT)',                  unit: 'U/L',   ref: '7–56',     min: 7,   max: 56   },
      { name: 'AST (SGOT)',                  unit: 'U/L',   ref: '10–40',    min: 10,  max: 40   },
      { name: 'ALP (Alkaline Phosphatase)',  unit: 'U/L',   ref: '44–147',   min: 44,  max: 147  },
      { name: 'Total Bilirubin',             unit: 'mg/dL', ref: '0.1–1.2',  min: 0.1, max: 1.2  },
      { name: 'Direct Bilirubin',            unit: 'mg/dL', ref: '0–0.3',    min: 0,   max: 0.3  },
      { name: 'Total Protein',               unit: 'g/dL',  ref: '6.3–8.2',  min: 6.3, max: 8.2  },
      { name: 'Albumin',                     unit: 'g/dL',  ref: '3.5–5.0',  min: 3.5, max: 5.0  },
      { name: 'GGT',                         unit: 'U/L',   ref: '9–48',     min: 9,   max: 48   },
    ],
  },

  'Renal Profile': {
    checkboxes: [
      { label: 'Renal function within normal limits',             defaultChecked: false },
      { label: 'Elevated creatinine – possible renal impairment', defaultChecked: false },
      { label: 'Elevated BUN – dehydration or renal disease',     defaultChecked: false },
      { label: 'Electrolyte imbalance noted',                     defaultChecked: false },
      { label: 'eGFR reduced – refer for nephrology review',      defaultChecked: false },
    ],
    parameters: [
      { name: 'Serum Creatinine',            unit: 'mg/dL',          ref: '0.7–1.3 (M) / 0.6–1.1 (F)', min: 0.6,  max: 1.3  },
      { name: 'Blood Urea Nitrogen (BUN)',   unit: 'mg/dL',          ref: '7–20',                        min: 7,    max: 20   },
      { name: 'Serum Uric Acid',             unit: 'mg/dL',          ref: '3.4–7.0 (M) / 2.4–6.0 (F)', min: 2.4,  max: 7.0  },
      { name: 'Sodium (Na⁺)',                unit: 'mmol/L',         ref: '136–145',                     min: 136,  max: 145  },
      { name: 'Potassium (K⁺)',              unit: 'mmol/L',         ref: '3.5–5.1',                     min: 3.5,  max: 5.1  },
      { name: 'Chloride (Cl⁻)',              unit: 'mmol/L',         ref: '98–106',                      min: 98,   max: 106  },
      { name: 'Bicarbonate (HCO₃⁻)',         unit: 'mmol/L',         ref: '22–29',                       min: 22,   max: 29   },
      // eGFR: only low is dangerous (≥90 is normal, no clinical upper concern)
      { name: 'eGFR',                        unit: 'mL/min/1.73m²',  ref: '≥ 90 (Normal)',               min: 90,   max: null },
    ],
  },

  'Thyroid Profile': {
    checkboxes: [
      { label: 'Euthyroid – thyroid function normal',                        defaultChecked: false },
      { label: 'Primary hypothyroidism – elevated TSH, low fT4',            defaultChecked: false },
      { label: 'Subclinical hypothyroidism – elevated TSH, normal fT4',     defaultChecked: false },
      { label: 'Hyperthyroidism – suppressed TSH, elevated fT4/fT3',        defaultChecked: false },
      { label: 'Subclinical hyperthyroidism – suppressed TSH, normal fT4',  defaultChecked: false },
    ],
    parameters: [
      { name: 'TSH (Thyroid Stimulating Hormone)', unit: 'mIU/L', ref: '0.4–4.0', min: 0.4, max: 4.0 },
      { name: 'Free T4 (fT4)',                     unit: 'ng/dL', ref: '0.8–1.8', min: 0.8, max: 1.8 },
      { name: 'Free T3 (fT3)',                     unit: 'pg/mL', ref: '2.3–4.2', min: 2.3, max: 4.2 },
    ],
  },

  'Serum Vit D Level': {
    checkboxes: [
      { label: 'Sufficient Vitamin D (≥ 30 ng/mL)',                         defaultChecked: false },
      { label: 'Insufficiency (20–29 ng/mL) – supplementation advised',     defaultChecked: false },
      { label: 'Deficiency (< 20 ng/mL) – therapeutic dose required',       defaultChecked: false },
      { label: 'Severe deficiency (< 10 ng/mL) – urgent management needed', defaultChecked: false },
    ],
    parameters: [
      // <30 = Low (insufficient/deficient), >100 = potential Vit D toxicity
      { name: '25-OH Vitamin D', unit: 'ng/mL', ref: '≥30 Sufficient | 20–29 Insufficient | <20 Deficient', min: 30, max: 100 },
    ],
  },

  'Dengue Ag': {
    checkboxes: [
      { label: 'NS1 Antigen NEGATIVE',                                     defaultChecked: false },
      { label: 'NS1 Antigen POSITIVE – Active dengue infection likely',    defaultChecked: false },
      { label: 'IgM Antibody POSITIVE – Recent/acute infection',           defaultChecked: false },
      { label: 'IgG Antibody POSITIVE – Past exposure/secondary infection',defaultChecked: false },
      { label: 'Result inconclusive – repeat test recommended',            defaultChecked: false },
    ],
    parameters: [
      // NS1: qualitative strip (Negative/Positive) — manual flag, no numeric range
      { name: 'NS1 Antigen', unit: '',      ref: 'Negative',                          min: null, max: null, positiveThreshold: null },
      // IgM / IgG: index value — ≥1.1 = Positive
      { name: 'Dengue IgM',  unit: 'Index', ref: '< 1.0 Negative | ≥ 1.1 Positive', min: null, max: null, positiveThreshold: 1.1  },
      { name: 'Dengue IgG',  unit: 'Index', ref: '< 1.0 Negative | ≥ 1.1 Positive', min: null, max: null, positiveThreshold: 1.1  },
    ],
  },
};

// ─── Schema ────────────────────────────────────────────────────────────────
const labTestResultSchema = new mongoose.Schema({

  testId:        { type: String, required: true, unique: true },
  labRequestRef: { type: String, required: true },
  appointmentId: { type: String, required: true },

  paymentId:        { type: String,  default: null },
  paymentConfirmed: { type: Boolean, default: false },

  testName: { type: String, required: true }, // no enum — accepts any test name

  patientId:   { type: String, default: null }, // stored as String (e.g. PHC-2026-001)
  patientName: { type: String, default: '' },

  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  preTestConditions: {
    checkboxes:         [{ label: String, checked: Boolean }],
    shortAnswers:       [{ question: String, answer: String }],
    verifiedByLabStaff: { type: Boolean, default: false },
    verifiedAt:         { type: Date,    default: null },
  },

  // ── Timestamp when pre-conditions were sent to the patient.
  // Used to calculate the fasting/waiting countdown.
  // Set automatically by the controller when status moves to pre_check.
  conditionsSentAt: { type: Date, default: null },

  status: {
    type:    String,
    enum:    ['payment_pending', 'pre_check', 'sample_received', 'in_progress', 'completed'],
    default: 'payment_pending',
  },

  sampleReceivedAt: { type: Date, default: null },
  testStartedAt:    { type: Date, default: null },
  completedAt:      { type: Date, default: null },

  results: {
    checkboxFindings: [{ label: String, checked: Boolean }],
    parameters: [{
      name:  String,
      value: String,
      unit:  String,
      ref:   String,
      flag:  { type: String, enum: ['Normal', 'High', 'Low', 'Positive', 'Negative', 'Reactive', ''], default: '' },
    }],
    labNotes:    { type: String, default: '' },
    performedBy: { type: String, default: '' },
  },

  reportPdfPath: { type: String, default: null },

  paymentMethod:    { type: String,  default: 'Cash' },  // Cash | Card | Online
  amountPaid:       { type: Number,  default: 0 },
}, { timestamps: true });

labTestResultSchema.index({ patientId: 1,  createdAt: -1 });
labTestResultSchema.index({ doctorId: 1,   createdAt: -1 });
labTestResultSchema.index({ labRequestRef: 1 });
labTestResultSchema.index({ appointmentId: 1 });
labTestResultSchema.index({ status:        1 });

labTestResultSchema.statics.generateTestId = async function () {
  const year = new Date().getFullYear();
  const last = await this.findOne({ testId: new RegExp(`^TR-${year}-`) }).sort({ createdAt: -1 });
  let seq = 1;
  if (last?.testId) {
    const n = parseInt(last.testId.split('-').pop());
    if (!isNaN(n)) seq = n + 1;
  }
  return `TR-${year}-${String(seq).padStart(4, '0')}`;
};

export default mongoose.model('LabTestResult', labTestResultSchema);