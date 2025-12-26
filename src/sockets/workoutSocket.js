import { io } from "../server.js";
import Workout from "../models/Workout.js";

const activeUserWorkout = new Map(); // userId → workoutId

export const workoutSocket = () => {
  io.on("connection", (socket) => {
    console.log("🔥 User Connected:", socket.id);

    // JOIN WORKOUT ROOM
    socket.on("joinWorkout", ({ userId, draftWorkoutId }) => {
      console.log("joinWorkout", userId, draftWorkoutId);

      const existing = activeUserWorkout.get(userId);

      if (existing && existing !== draftWorkoutId) {
        socket.join(existing);
        return;
      }

      socket.join(draftWorkoutId);
      socket.data.userId = userId;
      socket.data.workoutId = draftWorkoutId;

      activeUserWorkout.set(userId, draftWorkoutId);
    });

    // WORKOUT UPDATE — Save to DB + Broadcast
    socket.on("workout:update", async (data) => {
      const { draftWorkoutId, exercises, supersetGroups } = data;

      await Workout.findByIdAndUpdate(draftWorkoutId, {
        exercises,
        supersetGroups,
        updatedAt: new Date()
      });

      io.to(draftWorkoutId).emit("workout:update", data);
    });

    // COMPLETE WORKOUT
    socket.on("workout:complete", async ({ draftWorkoutId, userId }) => {
      await Workout.findByIdAndUpdate(draftWorkoutId, {
        status: "completed",
        completedAt: new Date()
      });

      activeUserWorkout.delete(userId);

      io.to(draftWorkoutId).emit("workout:complete");
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      console.log("❌ Socket Disconnected:", socket.id);
      // Do NOT delete workout
    });
  });
};
