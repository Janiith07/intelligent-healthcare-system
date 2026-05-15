import { useState, useEffect, useCallback } from "react";
import PharmacyLayout from "../../components/PharmacyLayout";
import InventoryPDFButton from "../../components/Inventorypdfbutton.jsx";

const API   = "http://localhost:5001/api";
const token = () => sessionStorage.getItem("token");
const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

const CATEGORIES = ["All","Antibiotic","Analgesic","Antifungal","Antiviral","Antihypertensive","Antidiabetic","Antihistamine","Vitamin","Supplement","Other"];
const FORMS      = ["Tablet","Capsule","Syrup","Injection","Cream","Drops","Inhaler","Other"];

// ── Strength presets by form ──────────────────────────────────────
const CAPSULE_MG_STRENGTHS = [
  "50mg","100mg","150mg","200mg","250mg","300mg","400mg","500mg",
  "600mg","750mg","875mg","1000mg","1g","2g",
];
const SYRUP_ML_STRENGTHS = [
  "5mg/5ml","10mg/5ml","20mg/5ml","25mg/5ml","50mg/5ml",
  "100mg/5ml","125mg/5ml","200mg/5ml","250mg/5ml","500mg/5ml",
  "1mg/ml","2mg/ml","5mg/ml","10mg/ml",
];
const FORMS_WITH_PRESET_STRENGTH = ["Capsule", "Syrup"];

const cls = "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 transition bg-white";

function getStatus(totalStock, reorderLevel) {
  if (totalStock === 0)              return "Out of Stock";
  if (totalStock <= reorderLevel)    return "Low Stock";
  return "In Stock";
}

const STATUS_CONFIG = {
  "In Stock":     { bg:"bg-emerald-100", text:"text-emerald-700", border:"border-emerald-200", dot:"bg-emerald-400", bar:"bg-emerald-400" },
  "Low Stock":    { bg:"bg-amber-100",   text:"text-amber-700",   border:"border-amber-200",   dot:"bg-amber-400",   bar:"bg-amber-400"   },
  "Out of Stock": { bg:"bg-red-100",     text:"text-red-600",     border:"border-red-200",     dot:"bg-red-500",     bar:"bg-red-400"     },
};

const STOCK_STATUS_CONFIG = {
  active:    { bg:"bg-slate-100", text:"text-slate-700", label:"Active" },
  exhausted: { bg:"bg-gray-100",    text:"text-gray-500",    label:"Exhausted" },
  expired:   { bg:"bg-red-100",     text:"text-red-600",     label:"Expired" },
};

// ── Toast ──────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl text-white shadow-2xl text-sm font-medium ${type === "success" ? "bg-emerald-600" : "bg-red-500"}`}
      style={{ animation: "slideIn .3s ease" }}>
      <span>{type === "success" ? "✅" : "❌"}</span>{msg}
    </div>
  );
}

// ── Confirm Dialog ──────────────────────────────────────────────
// blocked=true → shows an error state with no delete button
function ConfirmDialog({ title, message, onConfirm, onCancel, blocked, blockedMessage }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="text-center">
          <div className="text-4xl mb-3">{blocked ? "🚫" : "🗑️"}</div>
          <h3 className="font-bold text-gray-800 text-lg" style={{ fontFamily:"'Playfair Display', serif" }}>{title}</h3>
          <p className="text-sm text-gray-500 mt-2">{message}</p>
        </div>

        {/* Blocked: show clear explanation instead of delete button */}
        {blocked ? (
          <>
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 text-sm text-red-800 space-y-1">
              <p className="font-semibold">⛔ Cannot Delete</p>
              <p>{blockedMessage}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              💡 Open the <strong>📦 Stock</strong> panel for this drug, delete all stock entries, then try again.
            </div>
            <button onClick={onCancel}
              className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Got It
            </button>
          </>
        ) : (
          <div className="flex gap-3">
            <button onClick={onConfirm}
              className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition">
              Yes, Delete
            </button>
            <button onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Drug Form Modal (Add / Edit catalog entry) ─────────────────
// Stock fields (stockQty, expiryDate, batchNumber) are REMOVED — managed separately
function DrugFormModal({ drug, onClose, onSaved }) {
  const isEdit = !!drug;

  const [name,         setName]         = useState(drug?.name         || "");
  const [brand,        setBrand]        = useState(drug?.brand        || "");
  const [category,     setCategory]     = useState(drug?.category     || "Other");
  const [drugForm,     setDrugForm]     = useState(drug?.form         || "Tablet");
  const [strength,     setStrength]     = useState(drug?.strength     || "");
  const [unit,         setUnit]         = useState(drug?.unit         || "pcs");
  const [reorderLevel, setReorderLevel] = useState(String(drug?.reorderLevel ?? 10));
  const [unitPrice,    setUnitPrice]    = useState(String(drug?.unitPrice    || 0));
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const handleSubmit = async () => {
    if (!name.trim())     { setError("Drug name is required.");     return; }
    if (!strength.trim()) { setError("Drug strength is required."); return; }
    setLoading(true); setError("");
    try {
      const payload = {
        name: name.trim(), brand: brand.trim(), category,
        form: drugForm, strength: strength.trim(),
        unit: unit.trim(), reorderLevel: Number(reorderLevel),
        unitPrice: Number(unitPrice),
      };
      const url    = isEdit ? `${API}/drugs/${drug._id}` : `${API}/drugs`;
      const method = isEdit ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
      const data   = await res.json();
      if (!data.success) throw new Error(data.message);
      onSaved(data.drug, isEdit ? "updated" : "added");
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const Lbl = ({ t }) => <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t}</label>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-5 flex items-center justify-between sticky top-0 z-10 rounded-t-3xl"
          style={{ background:"linear-gradient(135deg, #0D2137, #263238)" }}>
          <div>
            <p className="text-white/60 text-xs">{isEdit ? "Edit Drug" : "Add New Drug"}</p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily:"'Playfair Display', serif" }}>
              {isEdit ? drug.name : "New Drug Entry"}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

          <div><Lbl t="Generic Name *" /><input className={cls} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amoxicillin" /></div>

          <div className="grid grid-cols-2 gap-4">
            <div><Lbl t="Brand Name" /><input className={cls} type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Amoxil" /></div>
            <div>
              <Lbl t="Category" />
              <select className={cls} value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Lbl t="Form *" />
              <select className={cls} value={drugForm} onChange={e => { setDrugForm(e.target.value); setStrength(""); }}>
                {FORMS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <Lbl t="Strength *" />
              {drugForm === "Capsule" ? (
                <select className={cls} value={strength === "__custom__" ? "__custom__" : strength} onChange={e => setStrength(e.target.value)}>
                  <option value="">— Select mg strength —</option>
                  {CAPSULE_MG_STRENGTHS.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="__custom__">Other (type below)</option>
                </select>
              ) : drugForm === "Syrup" ? (
                <select className={cls} value={strength === "__custom__" ? "__custom__" : strength} onChange={e => setStrength(e.target.value)}>
                  <option value="">— Select ml strength —</option>
                  {SYRUP_ML_STRENGTHS.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="__custom__">Other (type below)</option>
                </select>
              ) : (
                <input className={cls} type="text" value={strength} onChange={e => setStrength(e.target.value)} placeholder="e.g. 500mg" />
              )}
              {strength === "__custom__" && (
                <input
                  className={`${cls} mt-2`}
                  type="text"
                  placeholder={drugForm === "Syrup" ? "e.g. 300mg/5ml" : "e.g. 1250mg"}
                  onBlur={e => { if (e.target.value.trim()) setStrength(e.target.value.trim()); }}
                  autoFocus
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Lbl t="Unit" /><input className={cls} type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs / ml / g" /></div>
            <div><Lbl t="Unit Price (LKR)" /><input className={cls} type="number" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} /></div>
          </div>

          <div><Lbl t="Reorder Level" />
            <input className={cls} type="number" min="0" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Alert will trigger when total stock falls at or below this level</p>
          </div>

          {/* Info note: stock is managed separately */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
            📦 Stock entries (qty, expiry, price per lot) are managed separately via the <strong>Stock Entries</strong> panel per drug.
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition hover:opacity-90 disabled:opacity-50"
              style={{ background:"linear-gradient(135deg, #263238, #37474F)" }}>
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Drug"}
            </button>
            <button onClick={onClose}
              className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Stock Entry Modal (POST /api/stocks) ───────────────────
function AddStockModal({ drug, onClose, onAdded }) {
  const [receivedQty,      setReceivedQty]      = useState("");
  const [expiryDate,       setExpiryDate]       = useState("");
  const [manufacturedDate, setManufacturedDate] = useState("");
  const [unitPrice,        setUnitPrice]        = useState(String(drug.unitPrice || 0));
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState("");

  const handleAdd = async () => {
    if (!receivedQty || Number(receivedQty) <= 0) { setError("Enter a valid quantity > 0."); return; }
    if (!expiryDate)                               { setError("Expiry date is required.");   return; }
    const today     = new Date(); today.setHours(0,0,0,0);
    const expDate   = new Date(expiryDate);
    if (expDate <= today) { setError("Expiry date must be a future date."); return; }
    if (manufacturedDate) {
      const mfgDate = new Date(manufacturedDate);
      if (mfgDate >= expDate) { setError("Manufacture date must be before the expiry date."); return; }
      if (mfgDate > today)    { setError("Manufacture date cannot be in the future."); return; }
    }
    setLoading(true); setError("");
    try {
      const payload = {
        drugId:          drug._id,
        receivedQty:     Number(receivedQty),
        expiryDate,
        unitPrice:       Number(unitPrice),
        manufacturedDate: manufacturedDate || undefined,
      };
      const res  = await fetch(`${API}/stocks`, { method:"POST", headers:authHeaders(), body:JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      onAdded(data.stock);
    } catch (e) {
      setError(e.message || "Failed to add stock.");
    } finally {
      setLoading(false);
    }
  };

  const Lbl = ({ t, req }) => (
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
      {t}{req && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 flex items-center justify-between rounded-t-3xl"
          style={{ background:"linear-gradient(135deg, #0D2137, #263238)" }}>
          <div>
            <p className="text-white/60 text-xs">Add Stock Entry</p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily:"'Playfair Display', serif" }}>
              Receive Stock
            </h3>
            <p className="text-white/60 text-xs mt-0.5">{drug.name} · {drug.strength} ({drug.form})</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Current stock summary */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">{drug.name}</p>
              <p className="text-xs text-gray-500">{drug.form} · {drug.strength}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Current Total Stock</p>
              <p className={`text-xl font-bold ${(drug.totalStock ?? 0) <= drug.reorderLevel ? "text-red-600" : "text-emerald-600"}`}>
                {drug.totalStock ?? 0} <span className="text-sm font-normal text-gray-400">{drug.unit}</span>
              </p>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

          <div><Lbl t="Quantity Received" req /><input className={cls} type="number" min="1" value={receivedQty} onChange={e => setReceivedQty(e.target.value)} placeholder="e.g. 200" /></div>

          <div><Lbl t="Expiry Date" req /><input className={cls} type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>

          <div><Lbl t="Manufactured Date" /><input className={cls} type="date" value={manufacturedDate} onChange={e => setManufacturedDate(e.target.value)} /></div>

          <div>
            <Lbl t="Unit Price for This Lot (LKR)" />
            <input className={cls} type="number" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Leave as default or update for this specific lot</p>
          </div>

          {receivedQty && Number(receivedQty) > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-700 flex items-center gap-2">
              <span>📦</span>
              New total: <strong>{(drug.totalStock ?? 0) + Number(receivedQty)} {drug.unit}</strong> (adding {receivedQty})
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={handleAdd} disabled={loading}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition hover:opacity-90 disabled:opacity-50"
              style={{ background:"linear-gradient(135deg, #263238, #37474F)" }}>
              {loading ? "Adding…" : "Add Stock Entry"}
            </button>
            <button onClick={onClose}
              className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stock Entries Panel (slide-in right panel) ─────────────────
// Shows all DrugStock entries for a selected drug
function StockEntriesPanel({ drug, onClose, onStockChanged }) {
  const [stocks,  setStocks]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // "add" | { type:"delete", stock }
  const [toast,   setToast]   = useState(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/stocks/drug/${drug._id}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setStocks(data.stocks || []);
        // propagate updated totalStock to parent
        if (onStockChanged) onStockChanged(drug._id, data.totalStock ?? 0);
      }
    } catch { showToast("Failed to load stock entries", "error"); }
    finally { setLoading(false); }
  }, [drug._id]);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);

  const handleAdded = (newStock) => {
    setModal(null);
    showToast(`Stock entry ${newStock.stockId} added`);
    fetchStocks();
  };

  const handleDelete = async (stockId) => {
    setModal(null);
    try {
      const res  = await fetch(`${API}/stocks/${stockId}`, { method:"DELETE", headers:authHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      showToast("Stock entry deleted");
      fetchStocks();
    } catch (e) { showToast(e.message, "error"); }
  };

  const totalActive = stocks.filter(s => s.status === "active").reduce((sum, s) => sum + s.remainingQty, 0);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full flex flex-col shadow-2xl overflow-hidden"
        style={{ animation: "slideFromRight .3s ease" }}>

        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
        {modal === "add" && <AddStockModal drug={{ ...drug, totalStock: totalActive }} onClose={() => setModal(null)} onAdded={handleAdded} />}
        {modal?.type === "delete" && (
          <ConfirmDialog
            title="Delete Stock Entry"
            message={`Remove stock entry ${modal.stock.stockId}? This can only be done if no stock has been dispensed from it yet.`}
            onConfirm={() => handleDelete(modal.stock._id)}
            onCancel={() => setModal(null)}
          />
        )}

        {/* Panel header */}
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #0D2137, #263238)" }}>
          <div>
            <p className="text-white/60 text-xs">Stock Entries</p>
            <h3 className="text-white font-bold text-lg" style={{ fontFamily:"'Playfair Display', serif" }}>
              {drug.name} {drug.strength}
            </h3>
            <p className="text-white/60 text-xs mt-0.5">{drug.form} · {drug.drugId}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-white/50 text-xs">Total Active Stock</p>
              <p className="text-white font-bold text-xl" style={{ fontFamily:"'Playfair Display', serif" }}>
                {totalActive} <span className="text-sm font-normal text-white/60">{drug.unit}</span>
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Add stock button */}
        <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <button onClick={() => setModal("add")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #263238, #37474F)" }}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/>
            </svg>
            Add Stock Entry
          </button>
        </div>

        {/* Stock entries list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-3xl animate-pulse mb-2">📦</div>
              <p className="text-sm">Loading stock entries…</p>
            </div>
          ) : stocks.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm font-medium">No stock entries yet</p>
              <p className="text-xs mt-1">Click "Add Stock Entry" to receive new stock</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stocks.map(stock => {
                const sc    = STOCK_STATUS_CONFIG[stock.status] || STOCK_STATUS_CONFIG.active;
                const exp   = new Date(stock.expiryDate);
                const today = new Date();
                const daysLeft = Math.ceil((exp - today) / 86400000);
                const isExpiringSoon = stock.status === "active" && daysLeft <= 30 && daysLeft > 0;
                const isExpired      = stock.status === "expired" || daysLeft <= 0;

                return (
                  <div key={stock._id} className={`px-6 py-4 hover:bg-gray-50 transition ${isExpired ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-800">{stock.stockId}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                            {sc.label}
                          </span>
                          {isExpiringSoon && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              ⚠️ Exp. soon
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-2">
                          <div>
                            <p className="text-xs text-gray-400">Received</p>
                            <p className="text-sm font-semibold text-gray-800">{stock.receivedQty} {drug.unit}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Remaining</p>
                            <p className={`text-sm font-semibold ${stock.remainingQty === 0 ? "text-gray-400" : "text-slate-700"}`}>
                              {stock.remainingQty} {drug.unit}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Unit Price</p>
                            <p className="text-sm font-semibold text-gray-800">
                              {stock.unitPrice > 0 ? `LKR ${stock.unitPrice}` : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <p className="text-xs text-gray-400">Expiry</p>
                            <p className={`text-sm font-medium ${isExpired ? "text-red-600" : isExpiringSoon ? "text-amber-600" : "text-gray-700"}`}>
                              {exp.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
                              {isExpired      && " · Expired"}
                              {isExpiringSoon && ` · ${daysLeft}d left`}
                            </p>
                          </div>
                          {stock.manufacturedDate && (
                            <div>
                              <p className="text-xs text-gray-400">Manufactured</p>
                              <p className="text-sm text-gray-700">
                                {new Date(stock.manufacturedDate).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Dispensed progress bar */}
                        {stock.receivedQty > 0 && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>Dispensed: {stock.receivedQty - stock.remainingQty}</span>
                              <span>{Math.round(((stock.receivedQty - stock.remainingQty) / stock.receivedQty) * 100)}% used</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-slate-400 transition-all"
                                style={{ width: `${Math.round(((stock.receivedQty - stock.remainingQty) / stock.receivedQty) * 100)}%` }} />
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-gray-400 mt-2">
                          Added by {stock.addedBy?.name || "—"} · {new Date(stock.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Delete (only if not partially dispensed) */}
                      {stock.remainingQty === stock.receivedQty && stock.status !== "exhausted" && (
                        <button onClick={() => setModal({ type:"delete", stock })}
                          className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition flex-shrink-0 mt-1">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function PharmacyInventory() {
  const [drugs,         setDrugs]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [category,      setCategory]      = useState("All");
  const [statusFilter,  setStatusFilter]  = useState("All");
  const [expandedId,    setExpandedId]    = useState(null);
  const [modal,         setModal]         = useState(null);
  const [confirmDrug,   setConfirmDrug]   = useState(null);
  const [stockPanel,    setStockPanel]    = useState(null); // drug object | null
  const [toast,         setToast]         = useState(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const fetchDrugs = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/drugs now returns totalStock and isLowStock per drug
      const res  = await fetch(`${API}/drugs`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setDrugs(data.drugs);
      else showToast(data.message || "Failed to load drugs", "error");
    } catch {
      showToast("Cannot connect to server.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrugs(); }, [fetchDrugs]);

  const handleSaved = (savedDrug, action) => {
    setDrugs(prev => {
      const idx = prev.findIndex(d => d._id === savedDrug._id);
      if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], ...savedDrug }; return next; }
      return [{ ...savedDrug, totalStock: 0 }, ...prev];
    });
    setModal(null);
    showToast(`Drug ${action} successfully`);
  };

  const handleDelete = async (drugId) => {
    const drug = enriched.find(d => d._id === drugId);
    setConfirmDrug(null);
    try {
      const res  = await fetch(`${API}/drugs/${drugId}`, { method:"DELETE", headers:authHeaders() });
      const data = await res.json();
      // Backend blocked — show blocked dialog
      if (data.cannotDelete) {
        setConfirmDrug({ ...drug, _blocked: true, _blockedMessage: data.message });
        return;
      }
      if (!data.success) throw new Error(data.message);
      setDrugs(prev => prev.filter(d => d._id !== drugId));
      showToast("Drug removed from catalog");
    } catch (e) { showToast(e.message || "Failed to delete drug", "error"); }
  };

  // Called from StockEntriesPanel when stock is added/removed
  // Also syncs isActive: true when stock > 0, false when 0
  const handleStockChanged = (drugId, newTotal) => {
    setDrugs(prev => prev.map(d => {
      if (d._id !== drugId) return d;
      return {
        ...d,
        totalStock: newTotal,
        isLowStock: newTotal <= d.reorderLevel,
        isActive:   newTotal > 0,
      };
    }));
  };

  // Enrich drugs with status derived from totalStock
  const enriched = drugs.map(d => ({
    ...d,
    totalStock: d.totalStock ?? 0,
    status:     getStatus(d.totalStock ?? 0, d.reorderLevel),
  }));

  const inStock  = enriched.filter(d => d.status === "In Stock").length;
  const lowStock = enriched.filter(d => d.status === "Low Stock").length;
  const outStock = enriched.filter(d => d.status === "Out of Stock").length;

  const filtered = enriched.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      d.name.toLowerCase().includes(q) ||
      (d.drugId || "").toLowerCase().includes(q) ||
      (d.brand  || "").toLowerCase().includes(q);
    return matchSearch &&
      (category     === "All" || d.category === category) &&
      (statusFilter === "All" || d.status   === statusFilter);
  });

  return (
    <PharmacyLayout activePage="Inventory">
      <style>{`
        @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes slideFromRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {confirmDrug && (
        <ConfirmDialog
          title={confirmDrug._blocked ? "Cannot Delete Drug" : "Confirm Delete"}
          message={confirmDrug._blocked
            ? `"${confirmDrug.name}" still has stock entries.`
            : `Remove "${confirmDrug.name}" from the drug catalog? This cannot be undone.`}
          blocked={confirmDrug._blocked}
          blockedMessage={confirmDrug._blockedMessage}
          onConfirm={() => handleDelete(confirmDrug._id)}
          onCancel={() => setConfirmDrug(null)}
        />
      )}
      {modal === "add" && <DrugFormModal drug={null} onClose={() => setModal(null)} onSaved={handleSaved} />}
      {modal?.type === "edit" && <DrugFormModal drug={modal.drug} onClose={() => setModal(null)} onSaved={handleSaved} />}
      {stockPanel && (
        <StockEntriesPanel
          drug={enriched.find(d => d._id === stockPanel._id) || stockPanel}
          onClose={() => setStockPanel(null)}
          onStockChanged={handleStockChanged}
        />
      )}

      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily:"'Playfair Display', serif" }}>
              Medicine Inventory
            </h1>
            <p className="text-sm text-gray-400 mt-1">Manage drug catalog and stock entries independently</p>
          </div>
          <div className="flex items-center gap-3">
            <InventoryPDFButton />
            <button onClick={() => setModal("add")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg transition-transform hover:scale-105"
              style={{ background:"linear-gradient(135deg, #263238, #37474F)" }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/>
              </svg>
              Add Drug
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label:"Total SKUs",   value:enriched.length, color:"#1565C0" },
            { label:"In Stock",     value:inStock,         color:"#263238" },
            { label:"Low Stock",    value:lowStock,        color:"#E65100" },
            { label:"Out of Stock", value:outStock,        color:"#B71C1C" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold" style={{ fontFamily:"'Playfair Display', serif", color:s.color }}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Out of stock alert */}
        {outStock > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl">🚨</span>
            <div>
              <p className="text-sm font-semibold text-red-800">Out of Stock Alert</p>
              <p className="text-xs text-red-700 mt-1">
                {enriched.filter(d => d.status === "Out of Stock").map(d => d.name).join(", ")} — add stock entries immediately.
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-48 relative">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
              </svg>
              <input type="text" placeholder="Search by name, brand, or ID…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 transition"/>
            </div>
            <div className="flex gap-2 flex-wrap">
              {["All","In Stock","Low Stock","Out of Stock"].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${statusFilter===s?"text-white shadow-md":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  style={statusFilter===s?{background:"linear-gradient(135deg, #263238, #37474F)"}:{}}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${category===c?"bg-slate-200 text-slate-800 font-semibold":"text-gray-500 hover:bg-gray-100"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Drug table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3 animate-pulse">💊</div>
              <p className="text-sm">Loading inventory…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Medicine","Category","Total Stock","Unit Price","Stock Status","Active","Actions"].map(h => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase ${h==="Actions"?"text-right":"text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(drug => {
                    const s        = STATUS_CONFIG[drug.status];
                    const pct      = Math.min(Math.round((drug.totalStock / Math.max(drug.reorderLevel * 1.5, 1)) * 100), 100);
                    const expanded = expandedId === drug._id;
                    const inactive = drug.isActive === false;
                    return (
                      <>
                        <tr key={drug._id} onClick={() => setExpandedId(expanded ? null : drug._id)}
                          className={`hover:bg-gray-50 transition cursor-pointer ${inactive ? "opacity-50" : ""}`}>

                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`}/>
                              <div>
                                <div className="text-sm font-semibold text-gray-800">{drug.name}</div>
                                <div className="text-xs text-gray-400">{drug.drugId} · {drug.form} · {drug.strength}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{drug.category}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-sm font-bold text-gray-800">
                              {drug.totalStock} <span className="text-xs font-normal text-gray-400">{drug.unit}</span>
                            </div>
                            <div className="w-20 bg-gray-100 rounded-full h-1.5 mt-1">
                              <div className={`h-1.5 rounded-full transition-all ${s.bar}`} style={{ width:`${pct}%` }}/>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">reorder at {drug.reorderLevel}</div>
                          </td>
                          <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">
                            {drug.unitPrice > 0 ? `LKR ${drug.unitPrice}` : "—"}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
                              {drug.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                              drug.isActive !== false
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-gray-100 text-gray-500 border-gray-200"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${drug.isActive !== false ? "bg-emerald-500" : "bg-gray-400"}`}/>
                              {drug.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              {/* Stock Entries */}
                              <button onClick={() => setStockPanel(drug)} title="Manage Stock Entries"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition">
                                📦 Stock
                              </button>
                              {/* Edit */}
                              <button onClick={() => setModal({ type:"edit", drug })} title="Edit Drug"
                                className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition">
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                                </svg>
                              </button>
                              {/* Delete */}
                              <button onClick={() => setConfirmDrug(drug)} title="Delete Drug"
                                className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition">
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded row */}
                        {expanded && (
                          <tr key={`${drug._id}-exp`} className="bg-slate-50/40">
                            <td colSpan={6} className="px-5 py-4 border-t border-slate-100">
                              <div className="flex flex-wrap gap-6 text-sm">
                                <div><span className="text-xs text-gray-400 block">Brand</span><span className="font-medium text-gray-700">{drug.brand || "—"}</span></div>
                                <div><span className="text-xs text-gray-400 block">Reorder Level</span><span className="font-medium text-gray-700">{drug.reorderLevel} {drug.unit}</span></div>
                                <div><span className="text-xs text-gray-400 block">Added By</span><span className="font-medium text-gray-700">{drug.addedBy?.name || "—"}</span></div>
                                <div><span className="text-xs text-gray-400 block">Last Updated</span><span className="font-medium text-gray-700">{new Date(drug.updatedAt).toLocaleDateString()}</span></div>
                                <button onClick={() => { setExpandedId(null); setStockPanel(drug); }}
                                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                                  style={{ background:"linear-gradient(135deg, #263238, #37474F)" }}>
                                  📦 View All Stock Entries →
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">📦</div>
                  <div className="text-gray-500 font-medium">No medicines found</div>
                  <p className="text-xs text-gray-400 mt-1">Try adjusting filters or add a new drug</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PharmacyLayout>
  );
}