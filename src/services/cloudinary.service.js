const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const config = require('../config/environment');
const logger = require('../utils/logger');

// Initialize Cloudinary
if (config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
  });
  logger.info('Cloudinary initialized successfully');
} else {
  logger.warn('Cloudinary credentials not configured. File uploads will fail.');
}

/**
 * Convert buffer to stream for Cloudinary upload
 */
const bufferToStream = (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid buffer provided');
  }
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
};

/**
 * Upload file to Cloudinary
 * @param {Object} file - Multer file object (from req.file or req.files[0])
 * @param {Object} options - Cloudinary upload options
 * @param {string} options.folder - Folder path in Cloudinary
 * @param {string} options.resource_type - 'image', 'video', or 'auto'
 * @param {string} options.public_id - Custom public ID (optional)
 * @returns {Promise<Object>} - { secure_url, public_id, url }
 */
const uploadToCloudinary = async (file, options = {}) => {
  if (!file || !file.buffer) {
    throw new Error('Invalid file: file buffer is required');
  }

  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
  }

  const {
    folder = 'gym-management',
    resource_type = 'auto', // 'auto' automatically detects image or video
    public_id = null,
    transformation = [],
    ...otherOptions
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Validate buffer
      if (!Buffer.isBuffer(file.buffer)) {
        throw new Error('File buffer is not a valid Buffer');
      }

      if (file.buffer.length === 0) {
        throw new Error('File buffer is empty');
      }

      logger.debug('Starting Cloudinary upload', {
        bufferSize: file.buffer.length,
        folder,
        resource_type,
        mimetype: file.mimetype,
        originalname: file.originalname
      });

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type,
          public_id,
          transformation,
          ...otherOptions
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload error:', {
              error: error.message,
              http_code: error.http_code,
              name: error.name
            });
            reject(new Error(`Cloudinary upload failed: ${error.message || 'Unknown error'}`));
          } else if (!result || !result.secure_url || !result.public_id) {
            logger.error('Cloudinary upload returned invalid result:', result);
            reject(new Error('Cloudinary upload succeeded but returned invalid data'));
          } else {
            logger.info('File uploaded successfully to Cloudinary', {
              public_id: result.public_id,
              resource_type: result.resource_type,
              bytes: result.bytes
            });
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
              url: result.url,
              resource_type: result.resource_type,
              width: result.width,
              height: result.height,
              bytes: result.bytes,
              format: result.format
            });
          }
        }
      );

      // Handle stream errors
      uploadStream.on('error', (streamError) => {
        logger.error('Cloudinary upload stream error:', streamError);
        reject(new Error(`Upload stream failed: ${streamError.message}`));
      });

      // Convert buffer to stream and pipe to Cloudinary
      const bufferStream = bufferToStream(file.buffer);
      bufferStream.on('error', (streamError) => {
        logger.error('Buffer stream error:', streamError);
        reject(new Error(`Buffer stream failed: ${streamError.message}`));
      });
      
      bufferStream.pipe(uploadStream);
    } catch (error) {
      logger.error('Error setting up Cloudinary upload:', error);
      reject(error);
    }
  });
};

/**
 * Delete file from Cloudinary
 * @param {string} public_id - Cloudinary public ID
 * @param {Object} options - Cloudinary delete options
 * @param {string} options.resource_type - 'image', 'video', or 'raw'
 * @returns {Promise<Object>} - Cloudinary deletion result
 */
const deleteFromCloudinary = async (public_id, options = {}) => {
  if (!public_id) {
    logger.warn('No public_id provided for deletion');
    return { result: 'not_found' };
  }

  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
    logger.warn('Cloudinary not configured. Cannot delete file.');
    return { result: 'error', error: 'Cloudinary not configured' };
  }

  try {
    const { resource_type = 'auto' } = options;
    
    // If public_id contains folder path, extract just the public_id
    const cleanPublicId = public_id.includes('/') 
      ? public_id.split('/').pop().split('.')[0] 
      : public_id.split('.')[0];

    const result = await cloudinary.uploader.destroy(cleanPublicId, {
      resource_type,
      invalidate: true // Invalidate CDN cache
    });

    if (result.result === 'ok') {
      logger.info(`File deleted from Cloudinary: ${cleanPublicId}`);
    } else {
      logger.warn(`Cloudinary deletion result: ${result.result} for ${cleanPublicId}`);
    }

    return result;
  } catch (error) {
    logger.error('Cloudinary deletion error:', error);
    return { result: 'error', error: error.message };
  }
};

/**
 * Upload image to Cloudinary
 * @param {Object} file - Multer file object
 * @param {string} folder - Folder path in Cloudinary (default: 'gym-management/images')
 * @returns {Promise<Object>} - { secure_url, public_id }
 */
const uploadImage = async (file, folder = 'gym-management/images') => {
  return uploadToCloudinary(file, {
    folder,
    resource_type: 'image',
    transformation: [
      { quality: 'auto:good' },
      { fetch_format: 'auto' }
    ]
  });
};

/**
 * Upload video to Cloudinary
 * @param {Object} file - Multer file object
 * @param {string} folder - Folder path in Cloudinary (default: 'gym-management/videos')
 * @returns {Promise<Object>} - { secure_url, public_id }
 */
const uploadVideo = async (file, folder = 'gym-management/videos') => {
  return uploadToCloudinary(file, {
    folder,
    resource_type: 'video',
    transformation: [
      { quality: 'auto:good' },
      { fetch_format: 'auto' }
    ]
  });
};

/**
 * Upload file with auto-detection (image or video)
 * @param {Object} file - Multer file object
 * @param {string} folder - Folder path in Cloudinary
 * @returns {Promise<Object>} - { secure_url, public_id }
 */
const uploadFile = async (file, folder = 'gym-management') => {
  return uploadToCloudinary(file, {
    folder,
    resource_type: 'auto' // Automatically detects image or video
  });
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadImage,
  uploadVideo,
  uploadFile
};

