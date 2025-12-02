// controllers/exerciseController.js
import Exercise from '../models/Exercise.js';

// Get all exercises with optional filtering
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
      sortDir = 'asc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // SEARCH: prefer text for longer queries, fallback to regex for short ones
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

    // MUSCLE: support `muscle` or `muscleGroup`, single or comma-separated values
    const finalMuscle = (muscle || muscleGroup);
    if (finalMuscle && String(finalMuscle).trim().length > 0 && finalMuscle !== 'all') {
      const muscles = String(finalMuscle).split(',').map(m => m.trim()).filter(Boolean);
      if (muscles.length === 1) {
        // muscleGroups is an array in schema — this matches any doc that contains the value
        query.muscleGroups = muscles[0];
      } else if (muscles.length > 1) {
        query.muscleGroups = { $in: muscles };
      }
    }

    // EQUIPMENT: support single or comma-separated equipment values
    if (equipment && String(equipment).trim().length > 0 && equipment !== 'all') {
      const equips = String(equipment).split(',').map(e => e.trim()).filter(Boolean);
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


// Get single exercise by ID
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

// Create new exercise (for custom exercises)
export const createExercise = async (req, res) => {
  try {
    const exercise = new Exercise({
      ...req.body,
      isCustom: true,
      createdBy: req.user?.id || null
    });

    await exercise.save();

    res.status(201).json({
      success: true,
      data: exercise
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating exercise',
      error: error.message
    });
  }
};

// Update exercise
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

// Delete exercise (only custom exercises)
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

