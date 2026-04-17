const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { auditAction } = require('../middleware/auditLog');
router.get('/product/:productId', reviewController.getProductReviews);
router.get('/my-reviews', verifyToken, requireRole('customer'), reviewController.getMyReviews);
router.post(
  '/',
  verifyToken,
  requireRole('customer'),
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
  ],
  validate,
  reviewController.createReview
);
router.put('/:id', verifyToken, requireRole('customer'), reviewController.updateReview);
router.delete('/:id', verifyToken, requireRole('customer'), reviewController.deleteReview);
router.get('/shop/reviews', verifyToken, requireRole('shop'), reviewController.getShopReviews);
router.post(
  '/:id/reply',
  verifyToken,
  requireRole('shop'),
  [
    body('reply').notEmpty().withMessage('Reply is required')
  ],
  validate,
  reviewController.replyToReview
);
router.get('/admin/all', verifyToken, requireRole('admin'), reviewController.getAllReviews);
router.get('/', verifyToken, requireRole('admin'), reviewController.getAllReviews);
router.patch('/:id/status', verifyToken, requireRole('admin'), auditAction('review.update_status', 'review'), reviewController.updateReviewStatus);
module.exports = router;
