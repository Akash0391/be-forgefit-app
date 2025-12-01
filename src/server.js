import dotenv from "dotenv";
// Load environment variables first
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import session from "express-session";
import passport from "passport";
import MongoStore from "connect-mongo";
import { configurePassport } from "./config/passport.js";
import connectDB from "./config/db.js";
import routes from "./routes/index.js";
import authRoutes from "./routes/authRoutes.js";
import exerciseRoutes from "./routes/exerciseRoutes.js";
import workoutRoutes from "./routes/workoutRoutes.js";

const app = express();

// Connect to database (non-blocking)
connectDB().catch(err => {
  console.error('Database connection failed, but server will continue');
});

// Configure Passport strategies after env vars are loaded
configurePassport();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));

// Session store backed by MongoDB (use redis if preferred)
app.use(session({
  secret: process.env.SESSION_SECRET || "change_this_in_prod",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI, 
    collectionName: "sessions",
    // optionally add ttl, autoRemove options
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    httpOnly: true,
    // secure: true in production (only over HTTPS)
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Root Route - must be before /api routes
app.get("/", (req, res) => {
  res.send("✅ Node.js Backend is Running!");
});

// Routes
app.use("/api", routes);
app.use("/api/auth", authRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/workouts", workoutRoutes);

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
