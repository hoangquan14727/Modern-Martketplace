const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
router.get('/', categoryController.getCategories);
router.get('/tree', categoryController.getCategoryTree);
router.get('/:id', categoryController.getCategory);
router.post(
  '/',
  verifyToken,
  requireRole('admin'),
  [
    body('name').notEmpty().withMessage('Category name is required')
  ],
  validate,
  categoryController.createCategory
);
router.put(
  '/:id',
  verifyToken,
  requireRole('admin'),
  categoryController.updateCategory
);
router.delete(
  '/:id',
  verifyToken,
  requireRole('admin'),
  categoryController.deleteCategory
);
module.exports = router;
