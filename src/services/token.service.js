const jwt = require('jsonwebtoken');
const config = require('../config/environment');

const generateAccessToken = (userId, role) => jwt.sign({ id: userId, role }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRE || '15m' });
const generateRefreshToken = (userId) => jwt.sign({ id: userId }, config.JWT_REFRESH_SECRET, { expiresIn: config.JWT_REFRESH_EXPIRE || '7d' });
const verifyToken = (token, isRefresh = false) => jwt.verify(token, isRefresh ? config.JWT_REFRESH_SECRET : config.JWT_SECRET);
const generateEmailVerificationToken = (userId, email) => jwt.sign({ id: userId, email }, config.JWT_SECRET, { expiresIn: '24h' });

module.exports = { generateAccessToken, generateRefreshToken, verifyToken, generateEmailVerificationToken };


