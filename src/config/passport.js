import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

// Configure Google OAuth Strategy (only if credentials are provided)
export function configurePassport() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const callbackURL = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/google/callback`;
    
    console.log("🔧 Configuring Google OAuth Strategy...");
    console.log("   Callback URL:", callbackURL);
    console.log("   ⚠️  IMPORTANT: Make sure this exact URL is added in Google Cloud Console!");
    
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: callbackURL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Extract user information from Google profile
            const user = {
              id: profile.id,
              email: profile.emails?.[0]?.value,
              name: profile.displayName,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              avatar: profile.photos?.[0]?.value,
              provider: "google",
            };

            // In a real app, you would save/update user in database here
            // For now, we'll just return the user object
            return done(null, user);
          } catch (error) {
            return done(error, null);
          }
        }
      )
    );
    console.log("✅ Google OAuth strategy configured");
  } else {
    console.warn("⚠️  Google OAuth credentials not configured. Google authentication will not work.");
    console.warn("   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file");
  }

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Deserialize user from session
  passport.deserializeUser((user, done) => {
    done(null, user);
  });
}

