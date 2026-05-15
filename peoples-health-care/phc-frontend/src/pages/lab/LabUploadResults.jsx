import { useState, useEffect } from "react";
import LabLayout from "../../components/LabLayout";
import api from "../../services/api";
import { useToast } from "../../components/LiquidGlassToast";

const STAGE_LABEL = {
  payment_pending: "Awaiting Payment",
  pre_check:       "Pre-Test Check",
  sample_received: "Sample Received",
  in_progress:     "Test In Progress",
  completed:       "Completed",
};

// ─── Auto-flag logic ───────────────────────────────────────────────────────
// Called every time a lab staff member types a value.
// Returns the correct flag WITHOUT any manual input needed.
//
//   positiveThreshold → Dengue IgM / IgG style (index value)
//   min + max         → normal numeric range
//   min only          → only Low flag applies (e.g. eGFR)
//   null / null       → qualitative, no auto-flag
function autoFlag(value, param) {
  const num = parseFloat(value);
  if (value === "" || isNaN(num)) return "";

  // Index-value test (e.g. Dengue IgM ≥1.1 = Positive)
  if (param.positiveThreshold !== null && param.positiveThreshold !== undefined) {
    return num >= param.positiveThreshold ? "Positive" : "Negative";
  }

  const hasMin = param.min !== null && param.min !== undefined;
  const hasMax = param.max !== null && param.max !== undefined;

  if (hasMin && hasMax) {
    if (num < param.min) return "Low";
    if (num > param.max) return "High";
    return "Normal";
  }
  if (hasMin && !hasMax) {
    // Only low is clinically meaningful (e.g. eGFR)
    return num < param.min ? "Low" : "Normal";
  }
  return ""; // no range defined — manual
}

// ─── Hard validation limits ──────────────────────────────────────────────
// Values beyond these are biologically impossible — reject with error message.
const HARD_LIMITS = {
  "Haemoglobin (Hb)":                  { min: 0,    max: 25   },
  "RBC Count":                          { min: 0,    max: 15   },
  "WBC Count":                          { min: 0,    max: 200  },  // ×10³/µL
  "Platelet Count":                     { min: 0,    max: 10000 }, // ×10³/µL
  "ESR (Erythrocyte Sedimentation Rate)":{ min: 0,    max: 150  },
  "Fasting Blood Glucose":              { min: 0,    max: 600  },
  "ALT (SGPT)":                         { min: 0,    max: 2000 },
  "AST (SGOT)":                         { min: 0,    max: 2000 },
  "ALP (Alkaline Phosphatase)":         { min: 0,    max: 5000 },
  "Total Bilirubin":                    { min: 0,    max: 50   },
  "Direct Bilirubin":                   { min: 0,    max: 25   },
  "Total Protein":                      { min: 0,    max: 20   },
  "Albumin":                            { min: 0,    max: 10   },
  "GGT":                                { min: 0,    max: 5000 },
  "Serum Creatinine":                   { min: 0,    max: 20   },
  "Blood Urea Nitrogen (BUN)":          { min: 0,    max: 300  },
  "Serum Uric Acid":                    { min: 0,    max: 30   },
  "TSH (Thyroid Stimulating Hormone)":  { min: 0,    max: 100  },
  "Free T4 (fT4)":                      { min: 0,    max: 10   },
  "Free T3 (fT3)":                      { min: 0,    max: 20   },
  "25-OH Vitamin D":                    { min: 0,    max: 200  },
};

// Returns null (ok), "hard" (reject), or "soft" (warn)
function validateValue(name, rawValue, param) {
  const num = parseFloat(rawValue);
  if (rawValue === "" || isNaN(num)) return null; // empty/non-numeric, skip
  if (num < 0) return { type: "hard", msg: "Value cannot be negative." };

  const hl = HARD_LIMITS[name];
  if (hl) {
    if (hl.max !== undefined && num > hl.max)
      return { type: "hard", msg: `Value ${num} exceeds the maximum possible (${hl.max}). Please check your input.` };
  }
  return null; // valid
}

// ─── Flag badge helper ─────────────────────────────────────────────────────
function FlagBadge({ flag }) {
  if (!flag) return null;
  const cfg = {
    Normal:   "bg-green-100 text-green-700 border-green-200",
    Low:      "bg-blue-100  text-blue-700  border-blue-200",
    High:     "bg-red-100   text-red-600   border-red-200",
    Positive: "bg-red-100   text-red-600   border-red-200",
    Negative: "bg-green-100 text-green-700 border-green-200",
    Reactive: "bg-orange-100 text-orange-600 border-orange-200",
  };
  const icons = { Normal: "✓", Low: "↓", High: "↑", Positive: "+", Negative: "−", Reactive: "~" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold ${cfg[flag] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
      <span>{icons[flag] || "?"}</span> {flag}
    </span>
  );
}

// ─── Logo SVG ─────────────────────────────────────────────────────────────
const LOGO_SVG_STR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="50" height="50"><rect width="60" height="60" rx="10" fill="#CC0000"/><rect x="24" y="10" width="12" height="40" fill="white"/><rect x="10" y="24" width="40" height="12" fill="white"/></svg>`;

// ─── Download PDF report (as HTML file, no print dialog) ──────────────────
function generatePDF(testResult, patientName) {
  const { testName, results, completedAt, testId } = testResult;
  const date = completedAt
    ? new Date(completedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  const rows = (results?.parameters || []).map(p => {
    const abn = ["High","Low","Positive","Reactive"].includes(p.flag);
    return `<tr>
      <td style="padding:9px 14px;border-bottom:1px solid #E0F2F1;font-size:13px;">${p.name}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #E0F2F1;font-weight:700;font-size:13px;color:${abn?"#B71C1C":"#00695C"};">
        ${p.value||"—"} ${p.unit||""}
        ${p.flag && p.flag !== "Normal"
          ? `<span style="font-size:11px;background:${abn?"#FFEBEE":"#E8F5E9"};color:${abn?"#B71C1C":"#2E7D32"};padding:2px 7px;border-radius:4px;margin-left:6px;">${p.flag}</span>`
          : ""}
      </td>
      <td style="padding:9px 14px;border-bottom:1px solid #E0F2F1;font-size:12px;color:#888;">${p.ref||""}</td>
    </tr>`;
  }).join("");

  const findings = (results?.checkboxFindings||[]).filter(f=>f.checked)
    .map(f=>`<li style="margin:5px 0;font-size:13px;">${f.label}</li>`).join("");

  const isFlagged = (results?.parameters||[]).some(p=>["High","Low","Positive","Reactive"].includes(p.flag));

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Lab Report — ${testId||""}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #f4f6f9; }
  .page { max-width: 760px; margin: 0 auto; background: white; box-shadow: 0 4px 24px rgba(0,0,0,.12); }
  @media print { body { background: white; } .page { box-shadow: none; } .no-print { display: none !important; } }
</style></head><body>
<div class="page">
  <div style="background:linear-gradient(135deg,#0D2137,#006064);color:#fff;padding:26px 32px;display:flex;align-items:center;gap:18px;">
    <div style="flex-shrink:0;">${LOGO_SVG_STR}</div>
    <div style="flex:1;">
      <div style="font-size:22px;font-weight:700;font-family:Georgia,serif;">People's Health Care</div>
      <div style="font-size:12px;opacity:.65;margin-top:3px;">Laboratory Services · Certified Medical Laboratory · Matara</div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:1px;">Report ID</div>
      <div style="font-size:16px;font-weight:700;font-family:monospace;margin-top:2px;">${testId}</div>
      <div style="font-size:11px;opacity:.6;margin-top:4px;">${date}</div>
    </div>
  </div>
  <div style="background:#E0F2F1;padding:14px 32px;display:flex;justify-content:space-between;border-bottom:3px solid #006064;">
    <div><div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;">Patient</div>
    <div style="font-size:18px;font-weight:700;color:#0D2137;margin-top:2px;">${patientName}</div></div>
    <div style="text-align:right;"><div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;">Test</div>
    <div style="font-size:18px;font-weight:700;color:#006064;margin-top:2px;">${testName}</div></div>
  </div>
  ${isFlagged ? `<div style="margin:18px 32px 0;background:#FFEBEE;border:1px solid #FFCDD2;border-radius:8px;padding:12px 16px;font-size:13px;color:#B71C1C;">⚠️ <strong>Attention:</strong> One or more values outside the normal range. Please consult your doctor.</div>` : ""}
  <div style="padding:24px 32px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#006064;margin-bottom:10px;">Test Parameters</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #E0F2F1;">
      <thead><tr style="background:#F0FAF9;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#00695C;font-weight:600;">Parameter</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#00695C;font-weight:600;">Result</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#00695C;font-weight:600;">Reference Range</th>
      </tr></thead>
      <tbody>${rows||'<tr><td colspan="3" style="padding:16px;text-align:center;color:#aaa;">No parameters recorded</td></tr>'}</tbody>
    </table>
  </div>
  ${findings ? `<div style="padding:0 32px 24px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#006064;margin-bottom:8px;">Clinical Findings</div><ul style="margin:0;padding:14px 14px 14px 34px;background:#F9FFFE;border:1px solid #E0F2F1;border-radius:8px;">${findings}</ul></div>` : ""}
  ${results?.labNotes ? `<div style="margin:0 32px 24px;background:#FFFDE7;border:1px solid #FFF9C4;border-radius:8px;padding:16px;font-size:13px;color:#555;"><strong>Lab Notes:</strong> ${results.labNotes}</div>` : ""}
  <div style="margin:0 32px 24px;padding-top:16px;border-top:1px solid #E0E0E0;display:flex;justify-content:space-between;font-size:11px;color:#aaa;">
    <div>Performed by: <strong style="color:#555;">${results?.performedBy||"TPG"}</strong></div>
    <div>Confidential — for the patient and requesting physician only.</div>
  </div>
  <div class="no-print" style="padding:14px 32px 28px;text-align:center;background:#f8fffe;border-top:1px solid #e0f2f1;">
    <button onclick="window.print()" style="background:linear-gradient(135deg,#0D2137,#006064);color:white;border:none;padding:11px 32px;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer;">🖨️ Print / Save as PDF</button>
    <p style="font-size:11px;color:#aaa;margin-top:8px;">Use your browser's Print → Save as PDF to keep a copy.</p>
  </div>
</div></body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `PHC-LabReport-${testId||"report"}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// ─── Main Component ─────────────────────────────────────────────────────────
export default function LabUploadResults() {
  const toast = useToast();
  const [pendingResults, setPendingResults]     = useState([]);
  const [loadingList, setLoadingList]           = useState(true);
  const [selectedResult, setSelectedResult]     = useState(null);

  const [preTemplate, setPreTemplate]           = useState(null);
  const [resultTemplate, setResultTemplate]     = useState(null);

  const [preCheckboxes, setPreCheckboxes]       = useState([]);
  const [preShortAnswers, setPreShortAnswers]   = useState([]);

  const [resultCheckboxes, setResultCheckboxes] = useState([]);
  const [resultParams, setResultParams]         = useState([]);
  const [labNotes, setLabNotes]                 = useState("");
  const [performedBy, setPerformedBy]           = useState("");
  const [paramErrors, setParamErrors]           = useState({}); // { paramName: { type, msg } }

  const [stage, setStage]                       = useState("pre_check");
  const [saving, setSaving]                     = useState(false);
  const [success, setSuccess]                   = useState(false);
  const [completedResult, setCompletedResult]   = useState(null);

  // ── FEATURE 1: fasting warning state ─────────────────────────────────────
  const [fastingWarning, setFastingWarning]     = useState(null);
  // fastingWarning shape: { message, detail, remainingTime, sentAt, readyAt }

  // ── Countdown timer that refreshes every 60 s so remaining time stays live
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { fetchPending(); }, []);

  const fetchPending = async () => {
    setLoadingList(true);
    try {
      const res = await api.get("/lab-results?status=pre_check,sample_received,in_progress");
      setPendingResults(res.data.results || []);
    } catch { setPendingResults([]); }
    finally  { setLoadingList(false); }
  };

  const handleSelectResult = async (result) => {
    setSelectedResult(result);
    setStage(result.status);
    setSuccess(false);
    setFastingWarning(null);
    try {
      const [preRes, resRes] = await Promise.all([
        api.get(`/lab-results/pre-conditions/${encodeURIComponent(result.testName)}`),
        api.get(`/lab-results/result-fields/${encodeURIComponent(result.testName)}`),
      ]);
      const preT = preRes.data.template;
      const resT = resRes.data.template;
      setPreTemplate(preT);
      setResultTemplate(resT);

      if (result.preTestConditions?.checkboxes?.length) {
        setPreCheckboxes(result.preTestConditions.checkboxes);
        setPreShortAnswers(result.preTestConditions.shortAnswers || []);
      } else {
        setPreCheckboxes(preT.checkboxes.map(label => ({ label, checked: false })));
        setPreShortAnswers(preT.shortAnswers.map(q => ({ question: q.question, answer: "" })));
      }
      // Init result params — value empty, flag will be set when value is typed
      setResultCheckboxes(resT.checkboxes.map(c => ({ label: c.label, checked: c.defaultChecked })));
      setResultParams(resT.parameters.map(p => ({ ...p, value: "", flag: "" })));
      setLabNotes("");
      setPerformedBy("");
    } catch (err) { console.error("Failed to load templates", err); }
  };

  const handleSavePreConditions = async () => {
    setSaving(true);
    setFastingWarning(null);
    try {
      await api.put(`/lab-results/${selectedResult._id}/pre-conditions`, {
        checkboxes:   preCheckboxes,
        shortAnswers: preShortAnswers,
      });
      setStage("sample_received");
      setSelectedResult(prev => ({ ...prev, status: "sample_received" }));
      fetchPending();
    } catch (err) {
      const data = err.response?.data;
      if (data?.fastingWarning) {
        // ── FEATURE 1: show the fasting warning instead of a plain alert ──
        setFastingWarning(data);
      } else {
        toast.error("Pre-conditions Error", data?.message || err.message);
      }
    } finally { setSaving(false); }
  };

  const handleStartTest = async () => {
    setSaving(true);
    try {
      await api.put(`/lab-results/${selectedResult._id}/start`);
      setStage("in_progress");
      setSelectedResult(prev => ({ ...prev, status: "in_progress" }));
      fetchPending();
    } catch (err) {
      toast.error("Could not start test", err.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  const handleUploadResults = async () => {
    // ── Validate all params have a value ───────────────────────────────────
    const missingValues = resultParams.filter(p => {
      const isQualitative = (p.min === null || p.min === undefined) && (p.positiveThreshold === null || p.positiveThreshold === undefined);
      if (isQualitative) return !p.flag; // qualitative needs a flag selected
      return p.value === "" || p.value === null || p.value === undefined;
    });
    if (missingValues.length > 0) {
      const names = missingValues.map(p => p.name).join(", ");
      toast.warning("Missing Values", `Fill in all parameter values before uploading. Missing: ${names}`);
      return;
    }
    if (Object.keys(paramErrors).length > 0) return;
    setSaving(true);
    try {
      const res = await api.put(`/lab-results/${selectedResult._id}/upload-results`, {
        checkboxFindings: resultCheckboxes,
        parameters:       resultParams,
        labNotes,
        performedBy,
      });
      setSuccess(true);
      setCompletedResult(res.data.result);
      setStage("completed");
      fetchPending();
    } catch (err) {
      toast.error("Upload Failed", err.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  const togglePreCheckbox  = i => setPreCheckboxes(prev  => prev.map((c, idx)  => idx === i ? { ...c, checked: !c.checked } : c));
  const updateShortAnswer  = (i, v) => setPreShortAnswers(prev => prev.map((q, idx) => idx === i ? { ...q, answer: v }       : q));
  const toggleResultCheckbox = i => setResultCheckboxes(prev => prev.map((c, idx) => idx === i ? { ...c, checked: !c.checked } : c));

  // ── Auto-flag + hard validation when value changes ───────────────────────
  const updateParam = (i, field, rawValue) => {
    // Only allow digits, one decimal point, for numeric fields
    let value = rawValue;
    if (field === "value") {
      // Strip anything that isn't 0-9 or a single dot
      value = rawValue.replace(/[^0-9.]/g, "");
      // Prevent multiple dots
      const parts = value.split(".");
      if (parts.length > 2) value = parts[0] + "." + parts.slice(1).join("");
    }

    setResultParams(prev => prev.map((p, idx) => {
      if (idx !== i) return p;
      const updated = { ...p, [field]: value };
      if (field === "value") {
        updated.flag = autoFlag(value, p);
      }
      return updated;
    }));

    // Validate and update errors immediately
    if (field === "value") {
      setResultParams(prev => {
        const param = prev[i];
        const err = validateValue(param.name, value, param);
        setParamErrors(errs => {
          const next = { ...errs };
          if (err) next[param.name] = err;
          else delete next[param.name];
          return next;
        });
        return prev; // no change to params here, already updated above
      });
    }
  };

  const patientName = selectedResult?.patientName || selectedResult?.patientId?.name || "Patient";

  return (
    <LabLayout activePage="Upload Results">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>
            Upload Test Results
          </h1>
          <p className="text-sm text-gray-400 mt-1">Complete pre-checks, run tests, and upload results for doctor and patient</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Left panel: pending list ─────────────────────────────── */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 text-sm">Awaiting Action</h3>
                <p className="text-xs text-gray-400 mt-0.5">Payment confirmed — select to process</p>
              </div>
              {loadingList ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
              ) : pendingResults.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No pending tests</div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                  {pendingResults.map(r => (
                    <div key={r._id} onClick={() => handleSelectResult(r)}
                      className={`px-5 py-4 cursor-pointer transition ${selectedResult?._id === r._id ? "bg-teal-50 border-l-4 border-teal-500" : "hover:bg-gray-50"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-gray-800">{r.patientName || r.patientId?.name || "—"}</span>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                          {STAGE_LABEL[r.status] || r.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{r.testId}</div>
                      <div className="mt-1.5">
                        <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">🧪 {r.testName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right panel: action area ─────────────────────────────── */}
          <div className="lg:col-span-2">
            {!selectedResult ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-24 text-center">
                <div className="text-5xl mb-4">🧪</div>
                <h3 className="font-semibold text-gray-700">Select a Test</h3>
                <p className="text-sm text-gray-400 mt-1">Choose a pending test from the left panel to begin.</p>
              </div>
            ) : success ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-bold text-green-800 text-lg">Results Uploaded Successfully!</p>
                  <p className="text-sm text-green-700 mt-1">The doctor and patient have been notified.</p>
                </div>
                <button onClick={() => completedResult && generatePDF(completedResult, patientName)}
                  className="w-full py-3 rounded-2xl text-white font-semibold text-sm"
                  style={{ background: "linear-gradient(135deg, #006064, #00838F)" }}>
                  📥 Download PDF Report
                </button>
                <button onClick={() => { setSelectedResult(null); setSuccess(false); setCompletedResult(null); }}
                  className="w-full py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Process Another Test
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Patient info bar */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #006064, #00838F)" }}>
                    {patientName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">{patientName}</div>
                    <div className="text-xs text-gray-500 font-mono">{selectedResult.testId} · 🧪 {selectedResult.testName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Payment: <span className="text-teal-700 font-semibold">{selectedResult.paymentId}</span></div>
                  </div>
                  <div className="ml-auto">
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                      💳 Payment Confirmed
                    </span>
                  </div>
                </div>

                {/* ── FEATURE 1: Fasting warning banner ─────────────── */}
                {fastingWarning && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl flex-shrink-0">⏳</div>
                      <div className="flex-1">
                        <p className="font-bold text-amber-800 text-base">Fasting Period Not Yet Complete</p>
                        <p className="text-sm text-amber-700 mt-1">{fastingWarning.detail}</p>
                        <div className="mt-3 bg-amber-100 rounded-xl px-4 py-3 flex items-center gap-3">
                          <span className="text-2xl">⏱️</span>
                          <div>
                            <div className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Remaining Time</div>
                            <div className="text-xl font-bold text-amber-800">{fastingWarning.remainingTime}</div>
                          </div>
                        </div>
                        <p className="text-xs text-amber-600 mt-3">
                          ⚠️ Accepting a sample before the fasting period ends may cause inaccurate results.
                          Please ask the patient to wait and return at the correct time.
                        </p>
                        <button onClick={() => setFastingWarning(null)}
                          className="mt-3 text-xs text-amber-600 underline hover:text-amber-800">
                          Dismiss warning
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PRE-TEST CHECK ─────────────────────────────────── */}
                {(stage === "pre_check" || stage === "payment_pending") && preTemplate && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100"
                      style={{ background: "linear-gradient(135deg, #EDE7F6, #D1C4E9)" }}>
                      <h3 className="font-semibold text-gray-800">📋 Pre-Test Conditions</h3>
                      <p className="text-xs text-gray-500 mt-1">Verify all conditions before collecting sample from patient</p>
                    </div>
                    <div className="p-6 space-y-5">
                      <div className="space-y-3">
                        {preCheckboxes.map((item, i) => (
                          <label key={i} className="flex items-start gap-3 cursor-pointer group">
                            <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition ${item.checked ? "bg-teal-500 border-teal-500" : "border-gray-300 group-hover:border-teal-400"}`}
                              onClick={() => togglePreCheckbox(i)}>
                              {item.checked && <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <span className={`text-sm leading-relaxed ${item.checked ? "text-gray-700" : "text-gray-500"}`}>{item.label}</span>
                          </label>
                        ))}
                      </div>
                      {preShortAnswers.length > 0 && (
                        <div className="space-y-4 border-t border-gray-100 pt-4">
                          {preShortAnswers.map((q, i) => (
                            <div key={i}>
                              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{q.question}</label>
                              <textarea value={q.answer} onChange={e => updateShortAnswer(i, e.target.value)}
                                placeholder="Type your answer…" rows={2}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"/>
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={handleSavePreConditions} disabled={saving}
                        className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg, #6A1B9A, #4527A0)" }}>
                        {saving ? "Checking fasting time…" : "✅ Confirm & Mark Sample Received"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── SAMPLE RECEIVED ───────────────────────────────── */}
                {stage === "sample_received" && (
                  <div className="bg-white rounded-2xl border border-cyan-200 shadow-sm p-6 text-center">
                    <div className="text-4xl mb-3">💉</div>
                    <p className="font-semibold text-gray-800">Sample Received</p>
                    <p className="text-sm text-gray-500 mt-1">Pre-test conditions confirmed. Ready to begin analysis.</p>
                    <button onClick={handleStartTest} disabled={saving}
                      className="mt-5 px-8 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, #1565C0, #0288D1)" }}>
                      {saving ? "Starting…" : "🔬 Start Test"}
                    </button>
                  </div>
                )}

                {/* ── ENTER RESULTS ─────────────────────────────────── */}
                {stage === "in_progress" && resultTemplate && (
                  <div className="space-y-5">
                    {/* Clinical findings checkboxes */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100"
                        style={{ background: "linear-gradient(135deg, #E0F2F1, #B2DFDB)" }}>
                        <h3 className="font-semibold text-gray-800">🔬 Clinical Findings</h3>
                        <p className="text-xs text-gray-500 mt-1">Check all that apply based on analysis</p>
                      </div>
                      <div className="p-6 space-y-3">
                        {resultCheckboxes.map((item, i) => (
                          <label key={i} className="flex items-start gap-3 cursor-pointer group">
                            <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition ${item.checked ? "bg-teal-500 border-teal-500" : "border-gray-300 group-hover:border-teal-400"}`}
                              onClick={() => toggleResultCheckbox(i)}>
                              {item.checked && <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <span className={`text-sm leading-relaxed ${item.checked ? "text-teal-800 font-medium" : "text-gray-500"}`}>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* ── FEATURE 3: Parameter values with auto-flag ── */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100"
                        style={{ background: "linear-gradient(135deg, #E3F2FD, #BBDEFB)" }}>
                        <h3 className="font-semibold text-gray-800">📊 Test Parameters</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Type the measured value — the flag (<span className="text-green-600 font-semibold">Normal</span> / <span className="text-blue-600 font-semibold">Low</span> / <span className="text-red-600 font-semibold">High</span>) is set automatically
                        </p>
                      </div>
                      <div className="p-6 space-y-5">
                        {resultParams.map((p, i) => {
                          const hasRange = p.min !== null && p.min !== undefined;
                          const isQualitative = !hasRange && p.positiveThreshold === null;
                          return (
                            <div key={p.name} className={`rounded-xl border p-4 transition ${
                              p.flag === "High" || p.flag === "Positive" || p.flag === "Reactive" ? "border-red-200 bg-red-50" :
                              p.flag === "Low"  ? "border-blue-200 bg-blue-50" :
                              p.flag === "Normal" || p.flag === "Negative" ? "border-green-200 bg-green-50" :
                              "border-gray-100 bg-gray-50"
                            }`}>
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm text-gray-800">{p.name}</div>
                                  <div className="text-xs text-gray-400 mt-0.5">Ref: {p.ref}</div>
                                  {hasRange && (
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      Range: <span className="font-mono text-blue-600">{p.min}</span>
                                      {p.max !== null ? <> – <span className="font-mono text-blue-600">{p.max}</span></> : <span className="text-gray-400"> (min only)</span>}
                                      {p.unit && <span className="ml-1 text-gray-400">{p.unit}</span>}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0">
                                  {/* Value input */}
                                  <div>
                                    <label className="block text-xs text-gray-400 mb-1">
                                      Value {p.unit ? `(${p.unit})` : ""}
                                    </label>
                                    <input
                                      type="text"
                                      value={p.value}
                                      onChange={e => updateParam(i, "value", e.target.value)}
                                      placeholder={p.unit || "Enter value"}
                                      inputMode="decimal"
                                      className={`w-36 px-3 py-2 rounded-xl border text-sm text-center font-mono focus:outline-none focus:ring-2 bg-white ${
                                        paramErrors[p.name]?.type === "hard"
                                          ? "border-red-400 bg-red-50 focus:ring-red-300"
                                          : "border-gray-200 focus:ring-teal-400"
                                      }`}
                                    />
                                    {/* Hard error shown instantly */}
                                    {paramErrors[p.name]?.type === "hard" && (
                                      <div className="mt-1 text-xs text-red-600 font-semibold max-w-36">
                                        ❌ {paramErrors[p.name].msg}
                                      </div>
                                    )}
                                  </div>

                                  {/* Auto flag badge — or manual buttons for qualitative */}
                                  <div>
                                    <label className="block text-xs text-gray-400 mb-1">Flag</label>
                                    {isQualitative ? (
                                      // NS1 Antigen: qualitative, keep manual buttons
                                      <div className="flex gap-1.5">
                                        {["Negative", "Positive", "Reactive"].map(flag => {
                                          const colors = {
                                            Negative: "bg-green-100 text-green-700 border-green-200",
                                            Positive: "bg-red-100 text-red-600 border-red-200",
                                            Reactive: "bg-orange-100 text-orange-600 border-orange-200",
                                          };
                                          return (
                                            <button key={flag} onClick={() => updateParam(i, "flag", flag)}
                                              className={`px-2 py-1 rounded-lg text-xs font-semibold border transition ${p.flag === flag ? colors[flag] : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"}`}>
                                              {flag}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      // Numeric: show auto-calculated badge
                                      <div className="flex items-center gap-2">
                                        {p.flag ? (
                                          <FlagBadge flag={p.flag}/>
                                        ) : (
                                          <span className="text-xs text-gray-400 italic"></span>
                                        )}
                                        <span className="text-xs text-gray-300" title="Flag is calculated automatically when you type a value"></span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Lab notes + performed by */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Lab Notes & Observations</label>
                      <textarea value={labNotes} onChange={e => setLabNotes(e.target.value)}
                        placeholder="Add clinical interpretation, notes, or recommendations for the doctor…"
                        rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"/>
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Performed By</label>
                        <input type="text" value={performedBy} onChange={e => setPerformedBy(e.target.value)}
                          placeholder="Lab staff name"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
                      </div>
                    </div>

                    {Object.keys(paramErrors).length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                        ❌ Please correct the invalid values above before uploading.
                      </div>
                    )}
                    {resultParams.some(p => {
                      const isQualitative = (p.min === null || p.min === undefined) && (p.positiveThreshold === null || p.positiveThreshold === undefined);
                      return isQualitative ? !p.flag : (p.value === "" || p.value === null || p.value === undefined);
                    }) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
                        ⚠️ All parameter values are required before uploading.
                      </div>
                    )}
                    <button
                      onClick={handleUploadResults}
                      disabled={saving || Object.keys(paramErrors).length > 0}
                      className="w-full py-4 rounded-2xl text-white font-semibold text-sm shadow-xl disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, #006064, #00838F)" }}>
                      {saving ? "Uploading…" : "📤 Upload Results & Notify Doctor + Patient"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </LabLayout>
  );
}