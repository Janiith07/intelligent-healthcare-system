import { useState } from "react";
import AdminLayout from "../../components/AdminLayout";

const SETTINGS_SECTIONS = [
  {
    id: "clinic",
    label: "Clinic Information",
    icon: "🏥",
    fields: [
      { label: "Clinic Name",      key: "clinicName",  type: "text",  value: "People's Health Care" },
      { label: "Registration No.", key: "regNo",       type: "text",  value: "MOH-LK-2019-0482" },
      { label: "Phone",            key: "phone",       type: "text",  value: "0777 883 343" },
      { label: "Email",            key: "email",       type: "email", value: "info@peopleshealthcare.lk" },
      { label: "Address",          key: "address",     type: "text",  value: "Galle Road, Matara, Sri Lanka" },
    ],
  },
  {
    id: "schedule",
    label: "Operating Hours",
    icon: "🕐",
    fields: [
      { label: "Monday – Friday", key: "weekdays",  type: "text", value: "08:00 AM – 06:00 PM" },
      { label: "Saturday",        key: "saturday",  type: "text", value: "08:00 AM – 02:00 PM" },
      { label: "Sunday",          key: "sunday",    type: "text", value: "Closed" },
      { label: "Public Holidays", key: "holidays",  type: "text", value: "Emergency only (09:00 AM – 12:00 PM)" },
    ],
  },
  {
    id: "billing",
    label: "Billing Configuration",
    icon: "💰",
    fields: [
      { label: "Consultation Fee (LKR)", key: "consultFee",  type: "number", value: "1200" },
      { label: "Lab Processing Fee",     key: "labFee",      type: "number", value: "250"  },
      { label: "Currency",               key: "currency",    type: "text",   value: "LKR – Sri Lankan Rupee" },
      { label: "Tax Rate (%)",           key: "taxRate",     type: "number", value: "0"    },
    ],
  },
];

const TOGGLES = [
  { label: "Email Notifications",         desc: "Send appointment reminders to patients by email",          on: true  },
  { label: "SMS Notifications",           desc: "Send SMS alerts for lab results and appointments",          on: true  },
  { label: "Auto-Invoice Generation",     desc: "Automatically generate invoice after each consultation",    on: true  },
  { label: "Lab Result Auto-Notify",      desc: "Notify doctor when lab results are uploaded",               on: true  },
  { label: "Pharmacy Stock Alerts",       desc: "Alert admin when medicine stock falls below reorder level", on: true  },
  { label: "Maintenance Mode",            desc: "Restrict portal access for system maintenance",             on: false },
];

function Toggle({ on, onChange }) {
  return (
    <button onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${on ? "" : "bg-gray-200"}`}
      style={on ? { background: "linear-gradient(135deg, #1A237E, #283593)" } : {}}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export default function AdminSettings() {
  const [sections, setSections] = useState(SETTINGS_SECTIONS);
  const [toggles, setToggles]   = useState(TOGGLES);
  const [saved, setSaved]       = useState(false);
  const [activeSection, setActiveSection] = useState("clinic");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const updateField = (sectionId, key, value) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, fields: s.fields.map(f => f.key === key ? { ...f, value } : f) }
        : s
    ));
  };

  const toggleSwitch = idx => {
    setToggles(prev => prev.map((t, i) => i === idx ? { ...t, on: !t.on } : t));
  };

  return (
    <AdminLayout activePage="System Settings">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>System Settings</h1>
            <p className="text-sm text-gray-400 mt-1">Manage clinic configuration and portal preferences</p>
          </div>
          <button onClick={handleSave}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg transition ${saved ? "bg-green-600" : ""}`}
            style={!saved ? { background: "linear-gradient(135deg, #1A237E, #283593)" } : {}}>
            {saved ? "✅ Saved!" : "💾 Save Changes"}
          </button>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar nav */}
          <div className="space-y-1">
            {[...SETTINGS_SECTIONS.map(s => ({ id: s.id, label: s.label, icon: s.icon })),
              { id: "notifications", label: "Notifications", icon: "🔔" }
            ].map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-left ${
                  activeSection === s.id ? "text-white shadow-md" : "text-gray-600 hover:bg-gray-100"
                }`}
                style={activeSection === s.id ? { background: "linear-gradient(135deg, #1A237E, #283593)" } : { background: "white", border: "1px solid #f3f4f6" }}>
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* Main panel */}
          <div className="lg:col-span-3">
            {/* Settings form sections */}
            {sections.filter(s => s.id === activeSection).map(section => (
              <div key={section.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <span className="text-2xl">{section.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-800">{section.label}</h3>
                    <p className="text-xs text-gray-400">Configure {section.label.toLowerCase()} details</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {section.fields.map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{field.label}</label>
                      <input type={field.type} value={field.value}
                        onChange={e => updateField(section.id, field.key, e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition" />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Notifications panel */}
            {activeSection === "notifications" && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <span className="text-2xl">🔔</span>
                  <div>
                    <h3 className="font-semibold text-gray-800">Notifications & Alerts</h3>
                    <p className="text-xs text-gray-400">Control system-wide notification preferences</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {toggles.map((t, i) => (
                    <div key={t.label} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="text-sm font-semibold text-gray-800">{t.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
                      </div>
                      <Toggle on={t.on} onChange={() => toggleSwitch(i)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}