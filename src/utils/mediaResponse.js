const { normalizeCloudinaryAsset } = require('./cloudinaryAsset');

const getMediaUrl = (asset) => normalizeCloudinaryAsset(asset).secureUrl;

module.exports = {
  getMediaUrl,
};
