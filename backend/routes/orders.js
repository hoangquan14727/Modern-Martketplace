const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { ownsOrder } = require('../middleware/ownership');
const { validate } = require('../middleware/validator');
router.post(
  '/',
  verifyToken,
  requireRole('customer'),
  [
    body('shopId').isNumeric().withMessage('Shop ID is required'),
    body('addressId').isNumeric().withMessage('Address ID is required')
  ],
  validate,
  orderController.createOrder
);
router.post(
  '/checkout',
  verifyToken,
  requireRole('customer'),
  [
    body('items').isArray({ min: 1 }).withMessage('Items are required'),
    body('shippingAddress').notEmpty().withMessage('Shipping address is required')
  ],
  validate,
  orderController.createOrderDirect
);
router.get(
  '/my-orders',
  verifyToken,
  requireRole('customer'),
  orderController.getCustomerOrders
);
router.post(
  '/:id/cancel',
  verifyToken,
  requireRole('customer'),
  orderController.cancelOrder
);
router.get(
  '/shop/orders',
  verifyToken,
  requireRole('shop'),
  orderController.getShopOrders
);
router.patch(
  '/:id/status',
  verifyToken,
  requireRole('shop'),
  [
    body('status').isIn(['confirmed', 'processing', 'shipping', 'delivered', 'cancelled']).withMessage('Invalid status')
  ],
  validate,
  orderController.updateOrderStatus
);
router.get('/:id', verifyToken, ownsOrder, orderController.getOrder);
router.get('/:id/invoice', verifyToken, ownsOrder, orderController.downloadInvoice);
router.get(
  '/',
  verifyToken,
  requireRole('admin'),
  orderController.getAllOrders
);
router.get(
  '/:id/tracking',
  verifyToken,
  ownsOrder,
  orderController.getDetailedTracking
);
router.post(
  '/:id/tracking',
  verifyToken,
  requireRole('shop'),
  ownsOrder,
  [
    body('location').notEmpty().withMessage('Location is required'),
    body('description').notEmpty().withMessage('Description is required')
  ],
  validate,
  orderController.updateTrackingLocation
);
module.exports = router;
