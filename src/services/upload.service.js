const path = require('path');
const fs = require('fs');


const uploadsDir = path.join(__dirname, '../../uploads');


const uploadImage = async (file) => {
if (!file || !file.path) throw new Error('No file provided');
const relativePath = path.relative(uploadsDir, file.path).replace(/\\/g, '/');
return { path: relativePath };
};
const uploadVideo = uploadImage;


const deleteFile = async (filePath) => {
try {
if (!filePath) return true;
let relativePath = filePath;
if (filePath.includes('uploads/')) relativePath = filePath.split('uploads/')[1];
// strip leading slashes
relativePath = relativePath.replace(/^\\/,'').replace(/^\//,'');
const fullPath = path.join(uploadsDir, relativePath);
if (fs.existsSync(fullPath)) {
fs.unlinkSync(fullPath);
return true;
}
return true;
} catch (error) {
console.error('Error deleting file:', error);
return false;
}
};


module.exports = { uploadImage, uploadVideo, deleteFile };