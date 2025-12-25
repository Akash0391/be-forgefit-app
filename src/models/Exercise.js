import mongoose from 'mongoose';

const exerciseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    default: ''
  },
  primaryMuscle: {
    type: String,
    enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio'],
    required: true
  },

  secondaryMuscles: [{
    type: String,
    enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio']
  }],

  equipment: {
  type: String,
  enum: ['barbell', 'dumbbell', 'machine', 'plate', 'rband', 'sband', 'kettlebell', 'bodyweight', 'cable', 'other'],
  default: 'barbell'
},

  videoUrl: {
    type: String,
    default: ''
  },
  gifUrl: {
    type: String,
    default: ''
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  instructions: [{
    type: String
  }],
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  isCustom: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Index for search
exerciseSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Exercise', exerciseSchema);

