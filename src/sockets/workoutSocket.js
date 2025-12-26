
import Workout from "../models/Workout.js";

const activeUserWorkout = new Map(); // userId → workoutId

export const workoutSocket = (io) => {
    io.on("connection", (socket) => {
        console.log("🔥 User Connected:", socket.id);

        /**
         * JOIN WORKOUT ROOM
         */
        socket.on("joinWorkout", async ({ userId, draftWorkoutId }) => {
            try {
                console.log("joinWorkout", userId, draftWorkoutId);

                // 🧲 First: if memory knows user's active workout → force join it
                const existing = activeUserWorkout.get(userId);
                if (existing) {
                    console.log("↩️ User already has active workout, rejoining:", existing);
                    socket.join(existing);
                    socket.data.userId = userId;
                    socket.data.workoutId = existing;

                    socket.emit("workout:joined", { workoutId: existing });
                    return;
                }

                // 🔍 Try to find valid in-progress workout in DB
                let workout = await Workout.findOne({
                    _id: draftWorkoutId,
                    userId,
                    status: "in-progress"
                });

                // 🚀 IF NO IN-PROGRESS WORKOUT → CREATE ONE
                if (!workout) {
                    console.log("🆕 No active workout found → creating new workout");

                    workout = await Workout.create({
                        userId,
                        name: "Workout",
                        exercises: [],
                        supersetGroups: [],
                        status: "in-progress",
                        startTime: new Date(),
                        duration: 0,
                        totalVolumeKg: 0,
                        totalReps: 0,
                    });
                }

                const newWorkoutId = workout._id.toString();

                // Join room
                socket.join(newWorkoutId);
                socket.data.userId = userId;
                socket.data.workoutId = newWorkoutId;

                activeUserWorkout.set(userId, newWorkoutId);

                console.log("✅ Joined workout room", newWorkoutId);

                // 👈 Send ID back to frontend so it can save in sessionStorage
                socket.emit("workout:joined", { workoutId: newWorkoutId });

            } catch (err) {
                console.error("joinWorkout error:", err);
                socket.emit("workout:error", {
                    message: "Unable to join or start workout."
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
