import mongoose from 'mongoose';
import Workout from '../models/Workout.js';

// Get active workout for user
export const getActiveWorkout = async (req, res) => {
  try {
    const workout = await Workout.findOne({
      userId: req.user.id,
      status: 'in-progress'
    })
      .populate('exercises.exerciseId')
      .populate('supersetGroups.exerciseIds')
      .sort({ createdAt: -1 });

    if (!workout) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: workout
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching workout',
      error: error.message
    });
  }
};

// Create or update active workout
export const saveWorkout = async (req, res) => {
  try {
    const { exercises, supersetGroups, duration, startTime } = req.body;

    // Find existing active workout
    let workout = await Workout.findOne({
      userId: req.user.id,
      status: 'in-progress'
    });

    // Prepare exercises with order
    const exercisesData = exercises.map((ex, index) => {
      // Convert exerciseId to ObjectId if it's a string
      const exerciseId = ex._id || ex.exerciseId;
      return {
        exerciseId: mongoose.Types.ObjectId.isValid(exerciseId) 
          ? new mongoose.Types.ObjectId(exerciseId) 
          : exerciseId,
        order: index,
        notes: ex.notes || '',
        sets: ex.sets || []
      };
    });

    // Prepare superset groups
    const supersetGroupsData = (supersetGroups || []).map(group => {
      const ids = Array.isArray(group) ? group : (group.exerciseIds || []);
      return {
        exerciseIds: ids.map(id => 
          mongoose.Types.ObjectId.isValid(id) 
            ? new mongoose.Types.ObjectId(id) 
            : id
        )
      };
    });

    if (workout) {
      // Update existing workout
      workout.exercises = exercisesData;
      workout.supersetGroups = supersetGroupsData;
      if (duration !== undefined) workout.duration = duration;
      if (startTime) workout.startTime = new Date(startTime);
    } else {
      // Create new workout
      workout = new Workout({
        userId: req.user.id,
        exercises: exercisesData,
        supersetGroups: supersetGroupsData,
        duration: duration || 0,
        startTime: startTime ? new Date(startTime) : new Date(),
        status: 'in-progress'
      });
    }

    await workout.save();
    await workout.populate('exercises.exerciseId');
    await workout.populate('supersetGroups.exerciseIds');

    res.json({
      success: true,
      data: workout
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error saving workout',
      error: error.message
    });
  }
};

// Update exercise sets
export const updateExerciseSets = async (req, res) => {
  try {
    const { exerciseId, sets } = req.body;

    const workout = await Workout.findOne({
      userId: req.user.id,
      status: 'in-progress'
    });

    if (!workout) {
      return res.status(404).json({
        success: false,
        message: 'No active workout found'
      });
    }

    const exerciseIndex = workout.exercises.findIndex(
      ex => ex.exerciseId.toString() === exerciseId
    );

    if (exerciseIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found in workout'
      });
    }

    workout.exercises[exerciseIndex].sets = sets;
    await workout.save();
    await workout.populate('exercises.exerciseId');

    res.json({
      success: true,
      data: workout
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating exercise sets',
      error: error.message
    });
  }
};

// Finish workout
export const finishWorkout = async (req, res) => {
  try {
    const workout = await Workout.findOne({
      userId: req.user.id,
      status: 'in-progress'
    });

    if (!workout) {
      return res.status(404).json({
        success: false,
        message: 'No active workout found'
      });
    }

    workout.status = 'completed';
    workout.endTime = new Date();
    await workout.save();

    res.json({
      success: true,
      data: workout
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error finishing workout',
      error: error.message
    });
  }
};

// Discard workout
export const discardWorkout = async (req, res) => {
  try {
    const workout = await Workout.findOne({
      userId: req.user.id,
      status: 'in-progress'
    });

    if (workout) {
      workout.status = 'discarded';
      workout.endTime = new Date();
      await workout.save();
    }

    res.json({
      success: true,
      message: 'Workout discarded'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error discarding workout',
      error: error.message
    });
  }
};

// Update completed workout details (name, description, visibility)
export const updateWorkoutDetails = async (req, res) => {
  try {
    const { workoutId, name, description, visibility } = req.body;

    if (!workoutId) {
      return res.status(400).json({
        success: false,
        message: 'Workout ID is required'
      });
    }

    const workout = await Workout.findOne({
      _id: workoutId,
      userId: req.user.id,
      status: 'completed'
    });

    if (!workout) {
      return res.status(404).json({
        success: false,
        message: 'Completed workout not found'
      });
    }

    if (name !== undefined) workout.name = name;
    if (description !== undefined) workout.description = description;
    if (visibility !== undefined) workout.visibility = visibility;

    await workout.save();
    await workout.populate('exercises.exerciseId');
    await workout.populate('supersetGroups.exerciseIds');

    res.json({
      success: true,
      data: workout
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating workout details',
      error: error.message
    });
  }
};

// Get workout history
export const getWorkoutHistory = async (req, res) => {
  try {
    const workouts = await Workout.find({
      userId: req.user.id,
      status: 'completed'
    })
      .populate('exercises.exerciseId')
      .populate('supersetGroups.exerciseIds')
      .sort({ endTime: -1 })
      .limit(50);

    res.json({
      success: true,
      data: workouts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching workout history',
      error: error.message
    });
  }
};

