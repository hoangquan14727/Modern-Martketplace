const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// Simple in-memory rate limiter
const loginAttempts = new Map();
function rateLimit(maxAttempts, windowMs) {
  return (req, res, next) => {
    const key = req.ip + ':' + (req.body?.email || '');
    const now = Date.now();
    const entry = loginAttempts.get(key);
    if (entry && entry.count >= maxAttempts && (now - entry.firstAttempt) < windowMs) {
      return res.status(429).json({ success: false, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' });
    }
    if (!entry || (now - entry.firstAttempt) >= windowMs) {
      loginAttempts.set(key, { count: 1, firstAttempt: now });
    } else {
      entry.count++;
    }
    next();
  };
}

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Mật khẩu phải ít nhất 8 ký tự')
      .matches(/[a-zA-Z]/).withMessage('Mật khẩu phải có ít nhất 1 chữ cái')
      .matches(/\d/).withMessage('Mật khẩu phải có ít nhất 1 chữ số'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required')
  ],
  validate,
  authController.register
);
router.post(
  '/register-shop',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Mật khẩu phải ít nhất 8 ký tự')
      .matches(/[a-zA-Z]/).withMessage('Mật khẩu phải có ít nhất 1 chữ cái')
      .matches(/\d/).withMessage('Mật khẩu phải có ít nhất 1 chữ số'),
    body('shopName').notEmpty().withMessage('Shop name is required')
  ],
  validate,
  authController.registerShop
);
router.post(
  '/login',
  rateLimit(10, 15 * 60 * 1000),
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validate,
  authController.login
);
router.get('/me', verifyToken, authController.getMe);
router.put(
  '/change-password',
  verifyToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Mật khẩu mới phải ít nhất 8 ký tự')
      .matches(/[a-zA-Z]/).withMessage('Mật khẩu phải có ít nhất 1 chữ cái')
      .matches(/\d/).withMessage('Mật khẩu phải có ít nhất 1 chữ số')
  ],
  validate,
  authController.changePassword
);
router.post(
  '/forgot-password',
  rateLimit(5, 60 * 60 * 1000),
  [
    body('email').isEmail().withMessage('Valid email is required')
  ],
  validate,
  authController.requestPasswordReset
);
router.get(
  '/verify-reset-token/:token',
  authController.verifyResetToken
);
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Mật khẩu mới phải ít nhất 8 ký tự')
      .matches(/[a-zA-Z]/).withMessage('Mật khẩu phải có ít nhất 1 chữ cái')
      .matches(/\d/).withMessage('Mật khẩu phải có ít nhất 1 chữ số')
  ],
  validate,
  authController.resetPassword
);
module.exports = router;
