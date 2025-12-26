import { io } from "../server.js";
import Workout from "../models/Workout.js";

const activeUserWorkout = new Map(); // userId → workoutId

export const workoutSocket = () => {
    io.on("connection", (socket) => {
        console.log("🔥 User Connected:", socket.id);

        /**
         * JOIN WORKOUT ROOM
         */
        socket.on("joinWorkout", async ({ userId, draftWorkoutId }) => {
            try {
                console.log("joinWorkout", userId, draftWorkoutId);

                // 🔒 Validate workout really exists + belongs to user
                const workout = await Workout.findOne({
                    _id: draftWorkoutId,
                    userId,
                    status: "in-progress"
                });

                if (!workout) {
                    console.log("❌ Invalid or finished workout, blocking join");
                    socket.emit("workout:error", {
                        message: "Workout session is no longer active."
                    });
                    return;
                }

                /**
                 * If this user already has an active workout in memory
                 * keep them in SAME workout room (prevents duplicate sessions)
                 */
                const existing = activeUserWorkout.get(userId);

                if (existing && existing !== draftWorkoutId) {
                    console.log("⚠️ User already has another active workout, forcing them into existing room");
                    socket.join(existing);
                    return;
                }

                socket.join(draftWorkoutId);

                socket.data.userId = userId;
                socket.data.workoutId = draftWorkoutId;

                activeUserWorkout.set(userId, draftWorkoutId);

                console.log("✅ Joined workout room", draftWorkoutId);
            } catch (err) {
                console.error("joinWorkout error:", err);
                socket.emit("workout:error", {
                    message: "Unable to join workout session."
                });
            }
        });

        /**
         * WORKOUT LIVE UPDATE
         */
        socket.on("workout:update", async (data) => {
            try {
                const { draftWorkoutId, exercises, supersetGroups } = data;

                await Workout.findByIdAndUpdate(draftWorkoutId, {
                    exercises,
                    supersetGroups,
                    updatedAt: new Date()
                });

                io.to(draftWorkoutId).emit("workout:update", data);
            } catch (err) {
                console.error("workout:update error:", err);
            }
        });

        /**
         * COMPLETE WORKOUT
         */
        socket.on("workout:complete", async ({ draftWorkoutId, userId }) => {
            try {
                const workout = await Workout.findOne({
                    _id: draftWorkoutId,
                    userId,
                    status: "in-progress"
                });

                if (!workout) return;

                workout.status = "completed";
                workout.endTime = new Date();
                await workout.save();

                activeUserWorkout.delete(userId);

                io.to(draftWorkoutId).emit("workout:complete", {
                    workoutId: draftWorkoutId
                });

                console.log("🏁 Workout Completed:", draftWorkoutId);
            } catch (err) {
                console.error("workout:complete error:", err);
            }
        });

        /**
         * DISCONNECT — DO NOTHING
         * (resume should still work)
         */
        socket.on("disconnect", () => {
            console.log("❌ Socket Disconnected:", socket.id);
        });
    });
};
