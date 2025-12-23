import passport from "passport";
import User from "../models/User.js";
import bcrypt from "bcrypt";


// Initiate Google OAuth
export const initiateGoogleAuth = (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file",
    });
  }
  
  // Store redirect destination in session (default to /workout)
  const redirectTo = req.query.redirect || "/workout";
  req.session.oauthRedirect = redirectTo;
  
  // Check if this is a signup flow (to force account selection)
  const isSignup = req.query.signup === "true";
  
  const callbackURL = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/google/callback`;
  console.log("🔐 Initiating Google OAuth...");
  console.log("   Callback URL:", callbackURL);
  console.log("   Redirect to:", redirectTo);
  console.log("   Is Signup:", isSignup);
  console.log("   Client ID:", process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + "...");
  
  // Build authentication options
  const authOptions = {
    scope: ["profile", "email"],
  };
  
  // For signup, force account selection screen to always show
  if (isSignup) {
    authOptions.prompt = "select_account";
  }
  
  passport.authenticate("google", authOptions)(req, res, next);
};

// Handle Google OAuth callback
export const handleGoogleCallback = (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=not_configured`);
  }
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=auth_failed`,
  })(req, res, (err) => {
    if (err) {
      return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=auth_failed`);
    }
    // Successful authentication - req.user is set by passport
    // Get redirect destination from session (default to /workout)
    const redirectTo = req.session.oauthRedirect || "/workout";
    delete req.session.oauthRedirect; // Clean up session
    const frontendURL = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendURL}${redirectTo}`);
  });
};

// Get current user
export const getCurrentUser = (req, res) => {
  if (req.user) {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        avatar: req.user.avatar,
        sex: req.user.sex || null,
        birthday: req.user.birthday || null,
        bio: req.user.bio || "",
        link: req.user.link || "",
      },
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { name, bio, link, sex, birthday } = req.body;

    const update = {};

    if (typeof name === "string") update.name = name;
    if (typeof bio === "string") update.bio = bio;
    if (typeof link === "string") update.link = link;

    // sex: allow null, but enforce enum
    if (sex === null || sex === "" || sex === undefined) {
      update.sex = null;
    } else if (["male", "female", "other"].includes(sex)) {
      update.sex = sex;
    }

    // birthday: expect ISO string from frontend
    if (birthday === null) {
      update.birthday = null;
    } else if (typeof birthday === "string") {
      const d = new Date(birthday);
      if (!Number.isNaN(d.getTime())) {
        update.birthday = d;
      }
    }

    if (Object.keys(update).length === 0) {
      return res.json({
        success: true,
        data: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          avatar: req.user.avatar,             // kept from Google
          sex: req.user.sex ?? null,
          birthday: req.user.birthday ?? null,
          bio: req.user.bio ?? "",
          link: req.user.link ?? "",
        },
      });
    }

    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // shape the response similar to /me, but under `data` (what authApi expects)
    res.json({
      success: true,
      data: {
        id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatar: updatedUser.avatar,
        sex: updatedUser.sex || null,
        birthday: updatedUser.birthday || null,
        bio: updatedUser.bio || "",
        link: updatedUser.link || "",
      },
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};


export const updatePassword = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.findByIdAndUpdate(req.user.id, {
      password: hashedPassword,
    });

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    console.error("Update password error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update password",
    });
  }
};

// Logout user
export const logout = (req, res) => {
  console.log("Logout endpoint called");
  
  // Check if user is logged in
  if (!req.user) {
    console.log("No user session found, but proceeding with logout");
  }
  
  req.logout((err) => {
    if (err) {
      console.error("Error in req.logout:", err);
      return res.status(500).json({
        success: false,
        message: "Error logging out",
      });
    }
    console.log("req.logout successful, destroying session");
    
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({
          success: false,
          message: "Error destroying session",
        });
      }
      console.log("Session destroyed, clearing cookie");
      res.clearCookie("connect.sid");
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    });
  });
};

