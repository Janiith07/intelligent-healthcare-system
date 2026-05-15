# People's Health Care — Frontend UI

**Intelligent Medical Center Management System**  
Client: Dr. M.T.D. Jayaweera | SLIIT AIML Project 2026 | Group: AI/ML_M_01

---

## Tech Stack

- **React 18** + **Vite**
- **Tailwind CSS v3**
- **React Router DOM v6**

---

## Project Structure

```
peoples-health-care/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx              # App entry point
    ├── App.jsx               # Router & all routes
    ├── index.css             # Global styles + Tailwind
    ├── components/
    │   ├── DoctorLayout.jsx  # Sidebar layout for all doctor pages
    │   └── DashboardLayout.jsx
    └── pages/
        ├── Index.jsx         # Public landing page (/)
        ├── Login.jsx         # Login page with role selector
        ├── Register.jsx      # Patient registration
        ├── PatientDashboard.jsx
        ├── PharmacyDashboard.jsx
        ├── LabDashboard.jsx
        ├── AdminDashboard.jsx
        ├── BillingPage.jsx
        └── doctor/           # All doctor-specific pages
            ├── DoctorDashboard.jsx    # /doctor/dashboard
            ├── DoctorAppointments.jsx # /doctor/appointments
            ├── DoctorPrescriptions.jsx# /doctor/prescriptions
            └── DoctorLabRequests.jsx  # /doctor/lab-requests
```

---

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Index | Public landing page |
| `/login` | Login | Staff & patient login with role picker |
| `/register` | Register | New patient registration |
| `/doctor` | DoctorDashboard | Doctor's overview dashboard |
| `/doctor/appointments` | DoctorAppointments | Schedule & appointment management |
| `/doctor/prescriptions` | DoctorPrescriptions | Issue & manage prescriptions |
| `/doctor/lab-requests` | DoctorLabRequests | Lab test requests & results |
| `/patient` | PatientDashboard | Patient portal |
| `/pharmacy` | PharmacyDashboard | Pharmacy inventory & dispensal |
| `/lab` | LabDashboard | Laboratory test management |
| `/admin` | AdminDashboard | Admin control panel |

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build for production
npm run build
```

The app will open at **http://localhost:5173**

---

## Notes

- This is the **frontend only**. Connect to your MERN backend by updating API calls.
- Font families: **Playfair Display** (headings) + **DM Sans** (body)
- Color palette: Navy `#0D2137` · Blue `#1565C0` · Teal `#00ACC1`
- All AI/ML feature pages are named generically (e.g., "Medical Analysis") as per project requirements.
