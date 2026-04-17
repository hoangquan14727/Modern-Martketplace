const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const promotionController = require('../controllers/promotionController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
router.get('/active', promotionController.getActivePromotions);
router.post(
  '/validate-coupon',
  verifyToken,
  [
    body('code').notEmpty().withMessage('Coupon code is required'),
    body('shopId').optional({ nullable: true }).isNumeric().withMessage('Shop ID must be numeric'),
    body('orderAmount').optional({ nullable: true }).isNumeric().withMessage('Order amount must be numeric')
  ],
  validate,
  promotionController.validateCoupon
);
router.get('/shop/promotions', verifyToken, requireRole('shop'), promotionController.getShopPromotions);
router.post(
  '/shop/promotions',
  verifyToken,
  requireRole('shop'),
  [
    body('name').notEmpty().withMessage('Promotion name is required'),
    body('type').isIn(['percentage', 'fixed_amount', 'buy_x_get_y', 'free_shipping']).withMessage('Invalid promotion type'),
    body('value').isNumeric().withMessage('Value is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required')
  ],
  validate,
  promotionController.createPromotion
);
router.put('/shop/promotions/:id', verifyToken, requireRole('shop'), promotionController.updatePromotion);
router.delete('/shop/promotions/:id', verifyToken, requireRole('shop'), promotionController.deletePromotion);
router.get('/', verifyToken, requireRole('admin'), promotionController.getAllPromotions);
router.post(
  '/system',
  verifyToken,
  requireRole('admin'),
  [
    body('name').notEmpty().withMessage('Promotion name is required'),
    body('type').isIn(['percentage', 'fixed_amount', 'buy_x_get_y', 'free_shipping']).withMessage('Invalid promotion type'),
    body('value').isNumeric().withMessage('Value is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required')
  ],
  validate,
  promotionController.createSystemPromotion
);
router.put('/system/:id', verifyToken, requireRole('admin'), promotionController.updateSystemPromotion);
router.delete('/system/:id', verifyToken, requireRole('admin'), promotionController.deleteSystemPromotion);
module.exports = router;
