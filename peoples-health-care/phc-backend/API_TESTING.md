# 🧪 API Testing Guide

Quick reference for testing all endpoints.

## 📌 Setup

1. Start backend: `npm run dev`
2. Use Postman, Insomnia, or curl commands below

---

## 🔐 Authentication Endpoints

### 1. Register User

**Endpoint:** `POST http://localhost:5000/api/auth/register`

**Example: Register a Doctor**
```json
{
  "email": "doctor@phc.lk",
  "password": "password123",
  "fullName": "Dr. M.T.D. Jayaweera",
  "phone": "0777883343",
  "role": "doctor",
  "profileData": {
    "specialization": "Chief Physician",
    "department": "Consultation",
    "shift": "Mon–Sat · 08:00–17:00",
    "registrationNo": "SLMC-12345"
  }
}
```

**Example: Register a Patient**
```json
{
  "email": "kamal@gmail.com",
  "password": "password123",
  "fullName": "Kamal Perera",
  "phone": "0712345678",
  "role": "patient",
  "profileData": {
    "dob": "1972-03-12",
    "gender": "Male",
    "bloodType": "B+",
    "address": "No. 45, Galle Road, Matara",
    "allergies": ["Penicillin"],
    "activeConditions": ["Type 2 Diabetes", "Hypertension"]
  }
}
```

**Example: Register Admin**
```json
{
  "email": "admin@phc.lk",
  "password": "admin123",
  "fullName": "Administrator",
  "phone": "0777111222",
  "role": "admin",
  "profileData": {
    "department": "Administration",
    "designation": "System Administrator",
    "shift": "Mon–Fri · 09:00–17:00",
    "joinedDate": "2020-01-01"
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "65f1234567890abcdef",
    "userId": "STF-0001",
    "email": "doctor@phc.lk",
    "fullName": "Dr. M.T.D. Jayaweera",
    "role": "doctor",
    "doctorProfile": { ... }
  }
}
```

---

### 2. Login

**Endpoint:** `POST http://localhost:5000/api/auth/login`

**Request Body:**
```json
{
  "email": "doctor@phc.lk",
  "password": "password123"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "65f1234567890abcdef",
    "userId": "STF-0001",
    "email": "doctor@phc.lk",
    "fullName": "Dr. M.T.D. Jayaweera",
    "role": "doctor"
  }
}
```

**⚠️ IMPORTANT:** Save the `token` from response!

---

### 3. Get Current User

**Endpoint:** `GET http://localhost:5000/api/auth/me`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

**Success Response:**
```json
{
  "success": true,
  "user": {
    "_id": "65f1234567890abcdef",
    "userId": "STF-0001",
    "email": "doctor@phc.lk",
    "fullName": "Dr. M.T.D. Jayaweera",
    "role": "doctor",
    "doctorProfile": {
      "specialization": "Chief Physician",
      "department": "Consultation"
    }
  }
}
```

---

## 👥 User Management Endpoints (Admin Only)

### 4. Get All Users

**Endpoint:** `GET http://localhost:5000/api/users`

**Headers:**
```
Authorization: Bearer ADMIN_TOKEN_HERE
```

**Query Parameters (optional):**
- `role=doctor` - filter by role
- `isActive=true` - filter by active status
- `search=kamal` - search by name, email, or userId

**Example:**
```
GET http://localhost:5000/api/users?role=patient&isActive=true
```

**Success Response:**
```json
{
  "success": true,
  "count": 5,
  "users": [
    {
      "_id": "...",
      "userId": "PHC-2026-0001",
      "fullName": "Kamal Perera",
      "role": "patient",
      "isActive": true
    }
  ]
}
```

---

### 5. Get Single User

**Endpoint:** `GET http://localhost:5000/api/users/:id`

**Headers:**
```
Authorization: Bearer ADMIN_TOKEN_HERE
```

**Example:**
```
GET http://localhost:5000/api/users/65f1234567890abcdef
```

---

### 6. Update User

**Endpoint:** `PUT http://localhost:5000/api/users/:id`

**Headers:**
```
Authorization: Bearer ADMIN_TOKEN_HERE
Content-Type: application/json
```

**Request Body:**
```json
{
  "fullName": "Dr. M.T.D. Jayaweera (Updated)",
  "phone": "0777999888",
  "isActive": true
}
```

---

### 7. Delete User (Soft Delete)

**Endpoint:** `DELETE http://localhost:5000/api/users/:id`

**Headers:**
```
Authorization: Bearer ADMIN_TOKEN_HERE
```

**Success Response:**
```json
{
  "success": true,
  "message": "User deleted successfully",
  "user": {
    "_id": "...",
    "deletedAt": "2026-02-20T10:30:00.000Z",
    "isActive": false
  }
}
```

---

### 8. Restore Deleted User

**Endpoint:** `PUT http://localhost:5000/api/users/:id/restore`

**Headers:**
```
Authorization: Bearer ADMIN_TOKEN_HERE
```

---

## 🔥 Quick Test Workflow

### Using curl:

```bash
# 1. Register admin
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@phc.lk",
    "password": "admin123",
    "fullName": "Administrator",
    "phone": "0777111222",
    "role": "admin"
  }'

# 2. Login and get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@phc.lk",
    "password": "admin123"
  }'

# Copy the token from response

# 3. Get all users (replace YOUR_TOKEN)
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using Postman:

1. **Import Collection:**
   - File → Import → Paste this JSON

2. **Set Environment Variable:**
   - Create variable `token`
   - After login, copy token to this variable
   - Use `{{token}}` in Authorization headers

---

## ❌ Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Not authorized, no token provided` | Missing Authorization header | Add `Authorization: Bearer <token>` |
| `401 Not authorized, token failed` | Invalid/expired token | Login again to get new token |
| `403 User role 'patient' is not authorized` | Wrong role | Use admin token for /users routes |
| `400 User with this email already exists` | Duplicate email | Use different email |
| `500 Server error` | MongoDB not running | Start MongoDB service |

---

## 🎯 Testing Checklist

- [ ] Register doctor
- [ ] Register patient
- [ ] Register admin
- [ ] Login as doctor
- [ ] Login as patient
- [ ] Login as admin
- [ ] Get current user (with token)
- [ ] Get all users (admin only)
- [ ] Update user (admin only)
- [ ] Delete user (admin only)
- [ ] Restore user (admin only)

---

## 📝 Notes

- All passwords are hashed with bcrypt before saving
- Tokens expire in 7 days (configurable in `.env`)
- Soft delete: users are never truly removed from database
- userId is auto-generated based on role
