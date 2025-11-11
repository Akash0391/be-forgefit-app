import express from 'express';
import {
  getExercises,
  getExerciseById,
  createExercise,
  updateExercise,
  deleteExercise
} from '../controllers/exerciseController.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getExercises);
router.get('/:id', getExerciseById);

// Protected routes (for custom exercises)
router.post('/', isAuthenticated, createExercise);
router.put('/:id', isAuthenticated, updateExercise);
router.delete('/:id', isAuthenticated, deleteExercise);

export default router;

