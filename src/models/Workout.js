const mongoose = require('mongoose');
const { MAX_SCHEDULE_DAYS, getScheduleDays } = require('../utils/constants');

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'warmup', 'warmdown'];

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
    scheduleDay: { type: Number, min: 1, default: 1 },
    notes: { type: String, trim: true }
}, { _id: false });

const workoutSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    duration: { type: String, trim: true }, // e.g., "4 weeks", "8 weeks"
    workoutsPerWeek: { type: String, trim: true }, // e.g., "3x per week"
    scheduleType: {
        type: String,
        default: '1-day',
        validate: {
            validator: value => getScheduleDays(value) !== null,
            message: `Schedule type must contain between 1 and ${MAX_SCHEDULE_DAYS} days`
        }
    },
    exercises: [workoutExerciseSchema],
    goals: [{ type: String, trim: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

workoutSchema.index({ difficulty: 1 });
workoutSchema.index({ isActive: 1 });

workoutSchema.pre('validate', function validateExerciseScheduleDays() {
    const scheduleDays = getScheduleDays(this.scheduleType);
    if (!scheduleDays) return;

    this.exercises.forEach((exercise, index) => {
        if (exercise.scheduleDay > scheduleDays) {
            this.invalidate(
                `exercises.${index}.scheduleDay`,
                `Exercise schedule day cannot be greater than ${scheduleDays}`
            );
        }
    });
});

module.exports = mongoose.model('Workout', workoutSchema);
