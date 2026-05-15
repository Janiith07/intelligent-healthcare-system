import { useState, useEffect, useCallback } from "react";
import CashierLayout from "../../components/CashierLayout";

const API   = "http://localhost:5001/api";
const token = () => sessionStorage.getItem("token");
const authH = () => ({ Authorization: `Bearer ${token()}` });
const jsonH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

// ── Toast ────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-2xl text-white text-sm font-medium shadow-2xl
      ${type === "success" ? "bg-emerald-600" : "bg-red-500"}`}
      style={{ animation: "slideIn .3s ease" }}>
      {type === "success" ? "✅" : "❌"} {msg}
    </div>
  );
}

// ── Report Detail Modal ─────────────────────────────────────────
function ReportModal({ report, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 sticky top-0 z-10 rounded-t-3xl flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0D2137, #01579B)" }}>
          <div>
            <p className="text-white/60 text-xs">Billing Turnover Report</p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display',serif" }}>
              {report.reportNumber}
            </h3>
            <p className="text-white/60 text-xs mt-0.5">
              {report.reportDate} · Submitted {new Date(report.createdAt).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Total Collected",  value: `LKR ${(report.totalCollected  || 0).toLocaleString()}`, color: "#01579B", bg: "#E3F2FD" },
              { label: "Outstanding",      value: `LKR ${(report.totalOutstanding|| 0).toLocaleString()}`, color: "#B71C1C", bg: "#FFEBEE" },
              { label: "Total Bills",      value: report.totalBills,                                        color: "#37474F", bg: "#ECEFF1" },
              { label: "Paid Bills",       value: report.paidBills,                                         color: "#01579B", bg: "#E3F2FD" },
              { label: "Unpaid Bills",     value: report.unpaidBills,                                       color: "#B71C1C", bg: "#FFEBEE" },
            ].map(c => (
              <div key={c.label} className="rounded-2xl p-4 border border-gray-100" style={{ background: c.bg }}>
                <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                <div className="font-bold text-base" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Cashier note */}
          {report.note && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Cashier Note</p>
              <p className="text-sm text-amber-900">{report.note}</p>
            </div>
          )}

          {/* Bill snapshot */}
          {(report.billSnapshot || []).length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Bill Snapshot ({report.billSnapshot.length})
              </p>
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Bill No.</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Patient</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400">Amount</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {report.billSnapshot.map((b, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{b.billNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{b.patientName}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">
                          LKR {(b.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            b.paymentStatus === "paid"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {b.paymentStatus === "paid" ? "✅ Paid" : "⏳ Unpaid"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

// ── Send Report Modal ───────────────────────────────────────────
function SendReportModal({ preview, onClose, onSent }) {
  const [note,    setNote]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleSend = async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API}/turnover-reports`, {
        method:  "POST",
        headers: jsonH(),
        body:    JSON.stringify({ note, reportDate: preview.reportDate }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      onSent(data.report);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-5 sticky top-0 z-10 rounded-t-3xl"
          style={{ background: "linear-gradient(135deg, #0D2137, #01579B)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-xs">Send to Admin</p>
              <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display',serif" }}>
                Daily Turnover Report
              </h3>
              <p className="text-white/60 text-xs mt-0.5">{preview.reportDate}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">❌ {error}</div>
          )}

          {/* Key figures */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Collected", value: `LKR ${preview.totalCollected.toLocaleString()}`,   color: "#01579B", bg: "#E3F2FD" },
              { label: "Outstanding",     value: `LKR ${preview.totalOutstanding.toLocaleString()}`, color: "#B71C1C", bg: "#FFEBEE" },
              { label: "Bills Today",     value: preview.paidBills,                                  color: "#1565C0", bg: "#E3F2FD" },
              { label: "Unpaid Bills",    value: preview.unpaidBills,                                 color: "#E65100", bg: "#FFF3E0" },
            ].map(c => (
              <div key={c.label} className="rounded-2xl p-4 border border-gray-100" style={{ background: c.bg }}>
                <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                <div className="font-bold text-base" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Bills summary table */}
          {preview.bills.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Bills Included ({preview.bills.length})
              </p>
              <div className="rounded-2xl border border-gray-100 overflow-hidden max-h-52 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left text-gray-400 font-semibold">Bill</th>
                      <th className="px-3 py-2 text-left text-gray-400 font-semibold">Patient</th>
                      <th className="px-3 py-2 text-right text-gray-400 font-semibold">Amount</th>
                      <th className="px-3 py-2 text-center text-gray-400 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.bills.map((b, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-gray-600">{b.billNumber}</td>
                        <td className="px-3 py-2 text-gray-800">{b.patientName}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-800">
                          LKR {b.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-semibold px-1.5 py-0.5 rounded-full text-[10px] ${
                            b.paymentStatus === "paid"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {b.paymentStatus === "paid" ? "✅" : "⏳"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Note input */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Optional Note to Admin
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Add any notes, discrepancies, or comments for the admin…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition"
            />
          </div>

          {preview.unpaidBills > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">⚠️</span>
              <p className="text-xs text-amber-800">
                <strong>{preview.unpaidBills}</strong> unpaid bill(s) totalling{" "}
                <strong>LKR {preview.totalOutstanding.toLocaleString()}</strong> will be included in the report.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={handleSend} disabled={loading}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #01579B, #0277BD)" }}>
              {loading ? "Sending…" : "📤 Send Turnover Report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────
export default function CashierBillingTurnover() {
  const [reports,     setReports]     = useState([]);
  const [preview,     setPreview]     = useState(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [loadingRep,  setLoadingRep]  = useState(true);
  const [showSend,    setShowSend]    = useState(false);
  const [selectedRep, setSelectedRep] = useState(null);
  const [toast,       setToast]       = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const showToast = (msg, type = "success") => setToast({ msg, type });

  const fetchReports = useCallback(async () => {
    setLoadingRep(true);
    try {
      const res  = await fetch(`${API}/turnover-reports`, { headers: authH() });
      const data = await res.json();
      if (data.success) setReports(data.reports || []);
    } catch { showToast("Cannot connect to server", "error"); }
    finally { setLoadingRep(false); }
  }, []);

  const fetchPreview = useCallback(async () => {
    setLoadingPrev(true);
    try {
      const res  = await fetch(`${API}/turnover-reports/preview?date=${today}`, { headers: authH() });
      const data = await res.json();
      if (data.success) setPreview(data.preview);
    } catch { showToast("Cannot load billing preview", "error"); }
    finally { setLoadingPrev(false); }
  }, [today]);

  useEffect(() => { fetchPreview(); fetchReports(); }, [fetchPreview, fetchReports]);

  const handleSent = (report) => {
    setShowSend(false);
    setReports(prev => [report, ...prev]);
    showToast(`Report ${report.reportNumber} sent to admin successfully!`);
    fetchPreview();
  };

  const alreadySentToday = reports.some(r => r.reportDate === today);

  return (
    <CashierLayout activePage="Billing Turnover">
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {showSend && preview && (
        <SendReportModal preview={preview} onClose={() => setShowSend(false)} onSent={handleSent} />
      )}
      {selectedRep && (
        <ReportModal report={selectedRep} onClose={() => setSelectedRep(null)} />
      )}

      <div className="p-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display',serif" }}>
              Billing Turnover
            </h1>
            <p className="text-sm text-gray-400 mt-1">End-of-day billing summary · send to admin</p>
          </div>
          <button onClick={fetchPreview}
            className="text-xs font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            🔄 Refresh
          </button>
        </div>

        {/* Today's snapshot card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#01579B,#0277BD)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
              </div>
              <div>
                <div className="font-semibold text-gray-800 text-sm">Today's Billing Summary</div>
                <div className="text-xs text-gray-400">{today}</div>
              </div>
            </div>
            {alreadySentToday && (
              <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
                ✅ Report Sent
              </span>
            )}
          </div>

          {loadingPrev ? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-2 animate-pulse">📊</div>
              <p className="text-sm text-gray-400">Loading today's data…</p>
            </div>
          ) : preview ? (
            <div className="p-6 space-y-5">
              {/* Summary grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Collected", value: `LKR ${preview.totalCollected.toLocaleString()}`,   icon: "💸", color: "#01579B", bg: "#E3F2FD" },
                  { label: "Outstanding",     value: `LKR ${preview.totalOutstanding.toLocaleString()}`, icon: "⏳", color: "#B71C1C", bg: "#FFEBEE" },
                  { label: "Bills Today",     value: preview.paidBills,                                   icon: "🧾", color: "#1565C0", bg: "#E3F2FD" },
                  { label: "Unpaid Bills",    value: preview.unpaidBills,                                 icon: "📋", color: "#E65100", bg: "#FFF3E0" },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl p-4 border border-gray-100" style={{ background: s.bg }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{s.icon}</span>
                      <span className="text-xs text-gray-500 font-medium">{s.label}</span>
                    </div>
                    <div className="font-bold text-lg" style={{ fontFamily: "'Playfair Display',serif", color: s.color }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Paid vs Unpaid */}
              <div className="flex gap-4">
                <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">{preview.paidBills}</div>
                  <div className="text-xs text-blue-600 mt-1">Bills Paid · 💵 Cash</div>
                </div>
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-700">{preview.unpaidBills}</div>
                  <div className="text-xs text-amber-600 mt-1">Bills Unpaid</div>
                </div>
              </div>

              {/* Send button */}
              <button
                onClick={() => setShowSend(true)}
                disabled={preview.totalBills === 0}
                className="w-full py-4 rounded-2xl text-white font-semibold text-sm shadow-lg transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #01579B, #0277BD)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                {alreadySentToday ? "Send Updated Turnover Report" : "Send Turnover Report to Admin"}
              </button>

              {preview.totalBills === 0 && (
                <p className="text-center text-xs text-gray-400">No bills found for today — nothing to report yet.</p>
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">Could not load today's billing data.</p>
            </div>
          )}
        </div>

        {/* Past reports */}
        <div>
          <h2 className="text-base font-bold text-gray-700 mb-4" style={{ fontFamily: "'Playfair Display',serif" }}>
            Sent Reports
          </h2>

          {loadingRep ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="text-3xl mb-2 animate-pulse">📋</div>
              <p className="text-sm text-gray-400">Loading reports…</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-500 font-medium">No turnover reports yet</p>
              <p className="text-xs text-gray-400 mt-1">Reports you send will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map(rep => (
                <div key={rep._id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#01579B,#0277BD)" }}>
                      📊
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-bold text-gray-800 text-sm font-mono">{rep.reportNumber}</span>
                        <span className="text-xs text-gray-400">{rep.reportDate}</span>
                        {rep.readByAdmin && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">👁 Viewed</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {rep.paidBills} paid · {rep.unpaidBills} unpaid ·{" "}
                        <span className="font-semibold text-blue-700">
                          LKR {(rep.totalCollected || 0).toLocaleString()} collected
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Sent {new Date(rep.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-gray-800 text-base" style={{ fontFamily: "'Playfair Display',serif" }}>
                        LKR {(rep.totalCollected || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">{rep.totalBills} total bills</div>
                    </div>
                    <button onClick={() => setSelectedRep(rep)}
                      className="ml-2 text-xs font-semibold text-blue-700 hover:underline flex-shrink-0">
                      View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CashierLayout>
  );
}