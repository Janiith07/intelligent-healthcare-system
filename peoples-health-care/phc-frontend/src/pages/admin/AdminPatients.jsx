import { useState } from "react";
import AdminLayout from "../../components/AdminLayout";

const PATIENTS = [
  { id: "PHC-2026-0012", name: "Kamal Perera",      age: 54, gender: "Male",   blood: "B+",  phone: "0712 345 678", registered: "05 Jan 2026", lastVisit: "15 Feb 2026", visits: 5,  conditions: ["Type 2 Diabetes","Hypertension"], status: "Active" },
  { id: "PHC-2026-0019", name: "Sumudu Silva",       age: 29, gender: "Female", blood: "O+",  phone: "0765 234 567", registered: "10 Jan 2026", lastVisit: "15 Feb 2026", visits: 2,  conditions: ["Upper Respiratory Infection"],     status: "Active" },
  { id: "PHC-2026-0031", name: "Ruwan Fernando",     age: 47, gender: "Male",   blood: "A+",  phone: "0777 543 210", registered: "15 Jan 2026", lastVisit: "15 Feb 2026", visits: 3,  conditions: ["Hyperlipidaemia","Hypertension"],  status: "Active" },
  { id: "PHC-2026-0044", name: "Dilani Bandara",     age: 38, gender: "Female", blood: "AB+", phone: "0712 678 901", registered: "20 Jan 2026", lastVisit: "15 Feb 2026", visits: 2,  conditions: ["Suspected Diabetes"],              status: "Active" },
  { id: "PHC-2026-0051", name: "Suresh Jayasinghe", age: 52, gender: "Male",   blood: "B+",  phone: "0712 890 123", registered: "08 Feb 2026", lastVisit: "15 Feb 2026", visits: 2,  conditions: ["GERD"],                            status: "Active" },
  { id: "PHC-2026-0062", name: "Nimesha Silva",      age: 29, gender: "Female", blood: "O-",  phone: "0765 012 345", registered: "12 Feb 2026", lastVisit: "15 Feb 2026", visits: 1,  conditions: ["Upper Respiratory Infection"],     status: "Active" },
  { id: "PHC-2026-0071", name: "Anura Dissanayake", age: 61, gender: "Male",   blood: "A-",  phone: "0712 111 222", registered: "18 Jan 2026", lastVisit: "14 Feb 2026", visits: 4,  conditions: ["Type 2 Diabetes"],                 status: "Active" },
  { id: "PHC-2026-0082", name: "Priya Gamage",       age: 42, gender: "Female", blood: "B-",  phone: "0765 333 444", registered: "22 Jan 2026", lastVisit: "13 Feb 2026", visits: 2,  conditions: ["Hypertension"],                    status: "Active" },
];

export default function AdminPatients() {
  const [search, setSearch]     = useState("");
  const [genderFilter, setGender] = useState("All");

  const filtered = PATIENTS.filter(p => {
    const matchS = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase());
    const matchG = genderFilter === "All" || p.gender === genderFilter;
    return matchS && matchG;
  });

  return (
    <AdminLayout activePage="Patient Overview">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>Patient Overview</h1>
          <p className="text-sm text-gray-400 mt-1">All registered patients — People's Health Care</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Patients",   value: PATIENTS.length,                                    color: "#1A237E", bg: "#E8EAF6" },
            { label: "Active This Month",value: PATIENTS.filter(p => p.lastVisit.includes("Feb")).length, color: "#1565C0", bg: "#E3F2FD" },
            { label: "Female",           value: PATIENTS.filter(p => p.gender === "Female").length, color: "#EC4899", bg: "#FCE7F3" },
            { label: "Male",             value: PATIENTS.filter(p => p.gender === "Male").length,   color: "#00897B", bg: "#E0F2F1" },
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
            <input type="text" placeholder="Search by name or patient ID…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition" />
          </div>
          <div className="flex gap-2">
            {["All", "Male", "Female"].map(g => (
              <button key={g} onClick={() => setGender(g)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${genderFilter === g ? "text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                style={genderFilter === g ? { background: "linear-gradient(135deg, #1A237E, #283593)" } : {}}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Patient", "ID", "Age / Gender", "Blood", "Conditions", "Last Visit", "Visits", "Status"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1A237E, #283593)" }}>
                        {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><span className="font-mono text-xs text-gray-500">{p.id}</span></td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{p.age} · {p.gender}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-full">{p.blood}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {p.conditions.slice(0, 2).map(c => (
                        <span key={c} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{p.lastVisit}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-700">{p.visits}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full border border-green-200">● Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-gray-400 text-sm">No patients found</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}