import { useState, useEffect } from "react";

// ── Risk colour helpers ───────────────────────────────────────────────────────
const RISK = {
  Low:      { text: "Low Risk",      cls: "text-green-700  bg-green-50  border-green-200",  bar: "bg-green-500",  icon: "✓" },
  Moderate: { text: "Moderate Risk", cls: "text-amber-700  bg-amber-50  border-amber-200",  bar: "bg-amber-400",  icon: "⚠" },
  High:     { text: "High Risk",     cls: "text-red-700    bg-red-50    border-red-200",     bar: "bg-red-500",    icon: "✕" },
};

// ── Pretty label map ──────────────────────────────────────────────────────────
const FEAT_LABELS = {
  age: "Age", male: "Sex", sysBP: "Systolic BP", diaBP: "Diastolic BP",
  totChol: "Total Cholesterol", BMI: "BMI", glucose: "Glucose",
  heartRate: "Heart Rate", cigsPerDay: "Cigs / Day",
  PulsePressure: "Pulse Pressure", CholAgeRatio: "Chol/Age Ratio",
  prevalentHyp: "Hypertension", diabetes: "Diabetes",
  currentSmoker: "Smoker", BPMeds: "BP Medication",
};

// ── Field groups ──────────────────────────────────────────────────────────────
// ── Field validation limits ────────────────────────────────────────────────────
const FIELD_LIMITS = {
  age:        { min: 18,  max: 120, label: "Age",               unit: "yrs"   },
  sysBP:      { min: 70,  max: 300, label: "Systolic BP",       unit: "mmHg"  },
  diaBP:      { min: 40,  max: 200, label: "Diastolic BP",      unit: "mmHg"  },
  heartRate:  { min: 20,  max: 150, label: "Heart Rate",        unit: "bpm"   },
  BMI:        { min: 10,  max: 70,  label: "BMI",               unit: "kg/m²" },
  totChol:    { min: 50,  max: 700, label: "Total Cholesterol", unit: "mg/dL" },
  glucose:    { min: 50,  max: 600, label: "Blood Glucose",     unit: "mg/dL" },
  cigsPerDay: { min: 0,   max: 100, label: "Cigarettes/Day",    unit: "/day"  },
};

const SECTIONS = [
  {
    id: "demographics", title: "Patient Demographics",
    color: "#1565C0", bg: "#E3F2FD",
    fields: [
      { key: "age",       label: "Age",    type: "number", placeholder: "18 – 120",  unit: "yrs",
        min: FIELD_LIMITS.age.min, max: FIELD_LIMITS.age.max },
      { key: "male",      label: "Sex",    type: "select", options: [{ v: "1", l: "Male" }, { v: "0", l: "Female" }] },
      { key: "education", label: "Education Level", type: "select",
        options: [{ v: "1", l: "1 — No High School" }, { v: "2", l: "2 — High School / GED" },
                  { v: "3", l: "3 — Some College" },   { v: "4", l: "4 — College Grad" }] },
    ],
  },
  {
    id: "vitals", title: "Vital Signs & Body",
    color: "#00897B", bg: "#E0F2F1",
    fields: [
      { key: "sysBP",     label: "Systolic BP",  type: "number", placeholder: "70 – 300", unit: "mmHg",
        min: FIELD_LIMITS.sysBP.min,    max: FIELD_LIMITS.sysBP.max },
      { key: "diaBP",     label: "Diastolic BP", type: "number", placeholder: "40 – 200", unit: "mmHg",
        min: FIELD_LIMITS.diaBP.min,    max: FIELD_LIMITS.diaBP.max },
      { key: "heartRate", label: "Heart Rate",   type: "number", placeholder: "20 – 150", unit: "bpm",
        min: FIELD_LIMITS.heartRate.min, max: FIELD_LIMITS.heartRate.max },
      { key: "BMI",       label: "BMI",          type: "number", placeholder: "10 – 70",  unit: "kg/m²", step: "0.1",
        min: FIELD_LIMITS.BMI.min,      max: FIELD_LIMITS.BMI.max },
    ],
  },
  {
    id: "labs", title: "Lab Values",
    color: "#7B1FA2", bg: "#F3E5F5",
    fields: [
      { key: "totChol",   label: "Total Cholesterol", type: "number", placeholder: "50 – 700", unit: "mg/dL",
        min: FIELD_LIMITS.totChol.min,  max: FIELD_LIMITS.totChol.max },
      { key: "glucose",   label: "Blood Glucose",     type: "number", placeholder: "50 – 600", unit: "mg/dL",
        min: FIELD_LIMITS.glucose.min,  max: FIELD_LIMITS.glucose.max },
    ],
  },
  {
    id: "history", title: "Medical History",
    color: "#E65100", bg: "#FFF3E0",
    fields: [
      { key: "prevalentHyp",    label: "Prevalent Hypertension", type: "select", options: [{ v: "0", l: "No" }, { v: "1", l: "Yes" }] },
      { key: "prevalentStroke", label: "Prevalent Stroke",       type: "select", options: [{ v: "0", l: "No" }, { v: "1", l: "Yes" }] },
      { key: "diabetes",        label: "Diabetes",               type: "select", options: [{ v: "0", l: "No" }, { v: "1", l: "Yes" }] },
      { key: "BPMeds",          label: "On BP Medication",       type: "select", options: [{ v: "0", l: "No" }, { v: "1", l: "Yes" }] },
    ],
  },
  {
    id: "lifestyle", title: "Lifestyle",
    color: "#37474F", bg: "#ECEFF1",
    fields: [
      { key: "currentSmoker", label: "Current Smoker", type: "select", options: [{ v: "0", l: "No" }, { v: "1", l: "Yes" }] },
      { key: "cigsPerDay",    label: "Cigarettes / Day", type: "number", placeholder: "0 – 100", unit: "/day",
        min: FIELD_LIMITS.cigsPerDay.min, max: FIELD_LIMITS.cigsPerDay.max },
    ],
  },
];

const HEART_API = "http://localhost:5002";

const defaultForm = () => ({
  age: "", male: "1", education: "2",
  sysBP: "", diaBP: "", heartRate: "", BMI: "",
  totChol: "", glucose: "",
  prevalentHyp: "0", prevalentStroke: "0", diabetes: "0", BPMeds: "0",
  currentSmoker: "0", cigsPerDay: "0",
});

export default function DoctorHeartPredict() {
  const [form,        setForm]        = useState(defaultForm());
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [online,      setOnline]      = useState(null); // null=checking
  const [fieldErrors, setFieldErrors] = useState({});  // per-field validation msgs

  // ── Check ML service health ───────────────────────────────────────────────
  useEffect(() => {
    fetch(`${HEART_API}/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? setOnline(true) : setOnline(false))
      .catch(() => setOnline(false));
  }, []);

  // ── Per-field change handler with live range validation ──────────────────────
  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (FIELD_LIMITS[k] !== undefined) {
      const num = parseFloat(v);
      const { min, max, label, unit } = FIELD_LIMITS[k];
      if (v === "" || v === "-") {
        setFieldErrors(e => ({ ...e, [k]: null }));
      } else if (isNaN(num) || num < 0) {
        setFieldErrors(e => ({ ...e, [k]: `${label} cannot be negative` }));
      } else if (num < min) {
        setFieldErrors(e => ({ ...e, [k]: `${label} must be ≥ ${min} ${unit}` }));
      } else if (num > max) {
        setFieldErrors(e => ({ ...e, [k]: `${label} must be ≤ ${max} ${unit}` }));
      } else {
        setFieldErrors(e => ({ ...e, [k]: null }));
      }
    }
  };

  const handlePredict = async () => {
    setError("");
    const required = ["age", "sysBP", "diaBP", "heartRate", "BMI", "totChol", "glucose"];

    // Check for missing required fields
    const missing = required.filter(k => form[k] === "" || form[k] === null);
    if (missing.length) {
      setError(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    // Check for negative values or out-of-range values on all numeric fields
    const rangeErrors = {};
    Object.entries(FIELD_LIMITS).forEach(([k, { min, max, label, unit }]) => {
      const val = parseFloat(form[k]);
      if (form[k] === "" || form[k] === undefined) return; // handled by missing check above
      if (isNaN(val) || val < 0) {
        rangeErrors[k] = `${label} cannot be negative`;
      } else if (val < min) {
        rangeErrors[k] = `${label} must be ≥ ${min} ${unit}`;
      } else if (val > max) {
        rangeErrors[k] = `${label} must be ≤ ${max} ${unit}`;
      }
    });

    if (Object.keys(rangeErrors).length > 0) {
      setFieldErrors(rangeErrors);
      setError("Please correct the highlighted fields before predicting.");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach(k => {
        const v = payload[k];
        if (!isNaN(v) && v !== "") payload[k] = parseFloat(v);
      });
      const res = await fetch(`${HEART_API}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Prediction failed");
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || "Prediction failed. Is the ML service running?");
    } finally { setLoading(false); }
  };

  const risk = result ? RISK[result.riskLevel] : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 flex items-center justify-between overflow-hidden relative"
        style={{ background: "linear-gradient(135deg, #B71C1C 0%, #C62828 50%, #E53935 100%)" }}>
        <div className="absolute right-0 top-0 bottom-0 w-48 opacity-10 pointer-events-none">
          <svg viewBox="0 0 200 200" fill="white">
            <path d="M100,30 C60,30 30,60 30,95 C30,140 100,175 100,175 C100,175 170,140 170,95 C170,60 140,30 100,30Z"/>
          </svg>
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">❤️</span>
            <h1 className="text-white font-bold text-xl" style={{ fontFamily: "'Playfair Display', serif" }}>
              Heart Disease Risk Predictor
            </h1>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/20 text-white">AI</span>
          </div>
          <p className="text-white/70 text-sm">
            10-Year cardiovascular risk assessment using Random Forest model (Framingham-based)
          </p>
        </div>
        {/* Service status */}
        <div className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
          online === null ? "bg-white/20 text-white" :
          online ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            online === null ? "bg-white animate-pulse" :
            online ? "bg-green-500" : "bg-red-500"
          }`}/>
          {online === null ? "Checking…" : online ? "Service Online" : "Service Offline"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Input Form ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {SECTIONS.map(sec => (
            <div key={sec.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 flex items-center gap-2"
                style={{ background: sec.bg, borderBottom: `2px solid ${sec.color}22` }}>
                <div className="w-3 h-3 rounded-full" style={{ background: sec.color }}/>
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: sec.color }}>
                  {sec.title}
                </span>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                {sec.fields.map(field => (
                  <div key={field.key} className={field.type === "select" || !field.unit ? "" : ""}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{field.label}</label>
                    {field.type === "select" ? (
                      <select
                        value={form[field.key]}
                        onChange={e => set(field.key, e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white">
                        {field.options.map(o => (
                          <option key={o.v} value={o.v}>{o.l}</option>
                        ))}
                      </select>
                    ) : (() => {
                      const hasErr = !!fieldErrors[field.key];
                      return (
                        <div>
                          <div className="relative">
                            <input
                              type="number"
                              value={form[field.key]}
                              min={field.min}
                              max={field.max}
                              step={field.step || "1"}
                              placeholder={field.placeholder}
                              onChange={e => set(field.key, e.target.value)}
                              className={`w-full px-3 py-2 rounded-xl border text-sm text-gray-800 focus:outline-none focus:ring-2 bg-white pr-14
                                ${hasErr
                                  ? "border-red-400 focus:ring-red-100 focus:border-red-500 bg-red-50"
                                  : "border-gray-200 focus:ring-blue-100 focus:border-blue-400"}`}
                            />
                            {field.unit && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                                {field.unit}
                              </span>
                            )}
                          </div>
                          {hasErr && (
                            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                              <span>⚠</span> {fieldErrors[field.key]}
                            </p>
                          )}
                          {field.min !== undefined && field.max !== undefined && !hasErr && (
                            <p className="mt-1 text-xs text-gray-400">
                              Range: {field.min} – {field.max} {field.unit}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              ⚠ {error}
            </div>
          )}

          {/* Predict button */}
          <button
            onClick={handlePredict}
            disabled={loading || online === false}
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: loading ? "#9E9E9E" : "linear-gradient(135deg, #B71C1C, #E53935)" }}>
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg> Predicting…</>
            ) : "❤️  Predict Heart Disease Risk"}
          </button>
        </div>

        {/* ── Result Panel ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {!result ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center text-center min-h-[300px]">
              <div className="text-5xl mb-4 opacity-30">❤️</div>
              <p className="text-sm text-gray-400 font-medium">Fill in the patient details and click Predict</p>
            </div>
          ) : (
            <>
              {/* Risk result card */}
              <div className={`bg-white rounded-2xl border shadow-sm p-5 ${risk.cls.split(' ').slice(1).join(' ')}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold ${risk.bar}`}>
                    {risk.icon}
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${risk.cls.split(' ')[0]}`}>{risk.text}</div>
                    <div className="text-xs text-gray-500">10-year CHD risk</div>
                  </div>
                  <div className="ml-auto text-2xl font-black" style={{ color: risk.cls.includes('red') ? '#B71C1C' : risk.cls.includes('amber') ? '#E65100' : '#2E7D32' }}>
                    {result.riskPercent}%
                  </div>
                </div>

                {/* Risk bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${risk.bar}`}
                    style={{ width: `${Math.min(result.riskPercent, 100)}%` }}/>
                </div>

                {/* Probability breakdown */}
                <div className="flex gap-3 mt-3 text-xs">
                  <div className="flex-1 text-center p-2 rounded-lg bg-green-50 border border-green-100">
                    <div className="font-bold text-green-700">{(result.probLow * 100).toFixed(1)}%</div>
                    <div className="text-green-600">Low Risk</div>
                  </div>
                  <div className="flex-1 text-center p-2 rounded-lg bg-red-50 border border-red-100">
                    <div className="font-bold text-red-700">{(result.probHigh * 100).toFixed(1)}%</div>
                    <div className="text-red-600">High Risk</div>
                  </div>
                </div>
              </div>

              {/* Top risk factors */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  Top Contributing Factors
                </h3>
                <div className="space-y-2.5">
                  {result.topFactors.map((f, i) => (
                    <div key={f.feature}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">
                          {FEAT_LABELS[f.feature] || f.feature}
                        </span>
                        <span className="text-gray-400">{(f.importance * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-400 to-rose-600"
                          style={{ width: `${(f.importance / result.topFactors[0].importance) * 100}%` }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical note */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed">
                <strong>⚕ Clinical Note:</strong> This is a screening tool based on Framingham Heart Study data.
                Results should be combined with full clinical assessment. Not a substitute for professional judgement.
              </div>

              {/* Reset */}
              <button onClick={() => { setResult(null); setForm(defaultForm()); setFieldErrors({}); setError(""); }}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                ↺ New Assessment
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}