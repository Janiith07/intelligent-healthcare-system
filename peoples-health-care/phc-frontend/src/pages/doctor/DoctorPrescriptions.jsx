import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../services/api";
import PatientSearchInput from "../../components/PatientSearchInput";
import DrugSearchInput from "../../components/DrugSearchInput";

const LAB_TEST_PRICES = {
  "FBC":               2100,
  "FBS":               2300,
  "ESR":               2500,
  "Liver Profile":     2150,
  "Renal Profile":     2250,
  "Thyroid Profile":   2400,
  "Serum Vit D Level": 3000,
  "Dengue Ag":         3500,
};
const OTHER_PRICE = 4000;
const LAB_TESTS = Object.keys(LAB_TEST_PRICES);

const DOSAGE_BY_TYPE = {
  syrup: [
    "5ml (1 tsp) once daily",
    "5ml (1 tsp) twice daily (morning & night)",
    "5ml (1 tsp) three times daily (morning, noon & night)",
    "5ml (1 tsp) after meals, twice daily",
    "5ml (1 tsp) after meals, three times daily",
    "5ml (1 tsp) at bedtime",
    "10ml (2 tsp) twice daily",
    "10ml (2 tsp) three times daily",
    "2.5ml twice daily",
    "2.5ml three times daily",
    "Shake well before use — 5ml twice daily",
    "Shake well before use — 5ml three times daily",
    "Shake well before use — 10ml twice daily",
  ],
  tablet: [
    "1 tablet once daily in the morning",
    "1 tablet once daily at bedtime",
    "1 tablet twice daily (morning & night)",
    "1 tablet three times daily (morning, noon & night)",
    "1 tablet four times daily (every 6 hours)",
    "½ tablet once daily in the morning",
    "½ tablet twice daily (morning & night)",
    "1 tablet before breakfast",
    "1 tablet after breakfast",
    "1 tablet 30 minutes before meals",
    "1 tablet after meals, three times daily",
    "1 tablet with a full glass of water",
    "1 tablet with food to avoid stomach upset",
    "1 tablet at bedtime with milk",
    "2 tablets once daily in the morning",
    "2 tablets twice daily (morning & night)",
    "1 tablet every 8 hours",
    "1 tablet every 12 hours",
    "1 tablet when needed (max 3 per day)",
    "Take 2 tablets immediately, then 1 tablet every 8 hours",
    "1 tablet daily — do not crush or chew",
    "Dissolve 1 tablet in water before taking",
    "1 tablet under the tongue as needed",
  ],
  capsule: [
    "1 capsule once daily in the morning",
    "1 capsule once daily at bedtime",
    "1 capsule twice daily (morning & night)",
    "1 capsule three times daily (morning, noon & night)",
    "1 capsule before meals",
    "1 capsule after meals",
    "1 capsule 30 minutes before breakfast",
    "1 capsule with a full glass of water — do not open or crush",
    "1 capsule with food to avoid nausea",
    "2 capsules once daily in the morning",
    "2 capsules twice daily (morning & night)",
    "1 capsule every 8 hours",
    "1 capsule every 12 hours",
    "1 capsule at bedtime",
    "Open capsule and mix with soft food if unable to swallow",
  ],
  topical: [
    "Apply a thin layer to affected area once daily",
    "Apply a thin layer to affected area twice daily",
    "Apply a thin layer to affected area three times daily",
    "Apply and gently massage into skin twice daily",
    "Apply after cleaning the area, twice daily",
    "Apply after bathing, once daily",
  ],
  general: [
    "Once daily",
    "Twice daily (morning & night)",
    "Three times daily (morning, noon & night)",
    "At bedtime",
    "Before meals",
    "After meals",
    "As needed",
  ],
};

// Detect medicine type — prefer catalog form field, fall back to name keywords
function detectMedType(name = "", form = "") {
  // Catalog form takes priority
  const f = form.toLowerCase();
  if (f === "syrup" || f === "suspension" || f === "solution" || f === "drops" || f === "elixir") return "syrup";
  if (f === "capsule") return "capsule";
  if (f === "tablet")  return "tablet";
  if (f === "cream" || f === "ointment" || f === "gel" || f === "lotion") return "topical";
  // Fall back to name string matching
  const n = name.toLowerCase();
  if (/syrup|suspension|oral liquid|mixture|linctus|elixir|solution|drops|syr\b/.test(n)) return "syrup";
  if (/capsule|cap\b/.test(n)) return "capsule";
  if (/tablet|tab\b/.test(n)) return "tablet";
  if (/cream|ointment|gel|lotion|topical|paste/.test(n)) return "topical";
  return "general";
}

function getMedTypeLabel(type) {
  return { syrup:"Syrup / Liquid", tablet:"Tablet", capsule:"Capsule", topical:"Topical / Cream", general:"General" }[type] ?? "General";
}

function getMedTypeColor(type) {
  return {
    syrup:   "bg-amber-50 text-amber-700 border-amber-200",
    tablet:  "bg-blue-50 text-blue-700 border-blue-200",
    capsule: "bg-purple-50 text-purple-700 border-purple-200",
    topical: "bg-green-50 text-green-700 border-green-200",
    general: "bg-gray-100 text-gray-500 border-gray-200",
  }[type] ?? "bg-gray-100 text-gray-500 border-gray-200";
}

// Keep a flat list for backward compatibility (edit mode existing dosages)
const ALL_DOSAGE_OPTIONS = Object.values(DOSAGE_BY_TYPE).flat();

const DURATION_OPTIONS = [
  "3 days",
  "5 days",
  "1 week",
  "2 weeks",
  "3 weeks",
  "1 month",
  "2 months",
  "3 months",
  "6 months",
  "Ongoing (until review)",
];

const PHARMACY_STATUS = {
  pending:     { class: "bg-orange-100 text-orange-600 border-orange-200", dot: "bg-orange-500", label: "Pending"     },
  in_progress: { class: "bg-blue-100 text-blue-700 border-blue-200",       dot: "bg-blue-500",   label: "In Progress" },
  dispensed:   { class: "bg-green-100 text-green-700 border-green-200",    dot: "bg-green-500",  label: "Dispensed"   },
};

const LAB_STATUS = {
  pending:     { class: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-400",  label: "Pending"     },
  in_progress: { class: "bg-blue-100 text-blue-700 border-blue-200",     dot: "bg-blue-500",   label: "In Progress" },
  completed:   { class: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500",  label: "Completed"   },
};

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ══════════════════════════════════════════════════════════════
// Prescription Modal
// Props:
//   onClose  — close callback
//   onSaved  — (prescription, isEdit) callback
//   doctorName — string
//   existing — null | prescription object (edit mode)
//   prefill  — null | { patientName, patientId, appointmentId } (from dashboard Start)
// ══════════════════════════════════════════════════════════════
function PrescriptionModal({ onClose, onSaved, doctorName, existing = null, prefill = null }) {
  const isEdit    = !!existing;
  const isPrefill = !!prefill && !isEdit;

  // ── Patient info ─────────────────────────────────────────
  const [patientName,   setPatientName]   = useState(existing?.patientName   || prefill?.patientName   || "");
  const [patientId,     setPatientId]     = useState(existing?.patientId     || prefill?.patientId     || "");

  const [appointmentId, setAppointmentId] = useState(existing?.appointmentId || prefill?.appointmentId || "");

  // ── Medications ──────────────────────────────────────────
  const EMPTY_MED = () => ({ name: "", drugId: "", form: "", dosage: "", duration: "" });
  const [medications, setMedications] = useState(
    existing?.medications?.length
      ? [...existing.medications.map(m => ({ ...m, form: m.form || "" })), { name: "", drugId: "", form: "", dosage: "", duration: "" }]
      : [{ name: "", drugId: "", form: "", dosage: "", duration: "" }]
  );

  // ── Lab tests (new only) ─────────────────────────────────
  const [checkedTests,    setCheckedTests]    = useState({});
  const [testPriorities,  setTestPriorities]  = useState({});
  const [otherChecked,    setOtherChecked]    = useState(false);
  const [otherText,       setOtherText]       = useState("");
  const [otherPriority,   setOtherPriority]   = useState("Routine");
  const [labNotes,        setLabNotes]        = useState("");

  // ── Common ───────────────────────────────────────────────
  const [clinicalNotes, setClinicalNotes] = useState(existing?.clinicalNotes || "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [showLabOnlyConfirm, setShowLabOnlyConfirm] = useState(false);

  // Normalise: strip any empty rows in the middle, keep exactly one trailing empty slot.
  const normalizeMeds = (list) => {
    const filled = list.filter(m => m.name.trim());
    if (filled.length === 0) return [{ name: "", drugId: "", form: "", dosage: "", duration: "" }];
    return [...filled, { name: "", drugId: "", form: "", dosage: "", duration: "" }];
  };

  const removeMedication = (i) => {
    setMedications(normalizeMeds(medications.filter((_, idx) => idx !== i)));
  };

  const updateMed = (i, field, val) => {
    const updated = medications.map((m, idx) => idx === i ? { ...m, [field]: val } : m);
    // Re-normalise whenever the name changes so empty middle rows collapse immediately
    if (field === "name") {
      setMedications(normalizeMeds(updated));
    } else {
      setMedications(updated);
    }
  };
  const toggleTest = (t) => {
    const isNowChecked = !checkedTests[t];
    setCheckedTests(prev => ({ ...prev, [t]: !prev[t] }));
    if (isNowChecked) {
      setTestPriorities(prev => ({ ...prev, [t]: prev[t] || "Routine" }));
    }
  };
  const setTestPriority = (name, p) => setTestPriorities(prev => ({ ...prev, [name]: p }));
  const selectedNames  = Object.entries(checkedTests).filter(([,v]) => v).map(([k]) => k);
  const anyLabSelected = selectedNames.length > 0 || (otherChecked && otherText.trim());
  const urgentCount    = selectedNames.filter(n => testPriorities[n] === "Urgent").length
                       + (otherChecked && otherText.trim() && otherPriority === "Urgent" ? 1 : 0);

  const handleSubmit = async () => {
    setError("");
    if (!patientName.trim()) return setError("Patient name is required.");
    // Strip zero-width space used as custom-mode sentinel before validation
    const cleanedMeds = medications.map(m => ({
      ...m,
      dosage:   m.dosage.replace(/​/g, "").trim(),
      duration: m.duration.replace(/​/g, "").trim(),
    }));
    // Only validate rows that have a medicine name filled in
    const filledMeds = cleanedMeds.filter(m => m.name.trim());
    if (filledMeds.some(m => !m.dosage))
      return setError("Please fill in dosage instructions for all added medications.");
    if (filledMeds.some(m => !m.duration))
      return setError("Please fill in duration for all added medications.");
    if (!isEdit && !filledMeds.length && !anyLabSelected)
      return setError("Please add at least one medication or select a lab test.");
    if (!isEdit && otherChecked && !otherText.trim())
      return setError("Please describe the custom lab test.");

    // ── Lab-only guard: show confirmation popup ──────────────
    if (!isEdit && !filledMeds.length && anyLabSelected) {
      setShowLabOnlyConfirm(true);
      return;
    }

    const labTests = isEdit ? undefined : [
      ...selectedNames.map(name => ({ name, isOther: false, price: LAB_TEST_PRICES[name] || 0, priority: testPriorities[name] || "Routine" })),
      ...(otherChecked && otherText.trim() ? [{ name: otherText.trim(), isOther: true, price: OTHER_PRICE, priority: otherPriority }] : []),
    ];
    const overallLabPriority = labTests?.some(t => t.priority === "Urgent") ? "Urgent" : "Routine";

    await doSave(filledMeds, labTests, overallLabPriority);
  };

  // ── Shared save logic (called by handleSubmit and lab-only confirm) ──
  const doSave = async (filledMeds, labTests, overallLabPriority) => {
    setSaving(true);
    try {
      const payload = {
        patientName:   patientName.trim(),
        patientId:     patientId || undefined,
        appointmentId: appointmentId.trim() || undefined,
        medications:   filledMeds,
        clinicalNotes: clinicalNotes.trim(),
        ...(!isEdit && {
          labTests,
          labPriority: labTests?.length > 0 ? overallLabPriority : undefined,
          labNotes:    labTests?.length > 0 ? labNotes.trim() : undefined,
        }),
      };

      const res = isEdit
        ? await api.put(`/prescriptions/${existing._id}`, payload)
        : await api.post("/prescriptions", payload);

      onSaved(res.data.prescription, isEdit);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || (isEdit ? "Failed to update." : "Failed to issue prescription."));
    } finally {
      setSaving(false);
    }
  };

  // ── Called when doctor confirms the lab-only modal ─────────
  // Lab-only → create a STANDALONE lab request directly, no prescription
  const handleLabOnlyConfirm = async () => {
    setShowLabOnlyConfirm(false);
    const labTests = [
      ...selectedNames.map(name => ({ name, isOther: false, price: LAB_TEST_PRICES[name] || 0, priority: testPriorities[name] || "Routine" })),
      ...(otherChecked && otherText.trim() ? [{ name: otherText.trim(), isOther: true, price: OTHER_PRICE, priority: otherPriority }] : []),
    ];
    const overallPriority = labTests.some(t => t.priority === "Urgent") ? "Urgent" : "Routine";
    setSaving(true);
    try {
      await api.post("/lab-requests", {
        patientName:     patientName.trim(),
        patientId:       patientId || undefined,
        appointmentNumber: appointmentId.trim() || undefined,
        tests:           labTests,
        priority:        overallPriority,
        clinicalNotes:   clinicalNotes.trim() || labNotes.trim(),
      });
      // Lab-only: no prescription created — notify parent with null so list stays clean
      onSaved(null, false);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create lab request.");
    } finally {
      setSaving(false);
    }
  };

  const labTestsForPreview = [
    ...selectedNames.map(name => ({ name, priority: testPriorities[name] || "Routine" })),
    ...(otherChecked && otherText.trim() ? [{ name: otherText.trim(), priority: otherPriority }] : []),
  ];

  return (
    <>
      {showLabOnlyConfirm && (
        <LabOnlyConfirmModal
          labTests={labTestsForPreview}
          patientName={patientName || "this patient"}
          onConfirm={handleLabOnlyConfirm}
          onCancel={() => setShowLabOnlyConfirm(false)}
        />
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="font-bold text-gray-800 text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              {isEdit ? "Edit Prescription" : "Issue New Prescription"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">People's Health Care — {doctorName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              ⚠ {error}
            </div>
          )}

          {/* Prefill notice banner */}
          {isPrefill && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth={2} className="w-4 h-4">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-800">Auto-filled from appointment</p>
                <p className="text-xs text-blue-600 mt-0.5">Patient details have been pre-populated from the active appointment</p>
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
            </svg>
            Timestamped automatically:
            <strong className="text-gray-600 ml-1">{formatDateTime(new Date().toISOString())}</strong>
          </div>

          {/* Patient info */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Patient Information
            </label>
            <div className="space-y-3">

              {/* Patient Name */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Patient Name <span className="text-red-400">*</span>
                </label>
                <PatientSearchInput
                  value={patientName}
                  onChange={(name, uid) => { setPatientName(name); setPatientId(uid); }}
                  disabled={isEdit || isPrefill}
                  placeholder="Search by name or patient ID…"
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* Appointment ID — new field */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Appointment ID
                    {isPrefill && (
                      <span className="ml-1.5 text-blue-500 font-medium normal-case">(auto-filled)</span>
                    )}
                  </label>
                  <input
                    value={appointmentId}
                    onChange={e => setAppointmentId(e.target.value)}
                    placeholder="APT-2026-0000"
                    readOnly={isPrefill}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                      isPrefill
                        ? "border-blue-100 bg-blue-50/50 text-blue-800 cursor-default"
                        : "border-gray-200"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Medications */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Medications
                <span className="ml-1.5 text-blue-500 normal-case font-normal">(→ pharmacy)</span>
              </label>

            </div>


            <div className="space-y-3">
              {medications.map((med, i) => {
                const medType      = detectMedType(med.name, med.form || "");
                const dosageOpts   = DOSAGE_BY_TYPE[medType] ?? DOSAGE_BY_TYPE.general;
                const isKnownDosage = dosageOpts.includes(med.dosage) || ALL_DOSAGE_OPTIONS.includes(med.dosage);
                const isCustomMode  = med.dosage !== "" && !isKnownDosage;
                const isTrailingEmpty = !med.name.trim() && i === medications.length - 1;
                return (
                  <div key={i} className={`p-4 rounded-xl border relative transition-all ${
                    isTrailingEmpty
                      ? "border-dashed border-blue-200 bg-blue-50/20"
                      : "bg-blue-50/40 border-blue-100"
                  }`}>
                    {/* Row number badge for filled rows */}
                    {!isTrailingEmpty && (
                      <span className="absolute top-3 left-3 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center">
                        {medications.filter((m, idx) => m.name.trim() && idx <= i).length}
                      </span>
                    )}
                    {/* Trailing empty row hint */}
                    {isTrailingEmpty && (
                      <div className="flex items-center gap-2 mb-3 text-blue-300">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-[11px] font-medium">Add another medicine…</span>
                      </div>
                    )}
                    <button onClick={() => removeMedication(i)} className={`absolute top-3 right-3 p-1 hover:bg-red-100 rounded-lg transition text-red-400 ${isTrailingEmpty ? "opacity-0 pointer-events-none" : ""}`}>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                    </button>
                    <div className={`grid grid-cols-3 gap-3 ${isTrailingEmpty ? "pr-2" : "pl-7 pr-6"}`}>
                      <div className="col-span-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-500">Medicine Name &amp; Strength</label>
                          {/* Type badge — shown once name is entered */}
                          {med.name.trim() && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getMedTypeColor(medType)}`}>
                              {getMedTypeLabel(medType)}
                            </span>
                          )}
                        </div>
                        <DrugSearchInput
                          value={med.name}
                          onChange={(name, drugId, drugObj) => {
                            const newForm = drugObj?.form || "";
                            const newType = detectMedType(name, newForm);
                            const oldType = detectMedType(med.name, med.form || "");
                            const resetDosage = newType !== oldType;
                            const updated = medications.map((m, idx) =>
                              idx === i
                                ? { ...m, name, drugId: drugId || "", form: newForm, dosage: resetDosage ? "" : m.dosage }
                                : m
                            );
                            // Use same normalise so selecting/clearing a drug also collapses empty rows
                            setMedications(normalizeMeds(updated));
                          }}
                          placeholder="Search pharmacy catalog or type name…"
                        />
                      </div>
                      {!isTrailingEmpty && <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">
                          Dosage Instructions <span className="text-red-400">*</span>
                          {med.name.trim() && (
                            <span className="ml-1 text-gray-400 font-normal">
                              — {getMedTypeLabel(medType)} instructions
                            </span>
                          )}
                        </label>
                        <select
                          value={isCustomMode ? "__custom__" : (dosageOpts.includes(med.dosage) || ALL_DOSAGE_OPTIONS.includes(med.dosage) ? med.dosage : "")}
                          onChange={e => {
                            if (e.target.value === "__custom__") {
                              updateMed(i, "dosage", "\u200b"); // zero-width space → custom mode
                            } else {
                              updateMed(i, "dosage", e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                        >
                          <option value="">
                            {med.name.trim() ? `Select ${getMedTypeLabel(medType).toLowerCase()} instructions…` : "Select dosage instructions…"}
                          </option>
                          {dosageOpts.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          <option value="__custom__">✏️  Type custom instructions…</option>
                        </select>
                        {isCustomMode && (
                          <input
                            value={med.dosage.replace(/\u200b/g, "")}
                            onChange={e => updateMed(i, "dosage", e.target.value || "\u200b")}
                            placeholder="Type custom dosage instructions…"
                            autoFocus
                            className="mt-1.5 w-full px-3 py-2 rounded-lg border border-blue-300 bg-blue-50 text-sm text-blue-900 placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                          />
                        )}
                      </div>}
                    {!isTrailingEmpty && <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Duration <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={DURATION_OPTIONS.includes(med.duration) ? med.duration : ""}
                        onChange={e => {
                          if (e.target.value === "__custom__") {
                            updateMed(i, "duration", "​");
                          } else {
                            updateMed(i, "duration", e.target.value);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                      >
                        <option value="">Select duration…</option>
                        {DURATION_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                        <option value="__custom__">✏️  Type custom duration…</option>
                      </select>
                      {(!DURATION_OPTIONS.includes(med.duration) && med.duration !== "") && (
                        <input
                          value={med.duration.replace(/​/g, "")}
                          onChange={e => updateMed(i, "duration", e.target.value || "​")}
                          placeholder="e.g. 10 days, 45 days…"
                          autoFocus
                          className="mt-1.5 w-full px-3 py-2 rounded-lg border border-blue-300 bg-blue-50 text-sm text-blue-900 placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                      )}
                    </div>}
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* Lab Tests — NEW only */}
          {!isEdit && (
            <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${anyLabSelected ? "border-blue-300 bg-blue-50/30" : "border-gray-200"}`}>
              <div className="px-5 pt-5 pb-3">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  Lab Tests
                  <span className="text-blue-500 normal-case font-normal">(→ lab, only if ticked)</span>
                </label>

                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Tests</label>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  {LAB_TESTS.map(test => (
                    <label key={test} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition text-sm ${
                      checkedTests[test]
                        ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                        : "border-gray-200 hover:border-blue-200 hover:bg-blue-50/50 text-gray-700 bg-white"
                    }`}>
                      <input type="checkbox" checked={!!checkedTests[test]} onChange={() => toggleTest(test)} className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"/>
                      {test}
                    </label>
                  ))}
                  <label className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition text-sm ${
                    otherChecked
                      ? "border-amber-400 bg-amber-50 text-amber-700 font-medium"
                      : "border-gray-200 hover:border-amber-200 hover:bg-amber-50/50 text-gray-700 bg-white"
                  }`}>
                    <input type="checkbox" checked={otherChecked}
                      onChange={e => { setOtherChecked(e.target.checked); if (!e.target.checked) setOtherText(""); }}
                      className="w-3.5 h-3.5 accent-amber-500 flex-shrink-0"/>
                    Other (custom)
                  </label>
                </div>

                {otherChecked && (
                  <input value={otherText} onChange={e => setOtherText(e.target.value)} autoFocus
                    placeholder="Describe the custom test…"
                    className="mb-3 w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-900 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"/>
                )}

                {/* ── Per-test priority panel ── */}
                {anyLabSelected && (
                  <div className="rounded-xl border border-gray-200 overflow-hidden mb-3">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Set priority per test</p>
                      <div className="flex items-center gap-2">
                        {urgentCount > 0 && (
                          <span className="text-xs bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full font-semibold">🚨 {urgentCount} Urgent</span>
                        )}
                        <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">
                          {selectedNames.length + (otherChecked && otherText ? 1 : 0)} selected
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {selectedNames.map(name => (
                        <div key={name} className="flex items-center justify-between px-4 py-2.5 bg-white">
                          <span className="text-sm font-medium text-gray-700">{name}</span>
                          <div className="flex rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                            <button type="button" onClick={() => setTestPriority(name, "Routine")}
                              className={`px-2 py-0.5 text-[10px] font-semibold transition ${
                                (testPriorities[name] || "Routine") === "Routine" ? "bg-blue-600 text-white" : "bg-white text-gray-400 hover:bg-gray-50"
                              }`}>Routine</button>
                            <button type="button" onClick={() => setTestPriority(name, "Urgent")}
                              className={`px-2 py-0.5 text-[10px] font-semibold transition border-l border-gray-200 ${
                                testPriorities[name] === "Urgent" ? "bg-red-500 text-white" : "bg-white text-gray-400 hover:bg-gray-50"
                              }`}>🚨 Urgent</button>
                          </div>
                        </div>
                      ))}
                      {otherChecked && otherText && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-white">
                          <span className="text-sm font-medium text-amber-700">★ {otherText}</span>
                          <div className="flex rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                            <button type="button" onClick={() => setOtherPriority("Routine")}
                              className={`px-2 py-0.5 text-[10px] font-semibold transition ${
                                otherPriority === "Routine" ? "bg-blue-600 text-white" : "bg-white text-gray-400 hover:bg-gray-50"
                              }`}>Routine</button>
                            <button type="button" onClick={() => setOtherPriority("Urgent")}
                              className={`px-2 py-0.5 text-[10px] font-semibold transition border-l border-gray-200 ${
                                otherPriority === "Urgent" ? "bg-red-500 text-white" : "bg-white text-gray-400 hover:bg-gray-50"
                              }`}>🚨 Urgent</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {anyLabSelected && (
                <div className="px-5 pb-5 space-y-4 border-t border-blue-200 pt-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Clinical Notes for Lab</label>
                    <textarea value={labNotes} onChange={e => setLabNotes(e.target.value)}
                      placeholder="Reason for tests, relevant clinical history..."
                      rows={2} className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition resize-none"/>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit mode — lab request note */}
          {isEdit && existing?.labRequestRef && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-base">🧪</div>
              <div>
                <div className="text-xs font-semibold text-blue-800">Lab Request Linked — {existing.labRequestRef}</div>
                <div className="text-xs text-blue-500 mt-0.5">To edit lab tests, go to the Lab Requests page</div>
              </div>
            </div>
          )}

          {/* Clinical Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clinical Notes</label>
            <textarea value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)}
              placeholder="Additional instructions, dietary advice, follow-up schedule..."
              rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"/>
          </div>

          {/* Routing summary */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100 text-xs">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">💊</div>
              <div><span className="font-semibold text-gray-700">Pharmacy</span> — receives medications list automatically</div>
            </div>
            {!isEdit && anyLabSelected && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">🧪</div>
                <div>
                  <span className="font-semibold text-gray-700">Lab</span> — receives lab request automatically
                  {urgentCount > 0 && <span className="ml-2 text-red-600 font-semibold">🚨 Urgent</span>}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
              {saving ? (isEdit ? "Saving…" : "Issuing…") : (isEdit ? "Save Changes" : "Issue Prescription")}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// Cancel Confirmation Modal
// Shows when doctor clicks "Cancel Rx".
// If the prescription has a linked lab request, offers the choice
// to cancel it too — otherwise just confirms the prescription delete.
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// LAB-ONLY CONFIRMATION MODAL
// Shown when doctor submits a prescription with lab tests but no medicines
// ══════════════════════════════════════════════════════════════
function LabOnlyConfirmModal({ labTests, patientName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg,#FEF3C7,#FDE68A)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={2} className="w-6 h-6">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h3 className="font-bold text-gray-800 text-base">No Medicines Added</h3>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            No medications added for <strong>{patientName}</strong>. This will create a <strong>standalone lab request</strong> — no prescription will be issued.
          </p>
        </div>

        {/* Lab test list */}
        <div className="mx-6 mb-4 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-amber-200 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
              <path d="M6 2v6l-4 8a2 2 0 001.8 3h12.4A2 2 0 0018 16l-4-8V2"/><line x1="6" y1="2" x2="18" y2="2"/>
            </svg>
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Lab Tests Only</span>
          </div>
          <ul className="divide-y divide-amber-100">
            {labTests.map((t, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                <span className="text-sm text-gray-700 font-medium">{t.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  t.priority === "Urgent"
                    ? "bg-red-100 text-red-600 border border-red-200"
                    : "bg-blue-50 text-blue-600 border border-blue-200"
                }`}>{t.priority}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="px-6 pb-4 text-xs text-gray-400 leading-relaxed">
          A standalone lab request will be sent directly to the lab. No prescription record will be created.
        </p>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Go Back
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)" }}>
            Send to Lab
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelModal({ rx, labRequest, onConfirm, onClose }) {
  const [cancelLab, setCancelLab] = useState(false);
  const hasLab = !!rx.labRequestRef;

  // If lab is already in_progress or completed we can't delete it —
  // show a note instead of the checkbox
  const labIsLocked = labRequest && labRequest !== "loading" && labRequest?.status !== "pending";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-red-500">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </div>
          <h3 className="font-bold text-gray-800 text-base">Cancel Prescription?</h3>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-mono text-blue-600">{rx.prescriptionId}</span> for <strong>{rx.patientName}</strong> will be permanently deleted.
          </p>
        </div>

        {/* Lab request option */}
        {hasLab && (
          <div className="mx-6 mb-4">
            {labIsLocked ? (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-lg flex-shrink-0">🧪</span>
                <div>
                  <p className="text-xs font-semibold text-amber-800">Lab request cannot be cancelled</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    <span className="font-mono">{rx.labRequestRef}</span> is already {labRequest?.status?.replace("_", " ")} — the lab staff are working on it.
                  </p>
                </div>
              </div>
            ) : (
              <label className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition hover:bg-gray-50 select-none"
                style={{ borderColor: cancelLab ? "#EF4444" : "#E5E7EB", background: cancelLab ? "#FEF2F2" : "" }}>
                <input
                  type="checkbox"
                  checked={cancelLab}
                  onChange={e => setCancelLab(e.target.checked)}
                  className="mt-0.5 accent-red-500 w-4 h-4 flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Also cancel the linked lab request</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{rx.labRequestRef}</p>
                </div>
              </label>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Keep
          </button>
          <button onClick={() => onConfirm(cancelLab && !labIsLocked)}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #DC2626, #EF4444)" }}>
            {cancelLab && !labIsLocked ? "Cancel Both" : "Cancel Prescription"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════
export default function DoctorPrescriptions() {
  const location = useLocation();
  const navigate  = useNavigate();

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [expandedId,    setExpandedId]    = useState(null);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [editRx,        setEditRx]        = useState(null);
  const [prefillData,   setPrefillData]   = useState(null);  // from dashboard "Start"
  const [expandTarget,  setExpandTarget]  = useState(null);  // RX ID from ?open= param
  const [cancelling,    setCancelling]    = useState(null);
  const [cancelTarget,  setCancelTarget]  = useState(null); // rx being confirmed for cancel
  const [toast,         setToast]         = useState(null);

  // DOM refs per card — used to scroll the opened card into view
  const cardRefs = useRef({});

  // Cache of fetched lab requests, keyed by prescription._id
  // Prevents re-fetching when user collapses and re-expands the same card
  const [labCache, setLabCache] = useState({});
  // Cache of lab results (TR-xxx) keyed by prescription._id
  const [labResultsCache, setLabResultsCache] = useState({});

  const doctorName = (() => {
    try { return JSON.parse(localStorage.getItem("user"))?.name || "Doctor"; } catch { return "Doctor"; }
  })();

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadPrescriptions = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/prescriptions");
      setPrescriptions(res.data.prescriptions || []);
    } catch { showToast("Failed to load prescriptions", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadPrescriptions(); }, []);

  // ── Auto-refresh every 30 seconds ────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => loadPrescriptions(true), 5_000);
    return () => clearInterval(interval);
  }, []);

  // ── Read URL prefill params set by dashboard "Start" button ──
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("prefill") === "1") {
      const data = {
        appointmentId: params.get("appointmentId") || "",
        patientName:   params.get("patientName")   || "",
        patientId:     params.get("patientId")     || "",

      };
      setPrefillData(data);
      setShowModal(true);
      navigate("/doctor/prescriptions", { replace: true });
    }
  }, [location.search, navigate]);

  // ── Read ?open=RX-xxxx — set expandTarget so the card auto-expands ──
  // Separate from the prefill effect so both can coexist cleanly.
  useEffect(() => {
    const params  = new URLSearchParams(location.search);
    const openRxId = params.get("open");
    if (!openRxId) return;

    // Clean URL immediately so refresh doesn't re-trigger
    navigate("/doctor/prescriptions", { replace: true });

    // Store the target — a second effect resolves it once prescriptions load
    setExpandTarget(openRxId);
  }, [location.search, navigate]);

  // ── Once prescriptions load, resolve any pending expandTarget ──
  // This handles the case where ?open= arrives before data finishes loading.
  useEffect(() => {
    if (!expandTarget || loading || prescriptions.length === 0) return;

    const match = prescriptions.find(p => p.prescriptionId === expandTarget);
    if (!match) return;

    setExpandedId(match._id);
    setExpandTarget(null);  // clear so this doesn't re-run

    // Clear any active filters so the card is visible
    setSearch("");
    setStatusFilter("all");

    // Scroll the card into view after a short delay (allow render)
    setTimeout(() => {
      cardRefs.current[match._id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }, [expandTarget, loading, prescriptions]);

  // ── Auto-fetch lab request when a prescription card is expanded ──
  // We cache results so repeated expand/collapse doesn't re-fetch.
  useEffect(() => {
    if (!expandedId) return;

    const rx = prescriptions.find(p => p._id === expandedId);
    if (!rx?.labRequestId) return;           // no linked lab request
    if (labCache[expandedId]) return;        // already fetched

    // Mark as loading with a sentinel so we don't double-fetch
    setLabCache(prev => ({ ...prev, [expandedId]: "loading" }));

    api.get(`/lab-requests/${rx.labRequestId}`)
      .then(res => {
        const lr = res.data.labRequest || res.data;
        setLabCache(prev => ({ ...prev, [expandedId]: lr }));
        // Also fetch any lab results linked to this lab request
        api.get(`/lab-results?labRequestRef=${rx.labRequestRef}`)
          .then(r2 => { const all = r2.data.results || []; const filtered = all.filter(r => r.labRequestRef === rx.labRequestRef); setLabResultsCache(prev => ({ ...prev, [expandedId]: filtered })); })
          .catch(() => setLabResultsCache(prev => ({ ...prev, [expandedId]: [] })));
      })
      .catch(() => {
        // On error, store null so we show a fallback instead of blank
        setLabCache(prev => ({ ...prev, [expandedId]: null }));
      });
  }, [expandedId, prescriptions, labCache]);

  const handleSaved = (rx, isEdit = false) => {
    // rx is null when lab-only (no prescription was created)
    if (!rx) {
      showToast("Lab request created successfully");
      return;
    }
    if (isEdit) {
      setPrescriptions(prev => prev.map(p => p._id === rx._id ? rx : p));
      showToast("Prescription updated successfully");
    } else {
      setPrescriptions(prev => [rx, ...prev]);
      showToast(`Prescription ${rx.prescriptionId} issued successfully`);
    }
  };

  // Opens the cancel confirmation modal for the given prescription
  const handleCancel = (rx) => {
    setCancelTarget(rx);
  };

  // Called by CancelModal when doctor confirms
  // cancelLabToo: boolean — whether to also delete the linked lab request
  const handleConfirmCancel = async (cancelLabToo) => {
    const rx = cancelTarget;
    setCancelTarget(null);
    setCancelling(rx._id);
    try {
      await api.delete(`/prescriptions/${rx._id}/cancel`, {
        data: { cancelLabToo },
      });

      // Remove prescription from list
      setPrescriptions(prev => prev.filter(p => p._id !== rx._id));

      // If lab was also cancelled, remove it from the cache so
      // it doesn't show stale data if the user opens another Rx
      if (cancelLabToo) {
        setLabCache(prev => {
          const next = { ...prev };
          delete next[rx._id];
          return next;
        });
      }

      showToast(
        cancelLabToo
          ? "Prescription and lab request removed"
          : "Prescription removed"
      );
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to cancel", "error");
    } finally {
      setCancelling(null);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditRx(null);
    setPrefillData(null);
  };

  const filtered = prescriptions.filter(rx => {
    const matchSearch = rx.patientName?.toLowerCase().includes(search.toLowerCase())
      || rx.prescriptionId?.includes(search)
      || rx.appointmentId?.includes(search);  // also searchable by appointment ID
    const matchStatus = statusFilter === "all" || rx.pharmacyStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const total       = prescriptions.length;
  const pending     = prescriptions.filter(p => p.pharmacyStatus === "pending").length;
  const inProgress  = prescriptions.filter(p => p.pharmacyStatus === "in_progress").length;
  const dispensed   = prescriptions.filter(p => p.pharmacyStatus === "dispensed").length;
  const cancelled   = prescriptions.filter(p => p.pharmacyStatus === "cancelled").length;
  // activeTotal excludes cancelled so: activeTotal === pending + inProgress + dispensed ✓
  const activeTotal = total - cancelled;

  return (
  <>
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-xl border shadow-lg text-sm font-medium ${
          toast.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.type === "success" ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* Cancel confirmation modal — asks about lab request if one is linked */}
      {cancelTarget && (
        <CancelModal
          rx={cancelTarget}
          labRequest={labCache[cancelTarget._id]}
          onConfirm={handleConfirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}

      {/* Prescription modal — new, edit, or prefilled from dashboard */}
      {(showModal || editRx) && (
        <PrescriptionModal
          onClose={handleCloseModal}
          onSaved={handleSaved}
          doctorName={doctorName}
          existing={editRx}
          prefill={showModal && !editRx ? prefillData : null}
        />
      )}

      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>
              Prescription Management
            </h1>
            <p className="text-sm text-gray-400 mt-1">Issue and manage patient prescriptions</p>
          </div>
          <button
            onClick={() => { setPrefillData(null); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg transition-transform hover:scale-105"
            style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/>
            </svg>
            Issue Prescription
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Issued",   value: activeTotal, color: "#1565C0", bg: "#E3F2FD" },
            { label: "Pending",        value: pending,     color: "#E65100", bg: "#FFF3E0" },
            { label: "Dispensed",      value: dispensed,   color: "#00897B", bg: "#E0F2F1" },
            { label: "Cancelled",      value: cancelled,   color: "#B71C1C", bg: "#FFEBEE" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 relative">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input
              type="text"
              placeholder="Search by patient, RX ID, or appointment ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
          <div className="flex gap-2">
            {[["all","All"],["pending","Pending"],["in_progress","In Progress"],["dispensed","Dispensed"]].map(([val, label]) => (
              <button key={val} onClick={() => setStatusFilter(val)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  statusFilter === val ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(rx => {
              const pStatus    = PHARMACY_STATUS[rx.pharmacyStatus] || PHARMACY_STATUS.pending;
              const isExpanded = expandedId === rx._id;

              return (
                <div
                  key={rx._id}
                  ref={el => { cardRefs.current[rx._id] = el; }}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                    expandedId === rx._id ? "border-blue-300 shadow-blue-100" : "border-gray-100"
                  }`}
                >
                  <div
                    className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => setExpandedId(isExpanded ? null : rx._id)}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${pStatus.dot}`}/>
                    <div className="text-xs font-mono text-gray-400 w-32 flex-shrink-0">{rx.prescriptionId}</div>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                        {rx.patientName?.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{rx.patientName}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
                          {rx.appointmentId && (
                            <span className="font-mono text-blue-500">{rx.appointmentId}</span>
                          )}
                          {rx.appointmentId && <span className="text-gray-200">·</span>}
                          <span>{rx.medications?.length} med{rx.medications?.length !== 1 ? "s" : ""}</span>
                          {rx.labRequestRef && <span>· 🧪 Lab</span>}
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:block text-xs text-gray-400">{formatDateTime(rx.createdAt)}</div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${pStatus.class}`}>
                      💊 {pStatus.label}
                    </span>
                    <svg viewBox="0 0 20 20" fill="currentColor"
                      className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}>
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-6 py-5 bg-gray-50 space-y-4">
                      {/* Timestamp + IDs */}
                      <div className="flex items-center gap-2 text-xs text-gray-500 bg-white rounded-xl px-4 py-2.5 border border-gray-100 flex-wrap">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                        </svg>
                        Issued <strong className="ml-1 text-gray-700">{formatDateTime(rx.createdAt)}</strong>
                        <span className="mx-2 text-gray-300">·</span>
                        By <strong className="ml-1 text-gray-700">{rx.doctorName}</strong>
                        {rx.patientId && (
                          <><span className="mx-2 text-gray-300">·</span>
                          Patient ID: <strong className="ml-1 font-mono text-gray-700">{rx.patientId}</strong></>
                        )}
                        {rx.appointmentId && (
                          <><span className="mx-2 text-gray-300">·</span>
                          Appt: <strong className="ml-1 font-mono text-blue-600">{rx.appointmentId}</strong></>
                        )}
                        {rx.dispensedAt && (
                          <><span className="mx-2 text-gray-300">·</span>
                          Dispensed <strong className="ml-1 text-green-700">{formatDateTime(rx.dispensedAt)}</strong></>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-5">
                        {/* Medications */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">💊 Medications</p>
                          <div className="space-y-2">
                            {rx.medications?.map((med, i) => (
                              <div key={i} className="bg-white rounded-xl p-3 border border-gray-100">
                                <div className="font-semibold text-sm text-gray-800">{med.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{med.dosage}</div>
                                <div className="text-xs text-blue-600 mt-0.5">Duration: {med.duration}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {rx.labRequestRef && (() => {
                            const cachedLab = labCache[rx._id];
                            const labSt     = cachedLab && cachedLab !== "loading"
                              ? LAB_STATUS[cachedLab.status] || LAB_STATUS.pending
                              : null;

                            return (
                              <div className="border border-blue-200 rounded-xl overflow-hidden">
                                {/* Lab panel header */}
                                <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                                  <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-sm">🧪</div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-semibold text-blue-800">Lab Request Linked</span>
                                    <button
                                      onClick={() => navigate(`/doctor/lab-requests?open=${rx.labRequestRef}`)}
                                      className="ml-2 font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline transition"
                                      title="View this lab request"
                                    >
                                      {rx.labRequestRef}
                                    </button>
                                  </div>
                                  {labSt && (
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${labSt.class}`}>
                                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${labSt.dot}`}/>
                                      {labSt.label}
                                    </span>
                                  )}
                                </div>

                                {/* Lab panel body */}
                                {cachedLab === "loading" && (
                                  <div className="flex items-center gap-2 px-4 py-3 bg-white text-xs text-gray-400">
                                    <svg className="w-3.5 h-3.5 animate-spin text-blue-400" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                    </svg>
                                    Loading lab details…
                                  </div>
                                )}

                                {cachedLab === null && (
                                  <div className="px-4 py-3 bg-white text-xs text-gray-400">
                                    Could not load lab request details.
                                  </div>
                                )}

                                {cachedLab && cachedLab !== "loading" && (() => {
                                  const labResults = labResultsCache[rx._id] || [];
                                  const LAB_RESULT_STATUS = {
                                    payment_pending: { label:"Payment Pending", cls:"bg-gray-100 text-gray-600 border-gray-200",  dot:"bg-gray-400"   },
                                    pre_check:       { label:"Pre-Check",        cls:"bg-purple-100 text-purple-700 border-purple-200", dot:"bg-purple-500" },
                                    sample_received: { label:"Sample Received",  cls:"bg-blue-100 text-blue-700 border-blue-200",   dot:"bg-blue-500"   },
                                    in_progress:     { label:"In Progress",      cls:"bg-amber-100 text-amber-700 border-amber-200", dot:"bg-amber-500"  },
                                    completed:       { label:"Completed",        cls:"bg-green-100 text-green-700 border-green-200", dot:"bg-green-500"  },
                                  };
                                  return (
                                    <div className="bg-white px-4 py-3 space-y-2.5">
                                      {/* Priority + date */}
                                      <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <span className={`px-2 py-0.5 rounded-full font-medium border ${
                                          cachedLab.priority === "Urgent"
                                            ? "bg-red-50 text-red-600 border-red-200"
                                            : "bg-gray-50 text-gray-600 border-gray-200"
                                        }`}>
                                          {cachedLab.priority || "Routine"}
                                        </span>
                                        <span>Requested {new Date(cachedLab.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}</span>
                                      </div>

                                      {/* Tests list with per-test result status */}
                                      <div>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tests Ordered</p>
                                        <div className="space-y-1.5">
                                          {cachedLab.tests?.map((t, i) => {
                                            // Find matching result for this test name
                                            const matchResult = labResults.find(r => (r.testName === t.name || r.testName?.toLowerCase() === t.name?.toLowerCase()) && r.labRequestRef === rx.labRequestRef);
                                            const stCfg = matchResult ? (LAB_RESULT_STATUS[matchResult.status] || LAB_RESULT_STATUS.in_progress) : null;
                                            const isCompleted = matchResult?.status === "completed";
                                            const isFlagged   = matchResult?.results?.parameters?.some(p => ["High","Low","Positive","Reactive"].includes(p.flag));
                                            return (
                                              <div key={i} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-xs ${isCompleted ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-100"}`}>
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <span className={`font-medium ${t.isOther ? "text-amber-700" : "text-gray-700"}`}>
                                                    {t.isOther ? "★ " : "🧪 "}{t.name}
                                                  </span>
                                                  {isFlagged && <span className="text-xs text-red-500 font-semibold">⚠️ Abnormal</span>}
                                                </div>
                                                {matchResult ? (
                                                  isCompleted ? (
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); navigate(`/doctor/lab-results?open=${matchResult.testId}`); }}
                                                      className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full hover:bg-teal-100 transition flex-shrink-0"
                                                    >
                                                      <span className="font-mono">{matchResult.testId}</span>
                                                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M6.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L8.586 9H2a1 1 0 110-2h6.586L6.293 4.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                                                    </button>
                                                  ) : (
                                                    <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${stCfg?.cls || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                                      <span className={`w-1.5 h-1.5 rounded-full ${stCfg?.dot || "bg-gray-400"}`}/>
                                                      {stCfg?.label || "Pending"}
                                                    </span>
                                                  )
                                                ) : (
                                                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200 flex-shrink-0">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>Pending
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Clinical notes */}
                                      {cachedLab.clinicalNotes && (
                                        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                          📝 {cachedLab.clinicalNotes}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })()}

                          {rx.clinicalNotes && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clinical Notes</p>
                              <div className="bg-white rounded-xl p-3 border border-gray-100 text-sm text-gray-700">{rx.clinicalNotes}</div>
                            </div>
                          )}

                          {rx.pharmacyStatus === "pending" && (
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => setEditRx(rx)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-blue-200 text-blue-600 text-xs font-semibold hover:bg-blue-50 transition">
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                                </svg>
                                Edit
                              </button>
                              <button onClick={() => handleCancel(rx)} disabled={cancelling === rx._id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition disabled:opacity-60">
                                {cancelling === rx._id ? "Cancelling…" : "Cancel Rx"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && !loading && (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-gray-500 font-medium">No prescriptions found</div>
                <div className="text-gray-400 text-sm mt-1">Issue your first prescription using the button above</div>
              </div>
            )}
          </div>
        )}
      </div>
  </>
  );
}