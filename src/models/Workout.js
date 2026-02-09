const mongoose = require('mongoose');

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const SCHEDULE_TYPES = ['1-day', '2-day', '3-day'];

const exerciseSetRepSchema = new mongoose.Schema({
    sets: { type: String, required: true },
    reps: { type: String, required: true }
}, { _id: false });

const workoutExerciseSchema = new mongoose.Schema({
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
    exerciseName: { type: String, required: true, trim: true },
    setReps: [exerciseSetRepSchema],
    duration: { type: Number, min: 0 },
    restTime: { type: Number, min: 0, default: 60 },
    scheduleDay: { type: Number, min: 1, max: 3, default: 1 },
    notes: { type: String, trim: true }
}, { _id: false });

const workoutSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    duration: { type: String, trim: true }, // e.g., "4 weeks", "8 weeks"
    workoutsPerWeek: { type: String, trim: true }, // e.g., "3x per week"
    scheduleType: { type: String, enum: SCHEDULE_TYPES, default: '1-day' },
    exercises: [workoutExerciseSchema],
    goals: [{ type: String, trim: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

workoutSchema.index({ difficulty: 1 });
workoutSchema.index({ isActive: 1 });

module.exports = mongoose.model('Workout', workoutSchema);
