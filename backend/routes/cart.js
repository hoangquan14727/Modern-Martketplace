const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
router.use(verifyToken, requireRole('customer', 'admin', 'shop'));
router.get('/', cartController.getCart);
router.post(
  '/items',
  [
    body('productId').isNumeric().withMessage('Product ID is required'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1')
  ],
  validate,
  cartController.addToCart
);
router.put(
  '/items/:id',
  [
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be 0 or greater')
  ],
  validate,
  cartController.updateCartItem
);
router.delete('/items/:id', cartController.removeCartItem);
router.delete('/', cartController.clearCart);
module.exports = router;
