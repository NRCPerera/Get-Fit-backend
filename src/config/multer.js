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
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});


// helper: get ext from filename
const ensureExt = (originalname, fallbackExt = '.bin') => {
const ext = path.extname(originalname);
return ext || fallbackExt;
};


// Disk storage configuration
const diskStorage = multer.diskStorage({
destination: (req, file, cb) => {
if (file.fieldname === 'image' || file.fieldname === 'profilePicture') {
cb(null, profilesDir);
} else if (file.fieldname === 'videoUrl') {
cb(null, videosDir);
} else {
cb(null, imagesDir);
}
},
filename: (req, file, cb) => {
const ext = ensureExt(file.originalname, path.extname(file.originalname));
const baseName = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-z0-9_-]/gi, '_');
const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
cb(null, `${baseName}-${uniqueSuffix}${ext}`);
}
});


// Allowed mime groups
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];


// Robust fileFilter: allow either correct mimetype OR extension-based fallback
const fileFilterFactory = (allowed) => (req, file, cb) => {
try {
const mimetype = (file.mimetype || '').toLowerCase();
const ext = path.extname(file.originalname || '').toLowerCase();


const extToMime = {
'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
'.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm'
};


const mimeFromExt = extToMime[ext];


if (allowed.includes(mimetype) || (mimeFromExt && allowed.includes(mimeFromExt))) return cb(null, true);
return cb(new ApiError('Invalid file type', 400));
} catch (err) {
return cb(new ApiError('Invalid file type', 400));
}
};


// Create multer instances (without binding to specific field names yet)
const baseImageUploader = multer({ storage: diskStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: fileFilterFactory(IMAGE_MIMES) });
const baseVideoUploader = multer({ storage: diskStorage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: fileFilterFactory(VIDEO_MIMES) });
const baseAnyUploader = multer({ storage: diskStorage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: fileFilterFactory([...IMAGE_MIMES, ...VIDEO_MIMES]) });


// Middleware wrappers you can use in routes
const uploadProfileSingle = baseImageUploader.single('profilePicture');
const uploadImageSingle = baseImageUploader.single('imageUrl');
const uploadVideoSingle = baseVideoUploader.single('videoUrl');
// Exercise uploader (video only, optional)
const uploadExerciseFields = baseVideoUploader.fields([
  { name: 'videoUrl', maxCount: 1 }
]);
const uploadAny = baseAnyUploader.any();


module.exports = {
uploadProfileSingle,
uploadImageSingle,
uploadVideoSingle,
uploadExerciseFields,
uploadAny
};