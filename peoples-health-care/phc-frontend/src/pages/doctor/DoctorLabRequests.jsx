import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../services/api";
import PatientSearchInput from "../../components/PatientSearchInput";

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

const STATUS_CONFIG = {
  pending:     { class: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-400",  label: "Pending",     icon: "⏳" },
  in_progress: { class: "bg-blue-100 text-blue-700 border-blue-200",     dot: "bg-blue-500",   label: "In Progress", icon: "🔬" },
  completed:   { class: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500",  label: "Completed",   icon: "✅" },
};

const SOURCE_CONFIG = {
  standalone:        { class: "bg-slate-100 text-slate-600",   label: "Standalone" },
  from_prescription: { class: "bg-blue-100 text-blue-700",     label: "From Prescription" },
};

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ── Lab Request Modal (standalone creation / edit) ─────────────
function LabRequestModal({ onClose, onSaved, existing = null }) {
  const [patientName, setPatientName] = useState(existing?.patientName || "");
  const [patientId, setPatientId]     = useState(existing?.patientId || "");
  const [appointmentNumber, setAppointmentNumber] = useState(existing?.appointmentNumber || "");

  // checkedTests: { [testName]: true }
  const [checkedTests, setCheckedTests] = useState(() => {
    if (!existing?.tests) return {};
    const m = {};
    existing.tests.filter(t => !t.isOther).forEach(t => { m[t.name] = true; });
    return m;
  });

  // testPriorities: { [testName]: "Routine" | "Urgent" }
  const [testPriorities, setTestPriorities] = useState(() => {
    if (!existing?.tests) return {};
    const m = {};
    existing.tests.filter(t => !t.isOther).forEach(t => { m[t.name] = t.priority || "Routine"; });
    return m;
  });

  const [otherChecked, setOtherChecked] = useState(() => existing?.tests?.some(t => t.isOther) || false);
  const [otherText, setOtherText]       = useState(() => existing?.tests?.find(t => t.isOther)?.name || "");
  const [otherPriority, setOtherPriority] = useState(() => existing?.tests?.find(t => t.isOther)?.priority || "Routine");

  const [clinicalNotes, setClinical] = useState(existing?.clinicalNotes || "");
  const [saving, setSaving]          = useState(false);
  const [error, setError]            = useState("");

  const toggleTest = (t) => {
    setCheckedTests(prev => {
      const next = { ...prev, [t]: !prev[t] };
      // set default priority when first checked
      if (next[t] && !testPriorities[t]) {
        setTestPriorities(p => ({ ...p, [t]: "Routine" }));
      }
      return next;
    });
  };

  const setTestPriority = (name, p) =>
    setTestPriorities(prev => ({ ...prev, [name]: p }));

  const selectedNames  = Object.entries(checkedTests).filter(([,v]) => v).map(([k]) => k);
  const selectedCount  = selectedNames.length + (otherChecked && otherText ? 1 : 0);
  const urgentCount    = selectedNames.filter(n => testPriorities[n] === "Urgent").length
                       + (otherChecked && otherText && otherPriority === "Urgent" ? 1 : 0);

  const handleSubmit = async () => {
    setError("");
    if (!patientName.trim()) return setError("Patient name is required.");
    if (selectedCount === 0)  return setError("Select at least one test.");
    if (otherChecked && !otherText.trim()) return setError("Describe the custom test.");

    const tests = [
      ...selectedNames.map(name => ({ name, isOther: false, price: LAB_TEST_PRICES[name] || 0, priority: testPriorities[name] || "Routine" })),
      ...(otherChecked && otherText.trim()
        ? [{ name: otherText.trim(), isOther: true, price: OTHER_PRICE, priority: otherPriority }]
        : []),
    ];

    // Overall priority = Urgent if any test is urgent, else Routine
    const overallPriority = tests.some(t => t.priority === "Urgent") ? "Urgent" : "Routine";

    setSaving(true);
    try {
      const payload = {
        patientName:       patientName.trim(),
        patientId:         patientId || undefined,
        appointmentNumber: appointmentNumber.trim() || undefined,
        tests,
        priority:          overallPriority,
        clinicalNotes,
      };
      const res = existing
        ? await api.put(`/lab-requests/${existing._id}`, payload)
        : await api.post("/lab-requests", payload);
      onSaved(res.data.labRequest, !!existing);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save lab request.");
    } finally {
      setSaving(false);
    }
  };

  // Mini priority toggle used per-test
  function PriorityToggle({ value, onChange }) {
    return (
      <div className="flex rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
        <button
          type="button"
          onClick={() => onChange("Routine")}
          className={`px-2 py-0.5 text-[10px] font-semibold transition ${
            value === "Routine"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-400 hover:bg-gray-50"
          }`}
        >
          Routine
        </button>
        <button
          type="button"
          onClick={() => onChange("Urgent")}
          className={`px-2 py-0.5 text-[10px] font-semibold transition border-l border-gray-200 ${
            value === "Urgent"
              ? "bg-red-500 text-white"
              : "bg-white text-gray-400 hover:bg-gray-50"
          }`}
        >
          🚨 Urgent
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

        <div className="sticky top-0 bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="font-bold text-gray-800 text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              {existing ? "Edit Lab Request" : "New Lab Request"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">People's Health Care — Laboratory</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠ {error}</div>}

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
            </svg>
            Timestamped automatically: <strong className="text-gray-600 ml-1">{formatDateTime(new Date().toISOString())}</strong>
          </div>

          {/* Patient */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Patient Information</label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Patient Name <span className="text-red-400">*</span></label>
                <PatientSearchInput
                  value={patientName}
                  onChange={(name, uid) => { setPatientName(name); setPatientId(uid); }}
                  disabled={!!existing}
                  placeholder="Search by name or patient ID…"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Appointment Number</label>
                <input
                  type="text"
                  value={appointmentNumber}
                  onChange={e => setAppointmentNumber(e.target.value)}
                  placeholder="e.g. APT-00123"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono"
                />
              </div>
            </div>
          </div>

          {/* Test selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Select Tests <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                {urgentCount > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full font-semibold">
                    🚨 {urgentCount} Urgent
                  </span>
                )}
                {selectedCount > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">
                    {selectedCount} selected
                  </span>
                )}
              </div>
            </div>

            {/* Test checkboxes grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {LAB_TESTS.map(test => (
                <label key={test} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition text-sm ${
                  checkedTests[test]
                    ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                    : "border-gray-200 hover:border-blue-200 hover:bg-blue-50/50 text-gray-700 bg-white"
                }`}>
                  <input
                    type="checkbox"
                    checked={!!checkedTests[test]}
                    onChange={() => toggleTest(test)}
                    className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
                  />
                  {test}
                </label>
              ))}
              <label className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition text-sm ${
                otherChecked
                  ? "border-amber-400 bg-amber-50 text-amber-700 font-medium"
                  : "border-gray-200 hover:border-amber-200 hover:bg-amber-50/50 text-gray-700 bg-white"
              }`}>
                <input
                  type="checkbox"
                  checked={otherChecked}
                  onChange={e => { setOtherChecked(e.target.checked); if (!e.target.checked) setOtherText(""); }}
                  className="w-3.5 h-3.5 accent-amber-500 flex-shrink-0"
                />
                Other (custom)
              </label>
            </div>

            {otherChecked && (
              <input
                value={otherText}
                onChange={e => setOtherText(e.target.value)}
                autoFocus
                placeholder="Describe the custom test..."
                className="mb-3 w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-900 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
              />
            )}

            {/* ── Per-test priority list ── */}
            {selectedCount > 0 && (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Set priority per test
                  </p>
                </div>
                <div className="divide-y divide-gray-100">
                  {selectedNames.map(name => (
                    <div key={name} className="flex items-center justify-between px-4 py-2.5 bg-white">
                      <span className="text-sm font-medium text-gray-700">{name}</span>
                      <PriorityToggle
                        value={testPriorities[name] || "Routine"}
                        onChange={p => setTestPriority(name, p)}
                      />
                    </div>
                  ))}
                  {otherChecked && otherText && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-white">
                      <span className="text-sm font-medium text-amber-700">★ {otherText}</span>
                      <PriorityToggle value={otherPriority} onChange={setOtherPriority} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Clinical notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Clinical Notes for Lab</label>
            <textarea
              value={clinicalNotes}
              onChange={e => setClinical(e.target.value)}
              placeholder="Reason for tests, relevant clinical history..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
              {saving ? "Saving…" : (existing ? "Save Changes" : "Submit Lab Request")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function DoctorLabRequests() {
  const location = useLocation();
  const navigate  = useNavigate();

  const [labRequests, setLabRequests] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editReq, setEditReq]         = useState(null);
  const [expandedId, setExpandedId]   = useState(null);
  const [expandTarget, setExpandTarget] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch]           = useState("");
  const [cancelling, setCancelling]   = useState(null);
  const [toast, setToast]             = useState(null);
  const [labResultRefs, setLabResultRefs] = useState({});

  const cardRefs = useRef({});

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (silent = false) => {
    try {
      const res = await api.get("/lab-requests");
      setLabRequests(res.data.labRequests || []);
    } catch { showToast("Failed to load lab requests", "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Auto-refresh every 30 seconds ────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => load(true), 5_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const params   = new URLSearchParams(location.search);
    const openLrId = params.get("open");
    const isNew    = params.get("new") === "1";

    if (isNew) {
      navigate("/doctor/lab-requests", { replace: true });
      setShowModal(true);
      return;
    }
    if (!openLrId) return;
    navigate("/doctor/lab-requests", { replace: true });
    setExpandTarget(openLrId);
  }, [location.search, navigate]);

  useEffect(() => {
    if (!expandTarget || loading || labRequests.length === 0) return;
    const match = labRequests.find(r => r.labRequestId === expandTarget);
    if (!match) return;
    setExpandedId(match._id);
    setExpandTarget(null);
    setSearch("");
    setStatusFilter("all");
    setSourceFilter("all");
    setTimeout(() => {
      cardRefs.current[match._id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }, [expandTarget, loading, labRequests]);

  const fetchLabResultRef = async (labRequestId) => {
    if (labResultRefs[labRequestId] !== undefined) return;
    try {
      const res = await api.get(`/lab-results?labRequestRef=${labRequestId}&limit=1`);
      const result = res.data.results?.[0];
      setLabResultRefs(prev => ({ ...prev, [labRequestId]: result?.testId || null }));
    } catch {
      setLabResultRefs(prev => ({ ...prev, [labRequestId]: null }));
    }
  };

  const handleExpand = (req) => {
    const newId = expandedId === req._id ? null : req._id;
    setExpandedId(newId);
    if (newId && req.status === "completed") {
      fetchLabResultRef(req.labRequestId);
    }
  };

  const handleSaved = (lr, isEdit = false) => {
    if (isEdit) {
      setLabRequests(prev => prev.map(r => r._id === lr._id ? lr : r));
      showToast("Lab request updated");
    } else {
      setLabRequests(prev => [lr, ...prev]);
      showToast(`Lab request ${lr.labRequestId} created`);
    }
  };

  const handleCancel = async (id) => {
    setCancelling(id);
    try {
      await api.put(`/lab-requests/${id}/cancel`);
      setLabRequests(prev => prev.filter(r => r._id !== id));
      showToast("Lab request cancelled");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to cancel", "error");
    } finally { setCancelling(null); }
  };

  const filtered = labRequests.filter(r => {
    const matchSearch = r.patientName?.toLowerCase().includes(search.toLowerCase()) || r.labRequestId?.includes(search);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchSource = sourceFilter === "all" || r.source === sourceFilter;
    return matchSearch && matchStatus && matchSource;
  });

  const stats = {
    total:       labRequests.length,
    pending:     labRequests.filter(r => r.status === "pending").length,
    in_progress: labRequests.filter(r => r.status === "in_progress").length,
    completed:   labRequests.filter(r => r.status === "completed").length,
  };

  return (
  <>
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-xl border shadow-lg text-sm font-medium ${
          toast.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.type === "success" ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {(showModal || editReq) && (
        <LabRequestModal
          onClose={() => { setShowModal(false); setEditReq(null); }}
          onSaved={handleSaved}
          existing={editReq}
        />
      )}

      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>Laboratory Requests</h1>
            <p className="text-sm text-gray-400 mt-1">Request and track patient laboratory tests</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg transition-transform hover:scale-105"
            style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/>
            </svg>
            New Lab Request
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total",       value: stats.total,       color: "#1565C0", bg: "#E3F2FD" },
            { label: "Pending",     value: stats.pending,     color: "#E65100", bg: "#FFF3E0" },
            { label: "In Progress", value: stats.in_progress, color: "#1565C0", bg: "#E3F2FD" },
            { label: "Completed",   value: stats.completed,   color: "#00897B", bg: "#E0F2F1" },
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
            <input type="text" placeholder="Search by patient or LR ID..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
          </div>
          <div className="flex gap-2">
            {[["all","All"],["pending","Pending"],["in_progress","In Progress"],["completed","Completed"]].map(([val, label]) => (
              <button key={val} onClick={() => setStatusFilter(val)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${statusFilter === val ? "text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                style={statusFilter === val ? { background: "linear-gradient(135deg, #1565C0, #00ACC1)" } : {}}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {[["all","All Sources"],["standalone","Standalone"],["from_prescription","From Rx"]].map(([val, label]) => (
              <button key={val} onClick={() => setSourceFilter(val)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${sourceFilter === val ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
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
            {filtered.map(req => {
              const sConfig   = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const srcConfig = SOURCE_CONFIG[req.source] || SOURCE_CONFIG.standalone;
              const isExpanded = expandedId === req._id;

              return (
                <div
                  key={req._id}
                  ref={el => { cardRefs.current[req._id] = el; }}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                    expandedId === req._id ? "border-blue-300 shadow-blue-100" : "border-gray-100"
                  }`}
                >
                  {/* Row */}
                  <div className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => handleExpand(req)}>
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sConfig.dot}`}/>
                    <div className="text-xs font-mono text-gray-400 w-32 flex-shrink-0">{req.labRequestId}</div>

                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                        {req.patientName?.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{req.patientName}</div>
                        <div className="text-xs text-gray-400">
                          {req.tests?.length} test{req.tests?.length !== 1 ? "s" : ""}
                          {req.priority === "Urgent" && " · 🚨 Urgent"}
                        </div>
                      </div>
                    </div>

                    {/* Test chips preview */}
                    <div className="hidden lg:flex flex-wrap gap-1.5 flex-1 min-w-0">
                      {req.tests?.slice(0, 3).map((t, i) => (
                        <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.isOther ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                          {t.isOther ? `★ ${t.name}` : t.name}
                        </span>
                      ))}
                      {req.tests?.length > 3 && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">+{req.tests.length - 3} more</span>
                      )}
                    </div>

                    <div className="hidden md:block text-xs text-gray-400">{formatDateTime(req.createdAt)}</div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${srcConfig.class}`}>{srcConfig.label}</span>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1 ${sConfig.class}`}>
                        {sConfig.icon} {sConfig.label}
                      </span>
                    </div>

                    <svg viewBox="0 0 20 20" fill="currentColor"
                      className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}>
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-6 py-5 bg-gray-50 space-y-4">

                      {/* Timestamp + source */}
                      <div className="flex items-center gap-2 text-xs text-gray-500 bg-white rounded-xl px-4 py-2.5 border border-gray-100 flex-wrap">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                        </svg>
                        Requested <strong className="ml-1 text-gray-700">{formatDateTime(req.createdAt)}</strong>
                        <span className="mx-2 text-gray-300">·</span>
                        By <strong className="ml-1 text-gray-700">{req.doctorName}</strong>
                        {req.appointmentNumber && (
                          <><span className="mx-2 text-gray-300">·</span>
                          Appt <span className="ml-1 font-mono font-semibold text-gray-700">{req.appointmentNumber}</span></>
                        )}
                        {req.prescriptionRef && (
                          <><span className="mx-2 text-gray-300">·</span>
                          Linked to{" "}
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/doctor/prescriptions?open=${req.prescriptionRef}`); }}
                            className="ml-1 font-mono text-blue-600 hover:text-blue-800 hover:underline transition font-semibold"
                            title="View this prescription"
                          >
                            {req.prescriptionRef}
                          </button></>
                        )}
                        {req.completedAt && (
                          <><span className="mx-2 text-gray-300">·</span>
                          Completed <strong className="ml-1 text-green-700">{formatDateTime(req.completedAt)}</strong></>
                        )}
                        {req.status === "completed" && (
                          <><span className="mx-2 text-gray-300">·</span>
                          Lab Result:{" "}
                          {labResultRefs[req.labRequestId] === undefined ? (
                            <span className="ml-1 text-gray-400 text-xs">loading…</span>
                          ) : labResultRefs[req.labRequestId] ? (
                            <button
                              onClick={e => { e.stopPropagation(); navigate(`/doctor/lab-results?open=${labResultRefs[req.labRequestId]}`); }}
                              className="ml-1 font-mono text-teal-600 hover:text-teal-800 hover:underline transition font-semibold inline-flex items-center gap-1"
                              title="View lab result"
                            >
                              {labResultRefs[req.labRequestId]}
                              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                                <path fillRule="evenodd" d="M6.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L8.586 9H2a1 1 0 110-2h6.586L6.293 4.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                              </svg>
                            </button>
                          ) : (
                            <span className="ml-1 text-gray-400 text-xs font-mono">not yet available</span>
                          )}</>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-5">
                        {/* All tests */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            🧪 Tests Requested
                            {req.priority === "Urgent" && <span className="ml-2 text-red-600">🚨 Urgent</span>}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {req.tests?.map((t, i) => (
                              <span key={i} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border ${
                                t.isOther ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}>
                                {t.isOther ? `★ ${t.name}` : t.name}
                                {t.priority === "Urgent" && (
                                  <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                                    🚨 Urgent
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Notes + actions */}
                        <div className="space-y-3">
                          {req.clinicalNotes && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Clinical Notes</p>
                              <div className="bg-white rounded-xl p-3 border border-gray-100 text-sm text-gray-700">{req.clinicalNotes}</div>
                            </div>
                          )}

                          {req.status === "pending" && (
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => setEditReq(req)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-blue-200 text-blue-600 text-xs font-semibold hover:bg-blue-50 transition">
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                                </svg>
                                Edit
                              </button>
                              <button onClick={() => handleCancel(req._id)} disabled={cancelling === req._id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition disabled:opacity-60">
                                {cancelling === req._id ? "Cancelling…" : "Cancel"}
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
                <div className="text-4xl mb-3">🧪</div>
                <div className="text-gray-500 font-medium">No lab requests found</div>
                <div className="text-gray-400 text-sm mt-1">Create a standalone request or assign tests via prescription</div>
              </div>
            )}
          </div>
        )}
      </div>
  </>
  );
}