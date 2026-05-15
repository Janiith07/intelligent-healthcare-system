// ══════════════════════════════════════════════════════════════
// @desc    Create new staff member (admin only)
// @route   POST /api/users/staff
// @access  Private/Admin
// ══════════════════════════════════════════════════════════════
import User from '../models/User.js';

export const createStaff = async (req, res) => {
  try {
    const { name, email, password, telephone, role, slmcRegisterNumber, workingExperience } = req.body;

    const staffRoles = ['doctor', 'lab', 'pharmacy', 'cashier', 'admin'];
    if (!staffRoles.includes(role))
      return res.status(400).json({ success: false, message: 'Invalid role. Must be doctor, lab, pharmacy, cashier or admin' });
    if (!name || !email || !password || !telephone)
      return res.status(400).json({ success: false, message: 'Name, email, password and telephone are required' });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ success: false, message: 'A user with this email already exists' });

    const userId = await User.generateUserId(role);

    const doctorDetails = role === 'doctor' ? {
      slmcRegisterNumber: slmcRegisterNumber || '',
      workingExperience:  workingExperience  || '',
    } : undefined;

    const user = await User.create({
      userId,
      role,
      name,
      email,
      passwordHash: password,
      telephone,
      isActive: true,
      doctorDetails,
    });

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
      user: {
        _id: user._id, userId: user.userId, name: user.name,
        email: user.email, telephone: user.telephone, role: user.role,
        isActive: user.isActive, doctorDetails: user.doctorDetails,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════════
// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
// ══════════════════════════════════════════════════════════════
export const getAllUsers = async (req, res) => {
  try {
    const { role, isActive, search } = req.query;

    // Build filter
    const filter = { deletedAt: null }; // Exclude soft-deleted users

    if (role) {
      filter.role = role;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter).select('-passwordHash');

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════
// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
// ══════════════════════════════════════════════════════════════
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════
// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
// ══════════════════════════════════════════════════════════════
export const updateUser = async (req, res) => {
  try {
    const allowedUpdates = [
      'fullName',
      'phone',
      'isActive',
      'doctorProfile',
      'patientProfile',
      'staffProfile',
      'name',
      'email',
      'telephone',
      'password',
    ];

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Check if email is being updated and if it's already taken
    if (updates.email) {
      const existingUser = await User.findOne({
        email: updates.email,
        _id: { $ne: req.params.id }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use'
        });
      }
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update fields
    if (updates.name) user.name = updates.name;
    if (updates.email) user.email = updates.email;
    if (updates.telephone) user.telephone = updates.telephone;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;
    if (updates.password) user.passwordHash = updates.password; // Will be hashed in pre-save hook

    await user.save();

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.passwordHash;

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════
// @desc    Soft delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
// ══════════════════════════════════════════════════════════════
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        deletedAt: new Date(),
        isActive: false,
      },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════
// @desc    Restore soft-deleted user
// @route   PUT /api/users/:id/restore
// @access  Private/Admin
// ══════════════════════════════════════════════════════════════
export const restoreUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        deletedAt: null,
        isActive: true,
      },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User restored successfully',
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════
// @desc    Search patients by name or userId (for doctor forms)
// @route   GET /api/users/patients/search?q=...
// @access  Private (doctor, admin)
// ══════════════════════════════════════════════════════════════
export const searchPatients = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.status(200).json({ success: true, patients: [] });

    const regex = { $regex: q.trim(), $options: 'i' };
    const patients = await User.find({
      role: 'patient',
      $or: [{ name: regex }, { userId: regex }],
    }).select('_id userId name photo telephone patientDetails').limit(8);

    res.status(200).json({ success: true, patients });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════════
// @desc    Get public doctor profile (for landing page)
// @route   GET /api/public/doctor
// @access  Public
// ══════════════════════════════════════════════════════════════
export const getPublicDoctor = async (req, res) => {
  try {
    const doctor = await User.findOne({ role: 'doctor', isActive: true })
      .select('name photo doctorDetails telephone');
    res.status(200).json({ success: true, doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════════════════════
// @desc    Get all patients with their prescriptions (for doctor)
// @route   GET /api/patients
// @access  Private (doctor, admin)
// ══════════════════════════════════════════════════════════════
export const getAllPatients = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { role: 'patient' };

    if (search) {
      const regex = { $regex: search.trim(), $options: 'i' };
      filter.$or = [
        { name:      regex },
        { userId:    regex },
        { telephone: regex },
      ];
    }

    const patients = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: patients.length, patients });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};