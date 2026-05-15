import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

function getInitials(name = "") {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}
function calcAge(birthday) {
  if (!birthday) return null;
  return Math.floor((Date.now() - new Date(birthday)) / (365.25 * 24 * 60 * 60 * 1000));
}
function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Lab request detail modal ──────────────────────────────────
function LabRequestDetailModal({ lrId, onClose }) {
  const [lr, setLr]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    api.get(`/lab-requests/${lrId}`)
      .then(res => setLr(res.data.labRequest))
      .catch(() => setError("Could not load lab request."))
      .finally(() => setLoading(false));
  }, [lrId]);

  const statusStyle = {
    pending:     { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  label: "Pending"     },
    in_progress: { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   label: "In Progress" },
    completed:   { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  label: "Completed"   },
    cancelled:   { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    label: "Cancelled"   },
  }[lr?.status] || { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", label: "—" };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800 text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>Lab Request Details</h3>
            <p className="text-xs font-mono text-purple-600 mt-0.5">{lrId}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-gray-500">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading && <div className="flex flex-col items-center py-12 gap-3"><div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"/><p className="text-sm text-gray-400">Loading…</p></div>}
          {error  && <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center"><div className="text-3xl mb-2">🧪</div><p className="text-sm text-red-600">{error}</p></div>}
          {lr && (
            <div className="space-y-4">
              {/* Patient + status */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Patient</p>
                  <p className="font-semibold text-gray-800">{lr.patientName}</p>
                  {lr.channelingNo && <p className="text-xs text-gray-400 mt-0.5">Ch. #{lr.channelingNo}</p>}
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                  {statusStyle.label}
                </span>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-xs text-gray-400">Requested</p>
                  <p className="text-sm font-semibold text-gray-700 mt-0.5">{fmt(lr.createdAt)}</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-xs text-gray-400">Priority</p>
                  <p className={`text-sm font-bold mt-0.5 ${lr.priority === "Urgent" ? "text-red-600" : "text-gray-700"}`}>
                    {lr.priority === "Urgent" ? "🔴 Urgent" : "🟢 Routine"}
                  </p>
                </div>
              </div>

              {/* Tests */}
              {lr.tests?.length > 0 && (
                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-3">🧪 Tests Requested</p>
                  <div className="flex flex-wrap gap-2">
                    {lr.tests.map((t, i) => (
                      <span key={i}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium border ${
                          t.isOther
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-white text-purple-700 border-purple-200"
                        }`}>
                        {t.isOther ? `★ ${t.name}` : t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pre-test instructions */}
              {lr.preTestInstructions && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Pre-Test Instructions</p>
                  <p className="text-sm text-blue-800 leading-relaxed">{lr.preTestInstructions}</p>
                </div>
              )}

              {/* Clinical notes */}
              {lr.clinicalNotes && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clinical Notes</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{lr.clinicalNotes}</p>
                </div>
              )}

              {/* Linked prescription */}
              {lr.prescriptionRef && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 flex items-center gap-2">
                  <span className="text-sm">📋</span>
                  <span className="text-xs text-blue-700 font-medium">Linked Prescription:</span>
                  <span className="text-xs font-mono text-blue-600">{lr.prescriptionRef}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Prescription detail modal ─────────────────────────────────
function PrescriptionDetailModal({ rxId, onClose }) {
  const [rx, setRx]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    api.get(`/prescriptions/${rxId}`)
      .then(res => setRx(res.data.prescription))
      .catch(() => setError("Could not load prescription."))
      .finally(() => setLoading(false));
  }, [rxId]);

  const s = {
    pending:   { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  label: "Pending"   },
    dispensed: { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  label: "Dispensed" },
    cancelled: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    label: "Cancelled" },
  }[rx?.pharmacyStatus] || { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", label: "—" };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800 text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>Prescription Details</h3>
            <p className="text-xs font-mono text-blue-600 mt-0.5">{rxId}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-gray-500">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="p-6">
          {loading && <div className="flex flex-col items-center py-12 gap-3"><div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"/><p className="text-sm text-gray-400">Loading…</p></div>}
          {error  && <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center"><div className="text-3xl mb-2">📋</div><p className="text-sm text-red-600">{error}</p></div>}
          {rx && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Patient</p>
                  <p className="font-semibold text-gray-800">{rx.patientName}</p>
                  {rx.channelingNo && <p className="text-xs text-gray-400 mt-0.5">Ch. #{rx.channelingNo}</p>}
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-2xl p-3"><p className="text-xs text-gray-400">Issued</p><p className="text-sm font-semibold text-gray-700 mt-0.5">{fmt(rx.createdAt)}</p></div>
                {rx.dispensedAt && <div className="bg-green-50 rounded-2xl p-3"><p className="text-xs text-green-600">Dispensed</p><p className="text-sm font-semibold text-green-700 mt-0.5">{fmt(rx.dispensedAt)}</p></div>}
              </div>
              {rx.medications?.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">💊 Medications</p>
                  <div className="space-y-2">
                    {rx.medications.map((med, i) => (
                      <div key={i} className="bg-white rounded-xl p-3 border border-blue-100 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">{i + 1}</div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{med.name} <span className="font-normal text-gray-500">{med.dosage}</span></p>
                          <p className="text-xs text-gray-500 mt-0.5">{med.frequency} · {med.duration}</p>
                          {med.instructions && <p className="text-xs text-blue-600 mt-0.5 italic">{med.instructions}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {rx.clinicalNotes && <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clinical Notes</p><p className="text-sm text-gray-700 leading-relaxed">{rx.clinicalNotes}</p></div>}
              {rx.labRequestRef && <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 flex items-center gap-2"><span className="text-sm">🧪</span><span className="text-xs text-purple-700 font-medium">Linked Lab Request:</span><span className="text-xs font-mono text-purple-600">{rx.labRequestRef}</span></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Patient modal ─────────────────────────────────────────────
function PatientModal({ patient, onClose }) {
  const navigate = useNavigate();
  const [tab, setTab]                     = useState("overview");
  const [prescriptions, setPrescriptions] = useState([]);
  const [labResults,    setLabResults]    = useState([]);
  const [loadingRx, setLoadingRx]         = useState(false);
  const [loadingLab,setLoadingLab]        = useState(false);
  const [selectedRx, setSelectedRx]       = useState(null);
  const [selectedLr, setSelectedLr]       = useState(null);
  const [selectedLabResult, setSelectedLabResult] = useState(null);

  useEffect(() => {
    if (tab === "visits") {
      setLoadingRx(true);
      api.get(`/prescriptions?patientId=${patient.userId}`)
        .then(res => setPrescriptions(res.data.prescriptions || []))
        .catch(() => setPrescriptions([]))
        .finally(() => setLoadingRx(false));
    }
    if (tab === "labresults") {
      setLoadingLab(true);
      api.get(`/lab-results?patientId=${patient.userId}`)
        .then(res => setLabResults(res.data.results || []))
        .catch(() => setLabResults([]))
        .finally(() => setLoadingLab(false));
    }
  }, [tab, patient.userId]);

  const pd  = patient.patientDetails || {};
  const age = calcAge(pd.birthday);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {selectedRx && <PrescriptionDetailModal rxId={selectedRx} onClose={() => setSelectedRx(null)} />}
      {selectedLr && <LabRequestDetailModal   lrId={selectedLr}  onClose={() => setSelectedLr(null)} />}
      {selectedLabResult && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e=>e.target===e.currentTarget&&setSelectedLabResult(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div style={{background:"linear-gradient(135deg,#0D2137,#006064)"}} className="px-6 py-5 rounded-t-3xl">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-widest">Lab Result</p>
                  <h3 className="text-white font-bold text-lg mt-1" style={{fontFamily:"'Playfair Display',serif"}}>{selectedLabResult.testName}</h3>
                  <p className="text-white/60 text-xs font-mono mt-0.5">{selectedLabResult.testId}</p>
                </div>
                <button onClick={()=>setSelectedLabResult(null)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="bg-white/10 rounded-xl px-4 py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-xs">{selectedLabResult.patientId?.name?.split(" ").map(n=>n[0]).join("").slice(0,2)||"PT"}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-semibold">{selectedLabResult.patientId?.name||patient.name}</div>
                  <div className="text-white/60 text-xs font-mono">{selectedLabResult.patientId?.userId||patient.userId}</div>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100"><p className="text-xs text-gray-400">Lab Request</p><p className="text-sm font-mono font-semibold text-gray-700">{selectedLabResult.labRequestRef||"—"}</p></div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100"><p className="text-xs text-gray-400">Completed</p><p className="text-sm font-semibold text-gray-700">{selectedLabResult.completedAt?new Date(selectedLabResult.completedAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—"}</p></div>
              </div>
              {selectedLabResult.results?.parameters?.length>0&&(
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Parameters</p>
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-xs"><thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-gray-400 font-semibold">Parameter</th><th className="px-3 py-2 text-left text-gray-400 font-semibold">Value</th><th className="px-3 py-2 text-left text-gray-400 font-semibold">Flag</th></tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedLabResult.results.parameters.map((p,i)=>{
                        const abn=["High","Low","Positive","Reactive"].includes(p.flag);
                        return(<tr key={i} className={abn?"bg-red-50":""}><td className="px-3 py-2.5 text-gray-700 font-medium">{p.name}</td><td className="px-3 py-2.5"><span className={`font-bold ${abn?"text-red-600":"text-gray-800"}`}>{p.value||"—"} {p.unit}</span></td><td className="px-3 py-2.5">{p.flag&&<span className={`text-xs font-bold px-2 py-0.5 rounded-full ${abn?"bg-red-100 text-red-600":"bg-green-100 text-green-600"}`}>{p.flag}</span>}</td></tr>);
                      })}
                    </tbody></table>
                  </div>
                </div>
              )}
              {selectedLabResult.results?.labNotes&&<div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed">{selectedLabResult.results.labNotes}</div>}
              <button onClick={()=>{setSelectedLabResult(null);navigate(`/doctor/lab-results?open=${selectedLabResult.testId}`);}} className="w-full py-3 rounded-xl text-white text-sm font-semibold shadow-md" style={{background:"linear-gradient(135deg,#006064,#00838F)"}}>Open Full Report →</button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0D2137, #1565C0)" }}>
          <div className="px-6 pt-5 pb-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-white/20" style={{ background: "rgba(255,255,255,0.15)" }}>
                {patient.photo ? <img src={patient.photo} alt="" className="w-full h-full object-cover"/> : <span className="text-white font-bold text-lg">{getInitials(patient.name)}</span>}
              </div>
              <div>
                <h3 className="text-white font-bold text-xl" style={{ fontFamily: "'Playfair Display', serif" }}>{patient.name}</h3>
                <p className="text-white/60 text-xs mt-0.5">{patient.userId}{age ? ` · Age ${age}` : ""}{pd.gender ? ` · ${pd.gender}` : ""}{pd.bloodGroup ? ` · ${pd.bloodGroup}` : ""}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition self-start">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="flex gap-1 px-6 mt-4">
            {[{ id: "overview", label: "Overview" }, { id: "visits", label: "Prescriptions" }, { id: "labresults", label: "Lab Results" }, { id: "vitals", label: "Vitals" }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? "text-white border-cyan-300" : "text-white/50 border-transparent hover:text-white/80"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Overview */}
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl space-y-2.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Personal Info</p>
                  {[
                    { label: "Phone",      val: patient.telephone },
                    { label: "Email",      val: patient.email },
                    { label: "DOB",        val: pd.birthday ? fmt(pd.birthday) : "—" },
                    { label: "Address",    val: pd.address || "—" },
                    { label: "Registered", val: fmt(patient.createdAt) },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">{item.label}</span>
                      <span className="text-xs font-semibold text-gray-700 text-right truncate max-w-[60%]">{item.val}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <p className="text-xs font-semibold text-red-600 uppercase mb-2">Active Conditions</p>
                    {pd.chronicConditions
                      ? pd.chronicConditions.split(",").map(c => <div key={c} className="flex items-center gap-2 text-sm text-red-800 mb-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"/>{c.trim()}</div>)
                      : <p className="text-xs text-gray-400">None recorded</p>}
                  </div>
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="text-xs font-semibold text-amber-600 uppercase mb-2">Allergies</p>
                    {pd.allergies?.length
                      ? pd.allergies.map(a => <span key={a} className="inline-block text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full mr-1 mb-1">⚠️ {a}</span>)
                      : <p className="text-xs text-gray-400">None known</p>}
                  </div>
                </div>
              </div>
              {pd.currentMedications && (
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 uppercase mb-2">Current Medications</p>
                  <div className="flex flex-wrap gap-2">
                    {pd.currentMedications.split(",").map(m => <span key={m} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full">💊 {m.trim()}</span>)}
                  </div>
                </div>
              )}
              {pd.emergencyContactName && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Emergency Contact</p>
                  <p className="text-sm font-semibold text-gray-800">{pd.emergencyContactName}</p>
                  {pd.emergencyContactNumber && <p className="text-xs text-gray-500 mt-0.5">{pd.emergencyContactNumber}</p>}
                </div>
              )}
            </>
          )}

          {/* Prescriptions tab */}
          {tab === "visits" && (
            <div>
              {loadingRx ? (
                <div className="flex flex-col items-center py-10 gap-3">
                  <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
                  <p className="text-sm text-gray-400">Loading prescriptions…</p>
                </div>
              ) : prescriptions.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-gray-500 font-medium">No prescriptions found</p>
                  <p className="text-xs text-gray-400 mt-1">No prescriptions have been issued for this patient yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {prescriptions.map(rx => (
                    <div key={rx._id} className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-100 transition">
                      <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
                        <span className="text-xs font-bold leading-none">{new Date(rx.createdAt).toLocaleDateString("en-GB", { month: "short" })}</span>
                        <span className="text-base font-bold leading-none">{new Date(rx.createdAt).getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <button onClick={() => setSelectedRx(rx.prescriptionId)} className="inline-flex items-center gap-1.5 group/rx">
                            <span className="font-mono text-sm font-semibold text-blue-600 group-hover/rx:text-blue-800 group-hover/rx:underline transition">{rx.prescriptionId}</span>
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-blue-400 opacity-0 group-hover/rx:opacity-100 transition">
                              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                            </svg>
                          </button>
                          {rx.channelingNo && <span className="font-mono text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Ch. #{rx.channelingNo}</span>}
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-auto ${rx.pharmacyStatus === "dispensed" ? "bg-green-100 text-green-700" : rx.pharmacyStatus === "cancelled" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {rx.pharmacyStatus}
                          </span>
                        </div>
                        {rx.medications?.length > 0 && <p className="text-xs text-gray-600 mt-1">💊 {rx.medications.map(m => `${m.name} ${m.dosage}`).join(", ")}</p>}
                        {rx.clinicalNotes && <p className="text-xs text-gray-400 mt-1 italic truncate">{rx.clinicalNotes}</p>}
                        {rx.labRequestRef && (
                          <button onClick={() => setSelectedLr(rx.labRequestRef)} className="inline-flex items-center gap-1.5 mt-0.5 group/lr">
                            <span className="text-xs">🧪</span>
                            <span className="text-xs font-mono font-semibold text-purple-600 group-hover/lr:text-purple-800 group-hover/lr:underline transition">{rx.labRequestRef}</span>
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-purple-400 opacity-0 group-hover/lr:opacity-100 transition">
                              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* Lab Results Tab */}
          {tab === "labresults" && (() => {
            const LAB_ST = {
              payment_pending: { label:"Payment Pending", cls:"bg-gray-100 text-gray-600 border-gray-200" },
              pre_check:       { label:"Pre-Check",        cls:"bg-purple-100 text-purple-700 border-purple-200" },
              sample_received: { label:"Sample Received",  cls:"bg-blue-100 text-blue-700 border-blue-200" },
              in_progress:     { label:"In Progress",      cls:"bg-amber-100 text-amber-700 border-amber-200" },
              completed:       { label:"Completed",        cls:"bg-green-100 text-green-700 border-green-200" },
            };
            const DESC = {
              "FBC":             "Full Blood Count — red/white cells, platelets",
              "ESR":             "Erythrocyte Sedimentation Rate — inflammation marker",
              "FBS":             "Fasting Blood Sugar — diabetes & glucose screening",
              "Liver Profile":   "Liver function enzymes and bilirubin panel",
              "Renal Profile":   "Kidney function and electrolytes panel",
              "Thyroid Profile": "TSH, fT3, fT4 thyroid hormone levels",
              "Serum Vit D Level":"Vitamin D concentration in blood",
              "Dengue Ag":       "Dengue NS1 antigen and IgM/IgG antibodies",
            };
            return (
              <div>
                {loadingLab ? (
                  <div className="flex flex-col items-center py-10 gap-3">
                    <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin"/>
                    <p className="text-sm text-gray-400">Loading lab results…</p>
                  </div>
                ) : labResults.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="text-4xl mb-3">🧪</div>
                    <p className="text-gray-500 font-medium">No lab results found</p>
                    <p className="text-xs text-gray-400 mt-1">No lab tests on record for this patient.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {labResults.map(lr => {
                      const stCfg = LAB_ST[lr.status] || LAB_ST.in_progress;
                      const isCompleted = lr.status === "completed";
                      const desc = DESC[lr.testName] || "Laboratory diagnostic test";
                      const isFlagged = lr.results?.parameters?.some(p => ["High","Low","Positive","Reactive"].includes(p.flag));
                      return (
                        <div key={lr._id} className={`p-4 rounded-2xl border transition group ${isCompleted ? "bg-teal-50/30 border-teal-100 hover:border-teal-300" : "bg-gray-50 border-gray-100"}`}>
                          <div className="flex items-start gap-3">
                            {/* date block */}
                            <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0"
                              style={{background:isCompleted?"linear-gradient(135deg,#006064,#00838F)":"linear-gradient(135deg,#37474F,#546E7A)"}}>
                              <span className="text-xs font-bold leading-none">{lr.completedAt?new Date(lr.completedAt).toLocaleDateString("en-GB",{month:"short"}):"—"}</span>
                              <span className="text-sm font-bold leading-none">{lr.completedAt?new Date(lr.completedAt).getDate():"·"}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Row 1 */}
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="font-bold text-sm text-gray-800">🧪 {lr.testName}</span>
                                {isFlagged && <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full border border-red-200">⚠️ Abnormal</span>}
                                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ml-auto ${stCfg.cls}`}>{stCfg.label}</span>
                              </div>
                              {/* Description */}
                              <p className="text-xs text-gray-500 mb-1">{desc}</p>
                              {/* IDs row */}
                              <div className="flex items-center gap-2 flex-wrap text-xs">
                                <span className="font-mono bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md">{lr.testId}</span>
                                {lr.patientId?.userId && <span className="font-mono text-blue-500">{lr.patientId.userId}</span>}
                                {lr.labRequestRef && <span className="font-mono text-purple-500">{lr.labRequestRef}</span>}
                                {lr.appointmentId && <span className="text-gray-400">Appt: <span className="font-mono">{lr.appointmentId}</span></span>}
                              </div>
                              {/* Abnormal flags */}
                              {isFlagged && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {lr.results.parameters.filter(p=>["High","Low","Positive","Reactive"].includes(p.flag)).slice(0,3).map((p,i)=>(
                                    <span key={i} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">{p.name}: {p.value} {p.unit} ({p.flag})</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {isCompleted && (
                              <button onClick={()=>setSelectedLabResult(lr)} className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl hover:bg-teal-100 transition self-center">
                                View →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Vitals */}
          {tab === "vitals" && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Blood Group",    val: pd.bloodGroup || "—",             icon: "🩸" },
                { label: "Age",            val: age ? `${age} yrs` : "—",         icon: "🎂" },
                { label: "Gender",         val: pd.gender || "—",                 icon: "👤" },
                { label: "Emergency Tel",  val: pd.emergencyContactNumber || "—", icon: "📞" },
              ].map(v => (
                <div key={v.label} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{v.icon} {v.label}</div>
                  <div className="text-lg font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>{v.val}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <a href="/doctor/prescriptions" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition hover:opacity-90" style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
              💊 New Prescription
            </a>
            <a href="/doctor/lab-requests" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
              🧪 Request Lab Test
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DoctorPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);

  const fetchPatients = useCallback(async (silent = false) => {
    try {
      const res = await api.get(`/patients${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setPatients(res.data.patients || []);
    } catch { setPatients([]); }
    finally  { setLoading(false); }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => fetchPatients(false), 300);
    return () => clearTimeout(t);
  }, [fetchPatients]);

  // ── Auto-refresh every 60 seconds ────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => fetchPatients(true), 5_000);
    return () => clearInterval(interval);
  }, [fetchPatients]);

  const now = new Date();
  const stats = {
    total:       patients.length,
    conditions:  patients.filter(p => p.patientDetails?.chronicConditions).length,
    allergies:   patients.filter(p => p.patientDetails?.allergies?.length > 0).length,
    newThisMonth: patients.filter(p => { const d = new Date(p.createdAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length,
  };

  return (
  <>
      {selected && <PatientModal patient={selected} onClose={() => setSelected(null)} />}

      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>Patient Records</h1>
          <p className="text-sm text-gray-400 mt-1">All registered patients</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Patients",   value: stats.total,        color: "#1565C0" },
            { label: "With Conditions",  value: stats.conditions,   color: "#E65100" },
            { label: "With Allergies",   value: stats.allergies,    color: "#7B1FA2" },
            { label: "New This Month",   value: stats.newThisMonth, color: "#00897B" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: s.color }}>{loading ? "—" : s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="relative">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input type="text" placeholder="Search by name, patient ID, or phone..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"/>
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
            </button>}
          </div>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4"><div className="w-11 h-11 bg-gray-200 rounded-xl"/><div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-3/4"/><div className="h-3 bg-gray-100 rounded w-1/2"/></div></div>
                <div className="space-y-2"><div className="h-3 bg-gray-100 rounded"/><div className="h-3 bg-gray-100 rounded w-2/3"/></div>
              </div>
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <div className="text-5xl mb-4">👤</div>
            <p className="text-gray-600 font-semibold text-lg">No patients found</p>
            <p className="text-sm text-gray-400 mt-1">{search ? `No results for "${search}"` : "No patients registered yet."}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {patients.map(patient => {
              const pd = patient.patientDetails || {};
              const age = calcAge(pd.birthday);
              return (
                <div key={patient._id} onClick={() => setSelected(patient)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition cursor-pointer overflow-hidden group">
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
                        {patient.photo ? <img src={patient.photo} alt="" className="w-full h-full object-cover"/> : <span className="text-white font-bold text-sm">{getInitials(patient.name)}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 truncate group-hover:text-blue-700 transition">{patient.name}</div>
                        <div className="text-xs text-gray-400">{patient.userId}{age ? ` · Age ${age}` : ""}{pd.gender ? ` · ${pd.gender}` : ""}</div>
                      </div>
                      {pd.bloodGroup && <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded-full flex-shrink-0">{pd.bloodGroup}</span>}
                    </div>
                    {pd.chronicConditions
                      ? <div className="flex flex-wrap gap-1.5 mb-3">{pd.chronicConditions.split(",").map(c => <span key={c} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-100">{c.trim()}</span>)}</div>
                      : <p className="text-xs text-gray-400 mb-3">No active conditions</p>}
                    {pd.allergies?.length > 0 && <div className="flex items-center gap-1.5 mb-3"><span className="text-xs text-amber-600 font-semibold">⚠️</span><span className="text-xs text-amber-700 truncate">{pd.allergies.join(", ")}</span></div>}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Registered: <span className="text-gray-600 font-medium">{fmt(patient.createdAt)}</span></span>
                      <span>{patient.telephone}</span>
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400 truncate">{patient.email}</span>
                    <span className="text-xs font-semibold text-blue-600 group-hover:underline flex-shrink-0 ml-2">View Records →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
  </>
  );
}