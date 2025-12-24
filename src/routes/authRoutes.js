import express from "express";
import {
  initiateGoogleAuth,
  handleGoogleCallback,
  getCurrentUser,
  logout,
  updateProfile,
  updatePassword
} from "../controllers/authController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";


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
router.put("/profile", isAuthenticated, upload.single("avatar"), updateProfile);

// Update user password
router.put("/password", isAuthenticated, updatePassword);

export default router;

