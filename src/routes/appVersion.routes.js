const express = require('express');
const config = require('../config/environment');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    ios: {
      minimumVersion: config.IOS_MINIMUM_VERSION,
      latestVersion: config.IOS_LATEST_VERSION || config.IOS_MINIMUM_VERSION,
      storeUrl: config.IOS_STORE_URL,
      message: 'A new version of Get Fit is required to continue.',
    },
    android: {
      minimumVersion: config.ANDROID_MINIMUM_VERSION,
      latestVersion: config.ANDROID_LATEST_VERSION || config.ANDROID_MINIMUM_VERSION,
      storeUrl: config.ANDROID_STORE_URL,
      message: 'A new version of Get Fit is required to continue.',
    },
  });
});

module.exports = router;
