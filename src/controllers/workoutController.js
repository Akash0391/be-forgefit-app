import mongoose from 'mongoose';
import Workout from '../models/Workout.js';


// helper: normalizeSets - respects absence of min/max and doesn't overwrite unintentionally
const normalizeSets = (sets = []) => {
  return (sets || []).map((s) => {
    // make a shallow copy
    const set = { ...s };

    // If reps is a string with '-' (like "8-12") parse it into minReps/maxReps
    if (typeof set.reps === 'string' && set.reps.includes('-')) {
      const parts = set.reps.split('-').map(v => parseInt(v.trim(), 10));
      const min = Number.isFinite(parts[0]) ? parts[0] : null;
      const max = Number.isFinite(parts[1]) ? parts[1] : null;
      if (min !== null) set.minReps = min;
      if (max !== null) set.maxReps = max;
      // Optionally keep or remove set.reps string; we'll keep it for backward compatibility
    }

    // If client explicitly provided minReps or maxReps (numbers), keep them
    // (This includes the case where client sends only min or only max)
    if (set.minReps != null) set.minReps = Number(set.minReps);
    if (set.maxReps != null) set.maxReps = Number(set.maxReps);

    // If neither minReps nor maxReps provided, do NOTHING to minReps/maxReps.
    // This preserves existing DB values during updates if you assign only changed fields.
    // If you're replacing the whole sets array (create/save), then minReps/maxReps will remain null.

    return set;
  });
};

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
        sets: normalizeSets(ex.sets || [])
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

    const incomingSets = normalizeSets(sets);
    workout.exercises[exerciseIndex].sets = incomingSets;

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
      status: 'completed',
      $or: [
        { isRoutine: { $exists: false } },
        { isRoutine: false }
      ]
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

// Delete workout
export const deleteWorkout = async (req, res) => {
  try {
    const { workoutId } = req.params;

    if (!workoutId) {
      return res.status(400).json({
        success: false,
        message: 'Workout ID is required'
      });
    }

    const workout = await Workout.findOne({
      _id: workoutId,
      userId: req.user.id
    });

    if (!workout) {
      return res.status(404).json({
        success: false,
        message: 'Workout not found'
      });
    }

    await Workout.findByIdAndDelete(workoutId);

    res.json({
      success: true,
      message: 'Workout deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting workout',
      error: error.message
    });
  }
};

// Save routine
export const saveRoutine = async (req, res) => {
  try {
    const { name, exercises, supersetGroups } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Routine name is required'
      });
    }

    if (!exercises || exercises.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one exercise is required'
      });
    }

    // Prepare exercises with order
    const exercisesData = exercises.map((ex, index) => {
      // Convert exerciseId to ObjectId if it's a string
      const exerciseId = ex.exercise?._id || ex.exerciseId || ex._id;
      return {
        exerciseId: mongoose.Types.ObjectId.isValid(exerciseId)
          ? new mongoose.Types.ObjectId(exerciseId)
          : exerciseId,
        order: index,
        notes: ex.notes || '',
        sets: normalizeSets(ex.sets || [])
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

    // Create new routine
    const routine = new Workout({
      userId: req.user.id,
      name: name.trim(),
      exercises: exercisesData,
      supersetGroups: supersetGroupsData,
      duration: 0,
      status: 'completed', // Routines are saved as completed workouts
      isRoutine: true
    });

    await routine.save();
    await routine.populate('exercises.exerciseId');
    await routine.populate('supersetGroups.exerciseIds');

    res.json({
      success: true,
      data: routine
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error saving routine',
      error: error.message
    });
  }
};

// Get all routines for user
export const getRoutines = async (req, res) => {
  try {
    const routines = await Workout.find({
      userId: req.user.id,
      isRoutine: true
    })
      .populate('exercises.exerciseId')
      .populate('supersetGroups.exerciseIds')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: routines
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching routines',
      error: error.message
    });
  }
};

// Update routine
export const updateRoutine = async (req, res) => {
  try {
    const { routineId, name, exercises, supersetGroups } = req.body;

    if (!routineId) {
      return res.status(400).json({
        success: false,
        message: 'Routine ID is required'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Routine name is required'
      });
    }

    if (!exercises || exercises.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one exercise is required'
      });
    }

    // Find the routine
    const routine = await Workout.findOne({
      _id: routineId,
      userId: req.user.id,
      isRoutine: true
    });

    if (!routine) {
      return res.status(404).json({
        success: false,
        message: 'Routine not found'
      });
    }

    // Prepare exercises with order
    const exercisesData = exercises.map((ex, index) => {
      // Convert exerciseId to ObjectId if it's a string
      const exerciseId = ex.exercise?._id || ex.exerciseId || ex._id;
      return {
        exerciseId: mongoose.Types.ObjectId.isValid(exerciseId)
          ? new mongoose.Types.ObjectId(exerciseId)
          : exerciseId,
        order: index,
        notes: ex.notes || '',
        sets: normalizeSets(ex.sets || [])
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

    // Update routine
    routine.name = name.trim();
    routine.exercises = exercisesData;
    routine.supersetGroups = supersetGroupsData;

    await routine.save();
    await routine.populate('exercises.exerciseId');
    await routine.populate('supersetGroups.exerciseIds');

    res.json({
      success: true,
      data: routine
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating routine',
      error: error.message
    });
  }
};

