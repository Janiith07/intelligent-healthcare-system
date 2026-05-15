import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PatientLayout from "../../components/PatientLayout";
import api from "../../services/api";

// ── Flag styles ────────────────────────────────────────────
const FLAG_CONFIG = {
  Normal:   { bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200"  },
  High:     { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200"    },
  Low:      { bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200"  },
  Positive: { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200"    },
  Negative: { bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200"  },
  Reactive: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
};

const STATUS_CONFIG = {
  payment_pending: { bg: "bg-gray-100",   text: "text-gray-500",   label: "Payment Pending" },
  pre_check:       { bg: "bg-blue-100",   text: "text-blue-700",   label: "Pre-Check"       },
  sample_received: { bg: "bg-blue-100",   text: "text-blue-700",   label: "Sample Received" },
  in_progress:     { bg: "bg-purple-100", text: "text-purple-700", label: "In Progress"     },
  completed:       { bg: "bg-green-100",  text: "text-green-700",  label: "Completed"       },
};

const CLINIC = {
  name:    "People's Health Care",
  doctor:  "Dr. M.T.D Jayaweera",
  quals:   "MBBS (Sri Lanka)",
  slmc:    "SLMC Reg No- 14508",
  address: "No. 123, Akuressa Road, Isadeen Town, Matara.",
  tel:     "Tele - 041 2221761",
};

// ══════════════════════════════════════════════════════════
// PDF GENERATOR (unchanged)
// ══════════════════════════════════════════════════════════
function generateLabPDF(result) {
  const patientName = result.patientName || "Patient";
  const { testName, results, testId, completedAt, patientId, labRequestRef } = result;
  const completedDate = completedAt
    ? new Date(completedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : "—";
  const generatedDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const rows = results?.parameters?.map((p) => {
    const abnormal = ["High", "Low", "Positive", "Reactive"].includes(p.flag);
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #E0F2F1;font-size:13px;">${p.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E0F2F1;font-weight:700;font-size:13px;color:${abnormal ? "#B71C1C" : "#00695C"};">
        ${p.value || "—"} ${p.unit || ""}
        ${p.flag && p.flag !== "Normal" ? `<span style="font-size:11px;color:#B71C1C;"> (${p.flag})</span>` : ""}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #E0F2F1;font-size:12px;color:#888;">${p.ref || ""}</td>
    </tr>`;
  }).join("") || "";

  const findings = results?.checkboxFindings?.filter((f) => f.checked)
    .map((f) => `<li style="margin:5px 0;font-size:13px;">${f.label}</li>`).join("") || "";

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;}@media print{body{-webkit-print-color-adjust:exact;}}</style>
</head><body><div style="max-width:760px;margin:0 auto;padding:0 0 40px 0;">
<div style="background:linear-gradient(135deg,#0D2137,#1565C0);color:#fff;padding:28px 32px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:22px;font-weight:700;font-family:Georgia,serif;">${CLINIC.name}</div>
      <div style="font-size:12px;margin-top:4px;">${CLINIC.doctor}</div>
      <div style="font-size:11px;opacity:0.8;">${CLINIC.quals} · ${CLINIC.slmc}</div>
      <div style="font-size:11px;opacity:0.7;margin-top:4px;">${CLINIC.address}</div>
      <div style="font-size:11px;opacity:0.7;">${CLINIC.tel}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;opacity:0.7;">Report ID</div>
      <div style="font-size:18px;font-weight:700;font-family:monospace;">${testId}</div>
      <div style="font-size:11px;opacity:0.7;margin-top:4px;">Completed: ${completedDate}</div>
      ${labRequestRef ? `<div style="font-size:11px;opacity:0.7;">Ref: ${labRequestRef}</div>` : ""}
    </div>
  </div>
</div>
<div style="background:#E3F2FD;padding:16px 32px;display:flex;justify-content:space-between;border-bottom:2px solid #1565C0;">
  <div>
    <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Patient</div>
    <div style="font-size:18px;font-weight:700;color:#0D2137;">${patientName}</div>
    ${patientId ? `<div style="font-size:12px;color:#555;">ID: ${patientId}</div>` : ""}
  </div>
  <div style="text-align:right;">
    <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Test</div>
    <div style="font-size:18px;font-weight:700;color:#1565C0;">${testName}</div>
  </div>
</div>
<div style="padding:24px 32px 0;">
  <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1565C0;margin-bottom:12px;">Test Parameters</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #E0F2F1;">
    <thead><tr style="background:#E3F2FD;">
      <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#1565C0;">Parameter</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#1565C0;">Result</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#1565C0;">Reference Range</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="3" style="padding:16px;text-align:center;color:#aaa;">No parameters recorded</td></tr>'}</tbody>
  </table>
</div>
${findings ? `<div style="padding:20px 32px 0;"><div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1565C0;margin-bottom:12px;">Clinical Findings</div>
<ul style="margin:0;padding:16px 16px 16px 36px;background:#F8FAFC;border:1px solid #E3F2FD;border-radius:8px;">${findings}</ul></div>` : ""}
${results?.labNotes ? `<div style="padding:20px 32px 0;"><div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1565C0;margin-bottom:12px;">Lab Notes</div>
<div style="background:#FFFDE7;border:1px solid #FFF9C4;border-radius:8px;padding:16px;font-size:13px;color:#555;">${results.labNotes}</div></div>` : ""}
<div style="margin:24px 32px 0;padding-top:16px;border-top:1px solid #E3F2FD;text-align:center;font-size:11px;color:#aaa;">
  Generated on ${generatedDate} · ${CLINIC.name} · ${CLINIC.tel}
</div>
</div></body></html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("Please allow popups for PDF download."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ══════════════════════════════════════════════════════════
// PRE-CHECK CARD (Updated to BLUE theme)
// ══════════════════════════════════════════════════════════
function PreCheckCard({ result, notif }) {
  const [expanded, setExpanded] = useState(true);

  const preConditions = result?.preTestConditions || {};
  const checkboxes    = preConditions.checkboxes   || [];
  const shortAnswers  = preConditions.shortAnswers  || [];
  const fastingHours  = notif?.fastingHours ?? 0;
  const isReady       = notif?.isReady ?? true;
  const remainingTime = notif?.remainingTime;

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm"
      style={{ border: "2px solid #BAE6FD" }}>

      {/* Card header - Switched to Blue Gradient */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-4 px-6 py-4 cursor-pointer transition"
        style={{ background: "linear-gradient(135deg, #F0F9FF, #E0F2FE)" }}>

        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #0284C7, #0369A1)", boxShadow: "0 4px 12px rgba(3,105,161,0.3)" }}>
          🧪
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800 text-sm">{result.testName}</span>
            <span className="text-xs bg-white text-gray-500 px-2 py-0.5 rounded-full font-mono border border-gray-200">
              {result.testId}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full text-white"
              style={{ background: "linear-gradient(135deg, #0284C7, #0369A1)" }}>
              ⏳ Pre-Check Required
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {result.labRequestRef && `Ref: ${result.labRequestRef} · `}
            Lab has sent pre-conditions — please review before visiting
          </div>
        </div>

        <div className="flex-shrink-0">
          {isReady ? (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full text-white"
              style={{ background: "linear-gradient(135deg, #059669, #10B981)" }}>
              ✓ Ready to submit
            </span>
          ) : (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              ⏱ {remainingTime} left
            </span>
          )}
        </div>

        <svg viewBox="0 0 20 20" fill="currentColor"
          className={`w-4 h-4 text-blue-400 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`}>
          <path fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd" />
        </svg>
      </div>

      {expanded && (
        <div className="bg-white px-6 pb-6 space-y-5 border-t border-blue-100">

          {/* Fasting notice */}
          {fastingHours > 0 && (
            <div className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${
              isReady ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
            }`}>
              <span className="text-xl flex-shrink-0">{isReady ? "✅" : "⏱"}</span>
              <div>
                <p className={`text-sm font-semibold ${isReady ? "text-green-800" : "text-amber-800"}`}>
                  {isReady
                    ? `Fasting period complete — you may now go to the lab`
                    : `${fastingHours}-hour fasting required before sample collection`}
                </p>
                {!isReady && (
                  <p className="text-xs text-amber-700 mt-1">
                    Time remaining: <strong>{remainingTime}</strong> — please wait before visiting the lab
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pre-conditions checklist */}
          {checkboxes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-3">
                Pre-Test Conditions (verified by lab staff)
              </h4>
              <div className="space-y-2">
                {checkboxes.map((cb, i) => (
                  <div key={i}
                    className={`flex items-start gap-3 p-3 rounded-xl border ${
                      cb.checked ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100"
                    }`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      cb.checked ? "bg-green-500" : "bg-gray-200"
                    }`}>
                      {cb.checked && (
                        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                          <path d="M2 6l3 3 5-5" stroke="white"
                            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className={`text-xs leading-relaxed ${
                      cb.checked ? "text-green-800" : "text-gray-500"
                    }`}>
                      {cb.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lab staff short answers */}
          {shortAnswers.filter((sa) => sa.answer).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Lab Staff Notes
              </h4>
              <div className="space-y-3">
                {shortAnswers.filter((sa) => sa.answer).map((sa, i) => (
                  <div key={i} className="p-3 rounded-xl border bg-blue-50 border-blue-100">
                    <p className="text-xs font-semibold text-blue-700 mb-1">{sa.question}</p>
                    <p className="text-xs text-blue-900">{sa.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No conditions yet */}
          {checkboxes.length === 0 && shortAnswers.filter((sa) => sa.answer).length === 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <p className="text-sm text-gray-400">
                Lab staff are preparing your pre-conditions. Please check back shortly.
              </p>
            </div>
          )}

          {/* Patient instructions - Themed Blue */}
          <div className="p-4 rounded-xl border border-blue-100 bg-blue-50">
            <p className="text-xs font-semibold text-blue-800 mb-2">📋 What you need to do</p>
            <ul className="text-xs text-blue-700 space-y-1.5">
              {fastingHours > 0 && (
                <li>• Fast for <strong>{fastingHours} hour{fastingHours > 1 ? "s" : ""}</strong> before going to the lab</li>
              )}
              <li>• Review all pre-conditions listed above</li>
              <li>• Bring your appointment confirmation when you visit the lab</li>
              {isReady && (
                <li className="text-green-700 font-semibold">
                  • ✓ All conditions met — you can submit your sample now
                </li>
              )}
            </ul>
          </div>

        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// REGULAR RESULT CARD (completed / in-progress)
// ══════════════════════════════════════════════════════════
function LabResultCard({ result }) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_CONFIG[result.status] || STATUS_CONFIG.in_progress;
  const isCompleted = result.status === "completed";
  const completedDate = result.completedAt
    ? new Date(result.completedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : null;
  const createdDate = new Date(result.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const hasAbnormal = result.results?.parameters?.some((p) =>
    ["High", "Low", "Positive", "Reactive"].includes(p.flag)
  );

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition ${
      hasAbnormal && isCompleted ? "border-red-200" : "border-gray-100"
    }`}>
      <div onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50 transition">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0 ${
          hasAbnormal && isCompleted ? "bg-red-500" : ""
        }`}
          style={!hasAbnormal || !isCompleted ? { background: "linear-gradient(135deg, #006064, #00ACC1)" } : {}}>
          🧪
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">{result.testName}</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">{result.testId}</span>
            {hasAbnormal && isCompleted && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">⚠️ Abnormal</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {completedDate ? `Completed ${completedDate}` : `Requested ${createdDate}`}
            {result.labRequestRef && <span className="ml-2">· Ref: {result.labRequestRef}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
            {statusStyle.label}
          </span>
          <svg viewBox="0 0 20 20" fill="currentColor"
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}>
            <path fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-5 space-y-4 border-t border-gray-50">
          {!isCompleted ? (
            <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 text-center">
              <p className="text-sm text-amber-700 font-medium">Results not yet available</p>
              <p className="text-xs text-amber-600 mt-1">Current status: {statusStyle.label}</p>
            </div>
          ) : (
            <>
              {result.results?.parameters?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-3">Test Parameters</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          {["Parameter", "Result", "Reference", "Status"].map((h) => (
                            <th key={h} className="text-left text-xs text-gray-400 font-semibold uppercase tracking-wide px-4 py-2.5 border-b border-gray-100">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.results.parameters.map((p, i) => {
                          const flagStyle  = FLAG_CONFIG[p.flag] || {};
                          const isAbnormal = ["High", "Low", "Positive", "Reactive"].includes(p.flag);
                          return (
                            <tr key={i} className={`border-b border-gray-50 ${isAbnormal ? "bg-red-50" : "hover:bg-gray-50"}`}>
                              <td className="px-4 py-2.5 text-gray-700 text-xs">{p.name}</td>
                              <td className={`px-4 py-2.5 font-semibold text-xs ${isAbnormal ? "text-red-700" : "text-gray-800"}`}>
                                {p.value || "—"} {p.unit}
                              </td>
                              <td className="px-4 py-2.5 text-gray-400 text-xs">{p.ref || "—"}</td>
                              <td className="px-4 py-2.5">
                                {p.flag && (
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${flagStyle.bg || "bg-gray-100"} ${flagStyle.text || "text-gray-600"} ${flagStyle.border || "border-gray-200"}`}>
                                    {p.flag}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {result.results?.checkboxFindings?.some((f) => f.checked) && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Clinical Findings</h4>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5">
                    {result.results.checkboxFindings.filter((f) => f.checked).map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                            <path d="M2 6l3 3 5-5" stroke="#1565C0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <span className="text-xs text-gray-700">{f.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.results?.labNotes && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Lab Notes</p>
                  <p className="text-sm text-amber-800">{result.results.labNotes}</p>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <button onClick={() => generateLabPDF(result)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #006064, #00ACC1)" }}>
                  📄 Download Lab Report PDF
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════
export default function PatientLabResults() {
  const location = useLocation();
  const navigate  = useNavigate();

  const urlParams  = new URLSearchParams(location.search);
  const initialTab = urlParams.get("tab") === "pre_check" ? "pre_check" : "all";

  const [results,       setResults]       = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [filter,        setFilter]        = useState(initialTab);

  useEffect(() => {
    if (urlParams.get("tab")) {
      navigate("/patient/lab-results", { replace: true });
    }
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const user = JSON.parse(sessionStorage.getItem("user") || "{}");

        const [resLab, resNotif] = await Promise.all([
          api.get("/lab-results", { params: { patientId: user.userId } }),
          api.get("/lab-results/patient-notifications").catch(() => ({ data: { notifications: [] } })),
        ]);

        setResults(resLab.data.labTestResults || resLab.data.results || []);
        setNotifications(resNotif.data.notifications || []);
      } catch (err) {
        setError("Could not load lab results. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const preCheckResults = results.filter((r) => r.status === "pre_check");
  const filtered = filter === "all"
    ? results
    : results.filter((r) => r.status === filter);

  const counts = {
    all:       results.length,
    completed: results.filter((r) => r.status === "completed").length,
    pending:   results.filter((r) => ["payment_pending", "pre_check", "sample_received", "in_progress"].includes(r.status)).length,
    pre_check: preCheckResults.length,
  };

  if (loading) {
    return (
      <PatientLayout activePage="Lab Results">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 text-sm">Loading lab results...</p>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout activePage="Lab Results">
      <div className="p-6 space-y-5">

        <div>
          <h1 className="text-xl font-bold text-gray-800"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            Lab Results
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            View and download your laboratory test reports
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            ⚠️ {error}
          </div>
        )}

        {/* Stats - Changed Pre-Check stat to Blue/Light Blue */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Tests", value: counts.all,       color: "#1565C0", bg: "#E3F2FD" },
            { label: "Completed",   value: counts.completed, color: "#00897B", bg: "#E0F2F1" },
            { label: "In Progress", value: counts.pending,   color: "#7B1FA2", bg: "#F3E5F5" },
            { label: "Pre-Check",   value: counts.pre_check, color: "#0284C7", bg: "#E0F2FE" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold"
                style={{ fontFamily: "'Playfair Display', serif", color: s.color }}>
                {s.value}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs - Swapped purple tab for Blue Gradient */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap gap-2">
          {[
            { key: "all",         label: "All"           },
            { key: "pre_check",   label: "⏳ Pre-Check"  },
            { key: "completed",   label: "Completed"     },
            { key: "in_progress", label: "In Progress"   },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`relative px-4 py-2 rounded-xl text-sm font-medium transition ${
                filter === f.key ? "text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              style={filter === f.key
                ? (f.key === "pre_check" || f.key === "all" || f.key === "in_progress")
                  ? { background: "linear-gradient(135deg, #0284C7, #0369A1)" }
                  : { background: "linear-gradient(135deg, #006064, #00ACC1)" }
                : {}}>
              {f.label}
              {f.key === "pre_check" && counts.pre_check > 0 && filter !== "pre_check" && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #0284C7, #0369A1)" }}>
                  {counts.pre_check}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── PRE-CHECK TAB (Updated to Blue/Sky theme) ── */}
        {filter === "pre_check" && (
          <div className="space-y-4">
            {preCheckResults.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-gray-500 font-medium">No pre-checks pending</p>
                <p className="text-gray-400 text-sm mt-1">
                  All your tests are completed or waiting for results
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-2xl border flex items-start gap-3"
                  style={{ background: "#F0F9FF", borderColor: "#BAE6FD" }}>
                  <span className="text-2xl flex-shrink-0">🔔</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#0369A1" }}>
                      {preCheckResults.length} test{preCheckResults.length > 1 ? "s" : ""} require pre-check conditions
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#0284C7" }}>
                      Please review and follow all instructions before visiting the lab
                    </p>
                  </div>
                </div>

                {preCheckResults.map((result) => {
                  const notif = notifications.find(
                    (n) => String(n._id) === String(result._id) || n.testId === result.testId
                  );
                  return (
                    <PreCheckCard key={result._id} result={result} notif={notif} />
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── ALL OTHER TABS ── */}
        {filter !== "pre_check" && (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-4xl mb-3">🧪</div>
                <p className="text-gray-500 font-medium">No lab results found</p>
                <p className="text-gray-400 text-sm mt-1">
                  Lab results will appear here after your doctor requests tests
                </p>
              </div>
            ) : (
              filtered.map((result) => (
                <LabResultCard key={result._id} result={result} />
              ))
            )}
          </div>
        )}

      </div>
    </PatientLayout>
  );
}