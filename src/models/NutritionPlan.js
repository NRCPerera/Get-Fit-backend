const mongoose = require('mongoose');

const FOOD_NUTRIENTS = {
  calories: { type: Number, min: 0, default: 0 },
  protein: { type: Number, min: 0, default: 0 },
  carbs: { type: Number, min: 0, default: 0 },
  fats: { type: Number, min: 0, default: 0 }
};

const FoodSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },
  quantity: { type: Number, min: 0, default: 0 },
  unit: { type: String, trim: true },
  ...FOOD_NUTRIENTS
}, { _id: false });

const MealSchema = new mongoose.Schema({
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], required: true },
  name: { type: String, trim: true },
  time: { type: String, trim: true },
  foods: [FoodSchema],
  instructions: { type: String, trim: true }
}, { _id: false });

const nutritionPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  meals: [MealSchema],
  dailyCalories: { type: Number, min: 0 },
  dailyProtein: { type: Number, min: 0 },
  dailyCarbs: { type: Number, min: 0 },
  dailyFats: { type: Number, min: 0 },
  dietaryRestrictions: [{ type: String, trim: true }],
  startDate: { type: Date },
  endDate: { type: Date },
  notes: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Virtual total calories across all meals/foods
nutritionPlanSchema.virtual('totalCalories').get(function() {
  if (!this.meals || this.meals.length === 0) return 0;
  return this.meals.reduce((sumMeals, meal) => {
    const mealCalories = (meal.foods || []).reduce((sumFoods, food) => sumFoods + (food.calories || 0), 0);
    return sumMeals + mealCalories;
  }, 0);
});

module.exports = mongoose.model('NutritionPlan', nutritionPlanSchema);


