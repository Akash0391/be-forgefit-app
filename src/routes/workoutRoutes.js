import express from 'express';
import {
  getActiveWorkout,
  saveWorkout,
  updateExerciseSets,
  finishWorkout,
  discardWorkout,
  updateWorkoutDetails,
  getWorkoutHistory,
  deleteWorkout
} from '../controllers/workoutController.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

router.get('/active', getActiveWorkout);
router.post('/save', saveWorkout);
router.put('/sets', updateExerciseSets);
router.post('/finish', finishWorkout);
router.post('/discard', discardWorkout);
router.put('/details', updateWorkoutDetails);
router.get('/history', getWorkoutHistory);
router.delete('/:workoutId', deleteWorkout);

export default router;

