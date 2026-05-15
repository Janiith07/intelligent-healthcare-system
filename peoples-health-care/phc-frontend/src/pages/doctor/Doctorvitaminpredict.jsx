import { useState } from "react";
import api from "../../services/api";

// ── Field definitions grouped by section ─────────────────────
const SECTIONS = [
  {
    id: "demographics",
    title: "Patient Demographics",
    color: "#1565C0",
    bg: "#E3F2FD",
    fields: [
      { key: "age",    label: "Age",    type: "number", placeholder: "e.g. 35",  unit: "yrs" },
      { key: "bmi",    label: "BMI",    type: "number", placeholder: "e.g. 22.5", unit: "kg/m²", step: "0.1" },
      {
        key: "gender", label: "Gender", type: "select",
        options: ["Female", "Male"],
      },
    ],
  },
  {
    id: "lifestyle",
    title: "Lifestyle Factors",
    color: "#00897B",
    bg: "#E0F2F1",
    fields: [
      { key: "smoking_status",      label: "Smoking Status",      type: "select", options: ["Never", "Former", "Current"] },
      { key: "alcohol_consumption", label: "Alcohol Consumption",  type: "select", options: ["Moderate", "Heavy" , "None"] },
      { key: "exercise_level",      label: "Exercise Level",       type: "select", options: ["Active", "Light", "Moderate", "Sedentary"] },
      { key: "diet_type",           label: "Diet Type",            type: "select", options: ["Omnivore", "Vegetarian", "Vegan", "Pescatarian"] },
      { key: "sun_exposure",        label: "Sun Exposure",         type: "select", options: ["High", "Moderate", "Low"] },
      { key: "income_level",        label: "Income Level",         type: "select", options: ["High", "Middle", "Low"] },
      { key: "latitude_region",     label: "Latitude Region",      type: "select", options: ["High", "Mid", "Low"] },
    ],
  },
  {
    id: "serum",
    title: "Serum Lab Values",
    color: "#7B1FA2",
    bg: "#F3E5F5",
    fields: [
      { key: "hemoglobin_g_dl",        label: "Hemoglobin",        type: "number", placeholder: "e.g. 12.5", unit: "g/dL",  step: "0.1" },
      { key: "serum_vitamin_d_ng_ml",  label: "Serum Vitamin D",   type: "number", placeholder: "e.g. 20.0", unit: "ng/mL", step: "0.1" },
      { key: "serum_vitamin_b12_pg_ml",label: "Serum Vitamin B12", type: "number", placeholder: "e.g. 300",  unit: "pg/mL", step: "0.1" },
      { key: "serum_folate_ng_ml",     label: "Serum Folate",      type: "number", placeholder: "e.g. 8.0",  unit: "ng/mL", step: "0.1" },
    ],
  },
  {
    id: "rda",
    title: "Dietary Intake (% RDA)",
    color: "#E65100",
    bg: "#FBE9E7",
    fields: [
      { key: "vitamin_a_percent_rda",   label: "Vitamin A",   type: "number", placeholder: "0–100", unit: "%", min: 0, max: 200 },
      { key: "vitamin_c_percent_rda",   label: "Vitamin C",   type: "number", placeholder: "0–100", unit: "%", min: 0, max: 200 },
      { key: "vitamin_d_percent_rda",   label: "Vitamin D",   type: "number", placeholder: "0–100", unit: "%", min: 0, max: 200 },
      { key: "vitamin_e_percent_rda",   label: "Vitamin E",   type: "number", placeholder: "0–100", unit: "%", min: 0, max: 200 },
      { key: "vitamin_b12_percent_rda", label: "Vitamin B12", type: "number", placeholder: "0–100", unit: "%", min: 0, max: 200 },
      { key: "folate_percent_rda",      label: "Folate",      type: "number", placeholder: "0–100", unit: "%", min: 0, max: 200 },
      { key: "calcium_percent_rda",     label: "Calcium",     type: "number", placeholder: "0–100", unit: "%", min: 0, max: 200 },
      { key: "iron_percent_rda",        label: "Iron",        type: "number", placeholder: "0–100", unit: "%", min: 0, max: 200 },
    ],
  },
  {
    id: "symptoms",
    title: "Clinical Symptoms",
    color: "#C62828",
    bg: "#FFEBEE",
    fields: [
      { key: "has_night_blindness",   label: "Night Blindness",     type: "checkbox" },
      { key: "has_fatigue",           label: "Fatigue",             type: "checkbox" },
      { key: "has_bleeding_gums",     label: "Bleeding Gums",       type: "checkbox" },
      { key: "has_bone_pain",         label: "Bone Pain",           type: "checkbox" },
      { key: "has_muscle_weakness",   label: "Muscle Weakness",     type: "checkbox" },
      { key: "has_numbness_tingling", label: "Numbness / Tingling", type: "checkbox" },
      { key: "has_memory_problems",   label: "Memory Problems",     type: "checkbox" },
      { key: "has_pale_skin",         label: "Pale Skin",           type: "checkbox" },
    ],
  },
];

// ── Default form state ────────────────────────────────────────
const DEFAULT_FORM = {
  age: "", bmi: "", gender: "Female",
  smoking_status: "Never", alcohol_consumption: "Moderate",
  exercise_level: "Moderate", diet_type: "Omnivore",
  sun_exposure: "Moderate", income_level: "Middle",
  latitude_region: "Mid",
  hemoglobin_g_dl: "", serum_vitamin_d_ng_ml: "",
  serum_vitamin_b12_pg_ml: "", serum_folate_ng_ml: "",
  vitamin_a_percent_rda: "", vitamin_c_percent_rda: "",
  vitamin_d_percent_rda: "", vitamin_e_percent_rda: "",
  vitamin_b12_percent_rda: "", folate_percent_rda: "",
  calcium_percent_rda: "", iron_percent_rda: "",
  has_night_blindness: 0, has_fatigue: 0,
  has_bleeding_gums: 0, has_bone_pain: 0,
  has_muscle_weakness: 0, has_numbness_tingling: 0,
  has_memory_problems: 0, has_pale_skin: 0,
};

// ── Disease color map ─────────────────────────────────────────
const DISEASE_COLORS = {
  Anemia:               { bg: "#FFF3E0", border: "#E65100", text: "#BF360C", dot: "#FF6D00" },
  Healthy:              { bg: "#E8F5E9", border: "#2E7D32", text: "#1B5E20", dot: "#43A047" },
  Night_Blindness:      { bg: "#FFF8E1", border: "#F57F17", text: "#E65100", dot: "#FBC02D" },
  Rickets_Osteomalacia: { bg: "#EDE7F6", border: "#4527A0", text: "#311B92", dot: "#7B1FA2" },
  Scurvy:               { bg: "#FCE4EC", border: "#880E4F", text: "#6A1B9A", dot: "#E91E63" },
};

function getDiseaseStyle(name) {
  return DISEASE_COLORS[name] || { bg: "#E3F2FD", border: "#1565C0", text: "#0D47A1", dot: "#1976D2" };
}

// ── Confidence bar ────────────────────────────────────────────
function ConfidenceBar({ label, value, isTop }) {
  const pct = Math.round(value * 100);
  const style = getDiseaseStyle(label);
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-600 font-medium">{label.replace(/_/g, " ")}</span>
        <span className="text-xs font-bold" style={{ color: style.dot }}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: isTop ? style.dot : "#CBD5E1" }}
        />
      </div>
    </div>
  );
}

export default function DoctorVitaminPredict() {
  const [form, setForm]       = useState(DEFAULT_FORM);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [touched, setTouched] = useState({});

  // ── Form handlers ─────────────────────────────────────────
  const handleChange = (key, value, type) => {
    setTouched((p) => ({ ...p, [key]: true }));
    if (type === "checkbox") {
      setForm((p) => ({ ...p, [key]: p[key] === 1 ? 0 : 1 }));
    } else if (type === "number") {
      setForm((p) => ({ ...p, [key]: value === "" ? "" : parseFloat(value) }));
    } else {
      setForm((p) => ({ ...p, [key]: value }));
    }
  };

  const handleReset = () => {
    setForm(DEFAULT_FORM);
    setResult(null);
    setError(null);
    setTouched({});
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      // Convert empty strings to 0 for numeric fields before sending
      const payload = { ...form };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "") payload[k] = 0;
      });

      const { data } = await api.post("/vitamin/predict", payload);

      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.message || "Prediction failed.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Could not connect to prediction service. Ensure the ML API is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Render a single field ─────────────────────────────────
  const renderField = (field) => {
    if (field.type === "checkbox") {
      return (
        <label
          key={field.key}
          className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/40 cursor-pointer transition-all"
        >
          <div
            onClick={() => handleChange(field.key, null, "checkbox")}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
              form[field.key] === 1
                ? "bg-blue-600 border-blue-600"
                : "border-gray-300 bg-white"
            }`}
          >
            {form[field.key] === 1 && (
              <svg viewBox="0 0 10 10" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="1.5 5 4 7.5 8.5 2.5" />
              </svg>
            )}
          </div>
          <span className="text-sm text-gray-700">{field.label}</span>
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.key}>
          <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
          <select
            value={form[field.key]}
            onChange={(e) => handleChange(field.key, e.target.value, "select")}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
          >
            {field.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      );
    }

    // number input
    return (
      <div key={field.key}>
        <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
        <div className="relative">
          <input
            type="number"
            value={form[field.key]}
            placeholder={field.placeholder}
            step={field.step || "1"}
            min={field.min}
            max={field.max}
            onChange={(e) => handleChange(field.key, e.target.value, "number")}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition pr-12"
          />
          {field.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
              {field.unit}
            </span>
          )}
        </div>
      </div>
    );
  };

  // ── Result panel ──────────────────────────────────────────
  const renderResult = () => {
    if (!result) return null;

    const disease    = result.disease_diagnosis;
    const deficiency = result.multiple_deficiencies;
    const topDisease = disease.prediction;
    const dStyle     = getDiseaseStyle(topDisease);
    const confidence = disease.confidence || {};
    const sortedConf = Object.entries(confidence).sort((a, b) => b[1] - a[1]);

    return (
      <div className="mt-6 space-y-4 animate-in fade-in duration-300">

        {/* Main disease result */}
        <div
          className="rounded-2xl border-2 p-6"
          style={{ background: dStyle.bg, borderColor: dStyle.border }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: dStyle.dot }}>
                Disease Diagnosis — Stacking Model (96% F1)
              </p>
              <h2
                className="text-2xl font-bold"
                style={{ color: dStyle.text, fontFamily: "'Playfair Display', serif" }}
              >
                {topDisease.replace(/_/g, " ")}
              </h2>
              <p className="text-sm mt-1" style={{ color: dStyle.text, opacity: 0.7 }}>
                Confidence: {Math.round((confidence[topDisease] || 0) * 100)}%
              </p>
            </div>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: dStyle.dot + "20" }}
            >
              <div className="w-5 h-5 rounded-full" style={{ background: dStyle.dot }} />
            </div>
          </div>

          {/* Confidence bars */}
          <div className="mt-5 space-y-3">
            {sortedConf.map(([cls, prob]) => (
              <ConfidenceBar key={cls} label={cls} value={prob} isTop={cls === topDisease} />
            ))}
          </div>
        </div>

        {/* Multiple deficiencies result */}
        <div className={`rounded-2xl border-2 p-5 flex items-center gap-4 ${
          deficiency.prediction === "Yes"
            ? "bg-orange-50 border-orange-300"
            : "bg-green-50 border-green-300"
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            deficiency.prediction === "Yes" ? "bg-orange-100" : "bg-green-100"
          }`}>
            <svg viewBox="0 0 24 24" fill="none" stroke={deficiency.prediction === "Yes" ? "#E65100" : "#2E7D32"} strokeWidth={2} className="w-6 h-6">
              {deficiency.prediction === "Yes"
                ? <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                : <path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"/>
              }
            </svg>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest ${
              deficiency.prediction === "Yes" ? "text-orange-600" : "text-green-600"
            }`}>
              Multiple Deficiencies — Stacking Model (97% F1)
            </p>
            <p className={`text-lg font-bold mt-0.5 ${
              deficiency.prediction === "Yes" ? "text-orange-800" : "text-green-800"
            }`}>
              {deficiency.prediction === "Yes"
                ? "Multiple deficiencies detected"
                : "No multiple deficiencies detected"}
            </p>
            <p className={`text-sm ${deficiency.prediction === "Yes" ? "text-orange-600" : "text-green-600"}`}>
              Probability: {Math.round((deficiency.probability || 0) * 100)}%
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-gray-400 text-center px-4">
          This prediction is generated by an AI model and should be used as a clinical aid only.
          Always apply professional medical judgment.
        </p>
      </div>
    );
  };

  return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-xl font-bold text-gray-800"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Vitamin Deficiency Predictor
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Stacking ensemble model — disease diagnosis &amp; multiple deficiency detection
            </p>
          </div>
          <span
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}
          >
            AI · 96–97% F1
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-start">

          {/* ── LEFT: Input form ── */}
          <div className="space-y-5">
            {SECTIONS.map((section) => (
              <div key={section.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Section header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: section.bg }}>
                    <div className="w-3 h-3 rounded-full" style={{ background: section.color }} />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700">{section.title}</h3>
                </div>

                {/* Fields */}
                <div className={`p-5 ${
                  section.id === "symptoms"
                    ? "grid grid-cols-2 gap-2"
                    : "grid grid-cols-2 gap-4"
                }`}>
                  {section.fields.map((f) => renderField(f))}
                </div>
              </div>
            ))}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: loading ? "#93C5FD" : "linear-gradient(135deg, #1565C0, #00ACC1)" }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                      <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Predicting...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    Run Prediction
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                className="px-5 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition"
              >
                Reset
              </button>
            </div>
          </div>

          {/* ── RIGHT: Results panel ── */}
          <div className="space-y-4">

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="#C62828" strokeWidth={2} className="w-5 h-5 flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Placeholder when no result yet */}
            {!result && !error && (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 min-h-[480px] flex flex-col items-center justify-center p-10 text-center">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: "linear-gradient(135deg, #E3F2FD, #E0F7FA)" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth={1.5} className="w-10 h-10">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <h2
                  className="text-lg font-bold text-gray-700 mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Awaiting Input
                </h2>
                <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
                  Fill in the patient data on the left and click
                  <span className="font-semibold text-blue-600"> Run Prediction </span>
                  to see the diagnosis.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-xs text-left">
                  {[
                    { label: "Disease Diagnosis", sub: "5-class classification", color: "#1565C0", bg: "#E3F2FD" },
                    { label: "Multiple Deficiencies", sub: "Binary detection", color: "#00897B", bg: "#E0F2F1" },
                    { label: "Confidence Scores", sub: "Per-class probability", color: "#7B1FA2", bg: "#F3E5F5" },
                    { label: "Stacking Ensemble", sub: "6 models combined", color: "#E65100", bg: "#FBE9E7" },
                  ].map((c) => (
                    <div key={c.label} className="rounded-xl p-3" style={{ background: c.bg }}>
                      <p className="text-xs font-semibold" style={{ color: c.color }}>{c.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: c.color, opacity: 0.7 }}>{c.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actual results */}
            {renderResult()}
          </div>
        </div>
      </div>
  );
}