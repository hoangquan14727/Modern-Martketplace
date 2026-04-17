const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// Chat file upload config
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `chat-${uuidv4()}${ext}`);
  }
});
const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg', '.mp3', '.wav'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// In-memory rate limiter for message sending (per user)
const messageSendTimestamps = new Map();
const MESSAGE_RATE_LIMIT_MS = 1000; // minimum 1 second between messages
const MESSAGE_RATE_LIMIT_WINDOW = 60000; // 60 second window
const MESSAGE_RATE_LIMIT_MAX = 20; // max 20 messages per window

const messageRateLimiter = (req, res, next) => {
  const userId = req.user.id;
  const now = Date.now();
  if (!messageSendTimestamps.has(userId)) {
    messageSendTimestamps.set(userId, []);
  }
  const timestamps = messageSendTimestamps.get(userId);

  // Clean old timestamps outside the window
  const recentTimestamps = timestamps.filter(ts => now - ts < MESSAGE_RATE_LIMIT_WINDOW);
  messageSendTimestamps.set(userId, recentTimestamps);

  // Check minimum interval between messages
  if (recentTimestamps.length > 0 && now - recentTimestamps[recentTimestamps.length - 1] < MESSAGE_RATE_LIMIT_MS) {
    return res.status(429).json({
      success: false,
      message: 'You are sending messages too quickly. Please wait a moment.'
    });
  }

  // Check max messages in window
  if (recentTimestamps.length >= MESSAGE_RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      message: 'Message rate limit exceeded. Please wait before sending more messages.'
    });
  }

  recentTimestamps.push(now);
  next();
};

router.post(
  '/tickets',
  verifyToken,
  [
    body('subject').notEmpty().withMessage('Subject is required'),
    body('category').isIn(['order', 'payment', 'product', 'shipping', 'account', 'other']).withMessage('Invalid category'),
    body('message').notEmpty().withMessage('Message is required'),
    body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
    body('shopId').optional().isInt(),
    body('orderId').optional().isInt(),
    body('productId').optional().isInt().withMessage('productId must be an integer'),
    body('productName').optional().isString().isLength({ max: 255 }).withMessage('productName must be a string (max 255 chars)')
  ],
  validate,
  supportController.createTicket
);
router.get('/tickets', verifyToken, supportController.getUserTickets);
// Poll messages route — MUST be placed before /tickets/:id to avoid route conflicts
router.get('/tickets/:id/messages/poll', verifyToken, supportController.pollMessages);
router.get('/tickets/:id', verifyToken, supportController.getTicket);
router.post(
  '/tickets/:id/messages',
  verifyToken,
  messageRateLimiter,
  supportController.addMessage
);
router.post('/tickets/:id/close', verifyToken, supportController.closeTicket);
router.post(
  '/tickets/:id/rating',
  verifyToken,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
    body('comment').optional().isString()
  ],
  validate,
  supportController.rateTicket
);
router.get('/tickets/:id/typing', verifyToken, supportController.getTypingStatus);
router.post('/tickets/:id/typing', verifyToken, supportController.setTypingStatus);
router.post('/tickets/:id/upload', verifyToken, chatUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file provided or file type not allowed.' });
  res.json({
    success: true,
    data: {
      url: '/uploads/' + req.file.filename,
      type: req.file.mimetype,
      name: req.file.originalname,
      size: req.file.size
    }
  });
});
router.post('/tickets/:id/read', verifyToken, supportController.markAsRead);
router.get('/tickets/:id/read-status', verifyToken, supportController.getReadStatus);
router.get('/shop/tickets', verifyToken, requireRole('shop'), supportController.getShopTickets);
router.get('/shop/canned-responses', verifyToken, requireRole('shop'), supportController.getCannedResponses);
router.post(
  '/shop/canned-responses',
  verifyToken,
  requireRole('shop'),
  [
    body('category').isIn(['order', 'payment', 'product', 'shipping', 'account', 'other']).withMessage('Invalid category'),
    body('title').notEmpty().withMessage('Title is required'),
    body('response').notEmpty().withMessage('Response is required')
  ],
  validate,
  supportController.createCannedResponse
);
router.put(
  '/shop/canned-responses/:id',
  verifyToken,
  requireRole('shop'),
  supportController.updateCannedResponse
);
router.delete(
  '/shop/canned-responses/:id',
  verifyToken,
  requireRole('shop'),
  supportController.deleteCannedResponse
);
router.get('/canned-responses/:shopId', supportController.getShopCannedResponses);
router.get('/admin/tickets', verifyToken, requireRole('admin'), supportController.getAllTickets);
router.patch('/admin/tickets/:id', verifyToken, requireRole('admin'), supportController.updateTicket);
router.get('/admin/stats', verifyToken, requireRole('admin'), supportController.getSupportStats);
router.post('/admin/check-auto-close', verifyToken, requireRole('admin'), supportController.checkAutoClose);
module.exports = router;
