import mongoose from 'mongoose';

const routineFolderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      default: 0, // for future sorting
    },
  },
  {
    timestamps: true,
  }
);

routineFolderSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('RoutineFolder', routineFolderSchema);
