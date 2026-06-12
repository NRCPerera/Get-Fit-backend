const mongoose = require('mongoose');

const cloudinaryAssetSchema = new mongoose.Schema({
  secureUrl: { type: String, default: null },
  publicId: { type: String, default: null },
}, { _id: false });

const defaultCloudinaryAsset = () => ({ secureUrl: null, publicId: null });

module.exports = {
  cloudinaryAssetSchema,
  defaultCloudinaryAsset,
};
