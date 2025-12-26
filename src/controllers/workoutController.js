import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import RoutineFolder from '../models/RoutineFolder.js';
import cloudinary from "../config/cloudinary.js";



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

// helper: recompute duration, totalVolumeKg, totalReps
const recalculateWorkoutStats = (workout) => {
  // duration
  if (workout.startTime && workout.endTime) {
    const diffMs = workout.endTime.getTime() - workout.startTime.getTime();
    workout.duration = Math.max(0, Math.floor(diffMs / 1000)); // seconds
  }

  let totalVolumeKg = 0;
  let totalReps = 0;

  for (const ex of workout.exercises || []) {
    for (const set of ex.sets || []) {
      const kg = Number(set.kg) || 0;
      const reps = Number(set.reps) || 0;
      if (kg > 0 && reps > 0) {
        totalVolumeKg += kg * reps;
        totalReps += reps;
      }
    }
  }

  workout.totalVolumeKg = totalVolumeKg;
  workout.totalReps = totalReps;
};

export const startWorkout = async (req, res) => {
  try {
    const { routineId, exercises, supersetGroups = [] } = req.body;

    const workout = await Workout.create({
      userId: req.user._id,
      name: "Workout",
      exercises,
      supersetGroups,
      duration: 0,
      status: "in-progress",
      isRoutine: true,
      routineId,
      startTime: Date.now(),
    });

    return res.json({
      success: true,
      data: workout,
    });
  } catch (err) {
    console.error("Start workout error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to start workout",
    });
  }
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
    const exercisesData = (exercises || []).map((ex, index) => {
      // Convert exerciseId to ObjectId if it's a string
      const exerciseId = ex._id || ex.exerciseId;

      return {
        exerciseId: mongoose.Types.ObjectId.isValid(exerciseId)
          ? new mongoose.Types.ObjectId(exerciseId)
          : exerciseId,
        order: index,
        notes: ex.notes || '',
        sets: normalizeSets(ex.sets || []),

        // ✅ IMPORTANT: keep per-exercise rest timer
        restTimerSeconds: ex.restTimerSeconds ?? 0,
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

    // ✅ compute duration + totalVolumeKg + totalReps
    recalculateWorkoutStats(workout);

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
    const { workoutId, name, description, visibility, exercises,
      supersetGroups, media, } = req.body;

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

    // ✅ OPTIONAL MEDIA
    if (Array.isArray(media)) {
      workout.media = media;
    }

    // ---- exercises (sets, notes, restTimerSeconds, order) ----
    if (Array.isArray(exercises)) {
      workout.exercises = exercises.map((ex, index) => {
        // exerciseId can be object, string, or nested under exercise
        const rawId =
          (ex.exerciseId && typeof ex.exerciseId === "object"
            ? ex.exerciseId._id
            : ex.exerciseId) ||
          (ex.exercise && ex.exercise._id) ||
          ex._id;

        const exerciseId = mongoose.Types.ObjectId.isValid(rawId)
          ? new mongoose.Types.ObjectId(rawId)
          : rawId;

        return {
          exerciseId,
          order: ex.order ?? index,
          notes: ex.notes || "",
          sets: normalizeSets(ex.sets || []),
          restTimerSeconds: ex.restTimerSeconds ?? 0,
        };
      });
    }

    // ---- superset groups ----
    if (Array.isArray(supersetGroups)) {
      // frontend sends string[][], but also support [{ exerciseIds: [...] }]
      workout.supersetGroups = supersetGroups.map((group) => {
        const ids = Array.isArray(group)
          ? group
          : group.exerciseIds || [];

        return {
          exerciseIds: ids.map((id) =>
            mongoose.Types.ObjectId.isValid(id)
              ? new mongoose.Types.ObjectId(id)
              : id
          ),
        };
      });
    }

    // ✅ after changing exercises/sets, recompute stats
    recalculateWorkoutStats(workout);

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
    const { name, exercises, supersetGroups, routineFolderId } = req.body;

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
        sets: normalizeSets(ex.sets || []),
        restTimerSeconds: ex.restTimerSeconds ?? 0,
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
      isRoutine: true,
      routineFolderId: routineFolderId || null,
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
    const { routineId, name, exercises, supersetGroups, routineFolderId } = req.body;

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

    if (routineFolderId !== undefined) {
  routine.routineFolderId = routineFolderId || null;
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
        sets: normalizeSets(ex.sets || []),
        restTimerSeconds: ex.restTimerSeconds ?? 0,
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

// Get all routine folders for user
export const getRoutineFolders = async (req, res) => {
  try {
    const folders = await RoutineFolder.find({ userId: req.user.id })
      .sort({ order: 1, createdAt: 1 });
    res.json({
      success: true,
      data: folders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching routine folders',
      error: error.message,
    });
  }
};

// Create new routine folder
export const createRoutineFolder = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required',
      });
    }

    const folder = new RoutineFolder({
      userId: req.user.id,
      name: name.trim(),
    });

    await folder.save();

    res.json({
      success: true,
      data: folder,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating folder',
      error: error.message,
    });
  }
};

// Reorder routine folders
export const reorderRoutineFolders = async (req, res) => {
  try {
    const { folders } = req.body; // ✅ plain JS, no "as { ... }"

    if (!Array.isArray(folders)) {
      return res.status(400).json({
        success: false,
        message: 'folders must be an array',
      });
    }

    // bulk update all folder orders
    const bulkOps = folders.map((f) => ({
      updateOne: {
        filter: { _id: f.folderId, userId: req.user.id }, // ensure user-specific
        update: { $set: { order: f.order } },
      },
    }));

    if (bulkOps.length > 0) {
      await RoutineFolder.bulkWrite(bulkOps);
    }

    // return updated list sorted by order
    const updatedFolders = await RoutineFolder.find({
      userId: req.user.id,
    }).sort({ order: 1, createdAt: 1 });

    return res.json({
      success: true,
      data: updatedFolders,
    });
  } catch (error) {
    console.error('Error reordering folders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reorder folders',
      error: error.message,
    });
  }
};

// DELETE /api/workout/routine-folders/:id
// DELETE /api/workouts/folders/:id
export const deleteRoutineFolder = async (req, res) => {
  try {
    const { id } = req.params;

    // Optional: validate ObjectId early
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid folder id',
      });
    }

    // 🔴 IMPORTANT: match getRoutineFolders filter (userId + _id)
    const folder = await RoutineFolder.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Folder deleted successfully',
      data: folder,
    });
  } catch (error) {
    console.error('Error deleting routine folder:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete folder',
      error: error.message,
    });
  }
};

// Rename routine folder
export const renameRoutineFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required',
      });
    }

    const trimmed = name.trim();

    const folder = await RoutineFolder.findOneAndUpdate(
      { _id: id, userId: req.user.id }, // same filter style as getRoutineFolders
      { $set: { name: trimmed } },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found',
      });
    }

    return res.json({
      success: true,
      data: folder,
    });
  } catch (error) {
    console.error('Error renaming folder:', error);
    return res.status(500).json({
      success: false,
      message: 'Error renaming folder',
      error: error.message,
    });
  }
};

// GET /api/workouts/summary?range=3m
export const getWorkoutSummary = async (req, res) => {
  try {
    const { range = '3m' } = req.query;

    // simple range handling: 1w / 1m / 3m / 1y
    const now = new Date();
    const start = new Date(now);

    if (range === '1w') start.setDate(start.getDate() - 7);
    else if (range === '1m') start.setMonth(start.getMonth() - 1);
    else if (range === '3m') start.setMonth(start.getMonth() - 3);
    else if (range === '1y') start.setFullYear(start.getFullYear() - 1);
    else start.setMonth(start.getMonth() - 3); // default 3m

    const rows = await Workout.aggregate([
      {
        $match: {
          userId: req.user.id,
          status: 'completed',
          endTime: { $gte: start }
        }
      },
      {
        $project: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$endTime'
            }
          },
          duration: 1,
          totalVolumeKg: 1,
          totalReps: 1
        }
      },
      {
        $group: {
          _id: '$day',
          durationSeconds: { $sum: '$duration' },
          totalVolumeKg: { $sum: '$totalVolumeKg' },
          totalReps: { $sum: '$totalReps' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const data = rows.map(r => ({
      date: r._id,                  // "2025-11-16"
      durationSeconds: r.durationSeconds,
      durationMinutes: Math.round(r.durationSeconds / 60),
      totalVolumeKg: r.totalVolumeKg,
      totalReps: r.totalReps
    }));

    // also return current-week total hours for "0 hours this week"
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);

    const weekAgg = await Workout.aggregate([
      {
        $match: {
          userId: req.user.id,
          status: 'completed',
          endTime: { $gte: weekStart }
        }
      },
      {
        $group: {
          _id: null,
          durationSeconds: { $sum: '$duration' }
        }
      }
    ]);

    const weekSeconds = weekAgg[0]?.durationSeconds || 0;
    const weekHours = Math.round(weekSeconds / 3600);

    res.json({
      success: true,
      data,
      thisWeekHours: weekHours
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching workout summary',
      error: error.message
    });
  }
};

// GET /api/workouts/last-sets/:exerciseId
export const getLastExerciseSets = async (req, res) => {
  try {
    const { exerciseId } = req.params;

    if (!exerciseId) {
      return res.status(400).json({
        success: false,
        message: "exerciseId is required",
      });
    }

    // Cast once to ObjectId (safer than string match)
    const exObjectId = new mongoose.Types.ObjectId(exerciseId);

    // 🔹 Find most recent *real* completed workout (not routine) that used this exercise
    const lastWorkout = await Workout.findOne({
      userId: req.user.id,
      status: "completed",
      isRoutine: { $ne: true },            // exclude routines
      "exercises.exerciseId": exObjectId,
    })
      .sort({ endTime: -1 })               // newest first
      .lean();

    if (!lastWorkout) {
      return res.json({ success: true, data: [] });
    }

    const ex = lastWorkout.exercises.find((e) =>
      exObjectId.equals(e.exerciseId)
    );

    if (!ex) {
      return res.json({ success: true, data: [] });
    }

    const previousSets = (ex.sets || [])
      .filter((s) => (s.kg || 0) > 0 && (s.reps || 0) > 0)
      .map((s, idx) => ({
        setNumber: s.setNumber ?? idx + 1,
        kg: s.kg,
        reps: s.reps,
        // what will appear in PREVIOUS column
        previous: `${s.kg}x${s.reps}`,
      }));

    return res.json({
      success: true,
      data: previousSets,
    });
  } catch (error) {
    console.error("getLastExerciseSets error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching last sets",
      error: error.message,
    });
  }
};

