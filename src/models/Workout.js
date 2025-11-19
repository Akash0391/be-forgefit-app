import mongoose from 'mongoose';

const workoutSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    default: 'Quick Start Workout'
  },
  description: {
    type: String,
    default: ''
  },
  visibility: {
    type: String,
    enum: ['Everyone', 'Private'],
    default: 'Everyone'
  },
  exercises: [{
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise',
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    notes: {
      type: String,
      default: ''
    },
    sets: [{
      setNumber: {
        type: Number,
        required: true
      },
      previous: {
        type: String,
        default: '-'
      },
      kg: {
        type: Number,
        default: 0
      },
      reps: {
        type: Number,
        default: 0
      },
      completed: {
        type: Boolean,
        default: false
      }
    }]
  }],
  supersetGroups: [{
    exerciseIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise'
    }]
  }],
  duration: {
    type: Number, // Duration in seconds
    default: 0
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'discarded'],
    default: 'in-progress'
  },
  isRoutine: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
workoutSchema.index({ userId: 1, status: 1 });
workoutSchema.index({ userId: 1, createdAt: -1 });
workoutSchema.index({ userId: 1, isRoutine: 1 });

export default mongoose.model('Workout', workoutSchema);

