const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken, requireRole, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { auditAction } = require('../middleware/auditLog');

// Image upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `product-${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowed.includes(ext));
}});
router.get('/', optionalAuth, productController.getProducts);
router.get('/shop/my-products', verifyToken, requireRole('shop'), productController.getShopProducts);
router.get('/admin/all', verifyToken, requireRole('admin'), productController.getAllProductsAdmin);
router.patch(
  '/:id/status',
  verifyToken,
  requireRole('admin'),
  [
    body('status').isIn(['approved', 'rejected']).withMessage('Invalid status')
  ],
  validate,
  auditAction('product.update_status', 'product'),
  productController.updateProductStatus
);
router.get('/:id', optionalAuth, productController.getProduct);
router.post(
  '/',
  verifyToken,
  requireRole('shop'),
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('price').isNumeric().withMessage('Price must be a number')
  ],
  validate,
  productController.createProduct
);
router.put(
  '/:id',
  verifyToken,
  requireRole('shop'),
  productController.updateProduct
);
router.delete(
  '/:id',
  verifyToken,
  requireRole('shop'),
  productController.deleteProduct
);
// Image upload endpoint
router.post('/upload-image', verifyToken, requireRole('shop'), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, data: { url: imageUrl } });
});
module.exports = router;
