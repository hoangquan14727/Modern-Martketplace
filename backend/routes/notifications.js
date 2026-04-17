const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
router.get('/', verifyToken, notificationController.getNotifications);
router.patch('/:id/read', verifyToken, notificationController.markAsRead);
router.patch('/read-all', verifyToken, notificationController.markAllAsRead);
router.delete('/:id', verifyToken, notificationController.deleteNotification);
router.post(
  '/send',
  verifyToken,
  requireRole('admin'),
  [
    body('userId').isNumeric().withMessage('User ID is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required')
  ],
  validate,
  notificationController.sendNotification
);
router.post(
  '/send-bulk',
  verifyToken,
  requireRole('admin'),
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required')
  ],
  validate,
  notificationController.sendBulkNotification
);
module.exports = router;
