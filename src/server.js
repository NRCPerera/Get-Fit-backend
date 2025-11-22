// Load environment variables first
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');
const config = require('./config/environment');
const logger = require('./utils/logger');
const { handleUnhandledRejection, handleUncaughtException } = require('./middlewares/error.middleware');

// Handle uncaught exceptions
handleUncaughtException();

// Handle unhandled promise rejections
handleUnhandledRejection();

// Connect to database
connectDB();

// Start server
const PORT = config.PORT || 5000;
// Listen on all interfaces (0.0.0.0) to allow connections from mobile devices on the same network
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
  logger.info(`Server accessible at http://localhost:${PORT}`);
  logger.info(`For mobile devices, use your computer's local IP address (e.g., http://192.168.1.100:${PORT})`);
});

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});
