import express from "express";
import {
  initiateGoogleAuth,
  handleGoogleCallback,
  getCurrentUser,
  logout,
  updateProfile
} from "../controllers/authController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

// Initiate Google OAuth
router.get("/google", initiateGoogleAuth);

// Google OAuth callback
router.get("/google/callback", handleGoogleCallback);

// Get current authenticated user
router.get("/me", isAuthenticated, getCurrentUser);

// Logout
router.post("/logout", logout);

// Update user profile
router.put("/profile", isAuthenticated, updateProfile);

export default router;

