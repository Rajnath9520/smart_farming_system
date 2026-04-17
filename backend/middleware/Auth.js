const { auth } = require('../config/firebase');
const User = require('../models/User');
const { sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');


const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'No token provided. Authorization denied.', 401);
    }

    const token = authHeader.split(' ')[1];


    const decodedToken = await auth().verifyIdToken(token);
    req.firebaseUid = decodedToken.uid;
    req.firebaseUser = decodedToken;

    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      return sendError(res, 'User not found. Please register first.', 404);
    }

    if (!user.isActive) {
      return sendError(res, 'Account is deactivated. Contact support.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    if (error.code === 'auth/id-token-expired') {
      return sendError(res, 'Session expired. Please login again.', 401);
    }
    if (error.code === 'auth/argument-error') {
      return sendError(res, 'Invalid token format.', 401);
    }
    return sendError(res, 'Authentication failed.', 401);
  }
};


const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return sendError(res, 'Access denied. Admin privileges required.', 403);
  }
  next();
};


const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    const decodedToken = await auth().verifyIdToken(token);
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (user) req.user = user;
    next();
  } catch {
    next();
  }
};

module.exports = { protect, adminOnly, optionalAuth };