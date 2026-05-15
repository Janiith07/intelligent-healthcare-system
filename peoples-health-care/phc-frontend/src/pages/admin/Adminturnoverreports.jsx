import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../../components/AdminLayout";

const API   = "http://localhost:5001/api";
const token = () => sessionStorage.getItem("token");
const authH = () => ({ Authorization: `Bearer ${token()}` });

// ── Download turnover report as PDF ────────────────────────────
function handleDownload(report) {
  const isPaidColor   = "#1565C0";
  const isUnpaidColor = "#B45309";

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Turnover Report - ${report.reportNumber}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; max-width: 720px; margin: 0 auto; }
        .header      { text-align: center; margin-bottom: 20px; }
        .clinic-name { font-size: 20px; font-weight: 700; color: #0D2137; }
        .clinic-sub  { font-size: 11px; color: #666; margin-top: 3px; }
        .report-tag  { display: inline-block; margin-top: 8px; background: #1A237E; color: white; font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 20px; letter-spacing: 0.05em; }
        .divider     { border-top: 1px dashed #ccc; margin: 14px 0; }
        .meta-row    { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .meta-item   { font-size: 12px; }
        .meta-label  { color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
        .meta-value  { font-weight: 600; color: #222; }
        .cards       { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
        .card        { border-radius: 8px; padding: 12px; }
        .card-label  { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
        .card-value  { font-size: 16px; font-weight: 800; }
        .section-title { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin: 16px 0 8px; }
        table        { width: 100%; border-collapse: collapse; }
        thead tr     { background: #f5f5f5; }
        th           { font-size: 10px; font-weight: 700; color: #555; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e5e5; }
        th.right     { text-align: right; }
        th.center    { text-align: center; }
        td           { font-size: 12px; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
        td.right     { text-align: right; }
        td.center    { text-align: center; }
        tr:last-child td { border-bottom: none; }
        .badge       { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
        .paid-badge  { background: #dcfce7; color: ${isPaidColor}; }
        .unpaid-badge{ background: #fef9c3; color: ${isUnpaidColor}; }
        .note-box    { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
        .note-label  { font-size: 10px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
        .note-text   { font-size: 12px; color: #78350f; }
        .summary-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; margin-top: 16px; }
        .sum-row     { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
        .sum-row.total { font-size: 14px; font-weight: 800; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 4px; }
        .footer      { text-align: center; font-size: 10px; color: #aaa; margin-top: 28px; border-top: 1px solid #eee; padding-top: 12px; }
        @media print { body { padding: 18px; } }
      </style>
      <script>
        window.onload = function() { setTimeout(function() { window.print(); }, 300); };
      </script>
    </head>
    <body>

      <!-- Header -->
      <div class="header">
        <div class="clinic-name">People's Health Care</div>
        <div class="clinic-sub">Galle Road, Matara · 0777 883 343</div>
        <div><span class="report-tag">BILLING TURNOVER REPORT</span></div>
      </div>

      <div class="divider"></div>

      <!-- Meta info -->
      <div class="meta-row">
        <div class="meta-item">
          <div class="meta-label">Report No.</div>
          <div class="meta-value">${report.reportNumber}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Report Date</div>
          <div class="meta-value">${report.reportDate}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Submitted By</div>
          <div class="meta-value">${report.submittedByName || "Cashier"}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Submitted At</div>
          <div class="meta-value">${new Date(report.createdAt).toLocaleString()}</div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Summary cards -->
      <div class="cards">
        <div class="card" style="background:#f0fdf4; border:1px solid #bbf7d0;">
          <div class="card-label">Total Collected</div>
          <div class="card-value" style="color:#1565C0;">LKR ${(report.totalCollected || 0).toLocaleString()}</div>
        </div>
        <div class="card" style="background:#fff7ed; border:1px solid #fed7aa;">
          <div class="card-label">Outstanding</div>
          <div class="card-value" style="color:#B45309;">LKR ${(report.totalOutstanding || 0).toLocaleString()}</div>
        </div>
        <div class="card" style="background:#f8fafc; border:1px solid #e2e8f0;">
          <div class="card-label">Total Bills</div>
          <div class="card-value" style="color:#334155;">${report.totalBills || 0}</div>
        </div>
        <div class="card" style="background:#f0fdf4; border:1px solid #bbf7d0;">
          <div class="card-label">Paid Bills</div>
          <div class="card-value" style="color:#1565C0;">${report.paidBills || 0}</div>
        </div>
        <div class="card" style="background:#fefce8; border:1px solid #fef08a;">
          <div class="card-label">Unpaid Bills</div>
          <div class="card-value" style="color:#B45309;">${report.unpaidBills || 0}</div>
        </div>
      </div>

      <!-- Cashier note -->
      ${report.note ? `
        <div class="note-box">
          <div class="note-label">📝 Cashier Note</div>
          <div class="note-text">${report.note}</div>
        </div>
      ` : ""}

      <!-- Bill snapshot table -->
      ${(report.billSnapshot || []).length > 0 ? `
        <div class="section-title">Bill Snapshot (${report.billSnapshot.length})</div>
        <table>
          <thead>
            <tr>
              <th>Bill No.</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th class="right">Amount</th>
              <th class="center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${report.billSnapshot.map(b => `
              <tr>
                <td style="font-family:monospace; font-size:11px; color:#555;">${b.billNumber}</td>
                <td>${b.patientName}</td>
                <td style="color:#666; font-size:11px;">${b.doctorName || "—"}</td>
                <td class="right" style="font-weight:600;">LKR ${(b.totalAmount || 0).toLocaleString()}</td>
                <td class="center">
                  <span class="badge ${b.paymentStatus === "paid" ? "paid-badge" : "unpaid-badge"}">
                    ${b.paymentStatus === "paid" ? "✓ Paid" : "⏳ Unpaid"}
                  </span>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}

      <!-- Financial summary -->
      <div class="summary-box">
        <div class="sum-row">
          <span style="color:#555;">Paid Bills (${report.paidBills || 0})</span>
          <span style="color:#1565C0; font-weight:600;">LKR ${(report.totalCollected || 0).toLocaleString()}</span>
        </div>
        <div class="sum-row">
          <span style="color:#555;">Outstanding (${report.unpaidBills || 0} unpaid)</span>
          <span style="color:#B45309; font-weight:600;">LKR ${(report.totalOutstanding || 0).toLocaleString()}</span>
        </div>
        <div class="sum-row total">
          <span>Grand Total</span>
          <span>LKR ${((report.totalCollected || 0) + (report.totalOutstanding || 0)).toLocaleString()}</span>
        </div>
      </div>

      <div class="footer">
        People's Health Care · Galle Road, Matara · 0777 883 343<br/>
        This report was generated on ${new Date().toLocaleString()} · ${report.reportNumber}
      </div>

    </body>
    </html>
  `;

  const w = window.open("", "_blank", "width=780,height=900");
  w.document.write(printContent);
  w.document.close();
}

// ── Report Detail Modal ─────────────────────────────────────────
function ReportModal({ reportId, onClose, onMarkRead }) {
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API}/turnover-reports/${reportId}`, { headers: authH() });
        const data = await res.json();
        if (data.success) {
          setReport(data.report);
          if (data.report.readByAdmin) onMarkRead(reportId);
        }
        else throw new Error(data.message);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [reportId, onMarkRead]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 sticky top-0 z-10 rounded-t-3xl flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0D2137, #1A237E)" }}>
          <div>
            <p className="text-white/60 text-xs">Billing Turnover Report</p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display',serif" }}>
              {loading ? "Loading…" : report?.reportNumber || "Report"}
            </h3>
            {report && (
              <p className="text-white/60 text-xs mt-0.5">
                {report.reportDate} · By {report.submittedByName || "Cashier"} ·{" "}
                {new Date(report.createdAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
              {report && (
                <button
                  onClick={() => handleDownload(report)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition"
                  title="Download Report">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center">
              <div className="text-3xl mb-2 animate-pulse">📊</div>
              <p className="text-sm text-gray-400">Loading report…</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          ) : report ? (
            <div className="space-y-5">
              {/* Summary grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "Total Collected",  value: `LKR ${(report.totalCollected  || 0).toLocaleString()}`, color: "#1565C0", bg: "#E3F2FD" },
                  { label: "Outstanding",      value: `LKR ${(report.totalOutstanding|| 0).toLocaleString()}`, color: "#B71C1C", bg: "#FFEBEE" },
                  { label: "Total Bills",      value: report.totalBills,                                        color: "#37474F", bg: "#ECEFF1" },
                  { label: "Paid Bills",       value: report.paidBills,                                         color: "#1565C0", bg: "#E3F2FD" },
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

              {/* Bill snapshot table */}
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
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Doctor</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400">Amount</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-400">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {report.billSnapshot.map((b, i) => (
                          <tr key={i}>
                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{b.billNumber}</td>
                            <td className="px-4 py-3 text-sm text-gray-800">{b.patientName}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{b.doctorName}</td>
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
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────
export default function AdminTurnoverReports() {
  const [reports,    setReports]    = useState([]);
  const [stats,      setStats]      = useState({});
  const [loading,    setLoading]    = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [filterDate, setFilterDate] = useState("");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/turnover-reports`, { headers: authH() });
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
        setStats(data.stats || {});
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Auto-refresh every 30 seconds to pick up new reports
  useEffect(() => {
    const interval = setInterval(() => { fetchReports(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  // Mark report as read in local state immediately when opened (optimistic update)
  const handleViewReport = useCallback((reportId) => {
    setSelectedId(reportId);
    setReports(prev => prev.map(r =>
      r._id === reportId ? { ...r, readByAdmin: true } : r
    ));
  }, []);

  // Called by modal once backend confirms readByAdmin = true
  const handleMarkRead = useCallback((reportId) => {
    setReports(prev => prev.map(r =>
      r._id === reportId ? { ...r, readByAdmin: true } : r
    ));
  }, []);

  const unread   = reports.filter(r => !r.readByAdmin);
  const filtered = filterDate ? reports.filter(r => r.reportDate === filterDate) : reports;

  // Use true DB amounts from stats; only fall back to report sums when date-filtered
  const totalCollected   = filterDate
    ? filtered.reduce((s, r) => s + (r.totalCollected   || 0), 0)
    : (stats.totalCollected   ?? filtered.reduce((s, r) => s + (r.totalCollected   || 0), 0));
  // Outstanding: always use live DB value (report snapshots go stale when bills get paid)
  const totalOutstanding = filterDate
    ? filtered.reduce((s, r) => s + (r.totalOutstanding || 0), 0)
    : (stats.totalOutstanding ?? 0);
  // Total Bills = true count of all pharmacy bills from DB (not sum of report snapshots)
  const totalBills = filterDate
    ? filtered.reduce((s, r) => s + (r.totalBills || 0), 0)
    : (stats.totalBillCount ?? filtered.reduce((s, r) => s + (r.totalBills || 0), 0));

  return (
    <AdminLayout activePage="Turnover Reports">
      {selectedId && (
        <ReportModal
          reportId={selectedId}
          onClose={() => setSelectedId(null)}
          onMarkRead={handleMarkRead}
        />
      )}

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display',serif" }}>
              Billing Turnover Reports
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Daily reports submitted by cashier
              {unread.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {unread.length} unread
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
            />
            {filterDate && (
              <button onClick={() => setFilterDate("")}
                className="text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                Clear
              </button>
            )}
            <button onClick={fetchReports}
              className="text-xs font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { label: "Total Collected",  value: `LKR ${totalCollected.toLocaleString()}`,   icon: "💰", color: "#1565C0", bg: "#E3F2FD" },
            { label: "Outstanding",      value: `LKR ${totalOutstanding.toLocaleString()}`, icon: "⏳", color: "#B71C1C", bg: "#FFEBEE" },
            { label: "Total Bills",      value: totalBills,                                  icon: "🧾", color: "#1565C0", bg: "#E3F2FD" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: s.bg }}>
                  {s.icon}
                </div>
                <span className="text-xs text-gray-400 font-medium">{s.label}</span>
              </div>
              <div className="font-bold" style={{ fontFamily: "'Playfair Display',serif", color: s.color, fontSize: "1.1rem" }}>
                {s.value}
              </div>
              {filterDate && <div className="text-xs text-gray-400 mt-0.5">For {filterDate}</div>}
            </div>
          ))}
        </div>

        {/* Unread banner */}
        {unread.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-xl">📬</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">New Reports</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {unread.length} unread turnover report{unread.length > 1 ? "s" : ""} from cashier
              </p>
            </div>
          </div>
        )}

        {/* Reports list */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3 animate-pulse">📋</div>
            <p className="text-sm text-gray-400">Loading reports…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 font-medium">
              {filterDate ? `No reports for ${filterDate}` : "No turnover reports yet"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Reports appear here when the cashier submits end-of-day billing summaries.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(rep => (
              <div key={rep._id}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition overflow-hidden ${
                  !rep.readByAdmin ? "border-amber-300 ring-1 ring-amber-100" : "border-gray-100"
                }`}>
                {!rep.readByAdmin && (
                  <div className="px-5 py-2 bg-amber-50 border-b border-amber-200">
                    <span className="text-xs font-bold text-amber-700">🆕 New — not yet viewed</span>
                  </div>
                )}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1A237E, #283593)" }}>
                    📊
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold text-gray-800 text-sm font-mono">{rep.reportNumber}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{rep.reportDate}</span>
                      {rep.readByAdmin
                        ? <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">👁 Viewed</span>
                        : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🆕 New</span>
                      }
                    </div>
                    <div className="text-xs text-gray-500">
                      By {rep.submittedByName || "Cashier"} · {rep.paidBills} paid · {rep.unpaidBills} unpaid · {rep.totalBills} total bills
                    </div>
                    {rep.note && (
                      <div className="text-xs text-amber-700 mt-0.5 italic">📝 "{rep.note}"</div>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">
                      Submitted {new Date(rep.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0 mr-2">
                    <div className="font-bold text-blue-700 text-base" style={{ fontFamily: "'Playfair Display',serif" }}>
                      LKR {(rep.totalCollected || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">collected · 💵 Cash</div>
                    {(rep.totalOutstanding || 0) > 0 && (
                      <div className="text-xs text-red-500 font-semibold mt-0.5">
                        +LKR {rep.totalOutstanding.toLocaleString()} outstanding
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleViewReport(rep._id)}
                      className="text-xs font-semibold text-amber-700 hover:underline px-3 py-2 rounded-xl hover:bg-amber-50 transition text-right">
                      View Details →
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res  = await fetch(`${API}/turnover-reports/${rep._id}`, { headers: authH() });
                          const data = await res.json();
                          if (data.success) handleDownload(data.report);
                        } catch { alert("Failed to fetch report for download."); }
                      }}
                      className="flex items-center justify-end gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}