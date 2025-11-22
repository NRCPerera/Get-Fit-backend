const mongoose = require('mongoose');

const MedicationSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },
  dosage: { type: String, trim: true },
  frequency: { type: String, trim: true }
}, { _id: false });

const EmergencyContactSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },
  phone: { type: String, trim: true, required: true, match: [/^\+?[\d\s\-\(\)]+$/, 'Invalid phone'] },
  relationship: { type: String, trim: true }
}, { _id: false });

const medicalFormSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  bloodType: { type: String, trim: true },
  allergies: [{ type: String, trim: true }],
  chronicDiseases: [{ type: String, trim: true }],
  injuries: [{ type: String, trim: true }],
  medications: [MedicationSchema],
  emergencyContact: EmergencyContactSchema,
  height: { type: Number, min: 0 },
  weight: { type: Number, min: 0 },
  fitnessGoals: [{ type: String, trim: true }],
  exerciseRestrictions: [{ type: String, trim: true }]
}, { timestamps: true });

module.exports = mongoose.model('MedicalForm', medicalFormSchema);


