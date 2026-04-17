const jwt = require('jsonwebtoken');
const db = require('../config/database');
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET must be set in production.');
    process.exit(1);
  }
  if (!global.__jwtSecret) {
    global.__jwtSecret = require('crypto').randomBytes(64).toString('hex');
    console.warn('WARN: JWT_SECRET missing — using ephemeral dev secret. Tokens invalidate on restart.');
  }
}
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || global.__jwtSecret;
    const decoded = jwt.verify(token, secret);
    const user = db.prepare(
      'SELECT id, email, role, status FROM users WHERE id = ?'
    ).get(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active.'
      });
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this resource.'
      });
    }
    next();
  };
};
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required.'
      });
    }
    try {
      const admin = db.prepare(`
        SELECT permissions 
        FROM admins 
        JOIN users ON admins.user_id = users.id 
        WHERE users.id = ?
      `).get(req.user.id);
      if (!admin || !admin.permissions) {
        return res.status(403).json({
          success: false,
          message: 'No permissions assigned to this admin.'
        });
      }
      const permissions = JSON.parse(admin.permissions);
      if (!permissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          message: `Missing required permission: ${permission}`
        });
      }
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions.'
      });
    }
  };
};
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || global.__jwtSecret;
    const decoded = jwt.verify(token, secret);
    const user = db.prepare(
      'SELECT id, email, role, status FROM users WHERE id = ?'
    ).get(decoded.userId);
    if (user && user.status === 'active') {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role
      };
    }
    next();
  } catch (error) {
    next();
  }
};
module.exports = { verifyToken, requireRole, requirePermission, optionalAuth };
