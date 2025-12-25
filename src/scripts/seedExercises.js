import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Exercise from '../models/Exercise.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to exercises data file
const exercisesDataPath = path.join(__dirname, '../data/exercises.json');

const seedExercises = async () => {
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

    // Read exercises data
    if (!fs.existsSync(exercisesDataPath)) {
      console.error(`❌ Exercises data file not found: ${exercisesDataPath}`);
      console.log('   Please create the file with your exercise data and GIF URLs.');
      process.exit(1);
    }

    const exercisesData = JSON.parse(fs.readFileSync(exercisesDataPath, 'utf8'));
    console.log(`📖 Loaded ${exercisesData.length} exercises from data file`);

    // Validate exercises have required fields
    const validExercises = [];
    const invalidExercises = [];

    exercisesData.forEach((exercise, index) => {
      if (!exercise.name) {
        invalidExercises.push(`Exercise at index ${index}: missing name`);
        return;
      }

      const primary = exercise.muscleGroups?.length ? exercise.muscleGroups[0] : null;
      const secondary = exercise.muscleGroups?.length ? exercise.muscleGroups.slice(1) : [];

      if (!primary) {
        invalidExercises.push(`Exercise "${exercise.name}" has no primary muscle`);
        return;
      }

      validExercises.push({
        ...exercise,
        primaryMuscle: primary,
        secondaryMuscles: secondary,
        isCustom: false
      });

      delete exercise.muscleGroups;
    });


    if (invalidExercises.length > 0) {
      console.error('❌ Invalid exercises found:');
      invalidExercises.forEach(err => console.error(`   ${err}`));
      process.exit(1);
    }

    // Clear existing exercises (only non-custom ones)
    const deleteResult = await Exercise.deleteMany({ isCustom: false });
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing exercises`);

    // Insert exercises
    const result = await Exercise.insertMany(validExercises);
    console.log(`✅ Successfully seeded ${result.length} exercises`);

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Total exercises: ${result.length}`);
    console.log(`   With GIFs: ${result.filter(e => e.gifUrl).length}`);
    console.log(`   Without GIFs: ${result.filter(e => !e.gifUrl).length}`);

    // List exercises by muscle group
    const byMuscleGroup = {};
    result.forEach(ex => {
      if (ex.primaryMuscle) {
        if (!byMuscleGroup[ex.primaryMuscle]) byMuscleGroup[ex.primaryMuscle] = [];
        byMuscleGroup[ex.primaryMuscle].push(ex.name);
      }
    });


    console.log('\n📋 Exercises by muscle group:');
    Object.entries(byMuscleGroup).forEach(([group, exercises]) => {
      console.log(`   ${group}: ${exercises.length} exercises`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding exercises:', error);
    process.exit(1);
  }
};

seedExercises();

