import { useState, useEffect } from "react";
import PatientLayout from "../../components/PatientLayout";
import api from "../../services/api";

function getInitials(name) {
  if (!name) return "P";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function calculateAge(birthday) {
  if (!birthday) return null;
  const today = new Date();
  const birth = new Date(birthday);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800"
          style={{ fontFamily: "'Playfair Display', serif" }}>
          {title}
        </h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2
                    border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm text-gray-800 font-medium text-right max-w-[60%]">
        {value || "N/A"}
      </span>
    </div>
  );
}

const inputClass = `w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-400`;

export default function PatientProfile() {
  const [activeTab, setActiveTab]   = useState("overview");
  const [user, setUser]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg]     = useState("");

  const [form, setForm] = useState({
    telephone:              "",
    upgradeEmail:           "",
    // upgradeEmail is only used when user wants to upgrade from username to email
    birthday:               "",
    gender:                 "",
    address:                "",
    allergies:              "",
    chronicConditions:      "",
    currentMedications:     "",
    emergencyContactName:   "",
    emergencyContactNumber: "",
    currentPassword:        "",
    newPassword:            "",
    confirmNewPassword:     "",
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const stored = sessionStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser(parsed);
          populateForm(parsed);
        }
        const res = await api.get("/auth/me");
        if (res.data.success) {
          setUser(res.data.user);
          populateForm(res.data.user);
          sessionStorage.setItem("user", JSON.stringify(res.data.user));
        }
      } catch {
        setErrorMsg("Could not load profile data.");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const populateForm = (u) => {
    setForm({
      telephone:              u.telephone || "",
      upgradeEmail:           "",
      birthday:               u.patientDetails?.birthday
                                ? u.patientDetails.birthday.split("T")[0]
                                : "",
      gender:                 u.patientDetails?.gender || "",
      address:                u.patientDetails?.address || "",
      allergies:              (u.patientDetails?.allergies || []).join(", "),
      chronicConditions:      u.patientDetails?.chronicConditions || "",
      currentMedications:     u.patientDetails?.currentMedications || "",
      emergencyContactName:   u.patientDetails?.emergencyContactName || "",
      emergencyContactNumber: u.patientDetails?.emergencyContactNumber || "",
      currentPassword:        "",
      newPassword:            "",
      confirmNewPassword:     "",
    });
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ── Check if this is a username-only account ───────────
  const isUsernameOnly = !user?.email && !!user?.username;

  const validateForm = () => {
    if (!form.telephone.trim())
      return "Telephone number is required.";
    if (!/^\d{10}$/.test(form.telephone.trim()))
      return "Telephone must be exactly 10 digits.";

    // Validate upgrade email if provided
    if (form.upgradeEmail.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.upgradeEmail.trim()))
        return "Please enter a valid email address.";
    }

    if (form.emergencyContactNumber.trim() &&
        !/^\d{10}$/.test(form.emergencyContactNumber.trim()))
      return "Emergency contact number must be exactly 10 digits.";

    if (form.birthday) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(form.birthday) >= today)
        return "Date of birth must be before today.";
    }

    if (form.newPassword) {
      if (!form.currentPassword)
        return "Please enter your current password to set a new one.";
      if (!/^(?=.*[a-zA-Z])(?=.*\d).{6,}$/.test(form.newPassword))
        return "New password must be at least 6 characters with letters and numbers.";
      if (form.newPassword !== form.confirmNewPassword)
        return "New passwords do not match.";
    }
    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const validationError = validateForm();
    if (validationError) return setErrorMsg(validationError);

    setSaving(true);
    try {
      const payload = {
        telephone: form.telephone,
        patientDetails: {
          birthday:               form.birthday,
          gender:                 form.gender,
          address:                form.address,
          allergies:              form.allergies
                                    .split(",")
                                    .map((a) => a.trim())
                                    .filter(Boolean),
          chronicConditions:      form.chronicConditions,
          currentMedications:     form.currentMedications,
          emergencyContactName:   form.emergencyContactName,
          emergencyContactNumber: form.emergencyContactNumber,
        },
      };

      // Include email upgrade if user filled it in
      if (isUsernameOnly && form.upgradeEmail.trim()) {
        payload.email = form.upgradeEmail.trim();
      }

      if (form.currentPassword && form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword     = form.newPassword;
      }

      const res = await api.put("/auth/me", payload);
      if (res.data.success) {
        setUser(res.data.user);
        sessionStorage.setItem("user", JSON.stringify(res.data.user));
        populateForm(res.data.user);
        setSuccessMsg(
          form.upgradeEmail.trim() && isUsernameOnly
            ? "Email added successfully! You can now log in with your email."
            : "Profile updated successfully!"
        );
        setActiveTab("overview");
      }
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || "Failed to update. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PatientLayout activePage="My Profile">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 text-sm">Loading profile...</p>
        </div>
      </PatientLayout>
    );
  }

  const age          = calculateAge(user?.patientDetails?.birthday);
  const initials     = getInitials(user?.name);
  const bloodGroup   = user?.patientDetails?.bloodGroup;
  const registeredDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "N/A";

  const TABS = [
    { id: "overview", label: "Overview"     },
    { id: "medical",  label: "Medical Info" },
    { id: "edit",     label: "Edit Profile" },
  ];

  return (
    <PatientLayout activePage="My Profile">
      <div className="p-6 space-y-5">

        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700
                          text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg("")}
              className="text-green-500 hover:text-green-700 ml-3">✕</button>
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700
                          text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg("")}
              className="text-red-500 hover:text-red-700 ml-3">✕</button>
          </div>
        )}

        {/* Profile header */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0D2137 0%, #1565C0 60%, #00ACC1 100%)" }}>

          <div className="p-6 flex flex-col md:flex-row items-start
                          md:items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center
                              text-2xl font-bold text-white flex-shrink-0
                              border-4 border-white/20"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                {initials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full
                              bg-green-400 border-2 border-white" />
            </div>

            <div className="flex-1">
              <h2 style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 700, fontSize: "1.5rem", color: "white"
              }}>
                {user?.name}
              </h2>
              {user?.username && (
                <p className="text-white/50 text-xs mt-0.5">
                  @{user.username}
                  {isUsernameOnly && (
                    <span className="ml-2 text-amber-300">· No email set</span>
                  )}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  { label: "ID",          val: user?.userId              },
                  { label: "Age",         val: age ? `${age} yrs` : null },
                  { label: "Blood Group", val: bloodGroup                },
                  { label: "Since",       val: registeredDate            },
                ].filter((i) => i.val).map((item) => (
                  <div key={item.label}
                    className="flex items-center gap-1.5 bg-white/10
                               rounded-full px-3 py-1">
                    <span className="text-white/50 text-xs">{item.label}:</span>
                    <span className="text-white text-xs font-semibold">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setActiveTab("edit")}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/15
                         hover:bg-white/25 border border-white/20 rounded-xl
                         text-white text-sm font-medium transition flex-shrink-0">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Edit Profile
            </button>
          </div>

          <div className="flex border-t border-white/10 overflow-x-auto">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap
                            transition border-b-2 ${
                  activeTab === tab.id
                    ? "text-white border-cyan-300"
                    : "text-white/50 border-transparent hover:text-white/80"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB: Overview ── */}
        {activeTab === "overview" && (
          <div className="grid md:grid-cols-2 gap-5">
            <Section title="Personal Information">
              <div className="space-y-1">
                <InfoRow label="Full Name"     value={user?.name} />
                <InfoRow label="Patient ID"    value={user?.userId} />
                <InfoRow label="Email"         value={user?.email} />
                <InfoRow label="Username"      value={user?.username ? `@${user.username}` : null} />
                <InfoRow label="Phone"         value={user?.telephone} />
                <InfoRow label="Date of Birth" value={formatDate(user?.patientDetails?.birthday)} />
                <InfoRow label="Age"           value={age ? `${age} years` : null} />
                <InfoRow label="Gender"        value={user?.patientDetails?.gender} />
                <InfoRow label="Blood Group"   value={user?.patientDetails?.bloodGroup} />
              </div>
            </Section>

            <div className="space-y-5">
              <Section title="Address">
                <p className="text-sm text-gray-700">
                  {user?.patientDetails?.address || "No address saved"}
                </p>
              </Section>

              <Section title="Emergency Contact">
                <div className="flex items-center gap-3 p-4 bg-red-50
                                rounded-xl border border-red-100">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center
                                  justify-center text-lg flex-shrink-0">🆘</div>
                  <div>
                    <div className="font-semibold text-gray-800">
                      {user?.patientDetails?.emergencyContactName || "Not set"}
                    </div>
                    <div className="text-sm font-semibold text-blue-700 mt-0.5">
                      {user?.patientDetails?.emergencyContactNumber || "—"}
                    </div>
                  </div>
                </div>
              </Section>
            </div>
          </div>
        )}

        {/* ── TAB: Medical Info ── */}
        {activeTab === "medical" && (
          <div className="grid md:grid-cols-2 gap-5">
            <Section title="Allergies">
              {user?.patientDetails?.allergies?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.patientDetails.allergies.map((a) => (
                    <span key={a}
                      className="px-3 py-1.5 bg-red-50 text-red-700 border
                                 border-red-100 rounded-full text-sm font-medium">
                      ⚠️ {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No allergies recorded</p>
              )}
            </Section>

            <Section title="Blood Group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100
                                flex items-center justify-center text-xl flex-shrink-0">
                  🩸
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-800">
                    {user?.patientDetails?.bloodGroup || "Not recorded"}
                  </p>
                  <p className="text-xs text-gray-400">Cannot be changed by patient</p>
                </div>
              </div>
            </Section>

            <Section title="Chronic Conditions">
              <p className="text-sm text-gray-700">
                {user?.patientDetails?.chronicConditions || "None recorded"}
              </p>
            </Section>

            <Section title="Current Medications">
              <p className="text-sm text-gray-700">
                {user?.patientDetails?.currentMedications || "None recorded"}
              </p>
            </Section>
          </div>
        )}

        {/* ── TAB: Edit Profile ── */}
        {activeTab === "edit" && (
          <Section title="Edit Profile">

            {/* Fixed fields notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-xs text-amber-700 font-medium">
                ⓘ Name, Patient ID and Blood Group cannot be changed after registration.
                {user?.email
                  ? " Email address is also fixed once set."
                  : " You can add an email address below to upgrade your account."}
              </p>
            </div>

            {/* Read-only fixed fields */}
            <div className="grid md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50
                            rounded-xl border border-gray-100">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Full Name (fixed)
                </label>
                <p className="text-sm font-semibold text-gray-500">{user?.name}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  {user?.email ? "Email (fixed)" : "Username (login ID)"}
                </label>
                <p className="text-sm font-semibold text-gray-500">
                  {user?.email || (user?.username ? `@${user.username}` : "—")}
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Patient ID (fixed)
                </label>
                <p className="text-sm font-semibold text-gray-500">{user?.userId}</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">

              {/* Contact Info */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase
                               tracking-wide mb-3">Contact Information</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Phone <span className="text-red-400">*</span>
                    </label>
                    <input name="telephone" value={form.telephone}
                      onChange={handleChange} placeholder="e.g. 0712345678"
                      className={inputClass} />
                    <p className="text-xs text-gray-400 mt-1">
                      Must be exactly 10 digits
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Address</label>
                    <input name="address" value={form.address}
                      onChange={handleChange} placeholder="No., Street, City"
                      className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Email upgrade — only shown for username-only accounts */}
              {isUsernameOnly && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase
                                 tracking-wide mb-3">
                    Upgrade Account
                  </h4>
                  <div className="p-4 bg-blue-50 border border-blue-100
                                  rounded-xl space-y-3">
                    <p className="text-xs text-blue-700 font-medium">
                      📧 Add an email address to upgrade your account.
                      Your username will be removed and you will log in with email instead.
                    </p>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Email Address
                        <span className="text-gray-400 font-normal ml-1">
                          (optional — replaces your username)
                        </span>
                      </label>
                      <input
                        name="upgradeEmail"
                        type="email"
                        value={form.upgradeEmail}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Personal Details */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase
                               tracking-wide mb-3">Personal Details</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Date of Birth
                    </label>
                    <input type="date" name="birthday" value={form.birthday}
                      onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Gender</label>
                    <select name="gender" value={form.gender}
                      onChange={handleChange} className={inputClass}>
                      <option value="">Select gender</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                  {/* Blood group — read only */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Blood Group (fixed)
                    </label>
                    <div className="px-3 py-2.5 rounded-xl border border-gray-100
                                    bg-gray-50 text-sm text-gray-500">
                      {user?.patientDetails?.bloodGroup || "Not set"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Medical Info */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase
                               tracking-wide mb-3">Medical Information</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Allergies
                      <span className="text-gray-400 font-normal ml-1">
                        (separate with commas)
                      </span>
                    </label>
                    <input name="allergies" value={form.allergies}
                      onChange={handleChange}
                      placeholder="e.g. Penicillin, Dust"
                      className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Chronic Conditions
                    </label>
                    <input name="chronicConditions" value={form.chronicConditions}
                      onChange={handleChange}
                      placeholder="e.g. Diabetes, Hypertension"
                      className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">
                      Current Medications
                    </label>
                    <input name="currentMedications" value={form.currentMedications}
                      onChange={handleChange}
                      placeholder="e.g. Metformin 500mg"
                      className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase
                               tracking-wide mb-3">Emergency Contact</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Contact Name
                    </label>
                    <input name="emergencyContactName"
                      value={form.emergencyContactName}
                      onChange={handleChange}
                      placeholder="e.g. Kamali Perera"
                      className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Contact Number
                    </label>
                    <input name="emergencyContactNumber"
                      value={form.emergencyContactNumber}
                      onChange={handleChange}
                      placeholder="e.g. 0771234567"
                      className={inputClass} />
                    <p className="text-xs text-gray-400 mt-1">
                      Must be exactly 10 digits if provided
                    </p>
                  </div>
                </div>
              </div>

              {/* Change Password */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase
                               tracking-wide mb-3">
                  Change Password
                  <span className="normal-case font-normal text-gray-400 ml-1">
                    (leave blank to keep current password)
                  </span>
                </h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Current Password
                    </label>
                    <input type="password" name="currentPassword"
                      value={form.currentPassword} onChange={handleChange}
                      placeholder="Enter current password"
                      className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      New Password
                    </label>
                    <input type="password" name="newPassword"
                      value={form.newPassword} onChange={handleChange}
                      placeholder="Min 6 chars, letters + numbers"
                      className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Confirm New Password
                    </label>
                    <input type="password" name="confirmNewPassword"
                      value={form.confirmNewPassword} onChange={handleChange}
                      placeholder="Re-enter new password"
                      className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-white text-sm
                             font-semibold disabled:opacity-60 transition"
                  style={{ background: "linear-gradient(135deg, #1565C0, #00ACC1)" }}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button"
                  onClick={() => {
                    populateForm(user);
                    setActiveTab("overview");
                    setErrorMsg("");
                  }}
                  className="px-6 py-2.5 rounded-xl border border-gray-200
                             text-gray-600 text-sm font-medium
                             hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>

            </form>
          </Section>
        )}

      </div>
    </PatientLayout>
  );
}