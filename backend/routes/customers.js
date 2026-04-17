const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
router.get('/profile', verifyToken, requireRole('customer', 'admin', 'shop'), customerController.getProfile);
router.put('/profile', verifyToken, requireRole('customer', 'admin', 'shop'), customerController.updateProfile);
router.get('/addresses', verifyToken, requireRole('customer', 'admin', 'shop'), customerController.getAddresses);
router.post(
  '/addresses',
  verifyToken,
  requireRole('customer'),
  [
    body('recipientName').notEmpty().withMessage('Recipient name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('province').notEmpty().withMessage('Province is required'),
    body('district').notEmpty().withMessage('District is required'),
    body('ward').notEmpty().withMessage('Ward is required'),
    body('streetAddress').notEmpty().withMessage('Street address is required')
  ],
  validate,
  customerController.addAddress
);
router.put('/addresses/:id', verifyToken, requireRole('customer', 'admin', 'shop'), customerController.updateAddress);
router.delete('/addresses/:id', verifyToken, requireRole('customer', 'admin', 'shop'), customerController.deleteAddress);
router.get('/wishlist', verifyToken, requireRole('customer'), customerController.getWishlist);
router.post(
  '/wishlist',
  verifyToken,
  requireRole('customer'),
  [
    body('productId').isNumeric().withMessage('Product ID is required')
  ],
  validate,
  customerController.addToWishlist
);
router.delete('/wishlist/:productId', verifyToken, requireRole('customer'), customerController.removeFromWishlist);
router.get('/', verifyToken, requireRole('admin'), customerController.getAllCustomers);
router.patch('/:id/status', verifyToken, requireRole('admin'), customerController.updateCustomerStatus);
module.exports = router;
