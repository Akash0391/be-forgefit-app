import Exercise from '../models/Exercise.js';

// Get all exercises with optional filtering
export const getExercises = async (req, res) => {
  try {
    const { 
      search, 
      muscleGroup, 
      equipment,
      limit = 50,
      page = 1 
    } = req.query;

    const query = {};

    // Search by name or description
    if (search) {
      query.$text = { $search: search };
    }

    // Filter by muscle group
    if (muscleGroup) {
      query.muscleGroups = muscleGroup;
    }

    // Filter by equipment
    if (equipment) {
      query.equipment = equipment;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const exercises = await Exercise.find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ name: 1 });

    const total = await Exercise.countDocuments(query);

    res.json({
      success: true,
      data: exercises,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
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

