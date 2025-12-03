// controllers/exerciseController.js
import Exercise from '../models/Exercise.js';

// --- helpers -------------------------------------------------

const EQUIPMENT_MAP = {
  barbell: 'barbell',
  Barbell: 'barbell',

  dumbbell: 'dumbbell',
  Dumbbell: 'dumbbell',
  Dumbell: 'dumbbell', // typo-safe

  machine: 'machine',
  Machine: 'machine',

  plate: 'plate',
  Plate: 'plate',

  rband: 'rband',
  'Resistance Band': 'rband',

  sband: 'sband',
  'Suspension Band': 'sband',

  kettlebell: 'kettlebell',
  Kettlebell: 'kettlebell',

  other: 'other',
  Other: 'other'
};

const MUSCLE_MAP = {
  chest: 'chest',
  Chest: 'chest',

  back: 'back',
  Back: 'back',

  shoulders: 'shoulders',
  Shoulders: 'shoulders',

  arms: 'arms',
  Arms: 'arms',

  legs: 'legs',
  Legs: 'legs',

  core: 'core',
  Core: 'core',

  cardio: 'cardio',
  Cardio: 'cardio'
};

function normalizeEquipment(value) {
  if (!value) return undefined;
  return EQUIPMENT_MAP[value] || value; // fallback: let Mongoose validate
}

function normalizeMuscle(value) {
  if (!value) return undefined;
  return MUSCLE_MAP[value] || value;
}

// ------------------------------------------------------------------
// Get all exercises with optional filtering
// ------------------------------------------------------------------
export const getExercises = async (req, res) => {
  try {
    const {
      search,
      muscle,        // preferred by frontend
      muscleGroup,   // backward compat
      equipment,     // single or comma-separated
      limit = 50,
      page = 1,
      sortBy = 'name',
      sortDir = 'asc',
      isCustom       // optional filter from frontend
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // optional filter: custom / non-custom
    if (typeof isCustom !== 'undefined') {
      // accept "true"/"false" or boolean
      const flag = String(isCustom).toLowerCase() === 'true';
      query.isCustom = flag;
    }

    // SEARCH
    if (search && String(search).trim().length > 0) {
      const q = String(search).trim();
      if (q.length > 2) {
        query.$text = { $search: q };
      } else {
        query.$or = [
          { name: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ];
      }
    }

    // MUSCLE
    const finalMuscle = (muscle || muscleGroup);
    if (finalMuscle && String(finalMuscle).trim().length > 0 && finalMuscle !== 'all') {
      const muscles = String(finalMuscle)
        .split(',')
        .map(m => normalizeMuscle(m.trim()))
        .filter(Boolean);

      if (muscles.length === 1) {
        query.muscleGroups = muscles[0];
      } else if (muscles.length > 1) {
        query.muscleGroups = { $in: muscles };
      }
    }

    // EQUIPMENT
    if (equipment && String(equipment).trim().length > 0 && equipment !== 'all') {
      const equips = String(equipment)
        .split(',')
        .map(e => normalizeEquipment(e.trim()))
        .filter(Boolean);

      if (equips.length === 1) {
        query.equipment = equips[0];
      } else if (equips.length > 1) {
        query.equipment = { $in: equips };
      }
    }

    // safe sort
    const sortOrder = sortDir === 'desc' ? -1 : 1;
    const allowedSortFields = ['name', 'createdAt', 'difficulty'];
    const sortObj = {};
    sortObj[allowedSortFields.includes(sortBy) ? sortBy : 'name'] = sortOrder;

    const [total, exercises] = await Promise.all([
      Exercise.countDocuments(query),
      Exercise.find(query).sort(sortObj).skip(skip).limit(limitNum).lean()
    ]);

    res.json({
      success: true,
      data: exercises,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.max(1, Math.ceil(total / limitNum))
      }
    });
  } catch (error) {
    console.error('getExercises error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching exercises',
      error: error.message
    });
  }
};

// ------------------------------------------------------------------
// Get only custom exercises for the logged-in user
// ------------------------------------------------------------------
export const getCustomExercises = async (req, res) => {
  try {
    const userId = req.user?.id;

    const query = { isCustom: true };
    if (userId) {
      query.createdBy = userId;
    }

    const exercises = await Exercise.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: exercises
    });
  } catch (error) {
    console.error('getCustomExercises error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching custom exercises',
      error: error.message
    });
  }
};

// ------------------------------------------------------------------
// Get single exercise by ID
// ------------------------------------------------------------------
export const getExerciseById = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    res.json({
      success: true,
      data: exercise
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching exercise',
      error: error.message
    });
  }
};

// ------------------------------------------------------------------
// Create new exercise (for custom exercises)
// ------------------------------------------------------------------
export const createExercise = async (req, res) => {
  try {
    const {
      name,
      description,
      primaryMuscle,
      otherMuscles,   // array or comma-separated string
      equipment,
      videoUrl,
      gifUrl,
      thumbnailUrl,
      instructions,
      difficulty
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Exercise name is required'
      });
    }

    // normalise equipment
    const normalizedEquipment = normalizeEquipment(equipment);

    // build muscleGroups from primary + others
    const muscleGroupsSet = new Set();

    if (primaryMuscle) {
      const m = normalizeMuscle(primaryMuscle);
      if (m) muscleGroupsSet.add(m);
    }

    if (otherMuscles) {
      const arr = Array.isArray(otherMuscles)
        ? otherMuscles
        : String(otherMuscles).split(',');
      arr
        .map(m => normalizeMuscle(String(m).trim()))
        .filter(Boolean)
        .forEach(m => muscleGroupsSet.add(m));
    }

    const muscleGroups = Array.from(muscleGroupsSet);

    const exercise = new Exercise({
      name: name.trim(),
      description: description || '',
      muscleGroups,                         // drives your filters
      equipment: normalizedEquipment || 'other',
      videoUrl: videoUrl || '',
      gifUrl: gifUrl || '',
      thumbnailUrl: thumbnailUrl || '',
      instructions: Array.isArray(instructions) ? instructions : [],
      difficulty: difficulty || 'beginner',
      isCustom: true,
      createdBy: req.user?.id || null
    });

    await exercise.save();

    res.status(201).json({
      success: true,
      data: exercise
    });
  } catch (error) {
    console.error('createExercise error:', error);
    res.status(400).json({
      success: false,
      message: 'Error creating exercise',
      error: error.message
    });
  }
};

// ------------------------------------------------------------------
// Update exercise
// ------------------------------------------------------------------
export const updateExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    res.json({
      success: true,
      data: exercise
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating exercise',
      error: error.message
    });
  }
};

// ------------------------------------------------------------------
// Delete exercise (only custom exercises)
// ------------------------------------------------------------------
export const deleteExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    // Only allow deletion of custom exercises
    if (!exercise.isCustom) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete default exercises'
      });
    }

    await Exercise.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Exercise deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting exercise',
      error: error.message
    });
  }
};
