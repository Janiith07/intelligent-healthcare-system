import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import api from "../../services/api";

const ROLE_CONFIG = {
  doctor:   { label: "Doctor",      bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500",   icon: "🩺" },
  lab:      { label: "Lab",         bg: "bg-teal-100",   text: "text-teal-700",   dot: "bg-teal-500",   icon: "🔬" },
  pharmacy: { label: "Pharmacy",    bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500",  icon: "💊" },
  cashier:  { label: "Cashier",     bg: "bg-indigo-100",  text: "text-indigo-700",  dot: "bg-indigo-500",  icon: "💰" },
  admin:    { label: "Admin",       bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500",    icon: "🛡️" },
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getInitials(name = "") {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// ── Add Staff Modal ────────────────────────────────────────────
function AddStaffModal({ onClose, onSaved }) {
  const [role, setRole]             = useState("doctor");
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [telephone, setTelephone]   = useState("");
  // Doctor-specific
  const [slmc, setSlmc]             = useState("");
  const [experience, setExperience] = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  // Password strength
  const passRules = [
    { label: "8+ characters",      ok: password.length >= 8 },
    { label: "Uppercase letter",   ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter",   ok: /[a-z]/.test(password) },
    { label: "Number",             ok: /\d/.test(password) },
    { label: "Special character",  ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const passStrength = passRules.filter(r => r.ok).length;

  const handleSubmit = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !password || !telephone.trim())
      return setError("Name, email, password and telephone are required.");
    if (passStrength < 3)
      return setError("Password is too weak — meet at least 3 of the 5 rules.");

    setSaving(true);
    try {
      const payload = { name: name.trim(), email: email.trim(), password, telephone: telephone.trim(), role };
      if (role === "doctor") {
        payload.slmcRegisterNumber = slmc.trim();
        payload.workingExperience           = experience.trim();
      }
      const res = await api.post("/users/staff", payload);
      onSaved(res.data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create staff member.");
    } finally {
      setSaving(false);
    }
  };

  const strengthColor = passStrength <= 1 ? "bg-red-400" : passStrength <= 3 ? "bg-indigo-400" : "bg-green-500";
  const strengthLabel = passStrength <= 1 ? "Weak" : passStrength <= 3 ? "Fair" : passStrength === 4 ? "Good" : "Strong";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 rounded-t-3xl px-6 py-5 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0D2137, #1A237E)" }}>
          <div>
            <p className="text-white/60 text-xs">Staff Management</p>
            <h2 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              Add New Staff Member
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠ {error}</div>}

          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Role <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ROLE_CONFIG).filter(([r]) => r !== "admin").map(([r, cfg]) => (
                <label key={r} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition text-sm font-medium ${
                  role === r ? "border-indigo-400 bg-indigo-50 text-indigo-800" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}>
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="accent-indigo-600"/>
                  {cfg.icon} {cfg.label}
                </label>
              ))}
              <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition text-sm font-medium ${
                role === "admin" ? "border-red-400 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}>
                <input type="radio" name="role" value="admin" checked={role === "admin"} onChange={() => setRole("admin")} className="accent-red-500"/>
                🛡️ Admin
              </label>
            </div>
          </div>

          {/* Basic info */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Full Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dr. Amal Perera"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email <span className="text-red-400">*</span></label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@phc.lk"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Telephone <span className="text-red-400">*</span></label>
              <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="07X XXX XXXX"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Password <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass
                  ? <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                  : <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/></svg>
                }
              </button>
            </div>
            {password && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strengthColor}`} style={{ width: `${(passStrength / 5) * 100}%` }}/>
                  </div>
                  <span className={`text-xs font-semibold ${passStrength <= 1 ? "text-red-500" : passStrength <= 3 ? "text-indigo-500" : "text-green-600"}`}>
                    {strengthLabel}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {passRules.map(r => (
                    <div key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? "text-green-600" : "text-gray-400"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.ok ? "bg-green-500" : "bg-gray-300"}`}/>
                      {r.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Doctor-specific fields */}
          {role === "doctor" && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 flex items-center gap-2">
                🩺 Doctor Registration Details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">SLMC Reg. Number</label>
                  <input value={slmc} onChange={e => setSlmc(e.target.value)} placeholder="SLMC-XXXX"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Working Experience</label>
                <input value={experience} onChange={e => setExperience(e.target.value)} placeholder="e.g. 10 years in General Medicine"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition"/>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0D2137, #1A237E)" }}>
              {saving ? "Creating…" : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit Staff Modal ───────────────────────────────────────────
function EditStaffModal({ staff, onClose, onSaved }) {
  const [name, setName]             = useState(staff.name);
  const [email, setEmail]           = useState(staff.email);
  const [telephone, setTelephone]   = useState(staff.telephone);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");

  const passRules = newPassword ? [
    { label: "8+ characters",      ok: newPassword.length >= 8 },
    { label: "Uppercase letter",   ok: /[A-Z]/.test(newPassword) },
    { label: "Lowercase letter",   ok: /[a-z]/.test(newPassword) },
    { label: "Number",             ok: /\d/.test(newPassword) },
    { label: "Special character",  ok: /[^A-Za-z0-9]/.test(newPassword) },
  ] : [];
  const passStrength = passRules.filter(r => r.ok).length;

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    if (!name.trim() || !email.trim() || !telephone.trim())
      return setError("Name, email and telephone are required.");
    
    if (newPassword && confirmPassword) {
      if (newPassword !== confirmPassword)
        return setError("Passwords don't match.");
      if (passStrength < 3)
        return setError("Password is too weak — meet at least 3 of the 5 rules.");
    }

    setSaving(true);
    try {
      const payload = { name: name.trim(), email: email.trim(), telephone: telephone.trim() };
      if (newPassword) payload.password = newPassword;
      
      const res = await api.put(`/users/${staff._id}`, payload);
      onSaved(res.data.user);
      setSuccess("Staff member updated successfully!");
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update staff member.");
    } finally {
      setSaving(false);
    }
  };

  const strengthColor = passStrength <= 1 ? "bg-red-400" : passStrength <= 3 ? "bg-indigo-400" : "bg-green-500";
  const strengthLabel = passStrength <= 1 ? "Weak" : passStrength <= 3 ? "Fair" : passStrength === 4 ? "Good" : "Strong";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 rounded-t-3xl px-6 py-5 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0D2137, #1A237E)" }}>
          <div>
            <p className="text-white/60 text-xs">Staff Management</p>
            <h2 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              Edit Staff Member
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠ {error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✓ {success}</div>}

          {/* Basic info */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Full Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dr. Amal Perera"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email <span className="text-red-400">*</span></label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@phc.lk"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Telephone <span className="text-red-400">*</span></label>
              <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="07X XXX XXXX"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
            </div>
          </div>

          {/* Password change section */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
              🔐 Change Password (Optional)
            </p>
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">New Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Leave empty to keep current password"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass
                    ? <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                    : <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/></svg>
                  }
                </button>
              </div>
              {newPassword && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strengthColor}`} style={{ width: `${(passStrength / 5) * 100}%` }}/>
                    </div>
                    <span className={`text-xs font-semibold ${passStrength <= 1 ? "text-red-500" : passStrength <= 3 ? "text-indigo-500" : "text-green-600"}`}>
                      {strengthLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {passRules.map(r => (
                      <div key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? "text-green-600" : "text-gray-400"}`}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.ok ? "bg-green-500" : "bg-gray-300"}`}/>
                        {r.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {newPassword && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Confirm Password</label>
                <input type={showPass ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter the new password"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0D2137, #1A237E)" }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── View Staff Modal ───────────────────────────────────────────
function ViewStaffModal({ staff, onClose, onToggleActive, onEdit }) {
  const cfg = ROLE_CONFIG[staff.role] || ROLE_CONFIG.admin;
  const [toggling, setToggling] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    await onToggleActive(staff._id, !staff.isActive);
    setToggling(false);
    onClose();
  };

  return (
    <>
      {showEditModal && (
        <EditStaffModal
          staff={staff}
          onClose={() => setShowEditModal(false)}
          onSaved={(updatedStaff) => {
            onEdit(updatedStaff);
            setShowEditModal(false);
          }}
        />
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
          <div className="px-6 py-5 flex items-center justify-between rounded-t-3xl"
            style={{ background: "linear-gradient(135deg, #0D2137, #1A237E)" }}>
            <div>
              <p className="text-white/60 text-xs">Staff Record</p>
              <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>{staff.name}</h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Avatar + basics */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #0D2137, #1A237E)" }}>
                {getInitials(staff.name)}
              </div>
              <div>
                <div className="font-bold text-gray-800">{staff.name}</div>
                <div className="text-sm text-gray-500">{staff.email}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${staff.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {staff.isActive ? "● Active" : "● Inactive"}
                  </span>
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "User ID",    value: staff.userId },
                { label: "Telephone",  value: staff.telephone },
                { label: "Joined",     value: formatDate(staff.createdAt) },
                { label: "Role",       value: cfg.label },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{item.label}</div>
                  <div className="text-gray-800 font-medium">{item.value || "—"}</div>
                </div>
              ))}
            </div>

            {/* Doctor details */}
            {staff.role === "doctor" && staff.doctorDetails && (
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 space-y-2">
                <p className="text-xs font-semibold text-blue-700">🩺 Doctor Details</p>
                {[
                  { label: "SLMC Reg.", value: staff.doctorDetails.slmcRegisterNumber },
                  { label: "Experience", value: staff.doctorDetails.workingExperience },
                ].map(d => d.value ? (
                  <div key={d.label} className="flex justify-between text-sm">
                    <span className="text-blue-600 font-medium">{d.label}</span>
                    <span className="text-blue-800">{d.value}</span>
                  </div>
                ) : null)}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setShowEditModal(true)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition">
                ✏️ Edit Account
              </button>
              <button onClick={handleToggle} disabled={toggling}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition disabled:opacity-60 ${
                  staff.isActive
                    ? "border-red-200 text-red-600 hover:bg-red-50"
                    : "border-green-200 text-green-600 hover:bg-green-50"
                }`}>
                {toggling ? "Updating…" : staff.isActive ? "🚫 Deactivate" : "✓ Activate"}
            </button>
              <button onClick={onClose} className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
);}

// ── Main Page ──────────────────────────────────────────────────
export default function AdminStaff() {
  const [staff, setStaff]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [viewStaff, setViewStaff]   = useState(null);
  const [editStaff, setEditStaff]   = useState(null);
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    try {
      const res = await api.get("/users", { params: { role: roleFilter === "all" ? undefined : roleFilter } });
      // exclude patients from staff list
      setStaff((res.data.users || []).filter(u => u.role !== "patient"));
    } catch { showToast("Failed to load staff", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [roleFilter]);

  const handleSaved = (newUser) => {
    setStaff(prev => [newUser, ...prev]);
    showToast(`${newUser.name} added successfully`);
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      const res = await api.put(`/users/${id}`, { isActive });
      setStaff(prev => prev.map(s => s._id === id ? { ...s, isActive } : s));
      showToast(isActive ? "Account activated" : "Account deactivated");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update", "error");
    }
  };

  const handleEditStaff = (updatedStaff) => {
    setStaff(prev => prev.map(s => s._id === updatedStaff._id ? updatedStaff : s));
    setViewStaff(updatedStaff);
    showToast("Staff account updated successfully");
  };

  const filtered = staff.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase())
      || s.email?.toLowerCase().includes(search.toLowerCase())
      || s.userId?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const stats = {
    total:    staff.length,
    active:   staff.filter(s => s.isActive).length,
    inactive: staff.filter(s => !s.isActive).length,
    doctors:  staff.filter(s => s.role === "doctor").length,
  };

  return (
    <AdminLayout activePage="Staff Management">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-xl border shadow-lg text-sm font-medium ${
          toast.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.type === "success" ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} onSaved={handleSaved}/>}
      {editStaff && (
        <EditStaffModal
          staff={editStaff}
          onClose={() => setEditStaff(null)}
          onSaved={(updatedStaff) => {
            handleEditStaff(updatedStaff);
            setEditStaff(null);
          }}
        />
      )}
      {viewStaff && (
        <ViewStaffModal
          staff={viewStaff}
          onClose={() => setViewStaff(null)}
          onToggleActive={handleToggleActive}
          onEdit={handleEditStaff}
        />
      )}

      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>Staff Management</h1>
            <p className="text-sm text-gray-400 mt-1">Manage People's Health Care team members</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg transition-transform hover:scale-105"
            style={{ background: "linear-gradient(135deg, #0D2137, #1A237E)" }}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/>
            </svg>
            Add Staff
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Staff",  value: stats.total,    color: "#1A237E", bg: "#E8EAF6" },
            { label: "Active",       value: stats.active,   color: "#2E7D32", bg: "#E8F5E9" },
            { label: "Doctors",      value: stats.doctors,  color: "#1565C0", bg: "#E3F2FD" },
            { label: "Inactive",     value: stats.inactive, color: "#37474F", bg: "#ECEFF1" },
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
            <input type="text" placeholder="Search by name, email or ID…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[["all","All"], ["doctor","Doctors"], ["lab","Lab"], ["pharmacy","Pharmacy"], ["cashier","Cashier"], ["admin","Admin"]].map(([val, label]) => (
              <button key={val} onClick={() => setRoleFilter(val)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${roleFilter === val ? "text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                style={roleFilter === val ? { background: "linear-gradient(135deg, #0D2137, #1A237E)" } : {}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Staff grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"/>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map(s => {
              const cfg = ROLE_CONFIG[s.role] || ROLE_CONFIG.admin;
              return (
                <div key={s._id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition overflow-hidden ${!s.isActive ? "opacity-60" : "border-gray-100"}`}>
                  <div className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ background: s.isActive ? "linear-gradient(135deg, #0D2137, #1A237E)" : "#9CA3AF" }}>
                      {getInitials(s.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 truncate">{s.name}</div>
                      <div className="text-xs text-gray-500 truncate">{s.email}</div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {s.isActive ? "● Active" : "● Inactive"}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setViewStaff(s)}
                      className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition flex-shrink-0">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                      </svg>
                    </button>
                  </div>
                  <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">🪪 {s.userId}</div>
                    <div className="flex items-center gap-1.5">📞 {s.telephone}</div>
                    <div className="flex items-center gap-1.5 col-span-2">📅 Joined: {formatDate(s.createdAt)}</div>
                  </div>
                  <div className="border-t border-gray-100 px-5 py-3 flex gap-2">
                    <button onClick={() => setEditStaff(s)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-white transition bg-indigo-600 hover:bg-indigo-700">
                      ✏️ Edit
                    </button>
                    <button onClick={() => setViewStaff(s)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100 transition">
                      👁️ View
                    </button>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && !loading && (
              <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-4xl mb-3">👥</div>
                <div className="text-gray-500 font-medium">No staff members found</div>
                <div className="text-gray-400 text-sm mt-1">Add a new staff member using the button above</div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}