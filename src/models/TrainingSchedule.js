const mongoose = require('mongoose');
const { SCHEDULE_TYPES } = require('../utils/constants');

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Schema for set-rep combinations (allows different sets for different reps)
const SetRepSchema = new mongoose.Schema({
  sets: { type: Number, min: 1, required: true },
  reps: { type: Number, min: 1, required: true }
}, { _id: false });

const ScheduleExerciseSchema = new mongoose.Schema({
  exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
  // Support both old format (single sets/reps) and new format (array of set-rep combinations)
  sets: { type: Number, min: 0 }, // Legacy support
  reps: { type: Number, min: 0 }, // Legacy support
  setReps: [SetRepSchema], // New format: array of {sets, reps} combinations
  duration: { type: Number, min: 0 },
  restTime: { type: Number, min: 0 },
  notes: { type: String, trim: true },
  dayOfWeek: { type: String, enum: DAYS }, // Legacy support for 1-day schedules
  scheduleDay: { type: Number, min: 1, max: 3 } // New format: 1, 2, or 3 for schedule days
}, { _id: false });

const trainingScheduleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  scheduleType: { type: String, enum: SCHEDULE_TYPES, default: '1-day' }, // 1-day, 2-day, or 3-day
  exercises: [ScheduleExerciseSchema],
  startDate: { type: Date },
  endDate: { type: Date },
  isTemplate: { type: Boolean, default: false },
  difficulty: { type: String, trim: true },
  goals: [{ type: String, trim: true }],
  notes: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Helper to autopopulate exercise details when querying schedules
function autoPopulateExercises(next) {
  this.populate({ path: 'exercises.exerciseId', model: 'Exercise' });
  next();
}

trainingScheduleSchema
  .pre('find', autoPopulateExercises)
  .pre('findOne', autoPopulateExercises)
  .pre('findById', autoPopulateExercises);

module.exports = mongoose.model('TrainingSchedule', trainingScheduleSchema);


