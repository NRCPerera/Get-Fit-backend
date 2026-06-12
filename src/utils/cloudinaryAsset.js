const defaultCloudinaryAsset = () => ({ secureUrl: null, publicId: null });

/**
 * Normalize legacy media values into { secureUrl, publicId }.
 */
const normalizeCloudinaryAsset = (value) => {
  if (value == null) {
    return defaultCloudinaryAsset();
  }

  if (typeof value === 'string') {
    if (value.startsWith('/uploads/')) {
      return defaultCloudinaryAsset();
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return { secureUrl: value, publicId: null };
    }
    return defaultCloudinaryAsset();
  }

  if (typeof value === 'object') {
    const secureUrl = value.secureUrl || value.secure_url || null;
    const publicId = value.publicId || value.public_id || null;

    if (secureUrl && typeof secureUrl === 'string' && secureUrl.startsWith('/uploads/')) {
      return defaultCloudinaryAsset();
    }

    return {
      secureUrl: secureUrl || null,
      publicId: publicId || null,
    };
  }

  return defaultCloudinaryAsset();
};

const toCloudinaryUploadResult = (uploadResult) => {
  if (!uploadResult?.secure_url || !uploadResult?.public_id) {
    return null;
  }

  return {
    secureUrl: uploadResult.secure_url,
    publicId: uploadResult.public_id,
  };
};

const isMigratedCloudinaryAsset = (value) => (
  value
  && typeof value === 'object'
  && !Array.isArray(value)
  && ('secureUrl' in value || 'publicId' in value)
  && !('secure_url' in value)
  && !('public_id' in value)
);

module.exports = {
  defaultCloudinaryAsset,
  normalizeCloudinaryAsset,
  toCloudinaryUploadResult,
  isMigratedCloudinaryAsset,
};
