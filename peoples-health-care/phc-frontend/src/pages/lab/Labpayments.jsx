import { useState, useEffect, useCallback } from "react";
import LabLayout from "../../components/LabLayout";

const API   = "http://localhost:5001/api";
const token = () => sessionStorage.getItem("token");
const authH = () => ({ Authorization: `Bearer ${token()}` });

export default function LabPayments() {
  const [bills,   setBills]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("today");
  const [expanded, setExpanded] = useState(null);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API}/bills/lab-notified`,              { headers: authH() }),
        fetch(`${API}/lab-request-bills/lab-notified`,  { headers: authH() }),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);

      // Tag source so expanded detail can show correct fields
      const pharmBills = (d1.success ? d1.bills : []).map(b => ({ ...b, _src: "pharm" }));
      const labReqBills = (d2.success ? d2.bills : []).map(b => ({ ...b, _src: "labreq" }));

      // Merge and sort by labNotifiedAt desc
      const merged = [...pharmBills, ...labReqBills].sort(
        (a, b) => new Date(b.labNotifiedAt || b.paidAt) - new Date(a.labNotifiedAt || a.paidAt)
      );
      setBills(merged);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  // filter helpers
  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth()    === now.getMonth()    &&
           d.getDate()     === now.getDate();
  };

  const filtered = bills.filter(b => {
    const matchDate = filter === "all" ? true : isToday(b.paidAt);
    const q = search.toLowerCase();
    const matchSearch = !search || [b.patientName, b.billNumber, b.patientId]
      .some(v => v?.toLowerCase().includes(q));
    return matchDate && matchSearch;
  });

  const todayCount = bills.filter(b => isToday(b.paidAt)).length;
  const totalLabAmount = filtered.reduce((s, b) =>
    s + (b.labLines || []).reduce((ls, l) => ls + l.price, 0), 0);
  const totalTests = filtered.reduce((s, b) => s + (b.labLines || []).length, 0);

  return (
    <LabLayout activePage="Lab Payments">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>
              Lab Payment Notifications
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Patients who have paid for laboratory tests
            </p>
          </div>
          <button onClick={fetchBills}
            className="text-xs font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            🔄 Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "Paid Today",     value: todayCount,                          icon: "📅", color: "#0D47A1", bg: "#E3F2FD" },
            { label: "Total Paid",     value: bills.length,                        icon: "💳", color: "#0D47A1", bg: "#E3F2FD" },
            { label: "Tests Ordered",  value: totalTests,                          icon: "🧪", color: "#4A148C", bg: "#F3E5F5" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background: c.bg }}>
                {c.icon}
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.75rem", color: c.color }}>
                {c.value}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Search & filter bar */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 relative">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input
              type="text"
              placeholder="Search patient name, bill no., or patient ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
          <div className="flex gap-2">
            {[
              { key: "today", label: "📅 Today" },
              { key: "all",   label: "🗓 All Time" },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  filter === f.key
                    ? "text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={filter === f.key ? { background: "linear-gradient(135deg, #0D47A1, #1565C0)" } : {}}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bill list */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
            <div className="text-4xl mb-3 animate-pulse">💳</div>
            <p className="text-sm text-gray-400">Loading payment records…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
            <div className="text-4xl mb-3">🧪</div>
            <p className="text-gray-500 font-medium">No paid lab bills found</p>
            <p className="text-xs text-gray-400 mt-1">
              {filter === "today" ? "No lab payments received today." : "No paid lab bills match your search."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((bill) => {
              const isOpen = expanded === bill._id;
              const labAmt = (bill.labLines || []).reduce((s, l) => s + l.price, 0);
              return (
                <div key={bill._id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden">

                  {/* Paid badge strip */}
                  <div className="flex items-center gap-2 px-5 py-2 bg-blue-50 border-b border-blue-100">
                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    <span className="text-xs font-bold text-blue-700">Payment Confirmed</span>
                    <span className="text-xs text-blue-600 ml-auto">
                      {bill.paidAt ? new Date(bill.paidAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #0D47A1, #1565C0)" }}>
                      {bill.patientName?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-gray-800">{bill.patientName}</span>
                        {bill.patientId && (
                          <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{bill.patientId}</span>
                        )}
                        {bill.channelingNo && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Ch. #{bill.channelingNo}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{bill.billNumber} · Dr. {bill.doctorName}</div>

                      {/* Lab tests inline */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(bill.labLines || []).map((lab, j) => (
                          <span key={j} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                            🧪 {lab.testName}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Lab amount */}
                    <div className="text-right flex-shrink-0 mr-3">
                      <div className="text-base font-bold" style={{ color: "#0D47A1" }}>
                        LKR {labAmt.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {(bill.labLines || []).length} test{(bill.labLines || []).length !== 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpanded(isOpen ? null : bill._id)}
                      className="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 transition text-gray-400">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Lab Tests Ordered</p>
                      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-blue-50">
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-blue-700">Test Name</th>
                              <th className="px-4 py-2.5 text-right text-xs font-semibold text-blue-700">Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {(bill.labLines || []).map((lab, j) => (
                              <tr key={j}>
                                <td className="px-4 py-3 font-medium text-gray-800">🧪 {lab.testName}</td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-700">LKR {lab.price.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-gray-200 bg-blue-50">
                              <td className="px-4 py-2.5 text-xs font-bold text-blue-800">Lab Total</td>
                              <td className="px-4 py-2.5 text-right font-bold text-blue-800">LKR {labAmt.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                        {bill._src === "labreq"
                          ? <div><span className="font-semibold text-gray-700">Lab Request:</span> {bill.labRequestId}</div>
                          : <div><span className="font-semibold text-gray-700">Prescription Ref:</span> {bill.prescriptionRef}</div>
                        }
                        <div><span className="font-semibold text-gray-700">Bill No.:</span> {bill.billNumber}</div>
                        <div><span className="font-semibold text-gray-700">Doctor:</span> Dr. {bill.doctorName}</div>
                        <div><span className="font-semibold text-gray-700">Paid At:</span> {bill.paidAt ? new Date(bill.paidAt).toLocaleString() : "—"}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary footer */}
        {filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Showing <strong>{filtered.length}</strong> paid lab bill{filtered.length !== 1 ? "s" : ""}
              {filter === "today" ? " from today" : " in total"}
            </span>
            <span className="text-sm font-bold" style={{ color: "#0D47A1" }}>
              Total Lab Revenue: LKR {totalLabAmount.toLocaleString()}
            </span>
          </div>
        )}

      </div>
    </LabLayout>
  );
}