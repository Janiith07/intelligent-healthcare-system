import { useState, useEffect } from "react";
import LabLayout from "../../components/LabLayout";
import api from "../../services/api";

const STATUS_CONFIG = {
  pending:        { bg:"bg-amber-100",  text:"text-amber-700",  border:"border-amber-200",  bar:"#fbbf24", label:"Pending" },
  payment_pending:{ bg:"bg-orange-100", text:"text-orange-700", border:"border-orange-200", bar:"#fb923c", label:"Awaiting Payment" },
  pre_check:      { bg:"bg-purple-100", text:"text-purple-700", border:"border-purple-200", bar:"#a78bfa", label:"Pre Check" },
  sample_received:{ bg:"bg-cyan-100",   text:"text-cyan-700",   border:"border-cyan-200",   bar:"#22d3ee", label:"Sample Received" },
  in_progress:    { bg:"bg-blue-100",   text:"text-blue-700",   border:"border-blue-200",   bar:"#60a5fa", label:"In Progress" },
  completed:      { bg:"bg-green-100",  text:"text-green-700",  border:"border-green-200",  bar:"#4ade80", label:"Completed" },
};

export default function LabDashboard() {
  const [active,      setActive]      = useState([]);
  const [completed,   setCompleted]   = useState([]);
  const [equipAlerts, setEquipAlerts] = useState(0);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [activeRes, doneRes, alertRes] = await Promise.all([
        api.get("/lab-results?status=pending,payment_pending,pre_check,sample_received,in_progress&limit=20"),
        api.get("/lab-results?status=completed&limit=10"),
        api.get("/equipment/alert-count").catch(() => ({ data:{ alertCount:0 } })),
      ]);
      setActive(activeRes.data.results    || []);
      setCompleted(doneRes.data.results   || []);
      setEquipAlerts(alertRes.data.alertCount || 0);
    } catch {}
    finally { setLoading(false); }
  };

  const greet = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  };

  const pendingCount    = active.filter(r => ["pending","payment_pending","pre_check"].includes(r.status)).length;
  const inProgressCount = active.filter(r => r.status === "in_progress").length;
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true}) : "—";

  return (
    <LabLayout activePage="Dashboard">
      <div className="p-6 space-y-6">

        {/* Banner */}
        <div className="rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden"
          style={{ background:"linear-gradient(135deg,#0D2137 0%,#0D47A1 60%,#1565C0 100%)" }}>
          <div className="absolute right-0 top-0 bottom-0 w-48 opacity-10">
            <svg viewBox="0 0 200 200" fill="white"><circle cx="150" cy="100" r="90"/><circle cx="40" cy="40" r="50"/></svg>
          </div>
          <div className="relative">
            <p className="text-white/70 text-sm">{greet()} 👋</p>
            <h2 style={{ fontFamily:"'Playfair Display', serif", fontWeight:700, fontSize:"1.6rem", color:"white" }}>
              Diagnostic Laboratory
            </h2>
            <p className="text-white/60 text-sm mt-1">
              {loading ? "Loading…" : (
                <>
                  <span className="text-yellow-300 font-bold">{pendingCount} test{pendingCount!==1?"s":""} awaiting action</span>
                  {equipAlerts > 0 && <span className="ml-2 text-red-300 font-bold">· {equipAlerts} equipment alert{equipAlerts>1?"s":""}</span>}
                </>
              )}
            </p>
          </div>
          <div className="relative flex gap-3 flex-shrink-0">
            <a href="/lab/requests" className="px-5 py-2.5 bg-white text-blue-900 rounded-xl text-sm font-semibold hover:bg-blue-50 transition shadow">
              🧪 View Requests
            </a>
            <a href="/lab/upload" className="px-5 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition">
              📤 Upload Result
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:"Awaiting Action",  value: loading?"…":pendingCount,                           icon:"⏳", color:"#E65100", bg:"#FFF3E0" },
            { label:"In Progress",      value: loading?"…":inProgressCount,                        icon:"🔬", color:"#1565C0", bg:"#E3F2FD" },
            { label:"Completed Today",  value: loading?"…":completed.length,                       icon:"✅", color:"#2E7D32", bg:"#E8F5E9" },
            { label:"Equipment Alerts", value: loading?"…":equipAlerts, icon:"⚙️",
              color: equipAlerts>0?"#B71C1C":"#0D47A1",
              bg:    equipAlerts>0?"#FFEBEE":"#E3F2FD" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background:c.bg }}>{c.icon}</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontWeight:800, fontSize:"1.8rem", color:c.color }}>{c.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Active requests */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-800">Active Test Requests</h3>
                <p className="text-xs text-gray-400 mt-0.5">Pending · Pre-check · In Progress</p>
              </div>
              <a href="/lab/requests" className="text-sm font-medium text-blue-600 hover:underline">View All</a>
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading…</div>
              ) : active.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">No active requests</div>
              ) : active.slice(0,5).map(r => {
                const s = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                return (
                  <div key={r._id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition">
                    <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background:s.bar }}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-800">{r.patientName||"—"}</span>
                      </div>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r.testName}</span>
                      {r.testId && <span className="text-xs text-gray-400 ml-2 font-mono">{r.testId}</span>}
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border flex-shrink-0 ${s.bg} ${s.text} ${s.border}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Quick actions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 text-sm mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { label:"Upload Test Result",  href:"/lab/upload",    icon:"📤", color:"#0D47A1", bg:"#E3F2FD" },
                  { label:"View All Requests",   href:"/lab/requests",  icon:"🧪", color:"#1565C0", bg:"#E3F2FD" },
                  { label:"All Lab Reports",     href:"/lab/reports",   icon:"📋", color:"#2E7D32", bg:"#E8F5E9" },
                  { label:"Equipment Status",    href:"/lab/equipment", icon:"⚙️", color:"#E65100", bg:"#FFF3E0" },
                ].map(a => (
                  <a key={a.label} href={a.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background:a.bg }}>{a.icon}</div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 flex-1">{a.label}</span>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 group-hover:text-gray-500">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {equipAlerts > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <div className="text-xl flex-shrink-0">⚠️</div>
                <div>
                  <p className="text-sm font-semibold text-red-800">{equipAlerts} Equipment Alert{equipAlerts>1?"s":""}</p>
                  <p className="text-xs text-red-700 mt-1">Machines due for service or consumables running low.</p>
                  <a href="/lab/equipment"
                    className="inline-block mt-2 text-xs font-semibold text-red-900 border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">
                    View Equipment →
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recently completed */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-800">Recently Completed</h3>
              <p className="text-xs text-gray-400 mt-0.5">{loading?"…":completed.length} test{completed.length!==1?"s":""} completed</p>
            </div>
            <a href="/lab/reports" className="text-sm font-medium text-blue-600 hover:underline">All Reports</a>
          </div>
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : completed.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">No completed tests yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {completed.slice(0,5).map(r => (
                <div key={r._id} className="flex items-center gap-5 px-6 py-3.5 hover:bg-gray-50 transition">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background:"linear-gradient(135deg,#0D47A1,#1565C0)" }}>
                    {(r.patientName||"PT").split(" ").map(n=>n[0]).join("").slice(0,2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{r.patientName||"—"}</div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.testName}</span>
                  </div>
                  <div className="text-xs text-gray-400 hidden md:block">{fmtTime(r.completedAt)}</div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-green-100 text-green-700 border-green-200">
                    ✅ Completed
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </LabLayout>
  );
}