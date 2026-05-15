# People's Health Care - Frontend Setup

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
npm install axios
```

### 2. Start Development Server
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

## 📁 New Files Added

### Services
- `src/services/api.js` - Axios instance with interceptors
- `src/services/authService.js` - Authentication methods

### Pages
- `src/pages/Login.jsx` - **UPDATED** - Email + password only
- `src/pages/Register.jsx` - **NEW** - Step 1 (common details)
- `src/pages/CompleteProfile.jsx` - **NEW** - Step 2 (patient details)

### Routes
- `/login` - Login page
- `/register` - Patient registration (step 1)
- `/complete-profile` - Complete patient profile (step 2)

## 🔄 Patient Registration Flow

### Step 1: `/register`
User provides:
- Name
- Email
- Telephone
- Password

→ Redirects to `/complete-profile`

### Step 2: `/complete-profile`
User provides:
- Gender
- Birthday
- Blood Group
- Allergies (optional)

→ Redirects to `/patient/dashboard`

## 🔑 Login Flow

1. User enters **email + password** (no role selector)
2. Backend determines role from user record
3. Frontend redirects based on role:
   - `patient` → `/patient/dashboard`
   - `doctor` → `/doctor/dashboard`
   - `lab` → `/lab/dashboard`
   - `pharmacy` → `/pharmacy/dashboard`
   - `cashier` → `/pharmacy/billing`
   - `admin` → `/admin/dashboard`
4. If patient hasn't completed profile → `/complete-profile`

## 🧪 Testing

### Test Accounts

**Admin** (created via backend seed script):
- Email: `admin@phc.lk`
- Password: `admin123`

**Patient** (self-register):
- Go to `http://localhost:5173/register`
- Complete both steps

## 🔧 API Configuration

Backend URL is set in `src/services/api.js`:
```javascript
const API_URL = 'http://localhost:5000/api';
```

Change this if your backend runs on a different port.

## 📝 Environment Variables

No `.env` needed for frontend. Backend URL is hardcoded in `api.js`.

For production, update the API_URL to your production backend.

## ⚠️ Important Notes

1. **Only patients can self-register** - Other users must be created by admin
2. **Cashier role** uses Pharmacy UI (`/pharmacy/billing`)
3. **Photo upload** not implemented yet (placeholder field exists)
4. **One doctor** owns the center (assumption in system design)

## 🎨 UI Templates

All portals use the same design system:
- Navy sidebar (`#0D2137`)
- Role-specific accent colors
- Rounded cards, smooth animations
- Responsive grid layouts

## 🆘 Troubleshooting

**CORS errors?**
- Make sure backend `.env` has `FRONTEND_URL=http://localhost:5173`
- Restart backend after changing `.env`

**Can't login after registration?**
- Check browser console for errors
- Verify backend is running
- Check localStorage for token

**Stuck on complete-profile page?**
- Check network tab for API call to `/api/auth/complete-profile`
- Verify all required fields are filled
