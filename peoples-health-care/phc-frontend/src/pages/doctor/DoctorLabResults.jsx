import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../services/api";

// ─── PDF Generator ─────────────────────────────────────────────────────────
function generatePDF(result) {
  const patientName = result.patientName || result.patientId?.name || "Patient";
  const { testName, results, testId, completedAt } = result;
  const date = completedAt
    ? new Date(completedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : "—";
  const rows = results?.parameters?.map((p) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E0F2F1;font-size:13px;color:#1a1a2e;">${p.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E0F2F1;font-weight:700;font-size:13px;color:${p.flag==="High"||p.flag==="Low"||p.flag==="Positive"||p.flag==="Reactive"?"#B71C1C":"#00695C"};">
        ${p.value||"—"} ${p.unit||""}
        ${p.flag&&p.flag!=="Normal"&&p.flag!==""?`<span style="font-size:11px;color:#B71C1C;"> (${p.flag})</span>`:""}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #E0F2F1;font-size:12px;color:#888;">${p.ref||""}</td>
    </tr>`).join("") || "";
  const findings = results?.checkboxFindings?.filter(f=>f.checked).map(f=>`<li style="margin:4px 0;font-size:13px;">${f.label}</li>`).join("")||"";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{font-family:'Segoe UI',sans-serif;margin:0;padding:0;background:#fff;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><div style="max-width:720px;margin:0 auto;padding:40px;"><div style="background:linear-gradient(135deg,#0D2137,#006064);color:#fff;padding:28px 32px;border-radius:12px 12px 0 0;"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div><div style="font-size:22px;font-weight:700;font-family:Georgia,serif;">People's Health Care</div><div style="font-size:12px;opacity:0.7;margin-top:4px;">Laboratory Services · Certified Medical Laboratory</div></div><div style="text-align:right;"><div style="font-size:11px;opacity:0.7;">Report ID</div><div style="font-size:16px;font-weight:700;font-family:monospace;">${testId}</div><div style="font-size:11px;opacity:0.7;margin-top:4px;">${date}</div></div></div></div><div style="background:#E0F2F1;padding:16px 32px;display:flex;justify-content:space-between;border-bottom:2px solid #006064;"><div><div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Patient</div><div style="font-size:17px;font-weight:700;color:#0D2137;">${patientName}</div></div><div style="text-align:right;"><div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Test</div><div style="font-size:17px;font-weight:700;color:#006064;">${testName}</div></div></div><div style="margin-top:24px;"><div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#006064;margin-bottom:12px;">Test Parameters</div><table style="width:100%;border-collapse:collapse;border:1px solid #E0F2F1;border-radius:8px;overflow:hidden;"><thead><tr style="background:#F0FAF9;"><th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#00695C;letter-spacing:1px;">Parameter</th><th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#00695C;letter-spacing:1px;">Result</th><th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#00695C;letter-spacing:1px;">Reference Range</th></tr></thead><tbody>${rows||'<tr><td colspan="3" style="padding:16px;text-align:center;color:#aaa;">No parameters recorded</td></tr>'}</tbody></table></div>${findings?`<div style="margin-top:24px;"><div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#006064;margin-bottom:12px;">Clinical Findings</div><ul style="margin:0;padding:16px 16px 16px 36px;background:#F9FFFE;border:1px solid #E0F2F1;border-radius:8px;">${findings}</ul></div>`:""}${results?.labNotes?`<div style="margin-top:24px;"><div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#006064;margin-bottom:12px;">Lab Notes</div><div style="background:#FFFDE7;border:1px solid #FFF9C4;border-radius:8px;padding:16px;font-size:13px;color:#555;line-height:1.6;">${results.labNotes}</div></div>`:""}<div style="margin-top:40px;padding-top:20px;border-top:1px solid #E0E0E0;display:flex;justify-content:space-between;font-size:11px;color:#aaa;"><div>Performed by: <strong style="color:#555;">${results?.performedBy||"Lab Staff"}</strong></div><div>This report is confidential and intended only for the patient and requesting physician.</div></div></div></body></html>`;
  const win = window.open("","_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(()=>win.print(),500);
}

const STATUS_CONFIG = {
  payment_pending: { label:"Payment Pending", color:"bg-gray-100 text-gray-600 border-gray-200",    dot:"bg-gray-400",   icon:"💳" },
  pre_check:       { label:"Pre-Check",        color:"bg-purple-100 text-purple-700 border-purple-200", dot:"bg-purple-500", icon:"📋" },
  sample_received: { label:"Sample Received",  color:"bg-blue-100 text-blue-700 border-blue-200",    dot:"bg-blue-500",   icon:"🧫" },
  in_progress:     { label:"In Progress",      color:"bg-amber-100 text-amber-700 border-amber-200", dot:"bg-amber-500",  icon:"⚗️" },
  completed:       { label:"Completed",        color:"bg-green-100 text-green-700 border-green-200", dot:"bg-green-500",  icon:"✅" },
};

function ResultModal({ result, onClose, navigate }) {
  if (!result) return null;
  const isFlagged = result.results?.parameters?.some(p=>["High","Low","Positive","Reactive"].includes(p.flag));
  const fmt = iso => iso ? new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
  const statusCfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.completed;
  const flagColors = { High:"bg-red-100 text-red-600", Low:"bg-blue-100 text-blue-600", Positive:"bg-red-100 text-red-600", Reactive:"bg-orange-100 text-orange-600", Normal:"bg-green-100 text-green-600", Negative:"bg-green-100 text-green-600" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 rounded-t-3xl" style={{background:"linear-gradient(135deg,#0D2137,#006064)"}}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Lab Result Report</p>
              <h3 className="text-white font-bold text-xl" style={{fontFamily:"'Playfair Display',serif"}}>{result.testName}</h3>
              <p className="text-white/60 text-xs mt-1 font-mono">{result.testId}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {/* Patient strip */}
          <div className="bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {( result.patientName || result.patientId?.name || "" ).split(" ").map(n=>n[0]).join("").slice(0,2)||"PT"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm">{result.patientName || result.patientId?.name || "—"}</div>
              <div className="text-white/60 text-xs font-mono mt-0.5">{result.patientId || "—"}</div>
            </div>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${statusCfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}/>{statusCfg.label}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Key info row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {label:"Appointment", value:result.appointmentId||"—", mono:true},
              {label:"Completed",   value:fmt(result.completedAt)},
            ].map(item=>(
              <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                <div className={`text-sm font-semibold text-gray-700 ${item.mono?"font-mono":""}`}>{item.value}</div>
              </div>
            ))}
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
              <div className="text-xs text-purple-400 mb-0.5">Lab Request</div>
              {result.labRequestRef ? (
                <button
                  onClick={()=>{onClose();navigate(`/doctor/lab-requests?open=${result.labRequestRef}`);}}
                  className="text-sm font-semibold font-mono text-purple-700 hover:text-purple-900 hover:underline transition text-left flex items-center gap-1"
                >
                  {result.labRequestRef}
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path fillRule="evenodd" d="M6.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L8.586 9H2a1 1 0 110-2h6.586L6.293 4.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                </button>
              ) : <div className="text-sm font-semibold text-gray-400">—</div>}
            </div>
          </div>

          {/* Abnormal banner */}
          {isFlagged && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <span className="text-xl">⚠️</span>
              <div>
                <div className="text-sm font-bold text-red-700">Abnormal Values Detected</div>
                <div className="text-xs text-red-500 mt-0.5">
                  {result.results?.parameters?.filter(p=>["High","Low","Positive","Reactive"].includes(p.flag)).map(p=>`${p.name} (${p.flag})`).join(" · ")}
                </div>
              </div>
            </div>
          )}

          {/* Pre-test conditions */}
          {result.preTestConditions?.checkboxes?.filter(c=>c.checked).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pre-Test Verification</p>
              <div className="bg-purple-50 rounded-xl p-3 border border-purple-100 text-xs text-purple-800 space-y-1">
                {result.preTestConditions.checkboxes.filter(c=>c.checked).map((c,i)=>(
                  <div key={i} className="flex items-center gap-2"><span className="text-purple-500">✓</span>{c.label}</div>
                ))}
                {result.preTestConditions.shortAnswers?.filter(q=>q.answer).map((q,i)=>(
                  <div key={i} className="mt-1 pt-1 border-t border-purple-200">
                    <span className="font-semibold">{q.question}</span>
                    <span className="text-purple-700 ml-1">→ {q.answer}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinical findings */}
          {result.results?.checkboxFindings?.some(f=>f.checked) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clinical Findings</p>
              <div className="space-y-1.5">
                {result.results.checkboxFindings.filter(f=>f.checked).map((f,i)=>(
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="text-teal-500 mt-0.5">✓</span>{f.label}</div>
                ))}
              </div>
            </div>
          )}

          {/* Parameters table */}
          {result.results?.parameters?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Test Parameters</p>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Parameter</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Result</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Reference</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {result.results.parameters.map((p,i)=>{
                      const abn = ["High","Low","Positive","Reactive"].includes(p.flag);
                      return (
                        <tr key={i} className={abn?"bg-red-50":""}>
                          <td className="px-4 py-3 text-gray-700 text-xs font-medium">{p.name}</td>
                          <td className="px-4 py-3"><span className={`font-semibold text-sm ${abn?"text-red-600":"text-gray-800"}`}>{p.value||"—"} {p.unit}</span></td>
                          <td className="px-4 py-3 text-xs text-gray-400">{p.ref}</td>
                          <td className="px-4 py-3">{p.flag&&<span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${flagColors[p.flag]||"bg-gray-100 text-gray-600"}`}>{p.flag}</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.results?.labNotes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lab Notes</p>
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">{result.results.labNotes}</div>
            </div>
          )}

          {/* Timeline */}
          <div className="grid grid-cols-3 gap-3 text-xs text-center">
            {[
              {label:"Sample Received", value:fmt(result.sampleReceivedAt)},
              {label:"Test Started",    value:fmt(result.testStartedAt)},
              {label:"Completed",       value:fmt(result.completedAt)},
            ].map(item=>(
              <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-gray-400">{item.label}</div>
                <div className="font-semibold text-gray-700 mt-0.5">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            {result.status==="completed" && (
              <button onClick={()=>generatePDF(result)} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold" style={{background:"linear-gradient(135deg,#006064,#00838F)"}}>
                📥 Download PDF Report
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DoctorLabResults() {
  const location = useLocation();
  const navigate  = useNavigate();

  const [results,        setResults]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [search,         setSearch]         = useState("");
  const [testFilter,     setTestFilter]     = useState("All");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [openTarget,     setOpenTarget]     = useState(null);

  const TEST_NAMES = ["All","FBC","ESR","FBS","Liver Profile","Renal Profile","Thyroid Profile","Serum Vit D Level","Dengue Ag"];

  // Read ?open=TR-xxxx: clean URL, store target, switch to "all" status
  useEffect(()=>{
    const params = new URLSearchParams(location.search);
    const openId = params.get("open");
    if (!openId) return;
    navigate("/doctor/lab-results",{replace:true});
    setOpenTarget(openId);
    setStatusFilter("all");
  },[location.search,navigate]);

  // Once results load, auto-open the matching result modal (same pattern as Prescriptions/LabRequests)
  useEffect(()=>{
    if (!openTarget || loading || results.length === 0) return;
    const match = results.find(r => r.testId === openTarget);
    if (!match) return;
    setSelectedResult(match);
    setOpenTarget(null);
  },[openTarget, loading, results]);

  useEffect(()=>{ fetchResults(); },[statusFilter]);

  // ── Auto-refresh every 30 seconds ────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => fetchResults(true), 5_000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const fetchResults = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const query = statusFilter==="all" ? "" : `?status=${statusFilter}`;
      const res = await api.get(`/lab-results${query}`);
      setResults(res.data.results||[]);
    } catch { setError("Failed to load lab results."); }
    finally { if (!silent) setLoading(false); }
  };

  const isFlagged = r => r.results?.parameters?.some(p=>["High","Low","Positive","Reactive"].includes(p.flag));

  const filtered = results.filter(r=>{
    const s = search.toLowerCase();
    const matchSearch =
      ( r.patientName || r.patientId?.name || "" ).toLowerCase().includes(s) ||
      r.testId?.toLowerCase().includes(s) ||
      (typeof r.patientId === "string" && r.patientId.toLowerCase().includes(s)) ||
      r.appointmentId?.toLowerCase().includes(s);
    const matchTest = testFilter==="All" || r.testName===testFilter;
    return matchSearch && matchTest;
  });

  const fmt = iso => iso ? new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
  const flaggedCount   = results.filter(isFlagged).length;
  const completedCount = results.filter(r=>r.status==="completed").length;
  const pendingCount   = results.filter(r=>r.status!=="completed").length;

  return (
  <>
      {selectedResult && <ResultModal result={selectedResult} onClose={()=>setSelectedResult(null)} navigate={navigate}/>}

      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{fontFamily:"'Playfair Display',serif"}}>Lab Results</h1>
            <p className="text-sm text-gray-400 mt-1">All lab test results for your patients</p>
          </div>
          {flaggedCount>0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 flex items-center gap-2">
              <span className="text-lg">🚨</span>
              <div><div className="text-xs font-bold text-red-700">{flaggedCount} Abnormal</div><div className="text-xs text-red-500">Require review</div></div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {label:"Total",       value:results.length,  color:"#006064", icon:"🧪"},
            {label:"Completed",   value:completedCount,  color:"#00897B", icon:"✅"},
            {label:"In Progress", value:pendingCount,    color:"#E65100", icon:"⚗️"},
            {label:"Abnormal",    value:flaggedCount,    color:"#B71C1C", icon:"⚠️"},
          ].map(s=>(
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="text-2xl">{s.icon}</div>
              <div>
                <div className="text-2xl font-bold" style={{fontFamily:"'Playfair Display',serif",color:s.color}}>{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-52 relative">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input type="text" placeholder="Search by patient name, patient ID, or test ID…" value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[["all","All"],["completed","Completed"],["in_progress","In Progress"],["pre_check","Pre-Check"],["sample_received","Sample Received"]].map(([val,label])=>(
              <button key={val} onClick={()=>setStatusFilter(val)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition border ${statusFilter===val?"text-white border-transparent shadow-md":"bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}
                style={statusFilter===val?{background:"linear-gradient(135deg,#006064,#00838F)"}:{}}>
                {label}
              </button>
            ))}
          </div>
          <select value={testFilter} onChange={e=>setTestFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
            {TEST_NAMES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"/>
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-2xl border border-red-100 p-8 text-center text-red-600">{error}</div>
        ) : filtered.length===0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">🧪</div>
            <div className="text-gray-500 font-medium">No results found</div>
            <div className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(result=>{
              const flagged   = isFlagged(result);
              const statusCfg = STATUS_CONFIG[result.status]||STATUS_CONFIG.completed;
              const isCompleted = result.status==="completed";
              return (
                <div key={result._id}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer group ${flagged?"border-red-200 hover:border-red-300":"border-gray-100 hover:border-teal-200"}`}
                  onClick={()=>setSelectedResult(result)}>

                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{background:flagged?"linear-gradient(135deg,#B71C1C,#E53935)":isCompleted?"linear-gradient(135deg,#006064,#00838F)":"linear-gradient(135deg,#37474F,#546E7A)"}}>
                      {( result.patientName || result.patientId?.name || "" ).split(" ").map(n=>n[0]).join("").slice(0,2)||"PT"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Row 1: name + test */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm text-gray-800">{result.patientName || result.patientId?.name || "Unknown Patient"}</span>
                        <span className="text-xs bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-full font-medium">🧪 {result.testName}</span>
                        {flagged && <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full border border-red-200">⚠️ Abnormal</span>}
                      </div>
                      {/* Row 2: IDs */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{result.testId}</span>
                        {result.patientId && typeof result.patientId === "string" && <span className="text-xs font-mono text-blue-500">{result.patientId}</span>}
                        {result.appointmentId && <span className="text-xs text-gray-400">Appt: <span className="font-mono">{result.appointmentId}</span></span>}
                        <span className="text-xs text-gray-400">{isCompleted?`Completed: ${fmt(result.completedAt)}`:`Updated: ${fmt(result.updatedAt||result.createdAt)}`}</span>
                      </div>
                    </div>

                    {/* Param preview desktop */}
                    {isCompleted && (
                      <div className="hidden xl:flex flex-wrap gap-1.5 max-w-xs">
                        {result.results?.parameters?.slice(0,2).map((p,i)=>{
                          const abn=["High","Low","Positive","Reactive"].includes(p.flag);
                          return <div key={i} className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${abn?"bg-red-50 text-red-600 border-red-200":"bg-teal-50 text-teal-700 border-teal-100"}`}>{p.name}: {p.value} {p.unit}{abn&&" ↑"}</div>;
                        })}
                      </div>
                    )}

                    {/* Status + arrow */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${statusCfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}/>{statusCfg.label}
                      </span>
                      <span className="text-xs text-gray-400 group-hover:text-teal-600 transition">View Details →</span>
                    </div>
                  </div>

                  {/* Abnormal strip */}
                  {flagged && isCompleted && (
                    <div className="border-t border-red-100 px-5 py-2 bg-red-50 flex flex-wrap gap-3">
                      {result.results?.parameters?.filter(p=>["High","Low","Positive","Reactive"].includes(p.flag)).map((p,i)=>(
                        <span key={i} className="text-xs text-red-600 font-medium">{p.name}: <strong>{p.value} {p.unit}</strong> ({p.flag})</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
  </>
  );
}