import dotenv from "dotenv";
// Load environment variables first
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import session from "express-session";
import passport from "passport";

import { configurePassport } from "./config/passport.js";
import routes from "./routes/index.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();

// Configure Passport strategies after env vars are loaded
configurePassport();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(morgan("dev"));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days - persistent login
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Root Route - must be before /api routes
app.get("/", (req, res) => {
  res.send("✅ Node.js Backend is Running!");
});

// Routes
app.use("/api", routes);
app.use("/api/auth", authRoutes);

// 404 handler - must be after all routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handling middleware - must have 4 parameters
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
