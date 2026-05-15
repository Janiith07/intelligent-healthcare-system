import { useState, useEffect } from "react";
import LabLayout from "../../components/LabLayout";
import api from "../../services/api";

// ─── Fasting hours per test (mirrors backend) ─────────────────────────────
const FASTING_HOURS = {
  FBC: 0, ESR: 4, FBS: 8,
  "Liver Profile": 8, "Renal Profile": 12,
  "Thyroid Profile": 0, "Serum Vit D Level": 0, "Dengue Ag": 0,
};

// ─── Live fasting countdown hook ──────────────────────────────────────────
function useFastingTimer(labResults) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000); // update every 10s
    return () => clearInterval(id);
  }, []);

  // Returns array: [{ testName, fastingHours, conditionsSentAt, readyAt, remaining, isReady }]
  return (labResults || [])
    .map(r => {
      const hours = FASTING_HOURS[r.testName] ?? 0;
      if (hours === 0 || !r.conditionsSentAt) return null;
      const readyAt = new Date(new Date(r.conditionsSentAt).getTime() + hours * 3600000);
      const diffMs  = readyAt.getTime() - now;
      const isReady = diffMs <= 0;
      const hrs     = Math.floor(Math.abs(diffMs) / 3600000);
      const mins    = Math.floor((Math.abs(diffMs) % 3600000) / 60000);
      return {
        testName: r.testName,
        fastingHours: hours,
        conditionsSentAt: r.conditionsSentAt,
        readyAt,
        isReady,
        remaining: isReady ? null : `${hrs}h ${mins}m`,
      };
    })
    .filter(Boolean);
}


// ─── Status configs ────────────────────────────────────────────────────────
// LabRequest statuses:  pending | in_progress | completed
// LabTestResult statuses: pre_check | sample_received | in_progress | completed
const STATUS_CONFIG = {
  pending:        { bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200",  bar: "#fbbf24", icon: "⏳", label: "Awaiting Cashier" },
  in_progress:    { bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200",   bar: "#60a5fa", icon: "🔬", label: "In Progress" },
  completed:      { bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200",  bar: "#4ade80", icon: "✅", label: "Completed" },

  // LabTestResult sub-statuses (used in detail view)
  pre_check:      { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", bar: "#a78bfa", icon: "📋", label: "Pre Check" },
  sample_received:{ bg: "bg-cyan-100",   text: "text-cyan-700",   border: "border-cyan-200",   bar: "#22d3ee", icon: "💉", label: "Sample Received" },
};

const WORKFLOW_STEPS = [
  { key: "pending",         label: "Cashier Payment", desc: "Patient pays at cashier" },
  { key: "pre_check",       label: "Pre Check",       desc: "Conditions verified" },
  { key: "sample_received", label: "Sample Received", desc: "Sample collected" },
  { key: "in_progress",     label: "In Progress",     desc: "Test running" },
  { key: "completed",       label: "Completed",       desc: "Report uploaded" },
];

// ─── Pre-Conditions Modal ─────────────────────────────────────────────────
function PreConditionsModal({ labResults, onClose, onDone }) {
  const [currentIdx,       setCurrentIdx]       = useState(0);
  const [templates,        setTemplates]        = useState({});
  const [checkboxes,       setCheckboxes]       = useState({});
  const [answers,          setAnswers]          = useState({});
  const [loadingTemplate,  setLoadingTemplate]  = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState(null);

  const current = labResults[currentIdx];

  useEffect(() => { if (current) loadTemplate(current.testName); }, [currentIdx]);

  const loadTemplate = async (testName) => {
    if (templates[testName]) { setLoadingTemplate(false); return; }
    setLoadingTemplate(true);
    setError(null);
    try {
      const res = await api.get(`/lab-results/pre-conditions/${encodeURIComponent(testName)}`);
      const tpl = res.data.template;
      setTemplates(p => ({ ...p, [testName]: tpl }));
      setCheckboxes(p => ({ ...p, [testName]: tpl.checkboxes.map(label => ({ label, checked: false })) }));
      setAnswers(p => ({ ...p, [testName]: tpl.shortAnswers.map(q => ({ question: q.question, answer: "" })) }));
    } catch (err) {
      setError("Could not load pre-conditions: " + (err.response?.data?.message || err.message));
    } finally {
      setLoadingTemplate(false);
    }
  };

  const toggleCheck = (testName, i) =>
    setCheckboxes(p => ({ ...p, [testName]: p[testName].map((c, idx) => idx === i ? { ...c, checked: !c.checked } : c) }));

  const updateAnswer = (testName, i, value) =>
    setAnswers(p => ({ ...p, [testName]: p[testName].map((q, idx) => idx === i ? { ...q, answer: value } : q) }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/lab-results/${current._id}/pre-conditions`, {
        checkboxes:   checkboxes[current.testName] || [],
        shortAnswers: answers[current.testName]    || [],
      });
      if (currentIdx < labResults.length - 1) {
        setCurrentIdx(i => i + 1);
      } else {
        onDone();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const cbs = checkboxes[current?.testName] || [];
  const ans = answers[current?.testName]    || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 rounded-t-3xl" style={{ background: "linear-gradient(135deg, #6A1B9A, #4527A0)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-xs">Pre-Test Conditions · {currentIdx + 1} of {labResults.length}</p>
              <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
                📋 {current?.testName}
              </h3>
              <p className="text-white/60 text-xs mt-0.5">{labResults[0]?.patientName || "Patient"}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          {labResults.length > 1 && (
            <div className="flex gap-2 mt-3">
              {labResults.map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= currentIdx ? "bg-white" : "bg-white/30"}`}/>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 space-y-5">
          {loadingTemplate ? (
            <div className="text-center py-8 text-gray-400">Loading pre-conditions…</div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Verify before collecting sample
                </p>
                <div className="space-y-3">
                  {cbs.map((item, i) => (
                    <label key={i} className="flex items-start gap-3 cursor-pointer group">
                      <div onClick={() => toggleCheck(current.testName, i)}
                        className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition cursor-pointer ${
                          item.checked ? "bg-purple-600 border-purple-600" : "border-gray-300 group-hover:border-purple-400"
                        }`}>
                        {item.checked && (
                          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                            <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm leading-relaxed ${item.checked ? "text-gray-800" : "text-gray-500"}`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {ans.length > 0 && (
                <div className="border-t border-gray-100 pt-4 space-y-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Additional Questions</p>
                  {ans.map((q, i) => (
                    <div key={i}>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{q.question}</label>
                      <textarea value={q.answer} onChange={e => updateAnswer(current.testName, i, e.target.value)}
                        placeholder="Type your answer…" rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"/>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 text-xs px-4 py-2 rounded-xl border border-red-200">{error}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} disabled={saving}
                  className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #6A1B9A, #4527A0)" }}>
                  {saving ? (
                    <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>Saving…</>
                  ) : currentIdx < labResults.length - 1
                    ? "Save & Next Test →"
                    : "✅ Confirm & Mark Sample Received"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Request Detail Modal ──────────────────────────────────────────────────
function RequestDetailModal({ request, labTestResults, onClose, onOpenPreCond, onGoToUpload }) {
  // Determine the most meaningful status to show in the progress bar
  // We look at the LabTestResult statuses, not LabRequest status
  const allStatuses = labTestResults.map(r => r.status);

  // Priority order: if any result is in a later stage, show that
  const statusOrder = ["pre_check", "sample_received", "in_progress", "completed"];
  let displayStatus = "pending"; // default = awaiting cashier
  for (const s of statusOrder) {
    if (allStatuses.includes(s)) { displayStatus = s; break; }
  }

  // If all are completed, show completed
  if (allStatuses.length > 0 && allStatuses.every(s => s === "completed")) {
    displayStatus = "completed";
  }

  const currentIdx = WORKFLOW_STEPS.findIndex(s => s.key === displayStatus);

  // Which LabTestResults still need pre-conditions (still pre_check)
  const fastingTimers    = useFastingTimer(labTestResults);
  const needsPreCond     = labTestResults.filter(r => r.status === "pre_check");
  const needsUpload      = labTestResults.some(r => ["sample_received","in_progress"].includes(r.status));
  const allDone          = labTestResults.length > 0 && labTestResults.every(r => r.status === "completed");
  const awaitingCashier  = labTestResults.length === 0 && request.status === "pending"; // cashier hasn't confirmed yet

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between rounded-t-3xl"
          style={{ background: "linear-gradient(135deg, #0D2137, #0D47A1)" }}>
          <div>
            <p className="text-white/60 text-xs">Lab Request</p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              {request.labRequestId}
            </h3>
            <p className="text-white/60 text-xs mt-0.5">
              {new Date(request.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}
              {request.channelingNo ? ` · Ch. #${request.channelingNo}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Patient card */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #0D47A1, #1565C0)" }}>
              {request.patientName?.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-800">{request.patientName}</div>
              <div className="text-xs text-gray-500">
                {request.channelingNo ? `Ch. #${request.channelingNo}` : "No channeling no."}
                {request.doctorName ? ` · Dr. ${request.doctorName}` : ""}
              </div>
            </div>
            {request.priority === "Urgent" && (
              <span className="text-xs bg-red-100 text-red-600 font-bold px-3 py-1 rounded-full border border-red-200">
                🚨 Urgent
              </span>
            )}
          </div>

          {/* Workflow progress */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Workflow Progress</p>
            <div className="flex items-center gap-1">
              {WORKFLOW_STEPS.map((step, i) => {
                const done   = currentIdx >= i;
                const active = displayStatus === step.key;
                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                        done ? "text-white" : "bg-gray-100 text-gray-400"
                      }`} style={done ? { background: "linear-gradient(135deg, #0D47A1, #1565C0)" } : {}}>
                        {done ? "✓" : i + 1}
                      </div>
                      <span className={`text-xs mt-1 text-center leading-tight ${active ? "text-blue-700 font-semibold" : "text-gray-400"}`}>
                        {step.label}
                      </span>
                    </div>
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 mb-6 mx-1 ${currentIdx > i ? "bg-blue-500" : "bg-gray-100"}`}/>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tests with individual statuses */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tests</p>
            <div className="space-y-2">
              {request.tests?.map(t => {
                const result = labTestResults.find(r => r.testName === t.name);
                const cfg    = result ? (STATUS_CONFIG[result.status] || STATUS_CONFIG.in_progress) : STATUS_CONFIG.pending;
                const timer  = fastingTimers.find(ft => ft.testName === t.name);
                return (
                  <div key={t.name}
                    className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className={`text-sm font-medium ${cfg.text}`}>🧪 {t.name}</span>
                      <span className={`text-xs font-semibold ${cfg.text}`}>
                        {cfg.icon} {result ? cfg.label : "⏳ Awaiting Cashier"}
                      </span>
                    </div>
                    {timer && !timer.isReady && (
                      <div className="px-4 pb-3">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base">⏳</span>
                            <div className="flex-1">
                              <div className="text-xs font-bold text-amber-800">
                                Fasting Required — {timer.fastingHours}h total
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                                  ⏱ {timer.remaining} remaining
                                </span>
                                <span className="text-xs text-amber-600">
                                  Ready at {timer.readyAt.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true})}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {timer && timer.isReady && (
                      <div className="px-4 pb-3">
                        <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center gap-2">
                          <span>✅</span>
                          <span className="text-xs font-semibold text-green-700">
                            Fasting complete — sample can be collected now
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clinical notes */}
          {request.clinicalNotes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Doctor's Notes</p>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-700">
                📝 {request.clinicalNotes}
              </div>
            </div>
          )}

          {/* Action buttons — based on actual state */}
          {awaitingCashier && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800">⏳ Awaiting Payment at Cashier</p>
              <p className="text-xs text-amber-700 mt-1">
                The patient must pay at the cashier counter first. Once collected, this will automatically
                move to Pre-Check and you will be able to proceed.
              </p>
            </div>
          )}

          {needsPreCond.length > 0 && (
            <button onClick={() => onOpenPreCond(needsPreCond)}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #6A1B9A, #4527A0)" }}>
              📋 Fill Pre-Conditions & Mark Sample Received
            </button>
          )}

          {needsUpload && (
            <button onClick={() => onGoToUpload()}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #0D47A1, #1565C0)" }}>
              📤 Go to Upload Results
            </button>
          )}

          {allDone && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-sm font-semibold text-green-800">✅ All tests completed</p>
              <p className="text-xs text-green-700 mt-1">Results have been uploaded and are visible to the doctor and patient.</p>
            </div>
          )}

          <button onClick={onClose}
            className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function LabTestRequests() {
  const [requests,       setRequests]       = useState([]);
  const [labResults,     setLabResults]     = useState([]);   // all LabTestResult records
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [selected,       setSelected]       = useState(null);
  const [preCondTarget,  setPreCondTarget]  = useState(null);
  const [statusFilter,   setStatusFilter]   = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [search,         setSearch]         = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both LabRequests and LabTestResults in parallel
      const [reqRes, resRes] = await Promise.all([
        api.get("/lab-requests"),
        api.get("/lab-results?limit=500"),
      ]);
      setRequests(reqRes.data.labRequests || []);
      setLabResults(resRes.data.results   || []);
    } catch (err) {
      setError("Failed to load requests: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Get LabTestResult records for a given labRequestId
  const getResultsFor = (labRequestId) =>
    labResults.filter(r => r.labRequestRef === labRequestId);

  // Compute effective display status for a LabRequest card
  const effectiveStatus = (req) => {
    const results = getResultsFor(req.labRequestId);
    // When no LabTestResults exist yet, fall back to the actual LabRequest.status
    // so that "in_progress" (cashier paid + notified lab) is not misread as "Awaiting Cashier"
    if (results.length === 0) return req.status || "pending";
    if (results.every(r => r.status === "completed")) return "completed";
    if (results.some(r => ["sample_received","in_progress"].includes(r.status))) return "in_progress";
    if (results.some(r => r.status === "pre_check")) return "pre_check";
    return req.status || "pending";
  };

  const handlePreCondDone = () => {
    setPreCondTarget(null);
    setSelected(null);
    fetchAll();
  };

  // Stats based on effective status
  const counts = {
    pending:     requests.filter(r => effectiveStatus(r) === "pending").length,
    in_progress: requests.filter(r => ["pre_check","sample_received","in_progress"].includes(effectiveStatus(r))).length,
    completed:   requests.filter(r => effectiveStatus(r) === "completed").length,
  };

  const filtered = requests.filter(r => {
    const q    = search.toLowerCase();
    const eff  = effectiveStatus(r);
    const matchSearch   = !q || (r.patientName||"").toLowerCase().includes(q) || (r.labRequestId||"").includes(q);
    const matchStatus   = statusFilter === "All" || eff === statusFilter ||
                          (statusFilter === "in_progress" && ["pre_check","sample_received","in_progress"].includes(eff));
    const matchPriority = priorityFilter === "All" || r.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  return (
    <LabLayout activePage="Test Requests">
      {/* Pre-conditions modal */}
      {preCondTarget && (
        <PreConditionsModal
          labResults={preCondTarget}
          onClose={() => setPreCondTarget(null)}
          onDone={handlePreCondDone}
        />
      )}

      {/* Request detail modal */}
      {selected && !preCondTarget && (
        <RequestDetailModal
          request={selected}
          labTestResults={getResultsFor(selected.labRequestId)}
          onClose={() => setSelected(null)}
          onOpenPreCond={(results) => {
            setSelected(null);
            setPreCondTarget(results.map(r => ({ ...r, patientName: selected.patientName })));
          }}
          onGoToUpload={() => { window.location.href = "/lab/upload"; }}
        />
      )}

      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>
            Test Requests
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage and process incoming laboratory test requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Awaiting Cashier", value: counts.pending,     color: "#E65100", bg: "#FFF3E0" },
            { label: "In Progress",      value: counts.in_progress, color: "#1565C0", bg: "#E3F2FD" },
            { label: "Completed",        value: counts.completed,   color: "#2E7D32", bg: "#E8F5E9" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: s.color }}>
                {s.value}
              </div>
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
            <input type="text" placeholder="Search patient or request ID…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key:"All",         label:"All" },
              { key:"pending",     label:"⏳ Awaiting Cashier" },
              { key:"in_progress", label:"🔬 In Progress" },
              { key:"completed",   label:"✅ Completed" },
            ].map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  statusFilter === f.key ? "text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={statusFilter === f.key ? { background: "linear-gradient(135deg, #0D47A1, #1565C0)" } : {}}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setPriorityFilter(priorityFilter === "Urgent" ? "All" : "Urgent")}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              priorityFilter === "Urgent" ? "bg-red-500 text-white border-red-400" : "border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600"
            }`}>
            🚨 Urgent
          </button>
          <button onClick={fetchAll}
            className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 text-xs transition">
            🔄
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            Loading requests…
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-2xl border border-red-100 p-8 text-center text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">🧪</div>
            <div className="text-gray-500 font-medium">No requests found</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(req => {
              const eff     = effectiveStatus(req);
              const results = getResultsFor(req.labRequestId);

              // Determine what status label & color to show on the card
              let cfg = STATUS_CONFIG[eff] || STATUS_CONFIG.pending;
              // Override for pre_check so it shows meaningfully
              if (eff === "pre_check") cfg = STATUS_CONFIG.pre_check;
              if (eff === "sample_received") cfg = STATUS_CONFIG.sample_received;

              // Action hint text shown on card
              let actionHint = "View Details →";
              if (eff === "pending")          actionHint = "⏳ Awaiting payment →";
              if (eff === "pre_check")        actionHint = "📋 Fill pre-conditions →";
              if (eff === "sample_received")  actionHint = "📤 Upload results →";
              if (eff === "in_progress")      actionHint = "📤 Upload results →";
              if (eff === "completed")        actionHint = "✅ View report →";

              return (
                <div key={req._id}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition overflow-hidden cursor-pointer ${
                    req.priority === "Urgent" ? "border-red-100" : "border-gray-100"
                  }`}
                  onClick={() => setSelected(req)}>
                  <div className="flex items-center gap-4 px-6 py-4">
                    <div className="w-1.5 h-14 rounded-full flex-shrink-0" style={{ background: cfg.bar }}/>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #0D47A1, #1565C0)" }}>
                      {req.patientName?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-gray-800">{req.patientName}</span>
                        {req.channelingNo && (
                          <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            Ch. #{req.channelingNo}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {req.tests?.slice(0, 3).map(t => (
                          t.priority === "Urgent" ? (
                            <span key={t.name} className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                              🚨 {t.name} <span className="font-bold">· Urgent</span>
                            </span>
                          ) : (
                            <span key={t.name} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              {t.name}
                            </span>
                          )
                        ))}
                        {req.tests?.length > 3 && (
                          <span className="text-xs text-gray-400">+{req.tests.length - 3} more</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(req.createdAt).toLocaleDateString("en-GB")} · {req.labRequestId}
                        {results.length > 0 && <span className="ml-2 text-green-600">· {results.length} test result{results.length > 1 ? "s" : ""} created</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      <span className="text-xs text-gray-400">{actionHint}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </LabLayout>
  );
}