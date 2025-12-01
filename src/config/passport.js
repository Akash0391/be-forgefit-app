import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

// Configure Google OAuth Strategy (only if credentials are provided)
export function configurePassport() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const callbackURL = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/google/callback`;
    
    console.log("🔧 Configuring Google OAuth Strategy...");
    console.log("   Callback URL:", callbackURL);
    console.log("   ⚠️  IMPORTANT: Make sure this exact URL is added in Google Cloud Console!");
    
    passport.use(new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL
      },
      // verify callback
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;
          const firstName = profile.name?.givenName;
          const lastName = profile.name?.familyName;
          const avatar = profile.photos?.[0]?.value;

          // 1) Try find by providers.google.id
          let user = await User.findOne({ "providers.google.id": googleId });

          // 2) If not found, try find by email (account merging)
          if (!user && email) {
            user = await User.findOne({ email });
          }

          // 3) If still not found, create new user
          if (!user) {
            user = new User({
              email,
              name,
              firstName,
              lastName,
              avatar,
              providers: {
                google: {
                  id: googleId,
                  accessToken, // OPTIONAL: store if you need to call Google API later
                  refreshToken
                }
              }
            });
            await user.save();
          } else {
            // If found but provider not linked, link it
            user.providers = user.providers || {};
            if (!user.providers.google || user.providers.google.id !== googleId) {
              user.providers.google = {
                id: googleId,
                accessToken,
                refreshToken
              };
            } else {
              // Optionally update tokens
              user.providers.google.accessToken = accessToken || user.providers.google.accessToken;
              user.providers.google.refreshToken = refreshToken || user.providers.google.refreshToken;
            }
            // Update basic profile fields if missing
            user.email = user.email || email;
            user.name = user.name || name;
            user.firstName = user.firstName || firstName;
            user.lastName = user.lastName || lastName;
            user.avatar = user.avatar || avatar;
            await user.save();
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ));
    console.log("✅ Google OAuth strategy configured (DB-backed)");
  } else {
    console.warn("⚠️ Google OAuth credentials not configured. Skipping Google strategy.");
  }

  // Serialize only the user id into the session
  passport.serializeUser((user, done) => {
    // user may be a mongoose doc or plain object
    done(null, user._id ? user._id.toString() : user.id || user);
  });

  // Deserialize: read user from DB and attach to req.user
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).select("-providers.google.accessToken -providers.google.refreshToken");
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });
}