import passport from "passport";

// Initiate Google OAuth
export const initiateGoogleAuth = (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file",
    });
  }
  
  const callbackURL = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/google/callback`;
  console.log("🔐 Initiating Google OAuth...");
  console.log("   Callback URL:", callbackURL);
  console.log("   Client ID:", process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + "...");
  
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })(req, res, next);
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
    // Redirect to frontend workout page
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/workout`);
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
      },
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Not authenticated",
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

