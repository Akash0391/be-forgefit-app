import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Workout from '../models/Workout.js';

dotenv.config();

const deleteAllWorkouts = async () => {
  try {
    // Connect to MongoDB - ensure database name is included
    let mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forgefit';
    
    // Ensure database name is included for Atlas connections
    if (mongoURI.includes('mongodb+srv://') && !mongoURI.match(/\/[^\/]+\?/) && !mongoURI.endsWith('/')) {
      mongoURI = mongoURI + '/forgefit';
    } else if (mongoURI.includes('mongodb+srv://') && mongoURI.endsWith('/')) {
      mongoURI = mongoURI + 'forgefit';
    }
    
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
    console.log(`📊 Database: ${mongoose.connection.name}`);

    // Count workouts before deletion
    const countBefore = await Workout.countDocuments({});
    console.log(`📋 Found ${countBefore} workout(s) in database`);

    if (countBefore === 0) {
      console.log('ℹ️  No workouts to delete');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Delete all workouts
    const result = await Workout.deleteMany({});
    console.log(`✅ Successfully deleted ${result.deletedCount} workout(s)`);

    // Verify deletion
    const countAfter = await Workout.countDocuments({});
    console.log(`📊 Remaining workouts: ${countAfter}`);

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting workouts:', error);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

deleteAllWorkouts();

