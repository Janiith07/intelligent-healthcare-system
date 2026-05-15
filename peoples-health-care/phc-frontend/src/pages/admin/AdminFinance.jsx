import AdminLayout from "../../components/AdminLayout";

const MONTHLY = [
  { month: "Sep", revenue: 284000, expenses: 168000 },
  { month: "Oct", revenue: 312000, expenses: 181000 },
  { month: "Nov", revenue: 298000, expenses: 172000 },
  { month: "Dec", revenue: 275000, expenses: 158000 },
  { month: "Jan", revenue: 341000, expenses: 195000 },
  { month: "Feb", revenue: 389000, expenses: 217000 },
];

const TRANSACTIONS = [
  { id: "INV-2026-0089", patient: "Kamal Perera",      date: "15 Feb 2026", time: "08:45 AM", description: "Consultation + Pharmacy",  amount: 2200,  category: "Consultation", paid: true  },
  { id: "INV-2026-0088", patient: "Sumudu Silva",       date: "15 Feb 2026", time: "09:20 AM", description: "Consultation + Pharmacy",  amount: 1540,  category: "Consultation", paid: true  },
  { id: "INV-2026-0087", patient: "Ruwan Fernando",     date: "15 Feb 2026", time: "10:00 AM", description: "Consultation + Lab Tests", amount: 4800,  category: "Lab",          paid: true  },
  { id: "INV-2026-0086", patient: "Dilani Bandara",     date: "15 Feb 2026", time: "10:30 AM", description: "Consultation + Pharmacy",  amount: 3200,  category: "Consultation", paid: false },
  { id: "INV-2026-0085", patient: "Suresh Jayasinghe", date: "15 Feb 2026", time: "11:00 AM", description: "Consultation only",        amount: 1200,  category: "Consultation", paid: true  },
  { id: "INV-2026-0084", patient: "Nimesha Silva",      date: "15 Feb 2026", time: "11:30 AM", description: "Consultation + Lab + Pharmacy", amount: 5640, category: "Lab",    paid: false },
];

const maxRev = Math.max(...MONTHLY.map(m => m.revenue));

const REVENUE_SPLIT = [
  { label: "Consultations",  value: 189000, pct: 49, color: "#1A237E" },
  { label: "Pharmacy Sales", value: 113000, pct: 29, color: "#1565C0" },
  { label: "Lab Tests",      value:  62000, pct: 16, color: "#00897B" },
  { label: "Other",          value:  25000, pct:  6, color: "#9CA3AF" },
];

export default function AdminFinance() {
  const thisMonth = MONTHLY[MONTHLY.length - 1];
  const profit = thisMonth.revenue - thisMonth.expenses;
  const margin = Math.round((profit / thisMonth.revenue) * 100);

  return (
    <AdminLayout activePage="Finance & Billing">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>Finance & Billing</h1>
          <p className="text-sm text-gray-400 mt-1">Revenue overview · People's Health Care · February 2026</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Feb Revenue",   value: `LKR ${thisMonth.revenue.toLocaleString()}`, sub: "↑ 14% vs Jan",        color: "#1A237E", bg: "#E8EAF6" },
            { label: "Feb Expenses",  value: `LKR ${thisMonth.expenses.toLocaleString()}`, sub: "Operating costs",     color: "#E65100", bg: "#FFF3E0" },
            { label: "Net Profit",    value: `LKR ${profit.toLocaleString()}`,              sub: `${margin}% margin`,   color: "#2E7D32", bg: "#E8F5E9" },
            { label: "Outstanding",   value: "LKR 8,840",                                  sub: "2 unpaid invoices",   color: "#7B1FA2", bg: "#F3E5F5" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-2" style={{ background: c.bg }}>💰</div>
              <div className="font-bold" style={{ fontFamily: "'Playfair Display', serif", color: c.color, fontSize: "1rem" }}>{c.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
              <div className="text-xs text-green-600 font-semibold mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Bar chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-gray-800">Revenue vs Expenses</h3>
                <p className="text-xs text-gray-400 mt-0.5">Last 6 months</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: "#283593" }} /> Revenue</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block bg-gray-200" /> Expenses</span>
              </div>
            </div>
            <div className="flex items-end gap-2 h-36">
              {MONTHLY.map((m, i) => {
                const isLatest = i === MONTHLY.length - 1;
                const revH = Math.round((m.revenue / maxRev) * 120);
                const expH = Math.round((m.expenses / maxRev) * 120);
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-end gap-0.5 w-full justify-center">
                      <div className="flex-1 rounded-t-md" style={{
                        height: `${revH}px`,
                        background: isLatest ? "linear-gradient(180deg,#1A237E,#283593)" : "rgba(26,35,126,0.2)",
                      }} />
                      <div className="flex-1 rounded-t-md bg-gray-200" style={{ height: `${expH}px`, opacity: isLatest ? 1 : 0.5 }} />
                    </div>
                    <span className="text-xs text-gray-400">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue split */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="mb-5">
              <h3 className="font-semibold text-gray-800">Revenue Breakdown</h3>
              <p className="text-xs text-gray-400 mt-0.5">By service category · February 2026</p>
            </div>
            <div className="space-y-3">
              {REVENUE_SPLIT.map(r => (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                      <span className="text-sm text-gray-700">{r.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">LKR {r.value.toLocaleString()}</span>
                      <span className="text-xs font-bold text-gray-700">{r.pct}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-2.5 rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-700">
              💡 Consultations remain the largest revenue driver at <strong>49%</strong>.
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-800">Recent Transactions</h3>
              <p className="text-xs text-gray-400 mt-0.5">Today's invoices — 15 February 2026</p>
            </div>
            <span className="text-xs font-semibold text-indigo-600">
              Total: LKR {TRANSACTIONS.reduce((s, t) => s + t.amount, 0).toLocaleString()}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {TRANSACTIONS.map(t => (
              <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #1A237E, #283593)" }}>
                  {t.patient.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800">{t.patient}</div>
                  <div className="text-xs text-gray-400">{t.description} · {t.id}</div>
                  <div className="text-xs text-gray-400">{t.time}</div>
                </div>
                <div className="text-right flex-shrink-0 mr-4">
                  <div className="text-sm font-bold text-indigo-700">LKR {t.amount.toLocaleString()}</div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.category === "Lab" ? "bg-teal-100 text-teal-700" : "bg-blue-100 text-blue-700"}`}>
                    {t.category}
                  </span>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0 ${t.paid ? "bg-green-100 text-green-700 border-green-200" : "bg-indigo-100 text-indigo-700 border-indigo-200"}`}>
                  {t.paid ? "✅ Paid" : "⏳ Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}