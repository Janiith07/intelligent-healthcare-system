import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import api from "../../services/api";

const PORTAL_ACTIVITY = [
  { portal: "Doctor Portal",   active: 1, total: 1,  icon: "👨‍⚕️", color: "#1565C0", bg: "#E3F2FD" },
  { portal: "Patient Portal",  active: 6, total: 62, icon: "👤",  color: "#00897B", bg: "#E0F2F1" },
  { portal: "Lab Portal",      active: 1, total: 1,  icon: "🧪",  color: "#006064", bg: "#E0F2F1" },
  { portal: "Pharmacy Portal", active: 1, total: 1,  icon: "💊",  color: "#2E7D32", bg: "#E8F5E9" },
];

const RECENT_ACTIVITY = [
  { time: "09:45 AM", action: "New appointment booked",   actor: "Kamal Perera",    type: "appointment", icon: "📅" },
  { time: "09:38 AM", action: "Lab result uploaded",      actor: "Lab Technician",  type: "lab",         icon: "🧪" },
  { time: "09:22 AM", action: "Prescription dispensed",   actor: "Pharmacy Staff",  type: "pharmacy",    icon: "💊" },
  { time: "09:10 AM", action: "New patient registered",   actor: "Nimesha Silva",   type: "patient",     icon: "👤" },
  { time: "08:55 AM", action: "Consultation completed",   actor: "Dr. Jayaweera",   type: "doctor",      icon: "👨‍⚕️" },
  { time: "08:40 AM", action: "Invoice generated",        actor: "Billing System",  type: "billing",     icon: "💰" },
];

const REVENUE_MONTHS = [
  { month: "Sep", revenue: 284000 }, { month: "Oct", revenue: 312000 },
  { month: "Nov", revenue: 298000 }, { month: "Dec", revenue: 275000 },
  { month: "Jan", revenue: 341000 }, { month: "Feb", revenue: 389000 },
];
const maxRev = Math.max(...REVENUE_MONTHS.map(m => m.revenue));

const STAFF = [
  { name: "Dr. M.T.D. Jayaweera", role: "Chief Physician",  dept: "Consultation", status: "Active", avatar: "DJ" },
  { name: "Lab Technician",        role: "Lab Staff",         dept: "Laboratory",   status: "Active", avatar: "LT" },
  { name: "Pharmacist",            role: "Pharmacy Staff",    dept: "Pharmacy",     status: "Active", avatar: "PH" },
];

// ── REQ-7: Live Equipment Summary Widget ──────────────────────
function EquipmentSummary() {
  const [stats,    setStats]    = useState(null);
  const [flagged,  setFlagged]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, eqRes] = await Promise.all([
          api.get("/equipment/stats"),
          api.get("/equipment", { params: { status: "Needs Attention" } })
        ]);
        setStats(sRes.data.data || {});
        setFlagged(eqRes.data.data || []);
      } catch {
        // silently fail on dashboard — non-critical widget
      } finally {
        setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-center min-h-[140px]">
        <div className="w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"/>
      </div>
    );
  }

  if (!stats) return null;

  const statTiles = [
    { label: "Total",            value: stats.total||0,              color:"#1A237E", bg:"#E8EAF6" },
    { label: "Available",        value: stats.available||0,          color:"#2E7D32", bg:"#E8F5E9" },
    { label: "In Use",           value: stats.inUse||0,              color:"#1565C0", bg:"#E3F2FD" },
    { label: "Needs Attention",  value: stats.needsAttention||0,     color:"#E65100", bg:"#FFF3E0" },
    { label: "Under Maint.",     value: stats.underMaintenance||0,   color:"#B45309", bg:"#FEF3C7" },
    { label: "Replace Alerts",   value: stats.replacementAlerts||0,  color:"#C62828", bg:"#FFEBEE" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-800">⚙️ Equipment Status</h3>
          <p className="text-xs text-gray-400 mt-0.5">Live overview — auto-refreshes every 30 s</p>
        </div>
        <a href="/admin/equipment"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition">
          Manage Equipment →
        </a>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3 p-4">
        {statTiles.map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{background:s.bg}}>
            <div className="text-xl font-bold" style={{fontFamily:"'Playfair Display',serif",color:s.color}}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{color:s.color,opacity:0.8}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Flagged items */}
      {flagged.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-bold text-amber-800 mb-2">⚠️ Needs Attention ({flagged.length})</p>
            <div className="space-y-1.5">
              {flagged.slice(0,3).map(e => (
                <div key={e._id} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-900 truncate">{e.name}</span>
                  <span className="text-amber-600 font-mono ml-2 flex-shrink-0">{e.equipment_id}</span>
                </div>
              ))}
              {flagged.length > 3 && (
                <p className="text-xs text-amber-600">+{flagged.length-3} more…</p>
              )}
            </div>
          </div>
        </div>
      )}

      {flagged.length === 0 && (stats.underMaintenance||0) === 0 && (
        <div className="px-4 pb-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <span className="text-emerald-600 font-bold">✅</span>
            <span className="text-xs font-semibold text-emerald-700">All equipment in good condition</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AdminLayout activePage="Dashboard">
      <div className="p-6 space-y-6">

        {/* Welcome banner */}
        <div className="rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0D2137 0%, #1A237E 60%, #283593 100%)" }}>
          <div className="absolute right-0 top-0 bottom-0 w-48 opacity-10">
            <svg viewBox="0 0 200 200" fill="white"><circle cx="150" cy="100" r="90"/><circle cx="40" cy="40" r="50"/></svg>
          </div>
          <div className="relative">
            <p className="text-white/70 text-sm">Good Morning 👋</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.6rem", color: "white" }}>
              People's Health Care
            </h2>
            <p className="text-white/60 text-sm mt-1">
              <span className="text-indigo-200 font-bold">System running normally</span> · 15 Feb 2026
            </p>
          </div>
          <div className="relative flex gap-3 flex-shrink-0">
            <a href="/admin/staff" className="px-5 py-2.5 bg-white text-indigo-900 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition shadow">
              👥 Manage Staff
            </a>
            <a href="/admin/finance" className="px-5 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition">
              📊 View Reports
            </a>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Patients",       value: 62,           sub: "+8 this month",       icon: "👥", color: "#1565C0", bg: "#E3F2FD", up: true  },
            { label: "Consultations Today",  value: 19,           sub: "84 this month",        icon: "📋", color: "#00897B", bg: "#E0F2F1", up: true  },
            { label: "Today's Revenue",      value: "LKR 48,200", sub: "+12% vs yesterday",   icon: "💰", color: "#1A237E", bg: "#E8EAF6", up: true  },
            { label: "Active Staff",         value: STAFF.length, sub: "All departments",      icon: "👤", color: "#7B1FA2", bg: "#F3E5F5", up: false },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: card.bg }}>
                  {card.icon}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${card.up ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {card.sub}
                </span>
              </div>
              <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: card.color }}>{card.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Main grid: revenue + portal/quick-actions */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-gray-800">Monthly Revenue</h3>
                <p className="text-xs text-gray-400 mt-0.5">Last 6 months · People's Health Care</p>
              </div>
              <span className="text-xs bg-green-100 text-green-700 font-semibold px-3 py-1 rounded-full">↑ 14% this month</span>
            </div>
            <div className="flex items-end gap-3 h-36">
              {REVENUE_MONTHS.map((m, i) => {
                const isLatest = i === REVENUE_MONTHS.length - 1;
                const pct = Math.round((m.revenue / maxRev) * 100);
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className={`text-xs font-semibold ${isLatest ? "text-gray-800" : "text-gray-400"}`}>
                      {Math.round(m.revenue / 1000)}k
                    </span>
                    <div className="w-full rounded-t-xl transition-all" style={{
                      height: `${Math.max(pct * 0.9, 8)}px`,
                      background: isLatest
                        ? "linear-gradient(180deg, #1A237E, #283593)"
                        : "rgba(26,35,126,0.2)",
                    }} />
                    <span className="text-xs text-gray-400">{m.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Feb Revenue", val: "LKR 389,000" },
                { label: "Avg/Month",   val: "LKR 316,500" },
                { label: "YTD Revenue", val: "LKR 1,899,000" },
              ].map(s => (
                <div key={s.label} className="p-3 bg-gray-50 rounded-xl text-center">
                  <div className="text-sm font-bold text-indigo-700">{s.val}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Portal + Quick actions */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 text-sm mb-4">Portal Activity</h3>
              <div className="space-y-3">
                {PORTAL_ACTIVITY.map(p => (
                  <div key={p.portal} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: p.bg }}>
                      {p.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">{p.portal}</div>
                      <div className="text-xs text-gray-400">{p.active} active session{p.active > 1 ? "s" : ""}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-xs text-green-600 font-semibold">Online</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 text-sm mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { label: "Add Staff Member",       href: "/admin/staff",      icon: "➕", color: "#1A237E", bg: "#E8EAF6" },
                  { label: "View All Appointments",  href: "/admin/appointments",icon: "📅", color: "#1565C0", bg: "#E3F2FD" },
                  { label: "Finance Reports",        href: "/admin/finance",     icon: "📊", color: "#00897B", bg: "#E0F2F1" },
                  { label: "Equipment Management",   href: "/admin/equipment",   icon: "⚙️", color: "#B45309", bg: "#FEF3C7" },
                  { label: "System Settings",        href: "/admin/settings",    icon: "🔧", color: "#37474F", bg: "#ECEFF1" },
                ].map(a => (
                  <a key={a.label} href={a.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: a.bg }}>{a.icon}</div>
                    <span className="text-sm font-medium text-gray-700 flex-1">{a.label}</span>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 group-hover:text-gray-500">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* REQ-7: Equipment widget + Staff + Activity */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Equipment summary — REQ-7 */}
          <EquipmentSummary />

          {/* Staff summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Staff Overview</h3>
              <a href="/admin/staff" className="text-sm font-medium text-indigo-600 hover:underline">Manage →</a>
            </div>
            <div className="divide-y divide-gray-50">
              {STAFF.map(s => (
                <div key={s.name} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1A237E, #283593)" }}>
                    {s.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.role} · {s.dept}</div>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full border border-green-200 flex-shrink-0">
                    ● Active
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Recent Activity</h3>
              <span className="text-xs text-gray-400">Today</span>
            </div>
            <div className="divide-y divide-gray-50">
              {RECENT_ACTIVITY.map((a, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">{a.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700">{a.action}</div>
                    <div className="text-xs text-gray-400">{a.actor}</div>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">{a.time}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}
