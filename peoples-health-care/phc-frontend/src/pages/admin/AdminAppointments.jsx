import { useState } from "react";
import AdminLayout from "../../components/AdminLayout";

const APPOINTMENTS = [
  { id: "APT-0101", patient: "Kamal Perera",      age: 54, channeling: "012", time: "08:20 AM", type: "General Consultation", doctor: "Dr. Jayaweera", status: "Completed", paid: true  },
  { id: "APT-0102", patient: "Sumudu Silva",       age: 29, channeling: "002", time: "09:15 AM", type: "General Consultation", doctor: "Dr. Jayaweera", status: "Completed", paid: true  },
  { id: "APT-0103", patient: "Ruwan Fernando",     age: 47, channeling: "017", time: "09:35 AM", type: "Follow-up",            doctor: "Dr. Jayaweera", status: "Completed", paid: true  },
  { id: "APT-0104", patient: "Dilani Bandara",     age: 38, channeling: "016", time: "10:05 AM", type: "General Consultation", doctor: "Dr. Jayaweera", status: "In Progress",paid: false },
  { id: "APT-0105", patient: "Suresh Jayasinghe", age: 52, channeling: "015", time: "10:30 AM", type: "General Consultation", doctor: "Dr. Jayaweera", status: "Waiting",     paid: false },
  { id: "APT-0106", patient: "Nimesha Silva",      age: 29, channeling: "019", time: "10:55 AM", type: "General Consultation", doctor: "Dr. Jayaweera", status: "Waiting",     paid: false },
  { id: "APT-0107", patient: "Anura Dissanayake", age: 61, channeling: "011", time: "11:20 AM", type: "Follow-up",            doctor: "Dr. Jayaweera", status: "Scheduled",   paid: false },
  { id: "APT-0108", patient: "Priya Gamage",       age: 42, channeling: "013", time: "11:45 AM", type: "Annual Check",         doctor: "Dr. Jayaweera", status: "Scheduled",   paid: false },
];

const STATUS_STYLE = {
  Completed:   { bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200",  dot: "bg-green-400"  },
  "In Progress":{ bg: "bg-blue-100",  text: "text-blue-700",   border: "border-blue-200",   dot: "bg-blue-500"   },
  Waiting:     { bg: "bg-indigo-100",  text: "text-indigo-700",  border: "border-indigo-200",  dot: "bg-indigo-400"  },
  Scheduled:   { bg: "bg-gray-100",   text: "text-gray-600",   border: "border-gray-200",   dot: "bg-gray-400"   },
};

export default function AdminAppointments() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = APPOINTMENTS.filter(a => {
    const matchFilter = filter === "All" || a.status === filter;
    const matchSearch = a.patient.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = { Completed: 3, "In Progress": 1, Waiting: 2, Scheduled: 2 };

  return (
    <AdminLayout activePage="Appointments">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>Appointments</h1>
          <p className="text-sm text-gray-400 mt-1">All consultations · 15 February 2026</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Today",  value: APPOINTMENTS.length, color: "#1A237E", bg: "#E8EAF6" },
            { label: "Completed",    value: counts["Completed"],    color: "#2E7D32", bg: "#E8F5E9" },
            { label: "In Progress",  value: counts["In Progress"],  color: "#1565C0", bg: "#E3F2FD" },
            { label: "Waiting",      value: counts["Waiting"],      color: "#E65100", bg: "#FFF3E0" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 relative">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input type="text" placeholder="Search patient or appointment ID…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["All", "Completed", "In Progress", "Waiting", "Scheduled"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${filter === f ? "text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                style={filter === f ? { background: "linear-gradient(135deg, #1A237E, #283593)" } : {}}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Channeling", "Patient", "Time", "Type", "Doctor", "Payment", "Status", ""].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(a => {
                const s = STATUS_STYLE[a.status];
                return (
                  <tr key={a.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">#{a.channeling}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #1A237E, #283593)" }}>
                          {a.patient.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-800">{a.patient}</div>
                          <div className="text-xs text-gray-400">Age {a.age} · {a.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{a.time}</td>
                    <td className="px-5 py-3.5"><span className="text-xs text-gray-600">{a.type}</span></td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{a.doctor}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.paid ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {a.paid ? "✅ Paid" : "⏳ Pending"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 w-fit ${s.bg} ${s.text} ${s.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button className="text-xs font-semibold text-indigo-600 hover:underline">View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-gray-400 text-sm">No appointments found</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}