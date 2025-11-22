const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/ApiError');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
const profilesDir = path.join(uploadsDir, 'profiles');
const exercisesDir = path.join(uploadsDir, 'exercises');
const videosDir = path.join(uploadsDir, 'videos');
const imagesDir = path.join(uploadsDir, 'images');

[uploadsDir, profilesDir, exercisesDir, videosDir, imagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Disk storage configuration
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine destination based on field name or route
    if (file.fieldname === 'image' || file.fieldname === 'profilePicture') {
      cb(null, profilesDir);
    } else if (file.fieldname === 'videoUrl') {
      cb(null, videosDir);
    } else {
      // Default to images folder
      cb(null, imagesDir);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (allowed) => (req, file, cb) => {
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new ApiError('Invalid file type', 400));
};

// Uploader for images (profile pictures, general images)
const uploadImage = multer({
  storage: diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter(['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
});

// Uploader for videos
const uploadVideo = multer({
  storage: diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: fileFilter(['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'])
});

// Uploader for exercises (video only, optional)
const uploadExerciseMedia = multer({
  storage: diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: fileFilter([
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'
  ])
});

// General uploader for any file type (images or videos)
const uploadFile = multer({
  storage: diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: fileFilter([
    'image/jpeg', 'image/png', 'image/webp', 'image/jpg',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'
  ])
});

module.exports = { uploadImage, uploadVideo, uploadExerciseMedia, uploadFile };


