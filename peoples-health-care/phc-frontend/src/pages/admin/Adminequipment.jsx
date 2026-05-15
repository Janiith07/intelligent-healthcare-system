import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../../components/AdminLayout";
import api from "../../services/api";

const LAB_LOCATIONS = ["Lab A", "Lab B", "Lab C", "Lab D"];

const MACHINE_SUBCATEGORIES = ["Diagnostic & Testing Machines","Sample Processing Equipment","Storage Equipment","Safety & Laboratory Infrastructure","Digital & Power Equipment"];
const CONSUMABLE_SUBCATEGORIES = ["Sample Collection Materials","Blood Collection Tubes","Testing Consumables","Reagents & Testing Kits","Patient Safety & Infection Control Items","Waste Management Materials","General Laboratory Use Items"];
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

const fmt   = d => d ? new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fmtDT = d => d ? new Date(d).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
const daysUntil = d => d ? Math.ceil((new Date(d)-new Date())/86400000) : null;

// ─── Add Machine Modal ─────────────────────────────────────────────────────
// Serial number logic:
//   • First time this machine is added to a location → NO serial number needed
//   • Same machine already exists in the same location → serial number REQUIRED
function AddMachineModal({ existingMachines, onClose, onSave }) {
  const blank = () => ({
    subCategory:"Diagnostic & Testing Machines", name:"", serialNumber:"",
    testFor:"", location:"", installedDate:"", expiryDate:"", nextServiceDate:"",
    machineStatus:"operational",
  });

  const [rows, setRows] = useState([blank()]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const updateRow = (i,k,v) => setRows(p=>p.map((r,idx)=>idx===i?{...r,[k]:v}:r));
  const addRow = () => setRows(p=>[...p, blank()]);
  const removeRow = i => setRows(p=>p.filter((_,idx)=>idx!==i));

  // Check if same name+location already exists (needs serial number to differentiate)
  const needsSerial = (row) =>
    row.name && row.location &&
    existingMachines.some(m => m.name === row.name && m.location === row.location);

  // Auto-generate serial number
  const autoSerial = (row, i) => {
    return `${row.name.split(" ")[0].toUpperCase().slice(0,4)}-${(row.location||"XX").replace(" ","")}-${String(i+1).padStart(3,"0")}`;
  };

  const handleSave = async () => {
    const errs = {};
    rows.forEach((r,i)=>{
      if(!r.name)     errs[`${i}_name`]     = "Select a machine name";
      if(!r.location) errs[`${i}_location`] = "Select a location";
      if(needsSerial(r) && !r.serialNumber?.trim())
        errs[`${i}_serial`] = "Serial number required — this machine already exists in this location";
    });
    if(Object.keys(errs).length){ setErrors(errs); return; }

    setSaving(true);
    const failed = [];
    for(const row of rows) {
      try {
        await api.post("/equipment", {...row, category:"machine"});
      } catch(e) {
        failed.push(`${row.name} (${row.location}): ${e.response?.data?.message||e.message}`);
      }
    }
    setSaving(false);
    if(failed.length) {
      alert(`Some machines could not be added:\n\n${failed.join("\n")}`);
    }
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="font-bold text-gray-800 text-lg" style={{fontFamily:"'Playfair Display',serif"}}>+ Add Machines</h2>
            <p className="text-xs text-gray-400 mt-0.5">Same machine can be added in different locations without a serial number</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {rows.map((row, i) => {
            const sn = needsSerial(row);
            return (
            <div key={i} className="border border-gray-200 rounded-2xl p-5 space-y-4 relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Machine #{i+1}</span>
                {rows.length > 1 && (
                  <button onClick={()=>removeRow(i)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50">✕ Remove</button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sub-Category</label>
                  <select value={row.subCategory} onChange={e=>updateRow(i,"subCategory",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {MACHINE_SUBCATEGORIES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Machine Name *</label>
                  <select value={row.name} onChange={e=>updateRow(i,"name",e.target.value)} className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors[`${i}_name`]?"border-red-300":"border-gray-200"}`}>
                    <option value="">— Select machine —</option>
                    {(MACHINE_NAMES[row.subCategory]||[]).map(n=><option key={n}>{n}</option>)}
                  </select>
                  {errors[`${i}_name`] && <p className="text-xs text-red-600 mt-1">{errors[`${i}_name`]}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location *</label>
                  <select value={row.location} onChange={e=>updateRow(i,"location",e.target.value)} className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors[`${i}_location`]?"border-red-300":"border-gray-200"}`}>
                    <option value="">— Select room —</option>
                    {LAB_LOCATIONS.map(l=><option key={l}>{l}</option>)}
                  </select>
                  {errors[`${i}_location`] && <p className="text-xs text-red-600 mt-1">{errors[`${i}_location`]}</p>}
                </div>

                {/* Serial number — only shown when same machine already in this location */}
                {sn ? (
                  <div>
                    <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">
                      Serial Number <span className="text-red-500">*</span>
                      <span className="ml-1 font-normal text-amber-600 normal-case">(required — duplicate in {row.location})</span>
                    </label>
                    <div className="flex gap-2">
                      <input type="text" value={row.serialNumber} onChange={e=>updateRow(i,"serialNumber",e.target.value)}
                        placeholder="e.g. SN-002"
                        className={`flex-1 px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors[`${i}_serial`]?"border-red-300 bg-red-50":"border-amber-300 bg-amber-50"}`}/>
                      <button onClick={()=>updateRow(i,"serialNumber",autoSerial(row,i))} className="px-3 py-2 text-xs rounded-xl border border-amber-200 text-amber-700 hover:bg-amber-50 whitespace-nowrap">
                        Auto
                      </button>
                    </div>
                    {errors[`${i}_serial`] && <p className="text-xs text-red-600 mt-1">{errors[`${i}_serial`]}</p>}
                  </div>
                ) : (
                  <div className="flex items-end pb-1">
                    <p className="text-xs text-gray-400 italic">
                      {row.name && row.location
                        ? "✅ First unit of this machine in this location — no serial number needed"
                        : "Serial number only needed if same machine is added twice to the same location"}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Used For Test</label>
                  <select value={row.testFor} onChange={e=>updateRow(i,"testFor",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    <option value="">— Select test —</option>
                    {TESTS.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
                  <select value={row.machineStatus} onChange={e=>updateRow(i,"machineStatus",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {["operational","service_due","under_repair","decommissioned"].map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[["Installed","installedDate"],["Expiry","expiryDate"],["Next Service","nextServiceDate"]].map(([l,k])=>(
                  <div key={k}>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{l}</label>
                    <input type="date" value={row[k]} onChange={e=>updateRow(i,k,e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                  </div>
                ))}
              </div>
            </div>
            );
          })}

          <button onClick={addRow}
            className="w-full py-3 rounded-xl border-2 border-dashed border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition">
            + Add Another Machine
          </button>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60" style={{background:"linear-gradient(135deg,#0D47A1,#1565C0)"}}>
              {saving?`Adding ${rows.length} machine${rows.length>1?"s":""}…`:`+ Add ${rows.length} Machine${rows.length>1?"s":""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Consumable Modal ──────────────────────────────────────────────────
function AddConsumableModal({ existingConsumableNames, onClose, onSave }) {
  const [form, setForm] = useState({
    subCategory:"Sample Collection Materials", name:"",
    quantity:0, unit:"boxes", lowStockThreshold:10, consumableExpiry:"",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);
  const up = (k,v) => setForm(p=>({...p,[k]:v}));

  const handleSave = async () => {
    if(!form.name) return setErr("Please select an item name.");
    if(existingConsumableNames.includes(form.name)) return setErr(`"${form.name}" is already in the consumables list. Each consumable item can only be added once.`);
    if(form.quantity > 0 && form.quantity <= form.lowStockThreshold)
      return setErr(`Initial quantity (${form.quantity}) must be greater than the alert threshold (${form.lowStockThreshold}). Increase the initial quantity or lower the alert threshold.`);
    setSaving(true); setErr(null);
    try { await api.post("/equipment", {...form, category:"consumable"}); onSave(); }
    catch(e){ setErr(e.response?.data?.message||e.message); setSaving(false); }
  };

  const alreadyAdded = existingConsumableNames.includes(form.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="font-bold text-gray-800 text-lg" style={{fontFamily:"'Playfair Display',serif"}}>+ Add Consumable</h2>
            <p className="text-xs text-gray-400 mt-0.5">Each consumable type is tracked as one item</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sub-Category</label>
            <select value={form.subCategory} onChange={e=>up("subCategory",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              {CONSUMABLE_SUBCATEGORIES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Item Name</label>
            <select value={form.name} onChange={e=>up("name",e.target.value)} className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${alreadyAdded?"border-red-300 bg-red-50":"border-gray-200"}`}>
              <option value="">— Select item —</option>
              {(CONSUMABLE_NAMES[form.subCategory]||[]).map(n=>(
                <option key={n} value={n} disabled={existingConsumableNames.includes(n)}>
                  {n}{existingConsumableNames.includes(n)?" (already added)":""}
                </option>
              ))}
            </select>
            {alreadyAdded && <p className="text-xs text-red-600 mt-1">⚠️ This consumable is already registered.</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Initial Qty</label>
              <input type="number" min="0" value={form.quantity} onChange={e=>up("quantity",parseInt(e.target.value)||0)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Unit</label>
              <select value={form.unit} onChange={e=>up("unit",e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                {["boxes","packs","pairs","tubes","bottles","bags","rolls","units","pieces","sets"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Alert ≤</label>
              <input type="number" min="1" value={form.lowStockThreshold} onChange={e=>up("lowStockThreshold",parseInt(e.target.value)||10)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
            </div>
          </div>
          {form.quantity > 0 && form.quantity <= form.lowStockThreshold && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800">
              ⚠️ Initial quantity must exceed the alert threshold. Increase qty or lower the alert number.
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Expiry Date</label>
            <input type="date" value={form.consumableExpiry} onChange={e=>up("consumableExpiry",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
          </div>
          {err && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">❌ {err}</div>}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving||alreadyAdded} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60" style={{background:"linear-gradient(135deg,#0D47A1,#1565C0)"}}>
              {saving?"Adding…":"+ Add Consumable"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Machine Modal (admin) ────────────────────────────────────────────
function AdminEditMachineModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    subCategory:item.subCategory||MACHINE_SUBCATEGORIES[0], name:item.name||"",
    serialNumber:item.serialNumber||"", testFor:item.testFor||"", location:item.location||"",
    installedDate:item.installedDate?item.installedDate.slice(0,10):"",
    expiryDate:item.expiryDate?item.expiryDate.slice(0,10):"",
    nextServiceDate:item.nextServiceDate?item.nextServiceDate.slice(0,10):"",
    machineStatus:item.machineStatus||"operational",
  });
  const [saving,setSaving]=useState(false); const [err,setErr]=useState(null);
  const up=(k,v)=>setForm(p=>({...p,[k]:v}));
  const handleSave=async()=>{setSaving(true);setErr(null);try{await api.put(`/equipment/${item._id}`,{...form,category:"machine"});onSave();}catch(e){setErr(e.response?.data?.message||e.message);setSaving(false);}};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="font-bold text-gray-800 text-lg" style={{fontFamily:"'Playfair Display',serif"}}>Edit Machine</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sub-Category</label><select value={form.subCategory} onChange={e=>up("subCategory",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">{MACHINE_SUBCATEGORIES.map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Machine Name</label><select value={form.name} onChange={e=>up("name",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"><option value="">— Select —</option>{(MACHINE_NAMES[form.subCategory]||[]).map(n=><option key={n}>{n}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location</label><select value={form.location} onChange={e=>up("location",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"><option value="">— Select room —</option>{LAB_LOCATIONS.map(l=><option key={l}>{l}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Serial Number</label><input type="text" value={form.serialNumber} onChange={e=>up("serialNumber",e.target.value)} placeholder="e.g. SN-001" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Test</label><select value={form.testFor} onChange={e=>up("testFor",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"><option value="">— Select —</option>{TESTS.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label><select value={form.machineStatus} onChange={e=>up("machineStatus",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">{["operational","service_due","under_repair","decommissioned"].map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-3 gap-3">{[["Installed","installedDate"],["Expiry","expiryDate"],["Next Service","nextServiceDate"]].map(([l,k])=><div key={k}><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{l}</label><input type="date" value={form[k]} onChange={e=>up(k,e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/></div>)}</div>
          {err && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">❌ {err}</div>}
          <div className="flex gap-3 pt-2"><button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button><button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60" style={{background:"linear-gradient(135deg,#0D47A1,#1565C0)"}}>{saving?"Saving…":"Save Changes"}</button></div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Consumable Modal + Restock (admin) ───────────────────────────────
function AdminEditConsumableModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({ subCategory:item.subCategory||CONSUMABLE_SUBCATEGORIES[0], name:item.name||"", quantity:item.quantity??0, unit:item.unit||"boxes", lowStockThreshold:item.lowStockThreshold??10, consumableExpiry:item.consumableExpiry?item.consumableExpiry.slice(0,10):"" });
  const [restock, setRestock] = useState("");
  const [saving,setSaving]=useState(false); const [err,setErr]=useState(null);
  const up=(k,v)=>setForm(p=>({...p,[k]:v}));
  const handleSave=async()=>{
    setSaving(true);setErr(null);
    try{
      await api.put(`/equipment/${item._id}`,{...form,category:"consumable"});
      if(restock && parseInt(restock)>0){
        await api.put(`/equipment/${item._id}/restock`,{amount:parseInt(restock)});
      }
      onSave();
    }catch(e){setErr(e.response?.data?.message||e.message);setSaving(false);}
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="font-bold text-gray-800 text-lg" style={{fontFamily:"'Playfair Display',serif"}}>Edit Consumable</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sub-Category</label><select value={form.subCategory} onChange={e=>up("subCategory",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">{CONSUMABLE_SUBCATEGORIES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Item Name</label><select value={form.name} onChange={e=>up("name",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"><option value="">— Select —</option>{(CONSUMABLE_NAMES[form.subCategory]||[]).map(n=><option key={n}>{n}</option>)}</select></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quantity</label><input type="number" min="0" value={form.quantity} onChange={e=>up("quantity",parseInt(e.target.value)||0)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Unit</label><select value={form.unit} onChange={e=>up("unit",e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">{["boxes","packs","pairs","tubes","bottles","bags","rolls","units","pieces","sets"].map(u=><option key={u}>{u}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Alert ≤</label><input type="number" min="1" value={form.lowStockThreshold} onChange={e=>up("lowStockThreshold",parseInt(e.target.value)||10)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/></div>
          </div>
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Expiry Date</label><input type="date" value={form.consumableExpiry} onChange={e=>up("consumableExpiry",e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/></div>
          {/* Restock — admin only */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-green-800 uppercase tracking-wide mb-1.5">📥 Restock (add to current {form.quantity} {form.unit})</label>
            <input type="number" min="0" value={restock} onChange={e=>setRestock(e.target.value)} placeholder="e.g. 20" className="w-full px-4 py-2.5 rounded-xl border border-green-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"/>
            {restock && parseInt(restock)>0 && (
              <p className="text-xs text-green-700 mt-1">New quantity will be: {form.quantity + parseInt(restock)} {form.unit}</p>
            )}
          </div>
          {err && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">❌ {err}</div>}
          <div className="flex gap-3 pt-2"><button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button><button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60" style={{background:"linear-gradient(135deg,#0D47A1,#1565C0)"}}>{saving?"Saving…":"Save & Restock"}</button></div>
        </div>
      </div>
    </div>
  );
}

// ─── Requests Panel ────────────────────────────────────────────────────────
// ─── Restock Dialog (for consumable low-stock requests) ───────────────────
function RestockDialog({ req, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);

  const handleRestock = async () => {
    const qty = parseInt(amount);
    if (!qty || qty < 1) return setErr("Please enter a valid quantity to add.");
    setSaving(true); setErr(null);
    try {
      await api.put(`/equipment/${req.equipmentId}/restock`, { amount: qty });
      await api.post("/equipment/resolve", { equipmentId: req.equipmentId, requestId: req._id, category: "consumable" });
      onDone();
    } catch(e) { setErr(e.response?.data?.message || e.message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 rounded-t-3xl" style={{background:"linear-gradient(135deg,#1B5E20,#2E7D32)"}}>
          <h3 className="text-white font-bold text-lg" style={{fontFamily:"'Playfair Display',serif"}}>📥 Restock Consumable</h3>
          <p className="text-white/70 text-xs mt-1">{req.equipmentName}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-1">
            <p className="text-sm font-semibold text-orange-800">📦 Low Stock Alert from Lab Staff</p>
            <p className="text-xs text-orange-700">
              Stock at alert: <strong>{req.quantityAtTime} {req.unit}</strong>
              {" · "}Current: <strong>{req.currentQty ?? "—"} {req.unit}</strong>
              {" · "}Threshold: <strong>{req.threshold}</strong>
            </p>
            {req.notes && <p className="text-xs text-orange-600 mt-1 italic">"{req.notes}"</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Quantity to Add ({req.unit})
            </label>
            <input
              type="number" min="1" value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 50"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-xl font-bold text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            {amount && parseInt(amount) > 0 && (
              <p className="text-xs text-green-700 mt-1.5 text-center font-medium">
                New total will be: <strong>{(req.currentQty || 0) + parseInt(amount)} {req.unit}</strong>
              </p>
            )}
          </div>
          {err && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">❌ {err}</div>}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleRestock} disabled={saving || !amount || parseInt(amount) < 1}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
              style={{background:"linear-gradient(135deg,#1B5E20,#2E7D32)"}}>
              {saving ? "Restocking…" : "✅ Add Stock & Resolve"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestsPanel({ requests, onAck, onResolve, acting, onRestock }) {
  const URGENCY = {
    emergency:       {bg:"bg-red-100",    text:"text-red-700",    border:"border-red-300",    icon:"🚨"},
    "1_day_warning": {bg:"bg-red-50",     text:"text-red-600",    border:"border-red-200",    icon:"⛔"},
    "5_day_warning": {bg:"bg-orange-100", text:"text-orange-700", border:"border-orange-300", icon:"⚠️"},
    routine:         {bg:"bg-blue-50",    text:"text-blue-700",   border:"border-blue-200",   icon:"📋"},
  };
  if(!requests.length) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
      <div className="text-4xl mb-3">✅</div>
      <p className="text-gray-500 font-medium">No pending requests</p>
    </div>
  );
  return (
    <div className="space-y-3">
      {requests.map(req=>{
        const urg = req.category==="machine"?(URGENCY[req.urgency]||URGENCY.routine):{bg:"bg-orange-100",text:"text-orange-700",border:"border-orange-300",icon:"📦"};
        const st  = {pending:{bg:"bg-red-100",text:"text-red-700"},acknowledged:{bg:"bg-amber-100",text:"text-amber-700"},resolved:{bg:"bg-green-100",text:"text-green-700"}}[req.status]||{bg:"bg-gray-100",text:"text-gray-600"};
        const isConsumable = req.category === "consumable";
        return (
          <div key={String(req._id)} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${req.status==="pending"?urg.border:"border-gray-100"}`}>
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className={`text-2xl w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${urg.bg}`}>{urg.icon}</div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-800">{req.equipmentName}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${urg.bg} ${urg.text} ${urg.border}`}>
                        {req.category==="machine"?(req.urgency?.replace(/_/g," ")||"routine"):"Low Stock"}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{req.status}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {req.subCategory}
                      {req.category==="machine" ? (
                        <>{req.location&&` · 📍 ${req.location}`}{req.testFor&&` · 🔬 ${req.testFor}`}<br/>
                          <span className="font-semibold text-gray-700">{(req.requestType||"").replace(/_/g," ")}</span>
                          {req.nextServiceDate&&` · Service: ${fmt(req.nextServiceDate)}`}</>
                      ):(
                        <> · Stock at alert: <strong className="text-red-700">{req.quantityAtTime} {req.unit}</strong> · Current: <strong>{req.currentQty}</strong> (threshold: {req.threshold})</>
                      )}
                    </div>
                    {req.notes && <div className="mt-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">📝 {req.notes}</div>}
                    <div className="text-xs text-gray-400 mt-1">Sent: {fmtDT(req.sentAt)}</div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {/* Machine requests: Acknowledge + Mark Resolved */}
                  {!isConsumable && req.status==="pending" && (
                    <button onClick={()=>onAck(req)} disabled={acting[req._id]}
                      className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50">
                      {acting[req._id]?"…":"👁️ Acknowledge"}
                    </button>
                  )}
                  {!isConsumable && (req.status==="pending"||req.status==="acknowledged") && (
                    <button onClick={()=>onResolve(req)} disabled={acting[String(req._id)+"r"]}
                      className="px-4 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-50"
                      style={{background:"linear-gradient(135deg,#1B5E20,#2E7D32)"}}>
                      {acting[String(req._id)+"r"]?"…":"✅ Mark Resolved"}
                    </button>
                  )}
                  {/* Consumable requests: Add Stock dialog */}
                  {isConsumable && (req.status==="pending"||req.status==="acknowledged") && (
                    <button onClick={()=>onRestock(req)}
                      className="px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-sm"
                      style={{background:"linear-gradient(135deg,#1B5E20,#2E7D32)"}}>
                      📥 Add Stock
                    </button>
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

// ─── Admin Equipment Tree View ─────────────────────────────────────────────
function AdminEquipmentTree({ machines, consumables, onEdit, onDelete }) {
  const [openSubs, setOpenSubs] = useState(
    () => Object.fromEntries(MACHINE_SUBCATEGORIES.concat(CONSUMABLE_SUBCATEGORIES).map(s=>[s,false]))
  );
  const [openNames, setOpenNames] = useState({});
  const toggleSub  = s => setOpenSubs(p=>({...p,[s]:!p[s]}));
  const toggleName = k => setOpenNames(p=>({...p,[k]:!p[k]}));

  const mBySub = {};
  MACHINE_SUBCATEGORIES.forEach(s=>{ mBySub[s]=machines.filter(m=>m.subCategory===s); });
  const cBySub = {};
  CONSUMABLE_SUBCATEGORIES.forEach(s=>{ cBySub[s]=consumables.filter(c=>c.subCategory===s); });

  // name → units (machines) or single record (consumables)
  const machinesByName = {};
  machines.forEach(m=>{
    if(!machinesByName[m.name]) machinesByName[m.name]=[];
    machinesByName[m.name].push(m);
  });
  const consumablesByName = {};
  consumables.forEach(c=>{ consumablesByName[c.name]=c; });

  const renderMachineUnit = (m) => {
    const d = daysUntil(m.nextServiceDate);
    const urgent = d!==null&&d<=5;
    return (
      <div key={m._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${urgent?"bg-red-500 animate-pulse":"bg-green-400"}`}/>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-700">
            {m.serialNumber ? `SN: ${m.serialNumber}` : "Unit"}
          </span>
          <div className="text-xs text-gray-400">
            📍 {m.location||"—"} {m.testFor&&`· ${m.testFor}`}
            {urgent && <span className="ml-2 text-red-600 font-bold">{d<=0?"⛔ OVERDUE":`⚠️ ${d}d`}</span>}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={()=>onEdit(m)} className="text-xs px-2.5 py-1 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">✏️</button>
          <button onClick={()=>{ if(confirm(`Delete "${m.name}"${m.serialNumber?` (SN:${m.serialNumber})`:""}?`)) onDelete(m._id); }} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">🗑️</button>
        </div>
      </div>
    );
  };

  const renderMachineNameRow = (machineName, sub) => {
    const units = machinesByName[machineName] || [];
    const hasUnits = units.length > 0;
    const nameKey = `${sub}::${machineName}`;
    const isNameOpen = openNames[nameKey] !== false;
    const anyUrgent = units.some(m=>{ const d=daysUntil(m.nextServiceDate); return d!==null&&d<=5; });

    return (
      <div key={machineName}>
        <div className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition ${!hasUnits?"opacity-55":""}`}>
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
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasUnits?"bg-green-400":"bg-gray-200"}`}/>
          <span className={`text-sm flex-1 ${hasUnits?"font-medium text-gray-800":"text-gray-400"}`}>{machineName}</span>
          {anyUrgent && <span className="text-xs text-red-600 font-bold">⚠️</span>}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${hasUnits?"bg-amber-50 text-amber-700":"bg-gray-50 text-gray-300 border border-gray-100"}`}>
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

  const renderConsumable = (c) => {
    const isLow = c.quantity<=c.lowStockThreshold;
    return (
      <div key={c._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.quantity===0?"bg-red-500 animate-pulse":isLow?"bg-orange-400":"bg-green-400"}`}/>
        <span className="text-sm font-medium text-gray-800 flex-1">{c.name}</span>
        <span className={`text-xs font-bold ${c.quantity===0?"text-red-600":isLow?"text-orange-600":"text-green-700"}`}>
          {c.quantity} {c.unit}
        </span>
        {c.quantity===0 && <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">OUT</span>}
        {c.quantity>0&&isLow && <span className="text-xs bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded-full">LOW</span>}
        <div className="flex gap-1.5">
          <button onClick={()=>onEdit(c)} className="text-xs px-2.5 py-1 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">✏️ Edit / Restock</button>
          <button onClick={()=>{ if(confirm(`Delete "${c.name}"?`)) onDelete(c._id); }} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">🗑️</button>
        </div>
      </div>
    );
  };

  const renderConsumableNameRow = (itemName) => {
    const c = consumablesByName[itemName];
    if(c) return renderConsumable(c);
    return (
      <div key={itemName} className="flex items-center gap-3 px-4 py-2 opacity-50">
        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300"/>
        <span className="text-sm text-gray-400 flex-1">{itemName}</span>
        <span className="text-xs text-gray-300 px-2 py-0.5 rounded-full border border-gray-200">Not Added</span>
      </div>
    );
  };

  const SubGroup = ({ sub, allNames, isMachine }) => {
    const isOpen = !!openSubs[sub];
    const addedCount = isMachine
      ? (mBySub[sub]||[]).length
      : allNames.filter(n=>!!consumablesByName[n]).length;

    return (
      <div className="ml-4 border-l-2 border-gray-100 pl-3">
        <button onClick={()=>toggleSub(sub)} className="flex items-center gap-2 py-1.5 w-full text-left group">
          <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isOpen?"rotate-90":""}`}>
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
          </svg>
          <span className="text-xs font-semibold text-gray-600 group-hover:text-gray-800">{sub}</span>
          <span className="ml-auto text-xs text-gray-400">
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
      {/* Machines — always shown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
          <span className="text-sm font-bold text-amber-800">🖥️ Machines ({machines.length} added)</span>
        </div>
        <div className="px-2 py-2 space-y-1">
          {MACHINE_SUBCATEGORIES.map(sub=>(
            <SubGroup key={sub} sub={sub} allNames={MACHINE_NAMES[sub]||[]} isMachine={true}/>
          ))}
        </div>
      </div>

      {/* Consumables — always shown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
          <span className="text-sm font-bold text-amber-800">🧫 Consumables ({consumables.length} added)</span>
        </div>
        <div className="px-2 py-2 space-y-1">
          {CONSUMABLE_SUBCATEGORIES.map(sub=>(
            <SubGroup key={sub} sub={sub} allNames={CONSUMABLE_NAMES[sub]||[]} isMachine={false}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ───────────────────────────────────────────────────────
export default function AdminEquipment() {
  const [view,        setView]        = useState("list");   // "list" | "requests"
  const [items,       setItems]       = useState([]);
  const [requests,    setRequests]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [addMachine,  setAddMachine]  = useState(false);
  const [addConsume,  setAddConsume]  = useState(false);
  const [editItem,    setEditItem]    = useState(null);
  const [acting,      setActing]      = useState({});
  const [restockReq,  setRestockReq]  = useState(null); // consumable request to restock

  const machines    = items.filter(i=>i.category==="machine");
  const consumables = items.filter(i=>i.category==="consumable");
  const existingConsumableNames = consumables.map(i=>i.name);

  useEffect(()=>{ fetchAll(); },[]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [mr,cr,rr] = await Promise.all([
        api.get("/equipment?category=machine"),
        api.get("/equipment?category=consumable"),
        api.get("/equipment/pending-requests"),
      ]);
      setItems([...(mr.data.items||[]),...(cr.data.items||[])]);
      setRequests(rr.data.requests||[]);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchRequests = async () => {
    const r = await api.get("/equipment/pending-requests").catch(()=>({data:{requests:[]}}));
    setRequests(r.data.requests||[]);
  };

  const done = useCallback(()=>{ setAddMachine(false); setAddConsume(false); setEditItem(null); setRestockReq(null); fetchAll(); },[]);

  const handleDelete = async (id) => {
    try { await api.delete(`/equipment/${id}`); fetchAll(); }
    catch(e){ alert(e.response?.data?.message||e.message); }
  };

  const handleAck = async (req) => {
    setActing(p=>({...p,[req._id]:true}));
    try { await api.post("/equipment/acknowledge",{equipmentId:req.equipmentId,requestId:req._id,category:req.category}); await fetchRequests(); }
    catch(e){ alert(e.response?.data?.message||e.message); }
    finally { setActing(p=>({...p,[req._id]:false})); }
  };

  const handleResolve = async (req) => {
    setActing(p=>({...p,[String(req._id)+"r"]:true}));
    try { await api.post("/equipment/resolve",{equipmentId:req.equipmentId,requestId:req._id,category:req.category}); await fetchRequests(); fetchAll(); }
    catch(e){ alert(e.response?.data?.message||e.message); }
    finally { setActing(p=>({...p,[String(req._id)+"r"]:false})); }
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  // Low Stock: consumables AT or BELOW alert threshold (includes 0 / out-of-stock)
  const lowCount = consumables.filter(c =>
    (c.quantity ?? 0) <= (c.lowStockThreshold ?? 10)
  ).length;

  // Service Due: any machine with a pending service request (scheduled service,
  // emergency, or replacement) OR explicitly marked service_due / under_repair.
  const serviceCount = machines.filter(m =>
    m.serviceRequests?.some(r => r.status === "pending") ||
    m.machineStatus === "service_due" ||
    m.machineStatus === "under_repair"
  ).length;

  return (
    <AdminLayout activePage="Equipment Management">
      {addMachine  && <AddMachineModal   existingMachines={machines} onClose={()=>setAddMachine(false)} onSave={done}/>}
      {addConsume  && <AddConsumableModal existingConsumableNames={existingConsumableNames} onClose={()=>setAddConsume(false)} onSave={done}/>}
      {editItem?.category==="machine"    && <AdminEditMachineModal    item={editItem} onClose={()=>setEditItem(null)} onSave={done}/>}
      {editItem?.category==="consumable" && <AdminEditConsumableModal item={editItem} onClose={()=>setEditItem(null)} onSave={done}/>}
      {restockReq && <RestockDialog req={restockReq} onClose={()=>setRestockReq(null)} onDone={done}/>}

      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{fontFamily:"'Playfair Display',serif"}}>Equipment Management</h1>
            <p className="text-sm text-gray-400 mt-1">Add, edit and manage lab equipment, consumables and stock</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setAddMachine(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style={{background:"linear-gradient(135deg,#0D47A1,#1565C0)"}}>+ Add Machine</button>
            <button onClick={()=>setAddConsume(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style={{background:"linear-gradient(135deg,#0D47A1,#1565C0)"}}>+ Add Consumable</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label:"Machines",     value:machines.length,    color:"#0D47A1"},
            {label:"Consumables",  value:consumables.length, color:"#0D47A1"},
            {label:"Low Stock",    value:lowCount,     color:lowCount>0?"#B71C1C":"#555"},
            {label:"Service Due",  value:serviceCount, color:serviceCount>0?"#B71C1C":"#555"},
          ].map(s=>(
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold" style={{fontFamily:"'Playfair Display',serif",color:s.color}}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex gap-2 bg-white rounded-2xl p-2 border border-gray-100 shadow-sm w-fit">
          {[{key:"list",label:"📋 Equipment List"},{key:"requests",label:`🔔 Requests ${pendingCount>0?`(${pendingCount})`:""}`}].map(v=>(
            <button key={v.key} onClick={()=>setView(v.key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${view===v.key?"text-white":"text-gray-600 hover:bg-gray-50"}`}
              style={view===v.key?{background:"linear-gradient(135deg,#0D47A1,#1565C0)"}:{}}>
              {v.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border p-12 text-center text-gray-400">Loading…</div>
        ) : view==="requests" ? (
          <RequestsPanel requests={requests} onAck={handleAck} onResolve={handleResolve} acting={acting} onRestock={setRestockReq}/>
        ) : (
          <AdminEquipmentTree machines={machines} consumables={consumables} onEdit={setEditItem} onDelete={handleDelete}/>
        )}
      </div>
    </AdminLayout>
  );
}