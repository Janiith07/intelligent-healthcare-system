# People's Health Care - Backend API

Complete backend with simplified user management system.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Update `.env` with your MongoDB Atlas credentials:
```env
MONGO_URI=mongodb+srv://admin:123@cluster0.2t4ywiv.mongodb.net/peoples-health-care?retryWrites=true&w=majority
JWT_SECRET=phc-super-secret-jwt-key-2026
JWT_EXPIRE=7d
PORT=5000
FRONTEND_URL=http://localhost:5173
```

### 3. Create First Admin User
```bash
npm run seed
```

This creates:
- **Email:** admin@phc.lk
- **Password:** admin123

### 4. Start Server
```bash
npm run dev
```

## 👥 User Roles

| Role | Created By | Portal |
|------|-----------|---------|
| Patient | Self-registration | `/patient/dashboard` |
| Doctor | Admin | `/doctor/dashboard` |
| Lab | Admin | `/lab/dashboard` |
| Pharmacy | Admin | `/pharmacy/dashboard` |
| Cashier | Admin | `/pharmacy/billing` |
| Admin | Seed script | `/admin/dashboard` |

## 📊 User Attributes

### Common (All Users)
- Name
- Email (login username)
- Password (hashed)
- Telephone Number
- Role
- Photo

### Patient-Specific
- Gender
- Birthday/Age
- Blood Group
- Allergies (array)

### Doctor-Specific
- SLMC Register Number
- Medical Center Register Number
- Working Experience
- Certifications (array)

## 🔑 API Endpoints

### Public
- `POST /api/auth/register` - Patient signup (step 1)
- `POST /api/auth/login` - Login

### Protected
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/complete-profile` - Complete patient profile (step 2)

### Admin Only
- `POST /api/auth/admin/create-user` - Create staff users
- `GET /api/users` - List all users
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Soft delete user
- `PUT /api/users/:id/restore` - Restore deleted user

## 📝 Usage Examples

### Create Doctor (Admin)
```bash
curl -X POST http://localhost:5000/api/auth/admin/create-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "name": "Dr. M.T.D. Jayaweera",
    "email": "doctor@phc.lk",
    "password": "doctor123",
    "telephone": "0777883343",
    "role": "doctor",
    "doctorDetails": {
      "slmcRegisterNumber": "SLMC-12345",
      "medicalCenterRegisterNumber": "PHC-DOC-001",
      "workingExperience": "5 years at General Hospital Colombo",
      "certifications": ["MBBS", "MD", "FRCS"]
    }
  }'
```

### Patient Registration (2 Steps)

**Step 1 - Common Details:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kamal Perera",
    "email": "kamal@gmail.com",
    "password": "patient123",
    "telephone": "0712345678"
  }'
```

**Step 2 - Patient Details:**
```bash
curl -X PUT http://localhost:5000/api/auth/complete-profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -d '{
    "gender": "Male",
    "birthday": "1972-03-12",
    "bloodGroup": "B+",
    "allergies": ["Penicillin"]
  }'
```

## 🗄️ Database Schema

**User Document:**
```javascript
{
  userId: "PAT-2026-0001",
  role: "patient",
  name: "Kamal Perera",
  email: "kamal@gmail.com",
  passwordHash: "$2a$10$...",
  telephone: "0712345678",
  photo: null,
  isActive: true,
  profileCompleted: true,
  patientDetails: {
    gender: "Male",
    birthday: "1972-03-12",
    bloodGroup: "B+",
    allergies: ["Penicillin"]
  },
  createdAt: "2026-02-20T10:00:00Z",
  updatedAt: "2026-02-20T10:00:00Z",
  deletedAt: null
}
```

## 🔐 Security

- Passwords hashed with bcrypt (10 salt rounds)
- JWT tokens for authentication
- Role-based access control
- Soft delete (users never truly removed)
- CORS configured for frontend

## ⚙️ Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server (nodemon)
- `npm run seed` - Create first admin user

## 📁 Project Structure

```
backend/
├── server.js
├── .env
├── seed-admin.js
├── models/
│   └── User.js
├── routes/
│   ├── auth.js
│   └── users.js
├── controllers/
│   ├── authController.js
│   └── userController.js
└── middleware/
    ├── auth.js
    └── roleCheck.js
```
