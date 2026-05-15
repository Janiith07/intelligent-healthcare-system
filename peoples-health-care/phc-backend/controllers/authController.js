import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

// ── Validation helpers ─────────────────────────────────────
const isValidEmail    = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isValidPhone    = (v) => /^\d{10}$/.test(v);
const isValidPassword = (v) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(v);

// ── Age helper ─────────────────────────────────────────────
const calcAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const isValidUsername = (v) => /^[a-zA-Z0-9_]{3,20}$/.test(v);

// ── Register ───────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const {
      name, email, username, password, telephone,
      gender, dateOfBirth, bloodGroup,
      allergies, chronicConditions, currentMedications,
      emergencyContactName, emergencyContactNumber, address,
    } = req.body;

    // ── Required fields ────────────────────────────────────
    if (!name?.trim())
      return res.status(400).json({ success: false, message: 'Full name is required' });

    if (!password)
      return res.status(400).json({ success: false, message: 'Password is required' });

    if (!telephone?.trim())
      return res.status(400).json({ success: false, message: 'Telephone number is required' });

    // ── Must have email OR username, not both ──────────────
    const hasEmail    = !!email?.trim();
    const hasUsername = !!username?.trim();

    if (!hasEmail && !hasUsername)
      return res.status(400).json({ success: false, message: 'Please provide either an email address or a username' });

    if (hasEmail && hasUsername)
      return res.status(400).json({ success: false, message: 'Please provide either an email or a username, not both' });

    // ── Email validation ───────────────────────────────────
    if (hasEmail) {
      if (!isValidEmail(email))
        return res.status(400).json({ success: false, message: 'Please enter a valid email address (must contain @ and a domain)' });
      if (await User.findOne({ email: email.toLowerCase() }))
        return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    // ── Username validation ────────────────────────────────
    if (hasUsername) {
      if (!isValidUsername(username))
        return res.status(400).json({ success: false, message: 'Username must be 3-20 characters, letters/numbers/underscore only' });
      if (await User.findOne({ username: username.toLowerCase() }))
        return res.status(400).json({ success: false, message: 'This username is already taken' });
    }

    // ── Password strength ──────────────────────────────────
    if (!isValidPassword(password))
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character' });

    // ── Phone ──────────────────────────────────────────────
    if (!isValidPhone(telephone))
      return res.status(400).json({ success: false, message: 'Telephone must be exactly 10 digits (e.g. 0712345678)' });

    // ── Emergency contact phone ────────────────────────────
    if (emergencyContactNumber && !isValidPhone(emergencyContactNumber))
      return res.status(400).json({ success: false, message: 'Emergency contact number must be exactly 10 digits' });

    // ── Date of birth ──────────────────────────────────────
    if (dateOfBirth) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(dateOfBirth) >= today)
        return res.status(400).json({ success: false, message: 'Date of birth must be before today' });
    }

    // ── Build patientDetails ───────────────────────────────
    const patientDetails = {};
    if (gender)                 patientDetails.gender               = gender;
    if (dateOfBirth)            patientDetails.birthday             = dateOfBirth;
    if (bloodGroup && bloodGroup.trim())             patientDetails.bloodGroup           = bloodGroup;
    if (chronicConditions)      patientDetails.chronicConditions    = chronicConditions;
    if (currentMedications)     patientDetails.currentMedications   = currentMedications;
    if (emergencyContactName)   patientDetails.emergencyContactName = emergencyContactName;
    if (emergencyContactNumber) patientDetails.emergencyContactNumber = emergencyContactNumber;
    if (address)                patientDetails.address              = address;
    if (allergies) {
      patientDetails.allergies = Array.isArray(allergies)
        ? allergies
        : allergies.split(',').map((a) => a.trim()).filter(Boolean);
    }

    // ── Create user ────────────────────────────────────────
    // ── Age-based emergency-contact rule ───────────────────
    // Patients under 18 MUST provide both emergency contact name and number.
    const age = calcAge(dateOfBirth);
    if (age !== null && age < 18) {
      if (!emergencyContactName || !emergencyContactName.trim())
        return res.status(400).json({
          success: false,
          message: 'Emergency contact name is required for patients under 18 years old',
        });
      if (!emergencyContactNumber || !emergencyContactNumber.trim())
        return res.status(400).json({
          success: false,
          message: 'Emergency contact number is required for patients under 18 years old',
        });
    }

        const user = await User.create({
      userId:       await User.generateUserId('patient'),
      role:         'patient',
      name:         name.trim(),
      email:        hasEmail    ? email.toLowerCase().trim()    : null,
      username:     hasUsername ? username.toLowerCase().trim() : null,
      passwordHash: password,
      telephone:    telephone.trim(),
      patientDetails,
    });

    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      message: "Account created successfully! Welcome to People's Health Care.",
      token,
      user: buildUserResponse(user),
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
};

// ── Login ──────────────────────────────────────────────────
// Accepts email OR username in the identifier field
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier?.trim() || !password)
      return res.status(400).json({ success: false, message: 'Please provide your email/username and password' });

    const loginValue = identifier.toLowerCase().trim();

    // Determine lookup field by whether the identifier looks like an email.
    // Using a single-field query avoids sparse-index issues with $or on
    // fields that are null for many documents.
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginValue);
    const query   = isEmail ? { email: loginValue } : { username: loginValue };

    const user = await User.findOne(query).select('+passwordHash');

    if (!user || !await user.comparePassword(password))
      return res.status(401).json({ success: false, message: 'Incorrect email/username or password' });

    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact the medical center.' });

    const token = generateToken(user._id);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: buildUserResponse(user),
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login', error: error.message });
  }
};

// ── Get current user ───────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({
      success: true,
      user: buildUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Update own profile ─────────────────────────────────────
// Rules:
// - If user has username only → can add email (upgrades account, removes username)
// - If user has email → email cannot be changed
// - Cannot have both email and username at same time
// - bloodGroup cannot be changed
export const updateMe = async (req, res) => {
  try {
    const {
      telephone, email,
      photo,
      patientDetails, doctorDetails,
      currentPassword, newPassword,
    } = req.body;

    const updates = {};

    // ── Photo ──────────────────────────────────────────────
    if (photo !== undefined) {
      updates.photo = photo || null;
    }

    // ── Doctor details (doctors only) ──────────────────────
    if (doctorDetails && req.user.role === 'doctor') {
      const existing = req.user.doctorDetails?.toObject?.()
        || req.user.doctorDetails || {};
      // Only allow updating experience and certifications — slmcRegisterNumber is admin-only
      const allowedUpdate = {};
      if (doctorDetails.workingExperience !== undefined)
        allowedUpdate.workingExperience = doctorDetails.workingExperience;
      if (doctorDetails.certifications !== undefined) {
        allowedUpdate.certifications = Array.isArray(doctorDetails.certifications)
          ? doctorDetails.certifications
          : doctorDetails.certifications.split(',').map((c) => c.trim()).filter(Boolean);
      }
      updates.doctorDetails = { ...existing, ...allowedUpdate };
    }

    // ── Telephone ──────────────────────────────────────────
    if (telephone !== undefined) {
      if (!isValidPhone(telephone))
        return res.status(400).json({ success: false, message: 'Telephone must be exactly 10 digits (e.g. 0712345678)' });
      updates.telephone = telephone;
    }

    // ── Email upgrade (username → email) ───────────────────
    // Only allowed if user currently has NO email (username-only account)
    if (email !== undefined && email !== '') {
      if (req.user.email) {
        return res.status(400).json({ success: false, message: 'Email address cannot be changed once set' });
      }
      // User has username only — allow upgrade to email
      if (!isValidEmail(email))
        return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
      const taken = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: req.user._id },
      });
      if (taken)
        return res.status(400).json({ success: false, message: 'An account with this email already exists' });

      updates.email    = email.toLowerCase().trim();
      updates.username = null;
      // Remove username when email is added — cannot have both
    }

    // ── Patient details ────────────────────────────────────
    if (patientDetails) {
      const existing = req.user.patientDetails?.toObject?.()
        || req.user.patientDetails || {};

      if (patientDetails.allergies && typeof patientDetails.allergies === 'string') {
        patientDetails.allergies = patientDetails.allergies
          .split(',').map((a) => a.trim()).filter(Boolean);
      }

      if (patientDetails.emergencyContactNumber &&
          !isValidPhone(patientDetails.emergencyContactNumber))
        return res.status(400).json({ success: false, message: 'Emergency contact number must be exactly 10 digits' });

      if (patientDetails.birthday) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(patientDetails.birthday) >= today)
          return res.status(400).json({ success: false, message: 'Date of birth must be before today' });
      }

      // Remove bloodGroup — fixed field
      delete patientDetails.bloodGroup;

      updates.patientDetails = { ...existing, ...patientDetails };
    }

    // ── Password change ────────────────────────────────────
    if (currentPassword && newPassword) {
      if (!isValidPassword(newPassword))
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters with letters and numbers' });
      const userWithPw = await User.findById(req.user._id).select('+passwordHash');
      if (!await userWithPw.comparePassword(currentPassword))
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      Object.assign(userWithPw, updates);
      userWithPw.passwordHash = newPassword;
      const saved = await userWithPw.save();
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: buildUserResponse(saved),
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id, updates,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: buildUserResponse(user),
    });

  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json({ success: false, message: 'Server error during profile update', error: error.message });
  }
};

// ── Admin: create staff user ───────────────────────────────
export const adminCreateUser = async (req, res) => {
  try {
    const { name, email, password, telephone, role, photo, doctorDetails } = req.body;
    if (!name || !email || !password || !telephone || !role)
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    if (role === 'patient')
      return res.status(400).json({ success: false, message: 'Patients must register themselves' });
    if (await User.findOne({ email }))
      return res.status(400).json({ success: false, message: 'User with this email already exists' });

    const userData = {
      userId: await User.generateUserId(role),
      name, email, passwordHash: password, telephone, role,
      photo: photo || null,
    };
    if (role === 'doctor' && doctorDetails) userData.doctorDetails = doctorDetails;

    const user = await User.create(userData);
    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully`,
      user: buildUserResponse(user),
    });

  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(500).json({ success: false, message: 'Server error during user creation', error: error.message });
  }
};

// ── Helper ─────────────────────────────────────────────────
function buildUserResponse(user) {
  return {
    _id:            user._id,
    userId:         user.userId,
    name:           user.name,
    email:          user.email,
    username:       user.username,
    telephone:      user.telephone,
    role:           user.role,
    photo:          user.photo,
    patientDetails: user.patientDetails,
    doctorDetails:  user.doctorDetails,
    age:            user.age,
    createdAt:      user.createdAt,
  };
}