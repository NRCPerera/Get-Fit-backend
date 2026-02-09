const ApiError = require('../utils/ApiError');
const Workout = require('../models/Workout');
const logger = require('../utils/logger');

/**
 * Get all workouts with optional filters
 */
const getAllWorkouts = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 50,
            difficulty,
            isActive,
            q
        } = req.query;

        const filter = {};

        if (difficulty) {
            filter.difficulty = difficulty;
        }

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        if (q) {
            filter.$or = [
                { name: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [workouts, total] = await Promise.all([
            Workout.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Workout.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: {
                items: workouts,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        logger.error('Error getting workouts:', error);
        next(new ApiError(500, 'Failed to fetch workouts'));
    }
};

/**
 * Get active workouts for public display (mobile app)
 */
const getPublicWorkouts = async (req, res, next) => {
    try {
        const { difficulty } = req.query;

        const filter = { isActive: true };

        if (difficulty) {
            filter.difficulty = difficulty;
        }

        const workouts = await Workout.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        // Group workouts by difficulty for the mobile app
        const grouped = {
            beginner: workouts.filter(w => w.difficulty === 'beginner'),
            intermediate: workouts.filter(w => w.difficulty === 'intermediate'),
            advanced: workouts.filter(w => w.difficulty === 'advanced')
        };

        res.json({
            success: true,
            data: {
                items: workouts,
                grouped
            }
        });
    } catch (error) {
        logger.error('Error getting public workouts:', error);
        next(new ApiError(500, 'Failed to fetch workouts'));
    }
};

/**
 * Get workout by ID
 */
const getWorkoutById = async (req, res, next) => {
    try {
        const workout = await Workout.findById(req.params.id).lean();

        if (!workout) {
            return next(new ApiError(404, 'Workout not found'));
        }

        res.json({
            success: true,
            data: workout
        });
    } catch (error) {
        logger.error('Error getting workout:', error);
        next(new ApiError(500, 'Failed to fetch workout'));
    }
};

/**
 * Create a new workout
 */
const createWorkout = async (req, res, next) => {
    try {
        const {
            name,
            description,
            difficulty,
            duration,
            workoutsPerWeek,
            scheduleType,
            exercises,
            goals
        } = req.body;

        // Parse exercises and goals if they're strings (from form data)
        let parsedExercises = exercises;
        let parsedGoals = goals;

        if (typeof exercises === 'string') {
            try {
                parsedExercises = JSON.parse(exercises);
            } catch (e) {
                parsedExercises = [];
            }
        }

        if (typeof goals === 'string') {
            try {
                parsedGoals = JSON.parse(goals);
            } catch (e) {
                // If it's a comma-separated string
                parsedGoals = goals.split(',').map(g => g.trim()).filter(Boolean);
            }
        }

        const workout = new Workout({
            name,
            description,
            difficulty,
            duration,
            workoutsPerWeek,
            scheduleType: scheduleType || '1-day',
            exercises: parsedExercises || [],
            goals: parsedGoals || [],
            createdBy: req.user?._id,
            isActive: true
        });

        await workout.save();

        logger.info(`Workout created: ${workout.name} by user ${req.user?._id}`);

        res.status(201).json({
            success: true,
            message: 'Workout created successfully',
            data: workout
        });
    } catch (error) {
        logger.error('Error creating workout:', error);
        next(new ApiError(500, 'Failed to create workout'));
    }
};

/**
 * Update a workout
 */
const updateWorkout = async (req, res, next) => {
    try {
        const workout = await Workout.findById(req.params.id);

        if (!workout) {
            return next(new ApiError(404, 'Workout not found'));
        }

        const {
            name,
            description,
            difficulty,
            duration,
            workoutsPerWeek,
            scheduleType,
            exercises,
            goals,
            isActive
        } = req.body;

        // Parse exercises and goals if they're strings
        let parsedExercises = exercises;
        let parsedGoals = goals;

        if (typeof exercises === 'string') {
            try {
                parsedExercises = JSON.parse(exercises);
            } catch (e) {
                parsedExercises = workout.exercises;
            }
        }

        if (typeof goals === 'string') {
            try {
                parsedGoals = JSON.parse(goals);
            } catch (e) {
                parsedGoals = goals.split(',').map(g => g.trim()).filter(Boolean);
            }
        }

        // Update fields
        if (name !== undefined) workout.name = name;
        if (description !== undefined) workout.description = description;
        if (difficulty !== undefined) workout.difficulty = difficulty;
        if (duration !== undefined) workout.duration = duration;
        if (workoutsPerWeek !== undefined) workout.workoutsPerWeek = workoutsPerWeek;
        if (scheduleType !== undefined) workout.scheduleType = scheduleType;
        if (parsedExercises !== undefined) workout.exercises = parsedExercises;
        if (parsedGoals !== undefined) workout.goals = parsedGoals;
        if (isActive !== undefined) workout.isActive = isActive;

        await workout.save();

        logger.info(`Workout updated: ${workout.name}`);

        res.json({
            success: true,
            message: 'Workout updated successfully',
            data: workout
        });
    } catch (error) {
        logger.error('Error updating workout:', error);
        next(new ApiError(500, 'Failed to update workout'));
    }
};

/**
 * Delete a workout
 */
const deleteWorkout = async (req, res, next) => {
    try {
        const workout = await Workout.findByIdAndDelete(req.params.id);

        if (!workout) {
            return next(new ApiError(404, 'Workout not found'));
        }

        logger.info(`Workout deleted: ${workout.name}`);

        res.json({
            success: true,
            message: 'Workout deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting workout:', error);
        next(new ApiError(500, 'Failed to delete workout'));
    }
};

/**
 * Toggle workout active status
 */
const toggleWorkoutStatus = async (req, res, next) => {
    try {
        const { isActive } = req.body;

        const workout = await Workout.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true }
        );

        if (!workout) {
            return next(new ApiError(404, 'Workout not found'));
        }

        res.json({
            success: true,
            message: `Workout ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: workout
        });
    } catch (error) {
        logger.error('Error toggling workout status:', error);
        next(new ApiError(500, 'Failed to update workout status'));
    }
};

module.exports = {
    getAllWorkouts,
    getPublicWorkouts,
    getWorkoutById,
    createWorkout,
    updateWorkout,
    deleteWorkout,
    toggleWorkoutStatus
};
