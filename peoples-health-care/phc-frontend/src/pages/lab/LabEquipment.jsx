import { useState, useEffect, useCallback } from "react";
import LabLayout from "../../components/LabLayout";
import api from "../../services/api";

// ─── Static data ───────────────────────────────────────────────────────────
const LAB_LOCATIONS = ["Lab A", "Lab B", "Lab C", "Lab D" ];

const MACHINE_SUBCATEGORIES = [
  "Diagnostic & Testing Machines","Sample Processing Equipment",
  "Storage Equipment","Safety & Laboratory Infrastructure","Digital & Power Equipment",
];
const CONSUMABLE_SUBCATEGORIES = [
  "Sample Collection Materials","Blood Collection Tubes","Testing Consumables",
  "Reagents & Testing Kits","Patient Safety & Infection Control Items",
  "Waste Management Materials","General Laboratory Use Items",
];
const MACHINE_NAMES = {
  "Diagnostic & Testing Machines":       ["Hematology Analyzer","ESR Analyzer","Fully Automated Biochemistry Analyzer","Semi-Auto Biochemistry Analyzer","Electrolyte Analyzer","Immunoassay Analyzer (CLIA / ELISA)","ELISA Reader","ELISA Washer"],
  "Sample Processing Equipment":         ["Laboratory Centrifuge","Blood Tube Mixer / Roller Mixer","Vortex Mixer","Laboratory Incubator","Water Bath","Automated Pipetting System"],
  "Storage Equipment":                   ["Laboratory Refrigerator (2–8°C)","Reagent Refrigerator","Deep Freezer (-20°C)","Deep Freezer (-80°C)","Sample Storage Freezer"],
  "Safety & Laboratory Infrastructure":  ["Biosafety Cabinet","Laminar Air Flow Cabinet","Laboratory Exhaust / Ventilation System","Air Conditioning System","Hand Washing Sink Unit"],
  "Digital & Power Equipment":           ["Laboratory Computer Systems","Laboratory Information System (LIS) Server","Barcode Scanner","Label Printer","Report Printer","UPS (Uninterruptible Power Supply)","Power Backup Generator","Voltage Stabilizer"],
};
const CONSUMABLE_NAMES = {
  "Sample Collection Materials":               ["Disposable Syringes","Vacutainer Needles","Blood Collection Sets","Tourniquets","Lancets"],
  "Blood Collection Tubes":                    ["EDTA Tubes (Purple cap)","Sodium Citrate Tubes (Black cap)","Fluoride Oxalate Tubes (Grey cap)","Plain Tubes (Red cap)","Serum Separator Tubes – SST (Yellow cap)","ESR Tubes","Micro Collection Tubes"],
  "Testing Consumables":                       ["Micropipette Tips","Sample Cups","Reaction Cuvettes","Test Tubes","Glass Slides","Cover Slips","ELISA Plates","Test Cartridges","Rapid Test Cassettes / Strips","Dropper Pipettes"],
  "Reagents & Testing Kits":                   ["Biochemistry Reagent Kits","Liver Profile Reagents","Renal Profile Reagents","Thyroid Profile Reagents","Vitamin D Test Kits","Dengue NS1 Antigen Test Kits","Electrolyte Reagents","Calibration Solutions","Quality Control Materials","Buffer Solutions"],
  "Patient Safety & Infection Control Items":  ["Cotton Packs","Alcohol Swabs","Gauze Pieces","Adhesive Plasters","Disposable Gloves","Face Masks","Surgical Masks","Protective Gowns","Shoe Covers","Disposable Caps"],
  "Waste Management Materials":                ["Biohazard Waste Bags","Sharps Disposal Containers","Specimen Disposal Bags","Chemical Waste Containers"],
  "General Laboratory Use Items":              ["Tissue Paper / Wipes","Distilled Water","Cleaning Disinfectants","Surface Sanitizers","Hand Sanitizer"],
};
const TESTS = ["FBC","ESR","FBS","Liver Profile","Renal Profile","Thyroid Profile","Serum Vit D Level","Dengue Ag","General","All Tests"];

const fmt = d => d ? new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const daysUntil = d => d ? Math.ceil((new Date(d)-new Date())/86400000) : null;

// ─── Edit Machine Modal (lab can only edit, not add/restock) ───────────────
function EditMachineModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    subCategory: item.subCategory || MACHINE_SUBCATEGORIES[0],
    name:        item.name || "",
    serialNumber:item.serialNumber || "",
    testFor:     item.testFor || "",
    installedDate:   item.installedDate   ? item.installedDate.slice(0,10)   : "",
    expiryDate:      item.expiryDate      ? item.expiryDate.slice(0,10)      : "",
    nextServiceDate: item.nextServiceDate ? item.nextServiceDate.slice(0,10) : "",
    location:        item.location || "",
    machineStatus:   item.machineStatus || "operational",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);
  const up = (k,v) => setForm(p=>({...p,[k]:v}));

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      await api.put(`/equipment/${item._id}`, { ...form, category:"machine" });
      onSave();
    } catch(e){ setErr(e.response?.data?.message||e.message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="font-bold text-gray-800 text-lg" style={{fontFamily:"'Playfair Display',serif"}}>Edit Machine</h2>
            <p className="text-xs text-gray-400 mt-0.5">{item.name} {item.serialNumber ? `· SN: ${item.serialNumber}`:""}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location</label>
              <select value={form.location} onChange={e=>up("location",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">— Select —</option>
                {LAB_LOCATIONS.map(l=><option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Serial Number</label>
              <input type="text" value={form.serialNumber} onChange={e=>up("serialNumber",e.target.value)} placeholder="e.g. SN-001" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Used For Test</label>
            <select value={form.testFor} onChange={e=>up("testFor",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">— Select —</option>
              {TESTS.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[["Installed","installedDate"],["Expiry","expiryDate"],["Next Service","nextServiceDate"]].map(([l,k])=>(
              <div key={k}>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{l}</label>
                <input type="date" value={form[k]} onChange={e=>up(k,e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
            <select value={form.machineStatus} onChange={e=>up("machineStatus",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {["operational","service_due","under_repair","decommissioned"].map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
            </select>
          </div>
          {err && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">❌ {err}</div>}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60" style={{background:"linear-gradient(135deg,#0D47A1,#1565C0)"}}>
              {saving?"Saving…":"Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Consumable Modal (lab: no restock, just edit metadata) ───────────
function EditConsumableModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    subCategory:       item.subCategory       || CONSUMABLE_SUBCATEGORIES[0],
    name:              item.name              || "",
    unit:              item.unit              || "boxes",
    lowStockThreshold: item.lowStockThreshold ?? 10,
    consumableExpiry:  item.consumableExpiry  ? item.consumableExpiry.slice(0,10) : "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);
  const up = (k,v) => setForm(p=>({...p,[k]:v}));

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      await api.put(`/equipment/${item._id}`, { ...form, category:"consumable" });
      onSave();
    } catch(e){ setErr(e.response?.data?.message||e.message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="font-bold text-gray-800 text-lg" style={{fontFamily:"'Playfair Display',serif"}}>Edit Consumable</h2>
            <p className="text-xs text-gray-400 mt-0.5">Update details — stock quantity is managed by Admin</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Unit</label>
              <select value={form.unit} onChange={e=>up("unit",e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {["boxes","packs","pairs","tubes","bottles","bags","rolls","units","pieces","sets"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Alert When ≤</label>
              <input type="number" min="1" value={form.lowStockThreshold} onChange={e=>up("lowStockThreshold",parseInt(e.target.value)||10)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Expiry Date</label>
            <input type="date" value={form.consumableExpiry} onChange={e=>up("consumableExpiry",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          </div>
          {err && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">❌ {err}</div>}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60" style={{background:"linear-gradient(135deg,#1B5E20,#2E7D32)"}}>
              {saving?"Saving…":"Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Service Request Modal ─────────────────────────────────────────────────
function ServiceRequestModal({ machine, onClose, onSent }) {
  const [form, setForm] = useState({ requestType:"scheduled_service", urgency:"routine", notes:"" });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);
  const handleSend = async () => {
    setSending(true); setErr(null);
    try { await api.post(`/equipment/${machine._id}/service-request`, form); onSent(); }
    catch(e){ setErr(e.response?.data?.message||e.message); setSending(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 rounded-t-3xl" style={{background:"linear-gradient(135deg,#B71C1C,#C62828)"}}>
          <h3 className="text-white font-bold text-lg" style={{fontFamily:"'Playfair Display',serif"}}>🔧 Notify Resource Management</h3>
          <p className="text-white/70 text-xs mt-1">{machine.name}{machine.serialNumber?` · SN: ${machine.serialNumber}`:""} · {machine.location||"Lab"}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
            ⚠️ This sends a request to Resource Management (Admin).
            {machine.nextServiceDate && ` Next service: ${fmt(machine.nextServiceDate)}.`}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Request Type</label>
            <select value={form.requestType} onChange={e=>setForm(p=>({...p,requestType:e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
              <option value="scheduled_service">Scheduled Service</option>
              <option value="emergency">Emergency Repair</option>
              <option value="replacement">Replacement Required</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Urgency</label>
            <select value={form.urgency} onChange={e=>setForm(p=>({...p,urgency:e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
              <option value="routine">Routine (planned)</option>
              <option value="5_day_warning">5-Day Warning</option>
              <option value="1_day_warning">1-Day Warning (urgent)</option>
              <option value="emergency">Emergency — immediate action</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Notes</label>
            <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Describe the issue…" rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"/>
          </div>
          {err && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">❌ {err}</div>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSend} disabled={sending} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60" style={{background:"linear-gradient(135deg,#B71C1C,#C62828)"}}>
              {sending?"Sending…":"📨 Send to Resource Management"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stock Notify Modal ────────────────────────────────────────────────────
function StockNotifyModal({ item, onClose, onSent }) {
  const [notes, setNotes] = useState(`Stock is low. Current: ${item.quantity} ${item.unit}. Please reorder.`);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);
  const handleSend = async () => {
    setSending(true); setErr(null);
    try { await api.post(`/equipment/${item._id}/stock-request`, { notes }); onSent(); }
    catch(e){ setErr(e.response?.data?.message||e.message); setSending(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 rounded-t-3xl" style={{background:"linear-gradient(135deg,#E65100,#F57C00)"}}>
          <h3 className="text-white font-bold text-lg" style={{fontFamily:"'Playfair Display',serif"}}>📦 Notify Resource Management</h3>
          <p className="text-white/70 text-xs mt-1">{item.name} · {item.quantity} {item.unit} remaining</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">
            This sends a low-stock notification to Resource Management (Admin). They will arrange restocking.
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Message</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"/>
          </div>
          {err && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">❌ {err}</div>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSend} disabled={sending} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60" style={{background:"linear-gradient(135deg,#E65100,#F57C00)"}}>
              {sending?"Sending…":"📨 Send Notification"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Use Stock Modal (no restock — admin only) ────────────────────────────
function UseStockModal({ item, onClose, onDone }) {
  const [amount,  setAmount]  = useState(1);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  const isOverStock = amount > item.quantity;

  const handleChange = (val) => {
    const n = parseInt(val) || 1;
    setAmount(n);
    setError(n > item.quantity
      ? `⚠️ Only ${item.quantity} ${item.unit} in stock. You cannot use more than available.`
      : null);
  };

  const handleSubmit = async () => {
    if (isOverStock) return;
    setSaving(true);
    try {
      await api.put(`/equipment/${item._id}/decrement`, { amount });
      onDone();
    } catch(e) {
      setError(e.response?.data?.message || e.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-5 rounded-t-3xl" style={{background:"linear-gradient(135deg,#0D47A1,#1565C0)"}}>
          <h3 className="text-white font-bold" style={{fontFamily:"'Playfair Display',serif"}}>📦 Mark Stock Used</h3>
          <p className="text-white/70 text-xs mt-1">{item.name} · Current: {item.quantity} {item.unit}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">How many did you use?</label>
            <input
              type="number" min="1" max={item.quantity} value={amount}
              onChange={e => handleChange(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm text-center font-bold text-lg focus:outline-none focus:ring-2 ${
                isOverStock ? "border-red-400 bg-red-50 focus:ring-red-300" : "border-gray-200 focus:ring-blue-400"
              }`}
            />
            {!isOverStock && (
              <p className="text-xs text-gray-400 mt-1 text-center">
                New quantity: <span className="font-semibold text-gray-600">{Math.max(0, item.quantity - amount)} {item.unit}</span>
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          {!error && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              ℹ️ Restocking is done by Resource Management (Admin).
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSubmit} disabled={saving || isOverStock}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
              style={{background:"linear-gradient(135deg,#0D47A1,#1565C0)"}}>
              {saving ? "Saving…" : "Confirm Use"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Equipment Tree View (by sub-category) ─────────────────────────────────
function EquipmentTree({ items, onEdit, onServiceReq, onStockNotify, onUse }) {
  const [openSubs, setOpenSubs] = useState(
    () => Object.fromEntries(MACHINE_SUBCATEGORIES.concat(CONSUMABLE_SUBCATEGORIES).map(s=>[s,false]))
  );
  const [openNames, setOpenNames] = useState({});
  const toggleSub  = s => setOpenSubs(p=>({...p,[s]:!p[s]}));
  const toggleName = k => setOpenNames(p=>({...p,[k]:!p[k]}));

  const machines    = items.filter(i=>i.category==="machine");
  const consumables = items.filter(i=>i.category==="consumable");

  const machinesBySub    = {};
  const consumablesBySub = {};
  MACHINE_SUBCATEGORIES.forEach(s   =>{ machinesBySub[s]    = machines.filter(i=>i.subCategory===s); });
  CONSUMABLE_SUBCATEGORIES.forEach(s=>{ consumablesBySub[s] = consumables.filter(i=>i.subCategory===s); });

  // Build a map of name → list of machine records (multiple units of same name)
  const machinesByName = {};
  machines.forEach(m => {
    if(!machinesByName[m.name]) machinesByName[m.name] = [];
    machinesByName[m.name].push(m);
  });
  const consumablesByName = {};
  consumables.forEach(c => {
    consumablesByName[c.name] = c; // consumables: one per name
  });

  const renderMachineUnit = (m) => {
    const d       = daysUntil(m.nextServiceDate);
    const urgent  = d!==null && d<=5;
    const pending = (m.serviceRequests||[]).filter(r=>r.status==="pending");
    const statusCfg = {
      operational:{dot:"bg-green-400", badge:"bg-green-100 text-green-700", label:"Operational"},
      service_due:{dot:"bg-red-500 animate-pulse", badge:"bg-red-100 text-red-600", label:"Service Due"},
      under_repair:{dot:"bg-amber-400", badge:"bg-amber-100 text-amber-700", label:"Under Repair"},
      decommissioned:{dot:"bg-gray-400", badge:"bg-gray-100 text-gray-500", label:"Decommissioned"},
    }[m.machineStatus]||{dot:"bg-gray-400",badge:"bg-gray-100 text-gray-500",label:"Unknown"};

    return (
      <div key={m._id} className={`border-l-4 ${urgent?"border-red-400":"border-transparent"}`}>
        <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusCfg.dot}`}/>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-700">
              {m.serialNumber ? `SN: ${m.serialNumber}` : `Unit`}
            </span>
            <div className="text-xs text-gray-400 mt-0.5">
              📍 {m.location||"—"} {m.testFor&&`· 🔬 ${m.testFor}`}
              {m.nextServiceDate&&` · Service: ${fmt(m.nextServiceDate)}`}
              {urgent && <span className="ml-2 text-red-600 font-bold">{d<=0?"⛔ OVERDUE":`⚠️ ${d}d`}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {pending.length>0 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">📨 {pending.length}</span>}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.badge}`}>{statusCfg.label}</span>
            <button onClick={()=>onServiceReq(m)} className="text-xs px-2.5 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600">🔧</button>
          </div>
        </div>
      </div>
    );
  };

  // Renders the machine NAME row (with expand for individual units)
  const renderMachineNameRow = (machineName, sub) => {
    const units = machinesByName[machineName] || [];
    const hasUnits = units.length > 0;
    const nameKey = `${sub}::${machineName}`;
    const isNameOpen = openNames[nameKey] === true; // default collapsed
    const anyUrgent = units.some(m=>{ const d=daysUntil(m.nextServiceDate); return d!==null&&d<=5; });
    const statusCfg = !hasUnits ? {dot:"bg-gray-200",badge:"bg-gray-50 text-gray-400",label:"Not Added"} :
      units.some(m=>m.machineStatus==="service_due") ? {dot:"bg-red-500 animate-pulse",badge:"bg-red-100 text-red-600",label:"Service Due"} :
      units.some(m=>m.machineStatus==="under_repair") ? {dot:"bg-amber-400",badge:"bg-amber-100 text-amber-700",label:"Under Repair"} :
      {dot:"bg-green-400",badge:"bg-green-100 text-green-700",label:"Operational"};

    return (
      <div key={machineName}>
        <div className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition ${!hasUnits?"opacity-60":""}`}>
          {hasUnits ? (
            <button onClick={()=>toggleName(nameKey)} className="flex-shrink-0">
              <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isNameOpen?"rotate-90":""}`}>
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
              </svg>
            </button>
          ) : (
            <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300"/>
            </span>
          )}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusCfg.dot}`}/>
          <span className={`text-sm flex-1 ${hasUnits?"font-medium text-gray-800":"text-gray-400"}`}>{machineName}</span>
          {anyUrgent && <span className="text-xs text-red-600 font-bold">⚠️</span>}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.badge}`}>
            {hasUnits ? `${units.length} unit${units.length>1?"s":""}` : "Not Added"}
          </span>
        </div>
        {hasUnits && isNameOpen && (
          <div className="ml-8 border-l border-dashed border-gray-200 pl-2">
            {units.map(renderMachineUnit)}
          </div>
        )}
      </div>
    );
  };

  const renderConsumableRow = (c) => {
    const isLow  = c.quantity <= c.lowStockThreshold;
    const isEmpty = c.quantity === 0;
    const pct    = Math.min(100, Math.round((c.quantity/(c.lowStockThreshold*3))*100));
    const already = (c.stockRequests||[]).some(r=>r.status==="pending");
    return (
      <div key={c._id} className={`border-l-4 ${isEmpty?"border-red-400":isLow?"border-orange-400":"border-transparent"}`}>
        <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isEmpty?"bg-red-500 animate-pulse":isLow?"bg-orange-400 animate-pulse":"bg-green-400"}`}/>
          <span className="text-sm font-medium text-gray-800 flex-1">{c.name}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden hidden md:block">
              <div className="h-full rounded-full" style={{width:`${pct}%`,background:isEmpty?"#EF4444":isLow?"#F97316":"#10B981"}}/>
            </div>
            <span className={`text-xs font-bold ${isEmpty?"text-red-600":isLow?"text-orange-600":"text-green-700"}`}>
              {c.quantity} <span className="font-normal text-gray-400">{c.unit}</span>
            </span>
            {isEmpty && <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">OUT</span>}
            {!isEmpty&&isLow && <span className="text-xs bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded-full">LOW</span>}
            <button onClick={()=>onUse(c)} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">− Use</button>
            <button onClick={()=>onStockNotify(c)} disabled={already}
              className={`text-xs px-2.5 py-1 rounded-lg ${already?"bg-gray-100 text-gray-400 cursor-not-allowed":"bg-orange-500 text-white hover:bg-orange-600"}`}>
              {already?"✓ Notified":"📦 Notify"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Consumable name row — shows the item even if not added yet
  const renderConsumableNameRow = (itemName) => {
    const c = consumablesByName[itemName];
    if(c) return renderConsumableRow(c);
    // Not added yet — show greyed out placeholder
    return (
      <div key={itemName} className="flex items-center gap-3 px-5 py-2 opacity-50">
        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300"/>
        <span className="text-sm text-gray-400 flex-1">{itemName}</span>
        <span className="text-xs text-gray-300 px-2 py-0.5 rounded-full border border-gray-200">Not Added</span>
      </div>
    );
  };

  // Subcategory section — always shown, even if empty
  const SubSection = ({ title, allNames, isMachine, sub }) => {
    const isOpen = !!openSubs[title];
    const addedCount = isMachine
      ? (machinesBySub[title]||[]).length
      : allNames.filter(n=>!!consumablesByName[n]).length;

    return (
      <div className="ml-4 border-l-2 border-gray-100 pl-3">
        <button onClick={()=>toggleSub(title)} className="flex items-center gap-2 py-1.5 text-left w-full group">
          <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isOpen?"rotate-90":""}`}>
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
          </svg>
          <span className="text-xs font-semibold text-gray-600 group-hover:text-gray-800">{title}</span>
          <span className="text-xs text-gray-400 ml-auto">
            {addedCount > 0 ? `${addedCount} / ${allNames.length}` : <span className="text-gray-300">{allNames.length} items</span>}
          </span>
        </button>
        {isOpen && (
          <div className="border-l border-dashed border-gray-200 ml-2">
            {allNames.map(name =>
              isMachine
                ? renderMachineNameRow(name, sub)
                : renderConsumableNameRow(name)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Machines section — always shown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
          <span className="text-sm font-bold text-blue-800">🖥️ Laboratory Machines & Equipment</span>
          <span className="ml-2 text-xs text-blue-600">({machines.length} added)</span>
        </div>
        <div className="px-2 py-2 space-y-1">
          {MACHINE_SUBCATEGORIES.map(sub => (
            <SubSection
              key={sub}
              title={sub}
              allNames={MACHINE_NAMES[sub]||[]}
              isMachine={true}
              sub={sub}
            />
          ))}
        </div>
      </div>

      {/* Consumables section — always shown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
          <span className="text-sm font-bold text-purple-800">🧫 Consumables & Single-Use Items</span>
          <span className="ml-2 text-xs text-purple-600">({consumables.length} added)</span>
        </div>
        <div className="px-2 py-2 space-y-1">
          {CONSUMABLE_SUBCATEGORIES.map(sub => (
            <SubSection
              key={sub}
              title={sub}
              allNames={CONSUMABLE_NAMES[sub]||[]}
              isMachine={false}
              sub={sub}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Lab Rooms Map View ────────────────────────────────────────────────────
function LabRoomsView({ machines }) {
  const [openRooms, setOpenRooms] = useState(
    () => Object.fromEntries(LAB_LOCATIONS.map(l=>[l,false]))
  );
  const [openSubs, setOpenSubs] = useState({});
  const toggleRoom = r => setOpenRooms(p=>({...p,[r]:!p[r]}));
  const toggleSub  = k => setOpenSubs(p=>({...p,[k]:!p[k]}));

  const roomColors = {
    "Lab A": { header:"bg-cyan-400",   light:"bg-cyan-50",   border:"border-cyan-200",   text:"text-cyan-800"   },
    "Lab B": { header:"bg-cyan-500",   light:"bg-cyan-50",   border:"border-cyan-200",   text:"text-cyan-800"   },
    "Lab C": { header:"bg-cyan-600", light:"bg-cyan-50", border:"border-cyan-200", text:"text-cyan-800" },
    "Lab D": { header:"bg-cyan-700",   light:"bg-cyan-50",   border:"border-cyan-200",   text:"text-cyan-800"   },
  };

  return (
    <div className="space-y-4">
      {LAB_LOCATIONS.map(room => {
        const roomMachines = machines.filter(m=>m.location===room);
        const isOpen = !!openRooms[room];
        const col = roomColors[room];
        const urgentCount = roomMachines.filter(m=>{ const d=daysUntil(m.nextServiceDate); return d!==null&&d<=5; }).length;

        // group by subCategory
        const bySub = {};
        MACHINE_SUBCATEGORIES.forEach(s=>{ bySub[s]=roomMachines.filter(m=>m.subCategory===s); });

        return (
          <div key={room} className={`rounded-2xl border shadow-sm overflow-hidden ${col.border}`}>
            {/* Room header */}
            <button onClick={()=>toggleRoom(room)} className={`w-full flex items-center gap-3 px-5 py-4 text-left ${col.header} text-white`}>
              <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen?"rotate-90":""}`}>
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
              </svg>
              <span className="font-bold text-base">🏥 {room}</span>
              <span className="text-white/70 text-sm ml-1">— {roomMachines.length} machine{roomMachines.length!==1?"s":""}</span>
              {urgentCount > 0 && (
                <span className="ml-auto text-xs bg-white/20 border border-white/40 text-white px-2 py-0.5 rounded-full font-bold">
                  ⚠️ {urgentCount} alert{urgentCount>1?"s":""}
                </span>
              )}
              {roomMachines.length===0 && <span className="ml-auto text-white/50 text-xs">No equipment assigned</span>}
            </button>

            {/* Room content */}
            {isOpen && roomMachines.length > 0 && (
              <div className={`${col.light} px-4 py-3 space-y-2`}>
                {MACHINE_SUBCATEGORIES.map(sub => {
                  const subMachines = bySub[sub]||[];
                  if(subMachines.length===0) return null;
                  const subKey = `${room}::${sub}`;
                  const isSubOpen = openSubs[subKey] === true; // default collapsed
                  return (
                    <div key={sub} className={`rounded-xl border ${col.border} bg-white overflow-hidden`}>
                      <button onClick={()=>toggleSub(subKey)} className={`w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 ${col.light}`}>
                        <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${isSubOpen?"rotate-90":""}`}>
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                        </svg>
                        <span className={`text-xs font-bold ${col.text}`}>{sub}</span>
                        <span className="ml-auto text-xs text-gray-400">{subMachines.length}</span>
                      </button>
                      {isSubOpen && (
                        <div className="divide-y divide-gray-50">
                          {subMachines.map(m => {
                            const d = daysUntil(m.nextServiceDate);
                            const urgent = d!==null && d<=5;
                            const statusCfg = {
                              operational:{dot:"bg-green-400",text:"text-green-700",label:"Operational"},
                              service_due:{dot:"bg-red-500",text:"text-red-600",label:"Service Due"},
                              under_repair:{dot:"bg-amber-400",text:"text-amber-700",label:"Under Repair"},
                              decommissioned:{dot:"bg-gray-400",text:"text-gray-500",label:"Decommissioned"},
                            }[m.machineStatus]||{dot:"bg-gray-400",text:"text-gray-500",label:"Unknown"};
                            return (
                              <div key={m._id} className={`flex items-center gap-3 px-4 py-2.5 ${urgent?"bg-red-50":""}`}>
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusCfg.dot} ${urgent?"animate-pulse":""}`}/>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-gray-800">{m.name}</span>
                                  {m.serialNumber && <span className="ml-2 text-xs text-gray-400 font-mono">#{m.serialNumber}</span>}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {m.testFor && <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">{m.testFor}</span>}
                                  {urgent && <span className="text-xs text-red-600 font-bold">{d<=0?"⛔ OVERDUE":`⚠️ ${d}d`}</span>}
                                  <span className={`text-xs font-semibold ${statusCfg.text}`}>{statusCfg.label}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isOpen && roomMachines.length === 0 && (
              <div className={`${col.light} px-5 py-4 text-sm text-gray-400 italic`}>
                No machines are assigned to {room} yet.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Service Requests Panel (lab view — read-only, machine requests only) ──
function LabServiceRequestsPanel({ requests }) {
  const URGENCY = {
    emergency:       { bg:"bg-red-100",    text:"text-red-700",    border:"border-red-300",    icon:"🚨" },
    "1_day_warning": { bg:"bg-red-50",     text:"text-red-600",    border:"border-red-200",    icon:"⛔" },
    "5_day_warning": { bg:"bg-orange-100", text:"text-orange-700", border:"border-orange-300", icon:"⚠️" },
    routine:         { bg:"bg-blue-50",    text:"text-blue-700",   border:"border-blue-200",   icon:"📋" },
  };

  // Only show machine service requests
  const machineReqs = requests.filter(r => r.category === "machine");

  if (!machineReqs.length) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
      <div className="text-4xl mb-3">✅</div>
      <p className="text-gray-500 font-medium">No service requests sent</p>
      <p className="text-xs text-gray-400 mt-1">Use the 🔧 button on any machine to send a service request to Admin</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {machineReqs.map(req => {
        const urg = URGENCY[req.urgency] || URGENCY.routine;
        const stCfg = {
          pending:      { bg:"bg-red-100",    text:"text-red-700" },
          acknowledged: { bg:"bg-amber-100",  text:"text-amber-700" },
          resolved:     { bg:"bg-green-100",  text:"text-green-700" },
        }[req.status] || { bg:"bg-gray-100", text:"text-gray-600" };
        const fmtDT = d => d ? new Date(d).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
        return (
          <div key={String(req._id)} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${req.status==="pending"?urg.border:"border-gray-100"}`}>
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className={`text-2xl w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${urg.bg}`}>{urg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-800">{req.equipmentName}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${urg.bg} ${urg.text} ${urg.border}`}>
                      {req.urgency?.replace(/_/g," ") || "routine"}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stCfg.bg} ${stCfg.text}`}>{req.status}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {req.subCategory}
                    {req.location && ` · 📍 ${req.location}`}
                    {req.testFor  && ` · 🔬 ${req.testFor}`}
                    <br/>
                    <span className="font-semibold text-gray-700">{(req.requestType||"").replace(/_/g," ")}</span>
                  </div>
                  {req.notes && (
                    <div className="mt-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">📝 {req.notes}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">Sent: {fmtDT(req.sentAt)}</div>
                  {req.status === "resolved" && (
                    <div className="mt-1 text-xs text-green-700 font-semibold">✅ Admin has resolved this request</div>
                  )}
                  {req.status === "acknowledged" && (
                    <div className="mt-1 text-xs text-amber-700 font-semibold">👁️ Admin has acknowledged this request</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Low Stock Alerts Panel (lab view) ────────────────────────────────────
function LowStockAlertsPanel({ consumables, onNotify }) {
  const lowItems = consumables.filter(c => c.quantity <= c.lowStockThreshold);

  if (!lowItems.length) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
      <div className="text-4xl mb-3">✅</div>
      <p className="text-gray-500 font-medium">All consumables are well stocked</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3 flex items-center gap-3">
        <span className="text-2xl">📦</span>
        <div>
          <p className="font-semibold text-orange-800 text-sm">{lowItems.length} item{lowItems.length > 1 ? "s" : ""} need restocking</p>
          <p className="text-xs text-orange-600">Notify Resource Management (Admin) to arrange restocking for each item</p>
        </div>
      </div>

      {lowItems.map(c => {
        const isEmpty  = c.quantity === 0;
        const already  = (c.stockRequests||[]).some(r => r.status === "pending");
        const pct      = Math.min(100, Math.round((c.quantity / (c.lowStockThreshold * 3)) * 100));

        return (
          <div key={c._id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isEmpty ? "border-red-300" : "border-orange-200"}`}>
            <div className="px-5 py-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${isEmpty ? "bg-red-100" : "bg-orange-100"}`}>
                {isEmpty ? "🚫" : "⚠️"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">{c.name}</span>
                  {isEmpty && <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full border border-red-200">OUT OF STOCK</span>}
                  {!isEmpty && <span className="text-xs bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full border border-orange-200">LOW STOCK</span>}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="w-24 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width:`${pct}%`, background: isEmpty?"#EF4444":"#F97316" }}/>
                  </div>
                  <span className={`text-sm font-bold ${isEmpty?"text-red-600":"text-orange-600"}`}>
                    {c.quantity} <span className="font-normal text-gray-400 text-xs">{c.unit}</span>
                  </span>
                  <span className="text-xs text-gray-400">threshold: {c.lowStockThreshold}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{c.subCategory}</div>
              </div>
              <button
                onClick={() => onNotify(c)}
                disabled={already}
                className={`flex-shrink-0 text-xs px-4 py-2 rounded-xl font-semibold transition ${
                  already
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-orange-500 text-white hover:bg-orange-600 shadow-sm"
                }`}
              >
                {already ? "✓ Notified" : "📦 Notify Admin"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function LabEquipment() {
  const [view,         setView]         = useState("equipment"); // "equipment" | "rooms" | "service_requests" | "low_stock"
  const [items,        setItems]        = useState([]);
  const [requests,     setRequests]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [editItem,     setEditItem]     = useState(null);
  const [svcReq,       setSvcReq]       = useState(null);
  const [stockNotify,  setStockNotify]  = useState(null);
  const [useModal,     setUseModal]     = useState(null);

  useEffect(()=>{ fetchItems(); api.post("/equipment/check-alerts").catch(()=>{}); },[]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const [mr, cr, rr] = await Promise.all([
        api.get("/equipment?category=machine"),
        api.get("/equipment?category=consumable"),
        api.get("/equipment/pending-requests").catch(()=>({data:{requests:[]}})),
      ]);
      setItems([...(mr.data.items||[]), ...(cr.data.items||[])]);
      setRequests(rr.data.requests||[]);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  const done = useCallback(()=>{
    setEditItem(null); setSvcReq(null); setStockNotify(null); setUseModal(null);
    fetchItems();
  },[]);

  const machines    = items.filter(i=>i.category==="machine");
  const consumables = items.filter(i=>i.category==="consumable");
  const serviceReqCount = requests.filter(r=>r.category==="machine"&&r.status==="pending").length;
  const lowStockCount   = consumables.filter(c=>c.quantity<=c.lowStockThreshold).length;

  return (
    <LabLayout activePage="Equipment">
      {editItem?.category==="machine"    && <EditMachineModal    item={editItem} onClose={()=>setEditItem(null)} onSave={done}/>}
      {editItem?.category==="consumable" && <EditConsumableModal item={editItem} onClose={()=>setEditItem(null)} onSave={done}/>}
      {svcReq    && <ServiceRequestModal machine={svcReq}   onClose={()=>setSvcReq(null)}      onSent={done}/>}
      {stockNotify && <StockNotifyModal  item={stockNotify} onClose={()=>setStockNotify(null)} onSent={done}/>}
      {useModal    && <UseStockModal     item={useModal}    onClose={()=>setUseModal(null)}     onDone={done}/>}

      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{fontFamily:"'Playfair Display',serif"}}>Equipment Management</h1>
            <p className="text-sm text-gray-400 mt-1">
              View, track and notify resource management. Adding/restocking is done by Admin.
            </p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>setView("equipment")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${view==="equipment"?"text-white shadow-lg":"bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
            style={view==="equipment"?{background:"linear-gradient(135deg,#0D2137,#0D47A1)"}:{}}>
            📋 Equipment List
          </button>
          <button onClick={()=>setView("rooms")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${view==="rooms"?"text-white shadow-lg":"bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
            style={view==="rooms"?{background:"linear-gradient(135deg,#0D2137,#0D47A1)"}:{}}>
            🏥 Lab Rooms
          </button>
          <button onClick={()=>setView("service_requests")}
            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${view==="service_requests"?"text-white shadow-lg":"bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
            style={view==="service_requests"?{background:"linear-gradient(135deg,#7B1FA2,#9C27B0)"}:{}}>
            🔧 Service Requests
            {serviceReqCount > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${view==="service_requests"?"bg-white/20 text-white":"bg-red-100 text-red-700"}`}>
                {serviceReqCount}
              </span>
            )}
          </button>
          <button onClick={()=>setView("low_stock")}
            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${view==="low_stock"?"text-white shadow-lg":"bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
            style={view==="low_stock"?{background:"linear-gradient(135deg,#E65100,#F57C00)"}:{}}>
            📦 Low Stock Alerts
            {lowStockCount > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${view==="low_stock"?"bg-white/20 text-white":"bg-orange-100 text-orange-700"}`}>
                {lowStockCount}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border p-12 text-center text-gray-400">Loading…</div>
        ) : view==="equipment" ? (
          <EquipmentTree
            items={items}
            onEdit={setEditItem}
            onServiceReq={setSvcReq}
            onStockNotify={setStockNotify}
            onUse={setUseModal}
          />
        ) : view==="rooms" ? (
          <LabRoomsView machines={machines}/>
        ) : view==="service_requests" ? (
          <LabServiceRequestsPanel requests={requests}/>
        ) : (
          <LowStockAlertsPanel consumables={consumables} onNotify={setStockNotify}/>
        )}
      </div>
    </LabLayout>
  );
}