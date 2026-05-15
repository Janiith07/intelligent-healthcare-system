import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin exists
    const existingAdmin = await User.findOne({ email: 'admin@phc.lk' });
    if (existingAdmin) {
      console.log('❌ Admin already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      userId: 'ADM-0001',
      role: 'admin',
      name: 'Administrator',
      email: 'admin@phc.lk',
      passwordHash: 'admin123', // Will be hashed automatically
      telephone: '0777111222',
      isActive: true,
      profileCompleted: true,
    });

    console.log('✅ Admin user created successfully!');
    console.log('   Email: admin@phc.lk');
    console.log('   Password: admin123');
    console.log('\n   Use these credentials to login and create other users.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

seedAdmin();
