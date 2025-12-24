import express from "express";
import upload from "../middleware/upload.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { uploadWorkoutMedia } from "../controllers/uploadController.js";

const router = express.Router();

router.post(
  "/workout-media",
  isAuthenticated,
  upload.single("file"),
  uploadWorkoutMedia
);

export default router;
