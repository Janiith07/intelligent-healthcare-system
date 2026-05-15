import { useState, useEffect, useCallback } from "react";
import PatientLayout from "../../components/PatientLayout";

const API   = "http://localhost:5001/api";
const token = () => sessionStorage.getItem("token");
const authH = () => ({ Authorization: `Bearer ${token()}` });

function generateBillPDF(bill) {
  const DOCTOR_CHARGE = bill.doctorCharge ?? 1000;
  const drugTotal     = (bill.lines    || []).reduce((s, l) => s + l.lineTotal, 0);
  const labTotal      = (bill.labLines || []).reduce((s, l) => s + l.price,     0);
  const grandTotal    = drugTotal + labTotal + DOCTOR_CHARGE;

  return `<!DOCTYPE html><html><head><title>Receipt - ${bill.billNumber}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:24px;max-width:500px;margin:0 auto}
.clinic-name{font-size:18px;font-weight:700;text-align:center;color:#0D2137}
.clinic-sub{font-size:11px;color:#666;text-align:center;margin:2px 0 14px}
.divider{border-top:1px dashed #ccc;margin:10px 0}
.row{display:flex;justify-content:space-between;margin-bottom:4px}
.label{color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.bold{font-weight:700}
.section-title{font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px}
table{width:100%;border-collapse:collapse;margin-bottom:6px}
th{font-size:10px;font-weight:600;color:#888;text-align:left;padding:5px 6px;border-bottom:1px solid #eee}
th.right{text-align:right}th.center{text-align:center}
td{font-size:12px;padding:6px;border-bottom:1px solid #f5f5f5}
td.right{text-align:right}td.center{text-align:center}
.totals{background:#f9f9f9;border-radius:8px;padding:12px;margin-top:12px}
.total-row{display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px}
.total-row.main{font-size:15px;font-weight:700;border-top:1px solid #ddd;padding-top:8px;margin-top:6px;color:#00897B}
.paid-stamp{display:inline-block;background:#E0F2F1;color:#00695C;border:2px solid #80CBC4;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700}
.footer{text-align:center;font-size:11px;color:#999;margin-top:20px;padding-top:12px;border-top:1px dashed #ccc}
@media print{body{padding:10px}}</style>
<script>window.onload=function(){setTimeout(function(){window.print();},400);}</script>
</head><body>
<div class="clinic-name">People's Health Care</div>
<div class="clinic-sub">Galle Road, Matara · 0777 883 343</div>
<div class="divider"></div>
<div class="row">
  <div>
    <div class="label">Billed To</div>
    <div class="bold" style="font-size:14px">${bill.patientName}</div>
    ${bill.patientId?`<div style="font-size:11px;color:#2563eb;font-weight:600">${bill.patientId}</div>`:""}
    ${bill.channelingNo?`<div style="font-size:11px;color:#555">Channeling #${bill.channelingNo}</div>`:""}
    <div style="font-size:11px;color:#888;margin-top:4px">Rx Ref: ${bill.prescriptionRef}</div>
    <div style="font-size:11px;color:#888">Attending: Dr. ${bill.doctorName}</div>
  </div>
  <div style="text-align:right">
    <div class="label">Bill Number</div>
    <div style="font-size:13px;font-family:monospace;font-weight:600">${bill.billNumber}</div>
    <div style="margin-top:6px"><span class="paid-stamp">✓ PAID</span></div>
    <div style="font-size:11px;color:#888;margin-top:5px">${new Date(bill.paidAt).toLocaleDateString()}</div>
    <div style="font-size:11px;color:#888">${new Date(bill.paidAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
  </div>
</div>
<div class="divider"></div>
${(bill.lines||[]).length>0?`
<div class="section-title">Dispensed Medications</div>
<table><thead><tr>
  <th>Medication</th><th class="center">Qty</th><th class="right">Unit Price</th><th class="right">Total</th>
</tr></thead><tbody>
${bill.lines.map(i=>`<tr><td>${i.medicationName}</td><td class="center">${i.qtyDispensed}</td><td class="right">LKR ${i.unitPrice.toLocaleString()}</td><td class="right">LKR ${i.lineTotal.toLocaleString()}</td></tr>`).join("")}
</tbody></table>`:""}
${(bill.labLines||[]).length>0?`
<div class="section-title">Laboratory Tests</div>
<table><thead><tr><th>Test</th><th class="right">Price</th></tr></thead><tbody>
${bill.labLines.map(l=>`<tr><td>${l.testName}</td><td class="right">LKR ${l.price.toLocaleString()}</td></tr>`).join("")}
</tbody></table>`:""}
<div class="totals">
${(bill.lines||[]).length>0?`<div class="total-row"><span>Medications Subtotal</span><span>LKR ${drugTotal.toLocaleString()}</span></div>`:""}
${labTotal>0?`<div class="total-row" style="color:#7c3aed"><span>Lab Tests Subtotal</span><span>LKR ${labTotal.toLocaleString()}</span></div>`:""}
<div class="total-row" style="color:#1d4ed8"><span>Doctor Consultation Fee</span><span>LKR ${DOCTOR_CHARGE.toLocaleString()}</span></div>
<div class="total-row main"><span>Amount Paid</span><span>LKR ${grandTotal.toLocaleString()}</span></div>
<div style="font-size:11px;color:#888;text-align:right;margin-top:5px">Payment Method: Cash</div>
</div>
<div class="footer">Thank you for choosing People's Health Care<br>Please keep this receipt for your records</div>
</body></html>`;
}

function BillDetailModal({ bill, onClose }) {
  if (!bill) return null;

  const DOCTOR_CHARGE = bill.doctorCharge ?? 1000;
  const drugTotal     = (bill.lines    || []).reduce((s, l) => s + l.lineTotal, 0);
  const labTotal      = (bill.labLines || []).reduce((s, l) => s + l.price,     0);
  const grandTotal    = drugTotal + labTotal + DOCTOR_CHARGE;

  const handleDownload = () => {
    const html = generateBillPDF(bill);
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${bill.billNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const w = window.open("","_blank","width=560,height=750");
    w.document.write(generateBillPDF(bill));
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0D2137, #1565C0)" }}>
          <div>
            <p className="text-white/60 text-xs">{bill._isLabReq ? "🔬 Lab Request Receipt" : "Paid Receipt"}</p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              {bill.billNumber}
            </h3>
            <p className="text-white/60 text-xs mt-0.5">
              {new Date(bill.createdAt).toLocaleDateString()} · Dr. {bill.doctorName}
              {bill._isLabReq && bill.labRequestId && ` · ${bill.labRequestId}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-100 text-teal-700 border border-teal-200">
              ✅ Paid
            </span>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">From</p>
              <p className="text-sm font-semibold text-gray-800">People's Health Care</p>
              <p className="text-xs text-gray-500">Dr. {bill.doctorName}</p>
              <p className="text-xs text-gray-500">Galle Road, Matara</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Billed To</p>
              <p className="text-sm font-semibold text-gray-800">{bill.patientName}</p>
              {bill.patientId && <p className="text-xs text-blue-600 font-mono">{bill.patientId}</p>}
              {bill.channelingNo && <p className="text-xs text-gray-500">Ch. #{bill.channelingNo}</p>}
            </div>
          </div>

          {(bill.lines||[]).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dispensed Medications</p>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Medication</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-400">Qty</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.lines.map((item,i) => (
                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{item.medicationName}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">{item.qtyDispensed}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">LKR {item.lineTotal.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(bill.labLines||[]).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🧪 Lab Tests</p>
              <div className="rounded-xl border border-purple-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-purple-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-purple-400">Test</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-purple-400">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.labLines.map((lab,i) => (
                      <tr key={i} className="border-t border-purple-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{lab.testName}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">LKR {lab.price.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            {(bill.lines||[]).length > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Medications Subtotal</span><span>LKR {drugTotal.toLocaleString()}</span>
              </div>
            )}
            {labTotal > 0 && (
              <div className="flex justify-between text-sm text-purple-700">
                <span>Lab Tests Subtotal</span><span>LKR {labTotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-blue-700">
              <span>Doctor Consultation Fee</span><span>LKR {DOCTOR_CHARGE.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base text-gray-800">
              <span>Total Paid</span>
              <span style={{ color: "#00897B" }}>LKR {grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-sm text-teal-700 flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <span>Paid on {new Date(bill.paidAt).toLocaleDateString()} · Cash payment · Thank you!</span>
          </div>

          <div className="flex gap-3">
            <button onClick={handleDownload}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition hover:opacity-90 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
              Download Receipt
            </button>
            <button onClick={handlePrint}
              className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition flex items-center gap-1.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/>
              </svg>
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PatientBilling() {
  const [bills,       setBills]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [selectedBill, setSelectedBill] = useState(null);

  const fetchBills = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API}/patient-bills`,                    { headers: authH() }),
        fetch(`${API}/lab-request-bills/my-bills`,       { headers: authH() }),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      if (!d1.success) throw new Error(d1.message || "Failed to load bills");

      // Tag lab request bills so the detail modal can show correct fields
      const pharmBills  = (d1.bills || []);
      const labReqBills = (d2.success ? d2.bills : []).map(b => ({ ...b, _isLabReq: true }));

      // Merge and sort newest first
      const merged = [...pharmBills, ...labReqBills].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setBills(merged);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const totalPaid = bills.reduce((sum, b) => sum + b.totalAmount, 0);

  return (
    <PatientLayout activePage="Billing & Payments">
      {selectedBill && <BillDetailModal bill={selectedBill} onClose={() => setSelectedBill(null)} />}

      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>
            Billing & Payments
          </h1>
          <p className="text-sm text-gray-400 mt-1">Your paid receipts — sent by the cashier</p>
        </div>

        {/* Summary cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-teal-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center text-base">✅</div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Paid</span>
            </div>
            <div className="text-2xl font-bold text-teal-700" style={{ fontFamily: "'Playfair Display', serif" }}>
              LKR {totalPaid.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 mt-1">{bills.length} paid receipt{bills.length !== 1 ? "s" : ""}</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-base">📋</div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Bills</span>
            </div>
            <div className="text-2xl font-bold text-blue-700" style={{ fontFamily: "'Playfair Display', serif" }}>
              {bills.length}
            </div>
            <div className="text-xs text-gray-400 mt-1">Across all visits</div>
          </div>
        </div>

        {/* Bills list */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3 animate-pulse">🧾</div>
            <p className="text-sm text-gray-400">Loading your bills…</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-sm text-red-700 font-medium">{error}</p>
            <button onClick={fetchBills}
              className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition">
              Retry
            </button>
          </div>
        ) : bills.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-3">🧾</div>
            <p className="text-gray-500 font-medium">No bills yet</p>
            <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">
              Your paid receipts will appear here once the cashier sends them to your portal after payment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bills.map(bill => {
              const DOCTOR_CHARGE = bill.doctorCharge ?? 1000;
              const drugTotal = (bill.lines||[]).reduce((s,l)=>s+l.lineTotal,0);
              const labTotal  = (bill.labLines||[]).reduce((s,l)=>s+l.price,0);
              const grandTotal = drugTotal + labTotal + DOCTOR_CHARGE;

              return (
                <div key={bill._id} className="bg-white rounded-2xl border border-teal-100 shadow-sm hover:shadow-md transition overflow-hidden">
                  {bill._isLabReq && (
                    <div className="flex items-center gap-2 px-6 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs">🔬</span>
                      <span className="text-xs font-semibold text-gray-600">Lab Request Bill</span>
                      <span className="text-xs font-mono text-gray-400 ml-1">{bill.labRequestId}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4 px-6 py-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: "#E0F2F1" }}>
                      ✅
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-mono text-xs text-gray-400">{bill.billNumber}</span>
                        {!bill._isLabReq && bill.channelingNo && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Ch. #{bill.channelingNo}</span>
                        )}
                        <span className="text-xs text-gray-400">Dr. {bill.doctorName}</span>
                      </div>
                      <div className="text-xs text-gray-400">{new Date(bill.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Paid on {new Date(bill.paidAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-bold" style={{ color: "#00897B" }}>
                        LKR {grandTotal.toLocaleString()}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-teal-100 text-teal-700 border-teal-200">
                        ✅ Paid
                      </span>
                      <button onClick={() => setSelectedBill(bill)} className="text-xs text-blue-600 font-semibold hover:underline">
                        View Details →
                      </button>
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="border-t border-gray-50 px-6 py-3 bg-gray-50 flex flex-wrap gap-3">
                    {(bill.lines||[]).slice(0,3).map((item,i) => (
                      <span key={i} className="text-xs text-gray-500 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-emerald-400"/>
                        {item.medicationName} × {item.qtyDispensed}
                      </span>
                    ))}
                    {(bill.labLines||[]).slice(0,2).map((lab,i) => (
                      <span key={`l${i}`} className="text-xs text-purple-500 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-purple-400"/>
                        {lab.testName}
                      </span>
                    ))}
                    {((bill.lines||[]).length + (bill.labLines||[]).length) > 5 && (
                      <span className="text-xs text-gray-400">+more items</span>
                    )}
                    {/* Download shortcut */}
                    <span className="ml-auto">
                      <button
                        onClick={() => {
                          const w = window.open("","_blank","width=560,height=750");
                          w.document.write(generateBillPDF(bill));
                          w.document.close();
                        }}
                        className="text-xs text-blue-500 font-semibold hover:underline flex items-center gap-1">
                        🖨️ Print
                      </button>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
          <p className="text-sm text-gray-600">
            💡 Only paid receipts sent by the cashier are displayed here. For billing queries, please visit the clinic counter.
          </p>
        </div>
      </div>
    </PatientLayout>
  );
}