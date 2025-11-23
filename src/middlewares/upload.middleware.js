const multer = require('multer');
const ApiError = require('../utils/ApiError');

// Memory storage for Cloudinary (files are stored in memory as buffers, not on disk)
const memoryStorage = multer.memoryStorage();

// File filter factory
const fileFilter = (allowedMimeTypes) => (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }
  cb(new ApiError(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`, 400));
};

// Allowed MIME types
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg'];
const ALL_MEDIA_MIME_TYPES = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES];

// Uploader for images (profile pictures, general images)
const uploadImage = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter(IMAGE_MIME_TYPES)
});

// Uploader for videos
const uploadVideo = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB (increased for video)
  fileFilter: fileFilter(VIDEO_MIME_TYPES)
});

// Uploader for exercises (video only)
const uploadExerciseMedia = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: fileFilter(VIDEO_MIME_TYPES)
});

// General uploader for any file type (images or videos) - uses auto-detection
const uploadFile = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: fileFilter(ALL_MEDIA_MIME_TYPES)
});

module.exports = { uploadImage, uploadVideo, uploadExerciseMedia, uploadFile };


