const mongoose = require('mongoose');
const { MAX_SCHEDULE_DAYS, getScheduleDays } = require('../utils/constants');

const SetRepSchema = new mongoose.Schema({
  sets: { type: Number, min: 1, required: true },
  reps: { type: Number, min: 1, required: true },
}, { _id: false });

const ScheduleExerciseSchema = new mongoose.Schema({
  exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
  setReps: {
    type: [SetRepSchema],
    default: [],
  },
  duration: { type: Number, min: 0 },
  restTime: { type: Number, min: 0 },
  notes: { type: String, trim: true },
  scheduleDay: { type: Number, min: 1 },
}, { _id: false });

const trainingScheduleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  scheduleType: {
    type: String,
    default: '1-day',
    validate: {
      validator: value => getScheduleDays(value) !== null,
      message: `Schedule type must contain between 1 and ${MAX_SCHEDULE_DAYS} days`,
    },
  },
  exercises: [ScheduleExerciseSchema],
  startDate: { type: Date },
  endDate: { type: Date },
  isTemplate: { type: Boolean, default: false },
  difficulty: { type: String, trim: true },
  goals: [{ type: String, trim: true }],
  notes: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

trainingScheduleSchema.pre('validate', function validateExerciseScheduleDays() {
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

module.exports = mongoose.model('TrainingSchedule', trainingScheduleSchema);
